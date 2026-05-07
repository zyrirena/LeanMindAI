"""Auth endpoints: register and login."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.db import get_db
from app.models import User
from app.schemas import LoginRequest, RegisterRequest, TokenResponse, UserPublic
from app.security import (
    create_access_token,
    current_user,
    hash_password,
    is_admin,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _user_public(u: User) -> UserPublic:
    return UserPublic(
        id=u.id,
        email=u.email,  # type: ignore[arg-type]
        onboarded=u.onboarded,
        goal=u.goal,
        locale=u.locale.value,  # type: ignore[arg-type]
        unit_system=u.unit_system.value,  # type: ignore[arg-type]
        is_admin=is_admin(u),
        created_at=u.created_at,
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    existing = await db.scalar(select(User).where(User.email == payload.email.lower()))
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")

    user = User(email=payload.email.lower(), password_hash=hash_password(payload.password))
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return TokenResponse(access_token=create_access_token(user.id))


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    user = await db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account disabled")

    return TokenResponse(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserPublic)
async def me(user: Annotated[User, Depends(current_user)]) -> UserPublic:
    return _user_public(user)
