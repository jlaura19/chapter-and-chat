from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

READING_STATUSES = ("To Read", "Reading", "Completed")
RSVP_RESPONSES = ("yes", "no", "maybe")


class CamelModel(BaseModel):
    """Accepts and emits camelCase JSON, matching the frontend contract."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class ProfileUpdate(CamelModel):
    display_name: str | None = Field(None, max_length=64)
    bio: str | None = Field(None, max_length=300)
    favorite_genres: str | None = Field(None, max_length=255)
    reading_goal: int | None = Field(None, ge=0, le=500)
    theme_preference: Literal["LIGHT", "DARK", "SYSTEM"] | None = None
    notify_meetings: bool | None = None
    notify_messages: bool | None = None
    notify_reactions: bool | None = None
    show_avatars: bool | None = None


class GuestIn(CamelModel):
    guest_id: UUID


class RegisterIn(CamelModel):
    email: str = Field(max_length=255, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field("", max_length=64)


class LoginIn(CamelModel):
    email: str = Field(max_length=255)
    password: str = Field(max_length=128)


class ReviewIn(CamelModel):
    rating: int = Field(0, ge=0, le=5)
    reading_status: Literal["To Read", "Reading", "Completed"] = "Reading"
    comment: str = Field("", max_length=5000)


class JournalIn(CamelModel):
    kind: Literal["note", "quote"] = "note"
    book_title: str = Field("", max_length=255)
    page: int | None = Field(None, ge=0, le=100000)
    body: str = Field(min_length=1, max_length=5000)


class ClubIn(CamelModel):
    name: str = Field(min_length=3, max_length=120)
    description: str = Field("", max_length=2000)
    privacy: Literal["public", "private"] = "public"
    current_read_title: str = Field("", max_length=255)
    current_read_author: str = Field("", max_length=255)
    current_read_pages: int = Field(0, ge=0, le=100000)


class ClubUpdate(CamelModel):
    name: str | None = Field(None, min_length=3, max_length=120)
    description: str | None = Field(None, max_length=2000)
    privacy: Literal["public", "private"] | None = None
    current_read_title: str | None = Field(None, max_length=255)
    current_read_author: str | None = Field(None, max_length=255)
    current_read_pages: int | None = Field(None, ge=0, le=100000)


class JoinIn(CamelModel):
    invite_code: str | None = Field(None, max_length=64)


class RequestDecisionIn(CamelModel):
    approve: bool


class MemberRoleIn(CamelModel):
    role: Literal["admin", "member"]


class ProgressIn(CamelModel):
    page: int = Field(ge=0, le=100000)
    chapter: str = Field("", max_length=64)


class BoardIn(CamelModel):
    title: str = Field(min_length=2, max_length=120)
    prompt: str = Field("", max_length=255)
    kind: Literal["chat", "thread"] = "thread"


class MessageIn(CamelModel):
    body: str = Field(min_length=1, max_length=2000)


class EventIn(CamelModel):
    title: str = Field(min_length=2, max_length=160)
    description: str = Field("", max_length=4000)
    location: str = Field("", max_length=160)
    meet_link: str = Field("", max_length=255)
    starts_at: str = Field(description="ISO 8601 datetime. Offsets are converted to UTC.")
    notify_members: bool = True


class RsvpIn(CamelModel):
    response: Literal["yes", "no", "maybe"]


class AnnouncementIn(CamelModel):
    message: str = Field(min_length=1, max_length=1000)


class NominationIn(CamelModel):
    title: str = Field(min_length=1, max_length=255)
    author: str = Field("", max_length=255)
