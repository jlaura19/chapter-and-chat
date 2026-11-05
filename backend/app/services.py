from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import ClubMembership, Notification, User
from .realtime import hub

# Maps a notification kind to the member preference that gates it. Kinds not listed always notify.
_PREFERENCE_BY_KIND = {
    "event": User.notify_meetings,
    "announcement": User.notify_messages,
    "message": User.notify_messages,
}


def notify_users(db: Session, user_ids: list[int], club_id: int | None, kind: str, message: str) -> None:
    if not user_ids:
        return
    db.add_all(
        [Notification(user_id=user_id, club_id=club_id, kind=kind, message=message) for user_id in user_ids]
    )
    db.commit()
    hub.publish_users(user_ids, {"type": "notification", "clubId": club_id, "kind": kind, "message": message})


def notify_members(
    db: Session, club_id: int, kind: str, message: str, *, exclude_user_id: int | None = None
) -> int:
    stmt = select(User.id).join(ClubMembership, ClubMembership.user_id == User.id).where(
        ClubMembership.club_id == club_id
    )
    preference = _PREFERENCE_BY_KIND.get(kind)
    if preference is not None:
        stmt = stmt.where(preference.is_(True))
    if exclude_user_id is not None:
        stmt = stmt.where(User.id != exclude_user_id)
    user_ids = list(db.scalars(stmt))
    notify_users(db, user_ids, club_id, kind, message)
    return len(user_ids)
