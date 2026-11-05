from fastapi import APIRouter, Depends
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Notification, utcnow
from ..security import CurrentUser
from ..serializers import notification_out

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def list_notifications(user: CurrentUser, db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc(), Notification.id.desc())
        .limit(50)
    ).all()
    return [notification_out(row) for row in rows]


@router.post("/read-all")
def mark_all_read(user: CurrentUser, db: Session = Depends(get_db)) -> dict:
    db.execute(
        update(Notification)
        .where(Notification.user_id == user.id, Notification.read_at.is_(None))
        .values(read_at=utcnow())
    )
    db.commit()
    return {"ok": True}
