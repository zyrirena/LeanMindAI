"""LeanMind AI — FastAPI entrypoint."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import Base, engine
from app.rag import ensure_collection
from app.routers import admin, auth, chat, users

logging.basicConfig(level=get_settings().log_level)
log = logging.getLogger("leanmind")


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Create tables (use Alembic for prod migrations; this is fine for the slice)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    try:
        await ensure_collection()
    except Exception as exc:  # noqa: BLE001
        log.warning("Could not ensure Qdrant collection at startup: %s", exc)
    yield


def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(title="LeanMind AI", version="0.1.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=s.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth.router)
    app.include_router(users.router)
    app.include_router(chat.router)
    app.include_router(admin.router)

    @app.get("/health", tags=["meta"])
    async def health() -> dict[str, str]:
        return {"status": "ok", "env": s.env}

    return app


app = create_app()
