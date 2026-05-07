"""Retrieval-Augmented Generation pipeline.

Pipeline:
    PDF → text → cleaned chunks → embeddings → Qdrant
                                                  ↓
                              query → embedding → top-K → rerank → context

Reranking here is a lightweight cross-encoder via OpenAI: we score each
candidate chunk's relevance to the query with a small completion. For a
true production setup, swap in Cohere Rerank or a local bge-reranker.
"""

from __future__ import annotations

import logging
import re
import uuid
from dataclasses import dataclass

import tiktoken
from openai import AsyncOpenAI
from pypdf import PdfReader
from qdrant_client import AsyncQdrantClient
from qdrant_client.http import models as qmodels

from app.config import get_settings

log = logging.getLogger(__name__)

# Embedding model dimensions for text-embedding-3-small
EMBEDDING_DIM = 1536

# Chunk sizing, in tokens
CHUNK_TOKENS = 500
CHUNK_OVERLAP = 75


# ---------- Qdrant client (singleton-ish) ----------


_qdrant_client: AsyncQdrantClient | None = None


def get_qdrant() -> AsyncQdrantClient:
    global _qdrant_client
    if _qdrant_client is None:
        s = get_settings()
        _qdrant_client = AsyncQdrantClient(url=s.qdrant_url, api_key=s.qdrant_api_key or None)
    return _qdrant_client


async def ensure_collection() -> None:
    client = get_qdrant()
    s = get_settings()
    collections = await client.get_collections()
    names = {c.name for c in collections.collections}
    if s.qdrant_collection in names:
        return
    await client.create_collection(
        collection_name=s.qdrant_collection,
        vectors_config=qmodels.VectorParams(size=EMBEDDING_DIM, distance=qmodels.Distance.COSINE),
    )
    log.info("Created Qdrant collection %s", s.qdrant_collection)


# ---------- Text extraction & chunking ----------


_WHITESPACE = re.compile(r"\s+")


def extract_pdf_text(pdf_bytes: bytes) -> str:
    """Extract text from a PDF byte stream. Returns one long string."""
    import io

    reader = PdfReader(io.BytesIO(pdf_bytes))
    parts: list[str] = []
    for page in reader.pages:
        try:
            t = page.extract_text() or ""
        except Exception as exc:  # noqa: BLE001
            log.warning("PDF page extract failed: %s", exc)
            continue
        if t.strip():
            parts.append(t)
    return "\n\n".join(parts)


def _clean(text: str) -> str:
    text = text.replace("\x00", " ")
    text = _WHITESPACE.sub(" ", text)
    return text.strip()


def chunk_text(text: str, chunk_tokens: int = CHUNK_TOKENS, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Token-aware chunking using tiktoken's cl100k_base encoder."""
    text = _clean(text)
    if not text:
        return []

    enc = tiktoken.get_encoding("cl100k_base")
    tokens = enc.encode(text)
    if len(tokens) <= chunk_tokens:
        return [text]

    chunks: list[str] = []
    step = chunk_tokens - overlap
    for start in range(0, len(tokens), step):
        end = start + chunk_tokens
        piece_tokens = tokens[start:end]
        chunks.append(enc.decode(piece_tokens))
        if end >= len(tokens):
            break
    return chunks


# ---------- Embedding ----------


async def embed(client: AsyncOpenAI, texts: list[str]) -> list[list[float]]:
    s = get_settings()
    # OpenAI embeddings endpoint accepts batches; cap at 100 per request to be safe.
    out: list[list[float]] = []
    for i in range(0, len(texts), 100):
        batch = texts[i : i + 100]
        resp = await client.embeddings.create(model=s.openai_embedding_model, input=batch)
        out.extend(d.embedding for d in resp.data)
    return out


# ---------- Ingest ----------


@dataclass(slots=True)
class IngestResult:
    document_id: uuid.UUID
    chunks: int


async def ingest_pdf(
    *, oai: AsyncOpenAI, pdf_bytes: bytes, title: str, source: str, category: str | None
) -> IngestResult:
    await ensure_collection()
    raw = extract_pdf_text(pdf_bytes)
    chunks = chunk_text(raw)
    if not chunks:
        raise ValueError("PDF produced no extractable text")

    vectors = await embed(oai, chunks)
    document_id = uuid.uuid4()
    s = get_settings()
    qclient = get_qdrant()

    points = [
        qmodels.PointStruct(
            id=str(uuid.uuid4()),
            vector=vec,
            payload={
                "document_id": str(document_id),
                "title": title,
                "source": source,
                "category": category,
                "chunk_index": idx,
                "text": chunk,
            },
        )
        for idx, (chunk, vec) in enumerate(zip(chunks, vectors, strict=True))
    ]
    # Upsert in batches of 64
    for i in range(0, len(points), 64):
        await qclient.upsert(collection_name=s.qdrant_collection, points=points[i : i + 64])

    log.info("Ingested %s chunks for document %s", len(chunks), title)
    return IngestResult(document_id=document_id, chunks=len(chunks))


# ---------- Retrieval ----------


@dataclass(slots=True)
class Retrieved:
    text: str
    title: str
    source: str
    score: float


async def retrieve(*, oai: AsyncOpenAI, query: str, top_k: int = 8) -> list[Retrieved]:
    """Embed the query, fetch top_k candidates from Qdrant."""
    await ensure_collection()
    s = get_settings()
    qclient = get_qdrant()
    vec = (await embed(oai, [query]))[0]
    hits = await qclient.search(collection_name=s.qdrant_collection, query_vector=vec, limit=top_k)
    out: list[Retrieved] = []
    for h in hits:
        payload = h.payload or {}
        out.append(
            Retrieved(
                text=payload.get("text", ""),
                title=payload.get("title", "Unknown"),
                source=payload.get("source", ""),
                score=float(h.score),
            )
        )
    return out


async def rerank(oai: AsyncOpenAI, query: str, candidates: list[Retrieved], top_n: int = 4) -> list[Retrieved]:
    """LLM-based reranking. For production, replace with Cohere/bge cross-encoder.

    We ask the model to score each (query, candidate) pair from 0-10. Cheap
    enough on gpt-4o-mini and noticeably better than raw cosine for short queries.
    """
    if not candidates:
        return []
    if len(candidates) <= top_n:
        return candidates

    s = get_settings()
    # Build a single prompt scoring all candidates at once for efficiency.
    numbered = "\n\n".join(
        f"[{i}] {c.text[:600]}" for i, c in enumerate(candidates)
    )
    prompt = (
        "You are a relevance scorer. For each numbered passage below, output a single line "
        f"of the form `INDEX SCORE` where SCORE is an integer 0-10 indicating how well the "
        f"passage answers the query. Only output the lines, nothing else.\n\n"
        f"QUERY: {query}\n\nPASSAGES:\n{numbered}"
    )
    try:
        resp = await oai.chat.completions.create(
            model=s.openai_chat_model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=200,
        )
        text = resp.choices[0].message.content or ""
    except Exception as exc:  # noqa: BLE001
        log.warning("Rerank failed, returning top_n by cosine: %s", exc)
        return candidates[:top_n]

    scores: dict[int, int] = {}
    for line in text.splitlines():
        parts = line.strip().split()
        if len(parts) >= 2 and parts[0].isdigit() and parts[1].isdigit():
            scores[int(parts[0])] = int(parts[1])

    # Apply scores; fall back to cosine for any unscored candidates.
    scored = [
        (scores.get(i, int(c.score * 10)), c) for i, c in enumerate(candidates)
    ]
    scored.sort(key=lambda x: x[0], reverse=True)
    return [c for _, c in scored[:top_n]]
