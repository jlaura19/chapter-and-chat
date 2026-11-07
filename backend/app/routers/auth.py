from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..models import User
from ..schemas import LoginIn, SignupIn
from ..security import CurrentUser, create_access_token, hash_password, verify_password
from ..serializers import user_out

router = APIRouter(prefix="/auth", tags=["auth"])


def _token_response(user: User) -> dict:
    return {"accessToken": create_access_token(user), "tokenType": "bearer", "user": user_out(user)}


@router.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(body: SignupIn, db: Session = Depends(get_db)) -> dict:
    username = body.username.lower()
    admins = {name.lower() for name in get_settings().admin_usernames}
    user = User(
        username=username,
        password_hash=hash_password(body.password),
        display_name=body.display_name.strip(),
        role="admin" if username in admins else "member",
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Username is already taken") from None
    db.refresh(user)
    return _token_response(user)


@router.post("/login")
def login(body: LoginIn, db: Session = Depends(get_db)) -> dict:
    user = db.scalar(select(User).where(User.username == body.username.strip().lower()))
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid username or password")
    return _token_response(user)


@router.get("/me")
def me(user: CurrentUser) -> dict:
    return user_out(user)
