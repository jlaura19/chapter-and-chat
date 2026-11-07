import hashlib
import hmac
import logging
import os
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..schemas import GuestIn, LoginIn, RegisterIn
from ..security import CurrentUser, create_access_token
from ..serializers import user_out

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


def _token_response(user: User) -> dict:
    return {"accessToken": create_access_token(user), "tokenType": "bearer", "user": user_out(user)}


@router.post("/guest")
def create_guest_session(body: GuestIn, db: Session = Depends(get_db)) -> dict:
    guest_key = str(body.guest_id)
    username = f"guest_{hashlib.sha256(guest_key.encode()).hexdigest()[:26]}"
    user = db.scalar(select(User).where(User.username == username))
    if user is None:
        user = User(
            username=username,
            password_hash=secrets.token_urlsafe(32),
            display_name=f"Reader {guest_key[-4:]}",
        )
        db.add(user)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            user = db.scalar(select(User).where(User.username == username))
            if user is None:
                logger.exception("Could not create or retrieve guest profile")
                raise
        else:
            db.refresh(user)

    return _token_response(user)


def _hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return f"scrypt${salt.hex()}${digest.hex()}"


def _verify_password(password: str, stored: str) -> bool:
    try:
        scheme, salt_hex, digest_hex = stored.split("$")
        if scheme != "scrypt":
            return False
        digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt_hex), n=2**14, r=8, p=1)
        return hmac.compare_digest(digest, bytes.fromhex(digest_hex))
    except ValueError:
        return False


@router.post("/register")
def register(body: RegisterIn, db: Session = Depends(get_db)) -> dict:
    email = body.email.strip().lower()
    if db.scalar(select(User).where(User.email == email)) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
    user = User(
        username=f"reader_{secrets.token_hex(8)}",
        email=email,
        password_hash=_hash_password(body.password),
        display_name=body.display_name.strip() or email.split("@")[0][:64],
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
    db.refresh(user)
    return _token_response(user)


@router.post("/login")
def login(body: LoginIn, db: Session = Depends(get_db)) -> dict:
    user = db.scalar(select(User).where(User.email == body.email.strip().lower()))
    if user is None or not _verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    return _token_response(user)


@router.get("/me")
def me(user: CurrentUser) -> dict:
    return user_out(user)
