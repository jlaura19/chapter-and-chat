from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import (
    Book,
    Club,
    ClubMembership,
    DiscussionBoard,
    Event,
    EventRSVP,
    JournalEntry,
    Message,
    Nomination,
    NominationVote,
    Notification,
    Review,
    User,
)


def user_out(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "role": user.role,
        "displayName": user.display_name,
        "bio": user.bio,
        "favoriteGenres": user.favorite_genres,
        "readingGoal": user.reading_goal,
        "avatarUrl": user.avatar_url,
        "themePreference": user.theme_preference,
        "notifyMeetings": user.notify_meetings,
        "notifyMessages": user.notify_messages,
        "notifyReactions": user.notify_reactions,
        "showAvatars": user.show_avatars,
        "createdAt": user.created_at,
    }


def book_out(book: Book) -> dict:
    return {
        "id": book.id,
        "title": book.title,
        "author": book.author,
        "genre": book.genre,
        "readingStatus": book.reading_status,
        "rating": book.rating,
        "reviewNotes": book.review_notes,
        "coverImageUrl": book.cover_image_url,
        "ownerId": book.owner_id,
        "ownerUsername": book.owner.username,
        "createdAt": book.created_at,
    }


def review_out(review: Review) -> dict:
    return {
        "id": review.id,
        "bookId": review.book_id,
        "reviewerId": review.reviewer_id,
        "reviewerUsername": review.reviewer.username,
        "rating": review.rating,
        "readingStatus": review.reading_status,
        "comment": review.comment,
        "upvotes": review.upvotes,
        "createdAt": review.created_at,
    }


def journal_out(entry: JournalEntry) -> dict:
    return {
        "id": entry.id,
        "kind": entry.kind,
        "bookTitle": entry.book_title,
        "page": entry.page,
        "body": entry.body,
        "createdAt": entry.created_at,
    }


def club_out(db: Session, club: Club, my_role: str | None, *, include_secret: bool = False) -> dict:
    member_count = db.scalar(
        select(func.count()).select_from(ClubMembership).where(ClubMembership.club_id == club.id)
    )
    out = {
        "id": club.id,
        "name": club.name,
        "description": club.description,
        "privacy": club.privacy,
        "memberCount": member_count,
        "myRole": my_role,
        "isMember": my_role is not None,
        "currentReadTitle": club.current_read_title,
        "currentReadAuthor": club.current_read_author,
        "currentReadPages": club.current_read_pages,
        "createdAt": club.created_at,
    }
    if include_secret and club.privacy == "private":
        out["inviteCode"] = club.invite_code
    return out


def board_out(db: Session, board: DiscussionBoard) -> dict:
    reply_count = db.scalar(select(func.count()).select_from(Message).where(Message.board_id == board.id))
    last_at = db.scalar(select(func.max(Message.created_at)).where(Message.board_id == board.id))
    return {
        "id": board.id,
        "clubId": board.club_id,
        "title": board.title,
        "prompt": board.prompt,
        "kind": board.kind,
        "replyCount": reply_count,
        "lastActivityAt": last_at or board.created_at,
        "createdAt": board.created_at,
    }


def message_out(message: Message) -> dict:
    return {
        "id": message.id,
        "boardId": message.board_id,
        "authorId": message.author_id,
        "authorUsername": message.author.username,
        "body": message.body,
        "createdAt": message.created_at,
    }


def event_out(db: Session, event: Event, user_id: int) -> dict:
    counts = dict(
        db.execute(
            select(EventRSVP.response, func.count())
            .where(EventRSVP.event_id == event.id)
            .group_by(EventRSVP.response)
        ).all()
    )
    my_response = db.scalar(
        select(EventRSVP.response).where(EventRSVP.event_id == event.id, EventRSVP.user_id == user_id)
    )
    return {
        "id": event.id,
        "clubId": event.club_id,
        "title": event.title,
        "description": event.description,
        "location": event.location,
        "meetLink": event.meet_link,
        "startsAt": event.starts_at,
        "rsvpCounts": {"yes": counts.get("yes", 0), "no": counts.get("no", 0), "maybe": counts.get("maybe", 0)},
        "myRsvp": my_response,
    }


def nomination_out(db: Session, nomination: Nomination, user_id: int) -> dict:
    votes = db.scalar(
        select(func.count()).select_from(NominationVote).where(NominationVote.nomination_id == nomination.id)
    )
    voted = db.scalar(
        select(func.count())
        .select_from(NominationVote)
        .where(NominationVote.nomination_id == nomination.id, NominationVote.user_id == user_id)
    )
    return {
        "id": nomination.id,
        "clubId": nomination.club_id,
        "title": nomination.title,
        "author": nomination.author,
        "votes": votes,
        "myVote": bool(voted),
        "createdAt": nomination.created_at,
    }


def notification_out(notification: Notification) -> dict:
    return {
        "id": notification.id,
        "clubId": notification.club_id,
        "kind": notification.kind,
        "message": notification.message,
        "read": notification.read_at is not None,
        "createdAt": notification.created_at,
    }
