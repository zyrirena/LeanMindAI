"""Pydantic API schemas."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

# ---- Auth ----


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"


# ---- Users ----


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    onboarded: bool
    goal: str | None
    locale: Literal["en", "pl"]
    unit_system: Literal["metric", "imperial"]
    is_admin: bool = False
    created_at: datetime


class OnboardingRequest(BaseModel):
    goal: Literal["energy", "weight_loss", "strength", "sleep", "stress", "general"]
    locale: Literal["en", "pl"]
    unit_system: Literal["metric", "imperial"]


# ---- Chat ----


class ChatRequest(BaseModel):
    session_id: uuid.UUID | None = None
    message: str = Field(min_length=1, max_length=4000)


class Citation(BaseModel):
    source: str
    snippet: str
    score: float


class ChatMessagePublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    role: Literal["user", "assistant", "system"]
    content: str
    citations: list[Citation] | None = None
    safety_flag: str | None = None
    created_at: datetime


class ChatSessionPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    created_at: datetime


# ---- Admin / ingest ----


class IngestResponse(BaseModel):
    document_id: uuid.UUID
    title: str
    chunks: int


class IngestedDocPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    source: str
    category: str | None
    chunk_count: int
    created_at: datetime
