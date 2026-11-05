from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import DiscussionBoard, Event, EventRSVP, Message, Nomination, NominationVote
from ..realtime import hub
from ..schemas import AnnouncementIn, BoardIn, EventIn, MessageIn, NominationIn, RsvpIn
from ..security import CurrentUser, require_club_admin, require_member
from ..serializers import board_out, event_out, message_out, nomination_out
from ..services import notify_members

router = APIRouter(prefix="/clubs/{club_id}", tags=["community"])


def _load_board(db: Session, club_id: int, board_id: int) -> DiscussionBoard:
    board = db.get(DiscussionBoard, board_id)
    if board is None or board.club_id != club_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Board not found")
    return board


def _load_event(db: Session, club_id: int, event_id: int) -> Event:
    event = db.get(Event, event_id)
    if event is None or event.club_id != club_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    return event


def _parse_starts_at(value: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "startsAt must be an ISO 8601 datetime") from None
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


def post_board_message(db: Session, club_id: int, board_id: int, user, body: str) -> dict:
    """Shared by the REST endpoint and the WebSocket handler so both persist and broadcast the same way."""
    _load_board(db, club_id, board_id)
    message = Message(board_id=board_id, author_id=user.id, body=body.strip())
    db.add(message)
    db.commit()
    message = db.scalar(select(Message).options(selectinload(Message.author)).where(Message.id == message.id))
    payload = message_out(message)
    hub.publish_board(board_id, {"type": "message", "boardId": board_id, "message": payload})
    return payload


@router.get("/boards")
def list_boards(club_id: int, user: CurrentUser, db: Session = Depends(get_db)) -> list[dict]:
    require_member(db, club_id, user)
    boards = db.scalars(select(DiscussionBoard).where(DiscussionBoard.club_id == club_id).order_by(DiscussionBoard.created_at)).all()
    return [board_out(db, board) for board in boards]


@router.post("/boards", status_code=status.HTTP_201_CREATED)
def create_board(club_id: int, body: BoardIn, user: CurrentUser, db: Session = Depends(get_db)) -> dict:
    require_member(db, club_id, user)
    board = DiscussionBoard(
        club_id=club_id, title=body.title.strip(), prompt=body.prompt.strip(), kind=body.kind
    )
    db.add(board)
    db.commit()
    return board_out(db, board)


@router.get("/boards/{board_id}/messages")
def list_messages(club_id: int, board_id: int, user: CurrentUser, db: Session = Depends(get_db)) -> list[dict]:
    require_member(db, club_id, user)
    _load_board(db, club_id, board_id)
    rows = db.scalars(
        select(Message)
        .options(selectinload(Message.author))
        .where(Message.board_id == board_id)
        .order_by(Message.created_at.desc(), Message.id.desc())
        .limit(100)
    ).all()
    return [message_out(message) for message in reversed(rows)]


@router.post("/boards/{board_id}/messages", status_code=status.HTTP_201_CREATED)
def create_message(club_id: int, board_id: int, body: MessageIn, user: CurrentUser, db: Session = Depends(get_db)) -> dict:
    require_member(db, club_id, user)
    return post_board_message(db, club_id, board_id, user, body.body)


@router.get("/events")
def list_events(club_id: int, user: CurrentUser, db: Session = Depends(get_db)) -> list[dict]:
    require_member(db, club_id, user)
    events = db.scalars(select(Event).where(Event.club_id == club_id).order_by(Event.starts_at)).all()
    return [event_out(db, event, user.id) for event in events]


@router.post("/events", status_code=status.HTTP_201_CREATED)
def create_event(club_id: int, body: EventIn, user: CurrentUser, db: Session = Depends(get_db)) -> dict:
    require_club_admin(db, club_id, user)
    starts_at = _parse_starts_at(body.starts_at)
    event = Event(
        club_id=club_id,
        title=body.title.strip(),
        description=body.description.strip(),
        location=body.location.strip(),
        meet_link=body.meet_link.strip(),
        starts_at=starts_at,
        created_by=user.id,
    )
    db.add(event)
    db.commit()
    if body.notify_members:
        when = starts_at.strftime("%a %b %d, %H:%M UTC")
        notify_members(
            db,
            club_id,
            "event",
            f"New meetup: {event.title} on {when}",
            exclude_user_id=user.id,
        )
    return event_out(db, event, user.id)


@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(club_id: int, event_id: int, user: CurrentUser, db: Session = Depends(get_db)) -> Response:
    require_club_admin(db, club_id, user)
    db.delete(_load_event(db, club_id, event_id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/events/{event_id}/rsvp")
def set_rsvp(club_id: int, event_id: int, body: RsvpIn, user: CurrentUser, db: Session = Depends(get_db)) -> dict:
    require_member(db, club_id, user)
    event = _load_event(db, club_id, event_id)
    rsvp = db.scalar(select(EventRSVP).where(EventRSVP.event_id == event_id, EventRSVP.user_id == user.id))
    if rsvp is None:
        rsvp = EventRSVP(event_id=event_id, user_id=user.id, response=body.response)
        db.add(rsvp)
    else:
        rsvp.response = body.response
    db.commit()
    return event_out(db, event, user.id)


@router.post("/announcements")
def send_announcement(club_id: int, body: AnnouncementIn, user: CurrentUser, db: Session = Depends(get_db)) -> dict:
    require_club_admin(db, club_id, user)
    sent = notify_members(db, club_id, "announcement", body.message.strip(), exclude_user_id=user.id)
    return {"notified": sent}


@router.get("/nominations")
def list_nominations(club_id: int, user: CurrentUser, db: Session = Depends(get_db)) -> list[dict]:
    require_member(db, club_id, user)
    nominations = db.scalars(select(Nomination).where(Nomination.club_id == club_id).order_by(Nomination.created_at)).all()
    return [nomination_out(db, nomination, user.id) for nomination in nominations]


@router.post("/nominations", status_code=status.HTTP_201_CREATED)
def create_nomination(club_id: int, body: NominationIn, user: CurrentUser, db: Session = Depends(get_db)) -> dict:
    require_member(db, club_id, user)
    nomination = Nomination(
        club_id=club_id, title=body.title.strip(), author=body.author.strip(), nominated_by=user.id
    )
    db.add(nomination)
    db.commit()
    return nomination_out(db, nomination, user.id)


@router.post("/nominations/{nomination_id}/vote")
def vote_nomination(club_id: int, nomination_id: int, user: CurrentUser, db: Session = Depends(get_db)) -> dict:
    require_member(db, club_id, user)
    nomination = db.get(Nomination, nomination_id)
    if nomination is None or nomination.club_id != club_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Nomination not found")
    existing = db.scalar(
        select(NominationVote).where(
            NominationVote.nomination_id == nomination_id, NominationVote.user_id == user.id
        )
    )
    if existing is None:
        db.add(NominationVote(nomination_id=nomination_id, user_id=user.id))
        db.commit()
    return nomination_out(db, nomination, user.id)


@router.delete("/nominations/{nomination_id}/vote")
def unvote_nomination(club_id: int, nomination_id: int, user: CurrentUser, db: Session = Depends(get_db)) -> dict:
    require_member(db, club_id, user)
    nomination = db.get(Nomination, nomination_id)
    if nomination is None or nomination.club_id != club_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Nomination not found")
    vote = db.scalar(
        select(NominationVote).where(
            NominationVote.nomination_id == nomination_id, NominationVote.user_id == user.id
        )
    )
    if vote is not None:
        db.delete(vote)
        db.commit()
    return nomination_out(db, nomination, user.id)
