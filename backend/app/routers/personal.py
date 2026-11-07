from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..media import delete_upload, save_image
from ..models import Book, Club, JournalEntry
from ..schemas import AccountDeleteIn, JournalIn, ProfileUpdate
from ..security import CurrentUser, verify_password
from ..serializers import journal_out, user_out

router = APIRouter(tags=["personal"])


@router.get("/journal")
def list_journal(user: CurrentUser, db: Session = Depends(get_db), kind: str | None = Query(None)) -> list[dict]:
    stmt = select(JournalEntry).where(JournalEntry.user_id == user.id).order_by(JournalEntry.created_at.desc())
    if kind in ("note", "quote"):
        stmt = stmt.where(JournalEntry.kind == kind)
    return [journal_out(entry) for entry in db.scalars(stmt)]


@router.post("/journal", status_code=status.HTTP_201_CREATED)
def create_journal(body: JournalIn, user: CurrentUser, db: Session = Depends(get_db)) -> dict:
    entry = JournalEntry(
        user_id=user.id,
        kind=body.kind,
        book_title=body.book_title.strip(),
        page=body.page,
        body=body.body.strip(),
    )
    db.add(entry)
    db.commit()
    return journal_out(entry)


@router.delete("/journal/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_journal(entry_id: int, user: CurrentUser, db: Session = Depends(get_db)) -> None:
    entry = db.get(JournalEntry, entry_id)
    if entry is None or entry.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Journal entry not found")
    db.delete(entry)
    db.commit()


@router.get("/profile")
def get_profile(user: CurrentUser) -> dict:
    return user_out(user)


@router.put("/profile")
def update_profile(body: ProfileUpdate, user: CurrentUser, db: Session = Depends(get_db)) -> dict:
    for field, value in body.model_dump(exclude_unset=True).items():
        if isinstance(value, str):
            value = value.strip()
        setattr(user, field, value)
    db.commit()
    return user_out(user)


@router.post("/profile/avatar")
async def upload_avatar(
    user: CurrentUser,
    db: Session = Depends(get_db),
    avatar: UploadFile = File(...),
) -> dict:
    new_url = await save_image(avatar, "avatars", get_settings().max_avatar_bytes)
    delete_upload(user.avatar_url)
    user.avatar_url = new_url
    db.commit()
    return user_out(user)


@router.delete("/profile/avatar")
def remove_avatar(user: CurrentUser, db: Session = Depends(get_db)) -> dict:
    delete_upload(user.avatar_url)
    user.avatar_url = None
    db.commit()
    return user_out(user)


@router.delete("/profile", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(body: AccountDeleteIn, user: CurrentUser, db: Session = Depends(get_db)) -> None:
    if body.confirm.strip().lower() != user.username:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Confirmation does not match your username")
    # 403 rather than 401: the web client treats 401 as an expired session and logs the user out.
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Password is incorrect")
    if db.scalar(select(Club.id).where(Club.owner_id == user.id).limit(1)) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Transfer or delete the clubs you own before deleting your account")
    for book_cover in db.scalars(select(Book.cover_image_url).where(Book.owner_id == user.id)):
        delete_upload(book_cover)
    delete_upload(user.avatar_url)
    db.delete(user)
    db.commit()
