"""Admin endpoints — gated by ADMIN_EMAIL env var."""

from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.config import get_settings
from app.db import get_db
from app.models import IngestedDocument, User
from app.rag import ingest_pdf
from app.schemas import IngestedDocPublic, IngestResponse
from app.security import current_admin

router = APIRouter(prefix="/admin", tags=["admin"])


def _oai() -> AsyncOpenAI:
    return AsyncOpenAI(api_key=get_settings().openai_api_key)


@router.post("/ingest", response_model=IngestResponse)
async def ingest_document(
    admin: Annotated[User, Depends(current_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(...),
    title: str = Form(...),
    source: str = Form(...),
    category: str | None = Form(None),
) -> IngestResponse:
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only .pdf files are supported")

    pdf_bytes = await file.read()
    if len(pdf_bytes) > 25 * 1024 * 1024:
        raise HTTPException(413, "File too large (max 25 MB)")

    try:
        result = await ingest_pdf(
            oai=_oai(),
            pdf_bytes=pdf_bytes,
            title=title,
            source=source,
            category=category,
        )
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc

    record = IngestedDocument(
        id=result.document_id,
        title=title,
        source=source,
        category=category,
        chunk_count=result.chunks,
        uploaded_by=admin.id,
    )
    db.add(record)
    await db.commit()

    return IngestResponse(document_id=result.document_id, title=title, chunks=result.chunks)


@router.get("/documents", response_model=list[IngestedDocPublic])
async def list_documents(
    _: Annotated[User, Depends(current_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[IngestedDocument]:
    rows = await db.scalars(
        select(IngestedDocument).order_by(IngestedDocument.created_at.desc())
    )
    return list(rows)
