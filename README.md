# LeanMind AI — Vertical Slice

A privacy-first, multilingual, AI-powered wellness platform. **This repository is a working vertical slice**, not the full product described in the original spec. It is a deployable foundation you can extend.

## What's in this slice

- **Auth** — email/password signup + login, JWT sessions, protected routes
- **Onboarding** — goal, language (EN/PL), unit system → stored on user profile
- **AI Chat** — streaming responses from the Behavioral Lead agent, with RAG retrieval and source citations
- **RAG pipeline** — PDF ingestion → chunking → embeddings → Qdrant → retrieval with reranking
- **Safety layer** — rule-based + LLM classifier that detects medical/mental-health crises and halts coaching
- **i18n** — EN/PL throughout the UI; the AI replies in the user's chosen language
- **Admin ingest** — `/admin/ingest` route, gated by `ADMIN_EMAIL`, for uploading RAG documents
- **Infrastructure** — Dockerfiles, `docker-compose.yml`, `.env.example`, GitHub Actions CI

## What's intentionally NOT in this slice

These are real engineering work and were excluded to keep the slice solid:

- Stripe / subscriptions
- Wearable integrations (Apple Health, Garmin, Whoop)
- Mobile / Expo wrapper
- Nutrition agent and Training agent (chat scaffold supports adding them; only Behavioral is implemented)
- MFA, full audit logging, PHI-grade compliance
- Full admin dashboard (only the ingest tool exists)
- PDF export, push notifications, deep analytics dashboards

## Repo layout

```
leanmind/
├── apps/
│   ├── web/           # Next.js 15 frontend (App Router, TS, Tailwind)
│   └── api/           # FastAPI backend (Python 3.11)
├── docs/
│   ├── DEPLOYMENT.md
│   ├── ARCHITECTURE.md
│   └── SAFETY.md
├── .github/workflows/ # CI: typecheck, lint
├── docker-compose.yml # Postgres + Qdrant + api + web for local dev
└── README.md
```

## Quick start (local)

You need Docker, Node 20+, and Python 3.11+.

```bash
# 1. Copy env files
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env

# 2. Add your OpenAI API key to apps/api/.env

# 3. Start the stack
docker compose up --build

# 4. Open http://localhost:3000
```

First run: register an account, complete onboarding, chat with the Behavioral Lead. To enable RAG citations you need to ingest a document (see `docs/DEPLOYMENT.md`).

## Production deployment

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). Recommended target: Vercel (web) + Railway (api) + Neon (Postgres) + Qdrant Cloud.

## License

Proprietary. Internal use only.
