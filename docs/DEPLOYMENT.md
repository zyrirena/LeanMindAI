# Deployment Guide

This guide covers two paths: **local development** (Docker, one command) and **production** (Vercel + Railway + Neon + Qdrant Cloud).

## Local development

### Prerequisites

- Docker Desktop 4.x or newer (with Compose v2)
- An OpenAI API key — get one at https://platform.openai.com/api-keys

That's it. You don't need Node or Python locally for the docker-compose flow.

### Steps

```bash
# 1. Copy env files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Edit `apps/api/.env`:

- `OPENAI_API_KEY` — paste your key
- `JWT_SECRET` — generate a fresh one:
  ```bash
  python -c "import secrets; print(secrets.token_urlsafe(64))"
  ```
- `ADMIN_EMAIL` — the email you'll register with to get admin access (e.g. your own)

Then:

```bash
# 2. Start everything
docker compose up --build
```

First boot takes ~3–5 minutes (Python deps, Next build). Subsequent starts are seconds.

### What's running

| Service | URL | Purpose |
|---------|-----|---------|
| Web | http://localhost:3000 | Next.js frontend |
| API | http://localhost:8000 | FastAPI backend |
| API docs | http://localhost:8000/docs | OpenAPI Swagger UI |
| Postgres | localhost:5432 | `leanmind/leanmind/leanmind` |
| Qdrant | http://localhost:6333/dashboard | Vector DB UI |

### First steps in the app

1. Go to http://localhost:3000
2. Click **Begin** → register with the email matching `ADMIN_EMAIL`
3. Complete the 3-question onboarding
4. You'll land on the dashboard. Click **Open the coach** to chat.
5. **For citations**: go to **Admin → Evidence library**, upload a PDF (any peer-reviewed health paper). Once ingested, ask the coach a question on that topic and it should return citations.

### Stopping & resetting

```bash
docker compose down                 # stop, keep data
docker compose down -v              # stop, wipe volumes (Postgres + Qdrant)
```

---

## Production

The recommended target is **Vercel (web) + Railway (api) + Neon (Postgres) + Qdrant Cloud**. All four have generous free tiers.

### 1. Database — Neon

1. Sign up at https://neon.tech
2. Create a project. You'll get a connection string. **Convert to async**: replace `postgresql://` with `postgresql+asyncpg://`.
3. Save the URL; you'll paste it as `DATABASE_URL`.

### 2. Vector DB — Qdrant Cloud

1. Sign up at https://cloud.qdrant.io
2. Create a free cluster (1 GB).
3. Note the cluster URL and generate an API key.
4. Save them; they become `QDRANT_URL` and `QDRANT_API_KEY`.

### 3. API — Railway

1. Sign up at https://railway.app and create a new project from your GitHub repo.
2. Add a service from `apps/api`. Railway autodetects the `Dockerfile`.
3. Add these environment variables (use the **Variables** tab):

   ```
   DATABASE_URL=postgresql+asyncpg://...        (from Neon)
   JWT_SECRET=<long random string>
   OPENAI_API_KEY=sk-...
   QDRANT_URL=https://xyz.qdrant.io
   QDRANT_API_KEY=<from Qdrant>
   ADMIN_EMAIL=you@yourdomain.com
   CORS_ORIGINS=https://your-vercel-domain.vercel.app
   ENV=production
   ```
4. Deploy. Railway will give you a public URL like `https://leanmind-api-production.up.railway.app`.

### 4. Web — Vercel

1. Import the repo at https://vercel.com/new
2. Set the **Root Directory** to `apps/web`.
3. Set environment variable:
   ```
   NEXT_PUBLIC_API_URL=https://leanmind-api-production.up.railway.app
   ```
4. Deploy.

### 5. Verify

- Open the Vercel URL.
- Register the admin account (matching `ADMIN_EMAIL` on the API).
- Go to `/en/admin/ingest` and upload a PDF. If it succeeds, RAG is wired end-to-end.

### 6. After first deploy

- **Update CORS**: once you know your Vercel URL, set `CORS_ORIGINS` on Railway to that origin.
- **Custom domain**: add it in Vercel → Domains, then update `CORS_ORIGINS` on Railway again.
- **Migrations**: this slice uses `Base.metadata.create_all` on startup. For production, add Alembic migrations before you have real users — schema changes after that point need versioning.

---

## Costs at a small scale (< 1,000 users)

| Service | Plan | Approx monthly |
|---------|------|---------------:|
| Vercel | Hobby (free) | $0 |
| Railway | Hobby ($5 credit) | $5–10 |
| Neon | Free tier (0.5 GB) | $0 |
| Qdrant Cloud | Free 1 GB cluster | $0 |
| OpenAI | Pay-as-you-go | depends on usage |

OpenAI is the variable cost. With `gpt-4o-mini` chat, `text-embedding-3-small` for embeddings, and `omni-moderation-latest` for safety (free), expect roughly $0.01–0.03 per active user per day at moderate use.

---

## Troubleshooting

**`docker compose up` fails on `api` build with a `pip` error.**
You likely have an old Docker image cached. Run `docker compose build --no-cache api`.

**The web container starts but the page can't reach the API.**
Open the browser console. If you see CORS errors, your `CORS_ORIGINS` on the API doesn't include the origin you're loading from. In production this means setting it to your Vercel URL exactly (no trailing slash).

**Chat gets a 500 with `"OPENAI_API_KEY"` in the message.**
The key isn't set or is invalid. Check it on the API service.

**Ingest succeeds but the coach never returns citations.**
Two likely causes: (1) the PDF had no extractable text (it's a scan); the `pypdf` extraction returns nothing in that case. Try a text-PDF. (2) Your query topic doesn't overlap with what you ingested. Try asking about something explicitly covered.

**The reranker is slow.**
The slice uses an LLM-based reranker (~1 extra `gpt-4o-mini` call per query). For production, swap in Cohere Rerank or a local `bge-reranker-base`. The hook is `app/rag.py::rerank`.
