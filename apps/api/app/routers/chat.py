"""Chat endpoint.

Flow per user message:
  1. Persist user message
  2. Run safety classifier
     - If unsafe: persist a synthetic assistant message containing the
       escalation copy, return it (no AI call), HALT here.
  3. Otherwise: load recent history, run Behavioral agent (with RAG),
     stream tokens back as SSE, persist final assistant message + citations.
"""

from __future__ import annotations

import json
import logging
import uuid
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.agents.behavioral import run_behavioral_turn
from app.config import get_settings
from app.db import get_db
from app.models import ChatMessage, ChatSession, MessageRole, User
from app.safety import classify, escalation_text
from app.schemas import ChatMessagePublic, ChatRequest, ChatSessionPublic, Citation
from app.security import current_user

log = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["chat"])

# Keep last N messages of context
HISTORY_LIMIT = 16


def _oai() -> AsyncOpenAI:
    return AsyncOpenAI(api_key=get_settings().openai_api_key)


@router.get("/sessions", response_model=list[ChatSessionPublic])
async def list_sessions(
    user: Annotated[User, Depends(current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[ChatSession]:
    rows = await db.scalars(
        select(ChatSession).where(ChatSession.user_id == user.id).order_by(ChatSession.created_at.desc())
    )
    return list(rows)


@router.get("/sessions/{session_id}/messages", response_model=list[ChatMessagePublic])
async def list_messages(
    session_id: uuid.UUID,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[ChatMessagePublic]:
    session = await db.scalar(
        select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user.id)
    )
    if not session:
        raise HTTPException(404, "Session not found")
    rows = await db.scalars(
        select(ChatMessage).where(ChatMessage.session_id == session.id).order_by(ChatMessage.created_at)
    )
    out: list[ChatMessagePublic] = []
    for m in rows:
        cits = (
            [Citation(**c) for c in m.citations] if m.citations else None
        )
        out.append(
            ChatMessagePublic(
                id=m.id,
                role=m.role.value,  # type: ignore[arg-type]
                content=m.content,
                citations=cits,
                safety_flag=m.safety_flag,
                created_at=m.created_at,
            )
        )
    return out


async def _get_or_create_session(
    db: AsyncSession, user: User, session_id: uuid.UUID | None, first_message: str
) -> ChatSession:
    if session_id is not None:
        session = await db.scalar(
            select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user.id)
        )
        if not session:
            raise HTTPException(404, "Session not found")
        return session
    title = first_message[:60] + ("…" if len(first_message) > 60 else "")
    session = ChatSession(user_id=user.id, title=title or "New conversation")
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


async def _load_history(db: AsyncSession, session_id: uuid.UUID) -> list[dict[str, str]]:
    rows = await db.scalars(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(HISTORY_LIMIT)
    )
    msgs = list(rows)
    msgs.reverse()
    return [{"role": m.role.value, "content": m.content} for m in msgs]


def _sse(event: str, data: dict | str) -> bytes:
    payload = data if isinstance(data, str) else json.dumps(data, ensure_ascii=False)
    return f"event: {event}\ndata: {payload}\n\n".encode()


@router.post("")
async def post_chat(
    payload: ChatRequest,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> StreamingResponse:
    """Stream a chat turn over Server-Sent Events.

    Events:
      session  → {"id": "<uuid>"} (sent first)
      token    → {"text": "..."} (zero or more)
      citations→ [{source, snippet, score}, ...] (once, after retrieval)
      safety   → {"category": "...", "message": "..."} (terminal, instead of tokens)
      done     → {"message_id": "<uuid>"} (terminal on success)
      error    → {"detail": "..."}
    """
    session = await _get_or_create_session(db, user, payload.session_id, payload.message)

    # Persist the user message first.
    user_msg = ChatMessage(
        session_id=session.id, role=MessageRole.user, content=payload.message
    )
    db.add(user_msg)
    await db.commit()

    locale = user.locale.value
    oai = _oai()

    # Safety check (await before opening the stream so we can return cleanly).
    safety = await classify(oai, payload.message)
    if not safety.safe:
        msg = escalation_text(safety.category, locale)
        assistant = ChatMessage(
            session_id=session.id,
            role=MessageRole.assistant,
            content=msg,
            safety_flag=safety.category,
        )
        db.add(assistant)
        await db.commit()
        await db.refresh(assistant)

        async def safety_stream() -> AsyncIterator[bytes]:
            yield _sse("session", {"id": str(session.id)})
            yield _sse("safety", {"category": safety.category, "message": msg})
            yield _sse("done", {"message_id": str(assistant.id)})

        return StreamingResponse(safety_stream(), media_type="text/event-stream")

    # Run the agent.
    history = await _load_history(db, session.id)
    # _load_history includes the just-added user message; drop the trailing user turn
    # because run_behavioral_turn re-appends it.
    if history and history[-1]["role"] == "user":
        history = history[:-1]

    turn = await run_behavioral_turn(
        oai=oai, user_message=payload.message, history=history, locale=locale, use_rag=True
    )

    citations_payload = [
        {"source": c.title, "snippet": c.text[:280], "score": round(c.score, 4)}
        for c in turn.citations
    ]

    async def main_stream() -> AsyncIterator[bytes]:
        yield _sse("session", {"id": str(session.id)})
        if citations_payload:
            yield _sse("citations", citations_payload)

        full_text_parts: list[str] = []
        try:
            async for piece in turn.text_stream:
                full_text_parts.append(piece)
                yield _sse("token", {"text": piece})
        except Exception as exc:  # noqa: BLE001
            log.exception("Stream failed mid-flight")
            yield _sse("error", {"detail": str(exc)})
            return

        full_text = "".join(full_text_parts).strip()
        # Persist the assistant message in a fresh session because the dependency-injected
        # one is closed by the time the generator finishes streaming.
        from app.db import SessionLocal  # local import to avoid cycles

        async with SessionLocal() as fresh:
            assistant = ChatMessage(
                session_id=session.id,
                role=MessageRole.assistant,
                content=full_text,
                citations=citations_payload or None,
            )
            fresh.add(assistant)
            await fresh.commit()
            await fresh.refresh(assistant)
            yield _sse("done", {"message_id": str(assistant.id)})

    return StreamingResponse(main_stream(), media_type="text/event-stream")
