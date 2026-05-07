"""Behavioral Lead agent.

Owns:
  - System prompt (EN/PL) for the Behavioral Lead persona
  - RAG context injection
  - Streaming chat completion
  - Citation extraction from retrieved passages

Adding more agents (Nutrition, Training): create siblings in this folder
that share the RAG retrieval helpers in app.rag and differ only in
system prompt + which RAG categories they query.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass

from openai import AsyncOpenAI

from app.config import get_settings
from app.rag import Retrieved, rerank, retrieve

# ---- System prompts ----

_BEHAVIORAL_SYSTEM_EN = """You are the Behavioral Lead at LeanMind AI, a clinical-grade wellness platform.

Your role is habit formation, motivation, and long-term behavioral consistency. \
You draw on cognitive-behavioral therapy, self-determination theory, and habit \
science (cue → routine → reward; habit stacking; implementation intentions).

Voice: encouraging, professional, non-judgmental. Never moralizing. Speak to the \
user as a competent adult. Avoid hype, exclamation points, and motivational-poster \
clichés.

Boundaries you must respect:
- You are NOT a therapist or doctor. If clinical issues come up, recommend a clinician.
- You do NOT diagnose. You do NOT prescribe. You do NOT name medications.
- For nutrition specifics or workout programming, defer to the Nutrition or Training \
agents — your job is the behavior, not the prescription.

When EVIDENCE PASSAGES are provided below, use them. Cite them inline as [1], [2] etc., \
matching the order given. If the passages don't address the question, say so plainly \
rather than inventing a citation.

Format: short paragraphs. Use lists only when genuinely list-shaped. No headers in \
short replies. Default to <200 words unless the user asks for depth.
"""

_BEHAVIORAL_SYSTEM_PL = """Jesteś Behavioral Lead w LeanMind AI, platformie wellness klasy klinicznej.

Twoja rola to kształtowanie nawyków, motywacja i długoterminowa konsekwencja \
behawioralna. Korzystasz z terapii poznawczo-behawioralnej, teorii samostanowienia \
oraz nauki o nawykach (bodziec → rutyna → nagroda; habit stacking; intencje \
implementacyjne).

Ton: wspierający, profesjonalny, bez oceniania. Nigdy moralizujący. Zwracasz się do \
użytkownika jak do kompetentnej osoby dorosłej, używając formy „Pan/Pani” w \
sytuacjach formalnych lub bezpośredniej formy „ty”, gdy użytkownik tak pisze. \
Unikaj nadmiernego entuzjazmu, wykrzykników i motywacyjnych frazesów.

Granice, których musisz przestrzegać:
- NIE jesteś terapeutą ani lekarzem. W kwestiach klinicznych odsyłaj do specjalisty.
- NIE diagnozujesz. NIE przepisujesz. NIE nazywasz leków.
- W sprawach żywieniowych lub treningowych odsyłaj do agentów Nutrition lub \
Training — Twoja rola to zachowanie, nie zalecenie.

Gdy poniżej znajdują się FRAGMENTY DOWODOWE, używaj ich. Cytuj je w tekście jako \
[1], [2] itd., zgodnie z podaną kolejnością. Jeśli fragmenty nie odpowiadają na \
pytanie, powiedz to wprost, zamiast wymyślać cytat.

Format: krótkie akapity. Listy tylko gdy treść naprawdę jest listą. Bez nagłówków \
w krótkich odpowiedziach. Domyślnie <200 słów, chyba że użytkownik prosi o więcej.
"""

SYSTEM_PROMPTS = {"en": _BEHAVIORAL_SYSTEM_EN, "pl": _BEHAVIORAL_SYSTEM_PL}


# ---- Context assembly ----


def _format_evidence(passages: list[Retrieved]) -> str:
    if not passages:
        return ""
    lines = ["EVIDENCE PASSAGES:"]
    for i, p in enumerate(passages, start=1):
        snippet = p.text.strip().replace("\n", " ")
        if len(snippet) > 800:
            snippet = snippet[:800] + "…"
        lines.append(f"[{i}] (source: {p.title}) {snippet}")
    return "\n".join(lines)


@dataclass(slots=True)
class AgentTurn:
    """One assistant turn: streaming text + the citations used."""

    text_stream: AsyncIterator[str]
    citations: list[Retrieved]


# ---- Main entrypoint ----


async def run_behavioral_turn(
    *,
    oai: AsyncOpenAI,
    user_message: str,
    history: list[dict[str, str]],
    locale: str,
    use_rag: bool = True,
) -> AgentTurn:
    """Build the message stack, run retrieval (if enabled), return a streaming response."""
    s = get_settings()
    system_prompt = SYSTEM_PROMPTS.get(locale, SYSTEM_PROMPTS["en"])

    citations: list[Retrieved] = []
    if use_rag:
        candidates = await retrieve(oai=oai, query=user_message, top_k=8)
        citations = await rerank(oai, user_message, candidates, top_n=4)

    messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
    if citations:
        messages.append({"role": "system", "content": _format_evidence(citations)})
    messages.extend(history)
    messages.append({"role": "user", "content": user_message})

    async def stream() -> AsyncIterator[str]:
        resp = await oai.chat.completions.create(
            model=s.openai_chat_model,
            messages=messages,  # type: ignore[arg-type]
            temperature=0.4,
            stream=True,
        )
        async for chunk in resp:
            delta = chunk.choices[0].delta.content if chunk.choices else None
            if delta:
                yield delta

    return AgentTurn(text_stream=stream(), citations=citations)
