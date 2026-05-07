# Architecture

## Shape of the system

```
┌──────────────┐  HTTPS    ┌──────────────┐  asyncpg   ┌──────────────┐
│  Next.js 15  │◄─────────►│   FastAPI    │◄──────────►│  PostgreSQL  │
│  (App Router)│           │   (Python)   │            │   (Neon)     │
└──────────────┘   SSE     └──────┬───────┘            └──────────────┘
                                  │
                                  │  HTTP
                                  ▼
                          ┌──────────────┐
                          │   Qdrant     │  vector DB
                          └──────────────┘
                                  │
                                  │  HTTPS
                                  ▼
                          ┌──────────────┐
                          │   OpenAI     │  chat + embeddings + moderation
                          └──────────────┘
```

## Why these choices

**FastAPI over NestJS.** The AI ecosystem (LangChain, LlamaIndex, model SDKs) is Python-first. The cost of using TypeScript on the backend is wrapping every new tool yourself.

**Qdrant over Pinecone for the slice.** Qdrant runs as a single Docker container locally and has a real free tier in the cloud. Pinecone would also work — the abstraction layer is small (see `app/rag.py::get_qdrant`); swap the client and `upsert`/`search` calls.

**SSE over WebSockets.** The chat is one-direction streaming (server → client). SSE works through HTTP/1.1, requires no special infrastructure, and reconnects gracefully. WebSockets would be the right call for multi-user collaboration features later.

**JWT in localStorage.** Pragmatic for a slice. For production with sensitive data, consider httpOnly cookies + CSRF tokens instead. The change is contained to `apps/web/src/lib/api.ts` and the auth router.

**`Base.metadata.create_all` instead of Alembic.** Fine for the slice, not fine once you have users. Add Alembic before launch. Command sketch:

```bash
cd apps/api
pip install alembic
alembic init alembic
# edit alembic/env.py to import Base from app.db
alembic revision --autogenerate -m "init"
alembic upgrade head
```

## Request flow: a chat message

1. User types in `/[locale]/chat`. The `streamChat` helper opens a `fetch` POST to `/chat` with the JWT.
2. API: `chat.post_chat` persists the user message, then runs `safety.classify`.
3. **Safety hits** → write a synthetic assistant message with the escalation copy, return SSE with one `safety` event and one `done` event. STOP.
4. **Safe** → load last 16 messages of history (excluding the just-added user turn), call `agents.behavioral.run_behavioral_turn`.
5. Inside the agent: embed the query → Qdrant top-8 → LLM rerank to top-4 → assemble system + evidence + history + user → stream from OpenAI.
6. The route streams `citations` (one event), then `token` events, then `done`. Each `token` is appended to a buffer; on `done`, the full buffer is persisted as the assistant message in a fresh DB session.

## Why the rerank step exists

Cosine similarity over embeddings is a useful first filter but routinely returns near-duplicates and misses the actual best chunk for short queries. The LLM rerank pass is cheap (one `gpt-4o-mini` call, ~200 tokens) and visibly improves citation quality. For production scale, replace it with Cohere Rerank or a local bge-reranker model — the function signature is designed for drop-in replacement.

## Multi-agent extension path

The slice ships only the Behavioral Lead. Adding Nutrition or Training:

1. Create `app/agents/nutrition.py` with its own system prompt (EN/PL).
2. Filter RAG retrieval by `category` in `rag.retrieve` (Qdrant supports payload filters via `query_filter=models.Filter(must=[FieldCondition(key="category", match=MatchValue(value="nutrition"))])`).
3. Add an agent dispatcher: a small classifier prompt or a `?agent=nutrition` query parameter. The router pattern stays the same.

## i18n approach

Locale lives in the URL (`/en/...`, `/pl/...`). The dictionary is a flat string-keyed object — easy to extract to JSON, easy to hand to translators, easy to grep. For larger surface areas, swap to `next-intl` or `react-intl`; the URL convention is already compatible.

The AI's locale is independent of the UI locale: it's stored on the user (`user.locale`) and set during onboarding. This matters because someone can read English docs while preferring to be coached in Polish.

## Safety layer specifics

See [`SAFETY.md`](./SAFETY.md).

## What is NOT in this slice

(Worth listing explicitly so you know where the cliff edges are.)

- No rate limiting. Add one (e.g. `slowapi`) before public launch.
- No structured logging or request IDs. `logging.basicConfig` only.
- No tests. The slice is small enough to test end-to-end manually; for the next step, pytest + httpx async client for the API, Playwright for the web.
- Admin is one email. RBAC tables exist in the schema implicitly (single `is_admin` derived field), but if you want roles like "moderator" or "clinician reviewer," that's an additional table.
- No PHI segregation. If you'll handle real health data under HIPAA, you need a BAA with OpenAI, encryption at rest beyond what Neon provides by default, and audit logs for every PHI read.
