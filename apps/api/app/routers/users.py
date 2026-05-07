"""User-related endpoints (onboarding, etc.)."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Locale, UnitSystem, User
from app.routers.auth import _user_public
from app.schemas import OnboardingRequest, UserPublic
from app.security import current_user

router = APIRouter(prefix="/users", tags=["users"])


@router.post("/onboarding", response_model=UserPublic)
async def submit_onboarding(
    payload: OnboardingRequest,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserPublic:
    user.goal = payload.goal
    user.locale = Locale(payload.locale)
    user.unit_system = UnitSystem(payload.unit_system)
    user.onboarded = True
    await db.commit()
    await db.refresh(user)
    return _user_public(user)
