from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..media import delete_upload, save_image
from ..models import Book, Review, ReviewVote
from ..schemas import READING_STATUSES, ReviewIn
from ..security import CurrentUser
from ..serializers import book_out, review_out
from ..config import get_settings

router = APIRouter(prefix="/books", tags=["books"])
review_router = APIRouter(prefix="/books", tags=["reviews"])


def _load_book(db: Session, book_id: int) -> Book:
    book = db.scalar(select(Book).options(selectinload(Book.owner)).where(Book.id == book_id))
    if book is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Book not found")
    return book


def _check_status(value: str) -> str:
    if value not in READING_STATUSES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"readingStatus must be one of {READING_STATUSES}")
    return value


@router.get("")
def list_books(_user: CurrentUser, db: Session = Depends(get_db)) -> list[dict]:
    books = db.scalars(select(Book).options(selectinload(Book.owner)).order_by(Book.created_at.desc())).all()
    return [book_out(book) for book in books]


@router.get("/mine")
def my_books(user: CurrentUser, db: Session = Depends(get_db)) -> list[dict]:
    books = db.scalars(
        select(Book).options(selectinload(Book.owner)).where(Book.owner_id == user.id).order_by(Book.created_at.desc())
    ).all()
    return [book_out(book) for book in books]


@router.get("/{book_id}")
def get_book(book_id: int, _user: CurrentUser, db: Session = Depends(get_db)) -> dict:
    return book_out(_load_book(db, book_id))


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_book(
    user: CurrentUser,
    db: Session = Depends(get_db),
    title: Annotated[str, Form(min_length=1, max_length=255)] = ...,
    author: Annotated[str, Form(min_length=1, max_length=255)] = ...,
    genre: Annotated[str, Form(max_length=120)] = "",
    reading_status: Annotated[str, Form()] = "To Read",
    rating: Annotated[int, Form(ge=0, le=5)] = 0,
    review_notes: Annotated[str, Form(max_length=5000)] = "",
    cover_image: UploadFile | None = File(None),
) -> dict:
    cover_url = None
    if cover_image is not None and cover_image.filename:
        cover_url = await save_image(cover_image, "covers", get_settings().max_cover_bytes)
    book = Book(
        owner_id=user.id,
        title=title.strip(),
        author=author.strip(),
        genre=genre.strip(),
        reading_status=_check_status(reading_status),
        rating=rating,
        review_notes=review_notes,
        cover_image_url=cover_url,
    )
    db.add(book)
    db.commit()
    return book_out(_load_book(db, book.id))


@router.put("/{book_id}")
async def update_book(
    book_id: int,
    user: CurrentUser,
    db: Session = Depends(get_db),
    title: Annotated[str, Form(min_length=1, max_length=255)] = ...,
    author: Annotated[str, Form(min_length=1, max_length=255)] = ...,
    genre: Annotated[str, Form(max_length=120)] = "",
    reading_status: Annotated[str, Form()] = "To Read",
    rating: Annotated[int, Form(ge=0, le=5)] = 0,
    review_notes: Annotated[str, Form(max_length=5000)] = "",
    remove_cover: Annotated[bool, Form()] = False,
    cover_image: UploadFile | None = File(None),
) -> dict:
    book = _load_book(db, book_id)
    if book.owner_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the owner can edit this book")
    if cover_image is not None and cover_image.filename:
        new_cover = await save_image(cover_image, "covers", get_settings().max_cover_bytes)
        delete_upload(book.cover_image_url)
        book.cover_image_url = new_cover
    elif remove_cover:
        delete_upload(book.cover_image_url)
        book.cover_image_url = None
    book.title = title.strip()
    book.author = author.strip()
    book.genre = genre.strip()
    book.reading_status = _check_status(reading_status)
    book.rating = rating
    book.review_notes = review_notes
    db.commit()
    return book_out(_load_book(db, book.id))


@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_book(book_id: int, user: CurrentUser, db: Session = Depends(get_db)) -> None:
    book = _load_book(db, book_id)
    if book.owner_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the owner can delete this book")
    delete_upload(book.cover_image_url)
    db.delete(book)
    db.commit()


@review_router.get("/{book_id}/reviews")
def list_reviews(book_id: int, _user: CurrentUser, db: Session = Depends(get_db)) -> list[dict]:
    _load_book(db, book_id)
    reviews = db.scalars(
        select(Review).options(selectinload(Review.reviewer)).where(Review.book_id == book_id).order_by(Review.created_at.desc())
    ).all()
    return [review_out(review) for review in reviews]


@review_router.post("/{book_id}/reviews", status_code=status.HTTP_201_CREATED)
def create_review(book_id: int, body: ReviewIn, user: CurrentUser, db: Session = Depends(get_db)) -> dict:
    _load_book(db, book_id)
    review = Review(
        book_id=book_id,
        reviewer_id=user.id,
        rating=body.rating,
        reading_status=body.reading_status,
        comment=body.comment.strip(),
    )
    db.add(review)
    db.commit()
    return review_out(db.scalar(select(Review).options(selectinload(Review.reviewer)).where(Review.id == review.id)))


@review_router.post("/{book_id}/reviews/{review_id}/upvote")
def upvote_review(book_id: int, review_id: int, user: CurrentUser, db: Session = Depends(get_db)) -> dict:
    review = db.scalar(select(Review).options(selectinload(Review.reviewer)).where(Review.id == review_id, Review.book_id == book_id))
    if review is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Review not found")
    already = db.scalar(select(ReviewVote.id).where(ReviewVote.review_id == review_id, ReviewVote.user_id == user.id))
    if already is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "You already upvoted this review")
    db.add(ReviewVote(review_id=review_id, user_id=user.id))
    review.upvotes += 1
    db.commit()
    return review_out(review)
