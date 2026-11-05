import hmac
import secrets

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import Club, ClubMembership, DiscussionBoard, JoinRequest, ReadingProgress
from ..realtime import hub
from ..schemas import ClubIn, ClubUpdate, JoinIn, MemberRoleIn, ProgressIn, RequestDecisionIn
from ..security import CLUB_ADMIN_ROLES, CurrentUser, get_membership, require_club_admin, require_member
from ..serializers import club_out, user_out
from ..services import notify_users

router = APIRouter(prefix="/clubs", tags=["clubs"])


def _new_invite_code() -> str:
    return secrets.token_urlsafe(12)


def _revoke_live_access(db: Session, club_id: int, user_id: int) -> None:
    board_ids = list(db.scalars(select(DiscussionBoard.id).where(DiscussionBoard.club_id == club_id)))
    hub.unsubscribe_user_from_boards(user_id, board_ids)


def _load_club(db: Session, club_id: int) -> Club:
    club = db.get(Club, club_id)
    if club is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Club not found")
    return club


def _add_member(db: Session, club_id: int, user_id: int, role: str = "member") -> ClubMembership:
    membership = ClubMembership(club_id=club_id, user_id=user_id, role=role)
    db.add(membership)
    db.commit()
    return membership


def _admin_user_ids(db: Session, club_id: int) -> list[int]:
    return list(
        db.scalars(
            select(ClubMembership.user_id).where(
                ClubMembership.club_id == club_id, ClubMembership.role.in_(CLUB_ADMIN_ROLES)
            )
        )
    )


def _with_secret(membership: ClubMembership | None) -> bool:
    return membership is not None and membership.role in CLUB_ADMIN_ROLES


@router.get("")
def list_clubs(user: CurrentUser, db: Session = Depends(get_db)) -> list[dict]:
    roles = {
        m.club_id: m.role
        for m in db.scalars(select(ClubMembership).where(ClubMembership.user_id == user.id))
    }
    clubs = db.scalars(select(Club).order_by(Club.name)).all()
    return [
        club_out(db, club, roles.get(club.id), include_secret=roles.get(club.id) in CLUB_ADMIN_ROLES)
        for club in clubs
    ]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_club(body: ClubIn, user: CurrentUser, db: Session = Depends(get_db)) -> dict:
    club = Club(
        name=body.name.strip(),
        description=body.description.strip(),
        privacy=body.privacy,
        owner_id=user.id,
        invite_code=_new_invite_code() if body.privacy == "private" else None,
        current_read_title=body.current_read_title.strip(),
        current_read_author=body.current_read_author.strip(),
        current_read_pages=body.current_read_pages,
    )
    db.add(club)
    db.flush()
    db.add(ClubMembership(club_id=club.id, user_id=user.id, role="owner"))
    db.commit()
    db.refresh(club)
    return club_out(db, club, "owner", include_secret=True)


@router.get("/{club_id}")
def get_club(club_id: int, user: CurrentUser, db: Session = Depends(get_db)) -> dict:
    club = _load_club(db, club_id)
    membership = get_membership(db, club_id, user.id)
    role = membership.role if membership else None
    return club_out(db, club, role, include_secret=_with_secret(membership))


@router.put("/{club_id}")
def update_club(club_id: int, body: ClubUpdate, user: CurrentUser, db: Session = Depends(get_db)) -> dict:
    membership = require_club_admin(db, club_id, user)
    club = _load_club(db, club_id)
    for field, value in body.model_dump(exclude_unset=True, exclude_none=True).items():
        if isinstance(value, str):
            value = value.strip()
        setattr(club, field, value)
    if club.privacy == "private" and club.invite_code is None:
        club.invite_code = _new_invite_code()
    elif club.privacy == "public":
        club.invite_code = None
    db.commit()
    return club_out(db, club, membership.role, include_secret=True)


@router.delete("/{club_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_club(club_id: int, user: CurrentUser, db: Session = Depends(get_db)) -> Response:
    membership = require_club_admin(db, club_id, user)
    if membership.role != "owner":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the owner can delete this club")
    db.delete(_load_club(db, club_id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{club_id}/join")
def join_club(club_id: int, body: JoinIn, user: CurrentUser, db: Session = Depends(get_db)) -> dict:
    club = _load_club(db, club_id)
    existing = get_membership(db, club_id, user.id)
    if existing is not None:
        return {"status": "joined", "club": club_out(db, club, existing.role, include_secret=_with_secret(existing))}

    if club.privacy == "public":
        membership = _add_member(db, club_id, user.id)
        return {"status": "joined", "club": club_out(db, club, membership.role)}

    code = (body.invite_code or "").strip()
    if code:
        if club.invite_code is None or not hmac.compare_digest(code.encode(), club.invite_code.encode()):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Invalid invite code")
        membership = _add_member(db, club_id, user.id)
        return {"status": "joined", "club": club_out(db, club, membership.role)}

    pending = db.scalar(
        select(JoinRequest).where(
            JoinRequest.club_id == club_id, JoinRequest.user_id == user.id, JoinRequest.status == "pending"
        )
    )
    if pending is None:
        db.add(JoinRequest(club_id=club_id, user_id=user.id))
        db.commit()
        notify_users(
            db,
            _admin_user_ids(db, club_id),
            club_id,
            "join_request",
            f"{user.display_name or user.username} asked to join {club.name}",
        )
    return {"status": "pending", "club": club_out(db, club, None)}


@router.post("/{club_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
def leave_club(club_id: int, user: CurrentUser, db: Session = Depends(get_db)) -> Response:
    membership = require_member(db, club_id, user)
    if membership.role == "owner":
        raise HTTPException(status.HTTP_409_CONFLICT, "Owners must delete the club or transfer ownership first")
    db.delete(membership)
    db.commit()
    _revoke_live_access(db, club_id, user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{club_id}/invite-code")
def rotate_invite_code(club_id: int, user: CurrentUser, db: Session = Depends(get_db)) -> dict:
    require_club_admin(db, club_id, user)
    club = _load_club(db, club_id)
    if club.privacy != "private":
        raise HTTPException(status.HTTP_409_CONFLICT, "Invite codes only apply to private clubs")
    club.invite_code = _new_invite_code()
    db.commit()
    return {"inviteCode": club.invite_code}


@router.get("/{club_id}/requests")
def list_join_requests(club_id: int, user: CurrentUser, db: Session = Depends(get_db)) -> list[dict]:
    require_club_admin(db, club_id, user)
    requests = db.scalars(
        select(JoinRequest)
        .options(selectinload(JoinRequest.user))
        .where(JoinRequest.club_id == club_id, JoinRequest.status == "pending")
        .order_by(JoinRequest.created_at)
    ).all()
    return [
        {"id": r.id, "status": r.status, "createdAt": r.created_at, "user": user_out(r.user)} for r in requests
    ]


@router.post("/{club_id}/requests/{request_id}")
def decide_join_request(
    club_id: int, request_id: int, body: RequestDecisionIn, user: CurrentUser, db: Session = Depends(get_db)
) -> dict:
    require_club_admin(db, club_id, user)
    join_request = db.get(JoinRequest, request_id)
    if join_request is None or join_request.club_id != club_id or join_request.status != "pending":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pending request not found")
    club = _load_club(db, club_id)
    if body.approve:
        join_request.status = "approved"
        if get_membership(db, club_id, join_request.user_id) is None:
            _add_member(db, club_id, join_request.user_id)
    else:
        join_request.status = "rejected"
    db.commit()
    verdict = "approved" if body.approve else "declined"
    notify_users(db, [join_request.user_id], club_id, "join_decision", f"Your request to join {club.name} was {verdict}")
    return {"id": join_request.id, "status": join_request.status}


@router.get("/{club_id}/members")
def list_members(club_id: int, user: CurrentUser, db: Session = Depends(get_db)) -> list[dict]:
    require_member(db, club_id, user)
    memberships = db.scalars(
        select(ClubMembership).options(selectinload(ClubMembership.user)).where(ClubMembership.club_id == club_id)
    ).all()
    return [
        {"role": m.role, "joinedAt": m.joined_at, "user": user_out(m.user)}
        for m in sorted(memberships, key=lambda m: (m.role != "owner", m.role != "admin", m.user.username))
    ]


@router.put("/{club_id}/members/{member_id}/role")
def change_member_role(
    club_id: int, member_id: int, body: MemberRoleIn, user: CurrentUser, db: Session = Depends(get_db)
) -> dict:
    actor = require_club_admin(db, club_id, user)
    if actor.role != "owner":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the owner can change roles")
    target = get_membership(db, club_id, member_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    if target.role == "owner":
        raise HTTPException(status.HTTP_409_CONFLICT, "The owner's role cannot be changed")
    target.role = body.role
    db.commit()
    return {"userId": member_id, "role": target.role}


@router.delete("/{club_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(club_id: int, member_id: int, user: CurrentUser, db: Session = Depends(get_db)) -> Response:
    actor = require_club_admin(db, club_id, user)
    target = get_membership(db, club_id, member_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    if target.role == "owner":
        raise HTTPException(status.HTTP_409_CONFLICT, "The owner cannot be removed")
    if target.role == "admin" and actor.role != "owner":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the owner can remove admins")
    db.delete(target)
    db.commit()
    _revoke_live_access(db, club_id, member_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
@router.get("/{club_id}/progress")
def list_progress(club_id: int, user: CurrentUser, db: Session = Depends(get_db)) -> list[dict]:
    require_member(db, club_id, user)
    rows = db.scalars(
        select(ReadingProgress)
        .options(selectinload(ReadingProgress.user))
        .where(ReadingProgress.club_id == club_id)
        .order_by(ReadingProgress.updated_at.desc())
    ).all()
    return [
        {"page": p.page, "chapter": p.chapter, "updatedAt": p.updated_at, "user": user_out(p.user)} for p in rows
    ]


@router.put("/{club_id}/progress")
def update_progress(club_id: int, body: ProgressIn, user: CurrentUser, db: Session = Depends(get_db)) -> dict:
    require_member(db, club_id, user)
    progress = db.scalar(
        select(ReadingProgress).where(ReadingProgress.club_id == club_id, ReadingProgress.user_id == user.id)
    )
    if progress is None:
        progress = ReadingProgress(club_id=club_id, user_id=user.id)
        db.add(progress)
    progress.page = body.page
    progress.chapter = body.chapter.strip()
    db.commit()
    return {"page": progress.page, "chapter": progress.chapter, "updatedAt": progress.updated_at}
