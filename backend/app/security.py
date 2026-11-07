import logging
import secrets
from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .database import get_db
from .models import ClubMembership, User

logger = logging.getLogger(__name__)

CLUB_ADMIN_ROLES = ("owner", "admin")

_settings = get_settings()
if not _settings.jwt_secret:
    logger.warning("JWT_SECRET is not set; using a random per-process secret. Sessions reset on restart.")
_JWT_SECRET = _settings.jwt_secret or secrets.token_urlsafe(48)

_bearer = HTTPBearer(auto_error=False)


def create_access_token(user: User) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(user.id),
        "iat": now,
        "exp": now + timedelta(minutes=_settings.access_token_minutes),
    }
    return jwt.encode(payload, _JWT_SECRET, algorithm=_settings.jwt_algorithm)


def decode_token(token: str) -> int | None:
    try:
        payload = jwt.decode(token, _JWT_SECRET, algorithms=[_settings.jwt_algorithm])
        return int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    if credentials is None:
        raise _unauthorized()
    user_id = decode_token(credentials.credentials)
    user = db.get(User, user_id) if user_id is not None else None
    if user is None:
        raise _unauthorized()
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_membership(db: Session, club_id: int, user_id: int) -> ClubMembership | None:
    return db.scalar(
        select(ClubMembership).where(ClubMembership.club_id == club_id, ClubMembership.user_id == user_id)
    )


def require_member(db: Session, club_id: int, user: User) -> ClubMembership:
    membership = get_membership(db, club_id, user.id)
    if membership is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Club membership required")
    return membership


def require_club_admin(db: Session, club_id: int, user: User) -> ClubMembership:
    membership = require_member(db, club_id, user)
    if membership.role not in CLUB_ADMIN_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Club administrator role required")
    return membership
