import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../services/api'
import { errorMessage } from '../services/errors'
import AppHeader from '../components/AppHeader'
import {
  Avatar,
  Badge,
  Button,
  Card,
  Container,
  Field,
  Notice,
  Page,
  SectionTitle,
  inputClass,
} from '../components/ui'

const statusOptions = ['To Read', 'Reading', 'Completed']

export default function CommunityPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [books, setBooks] = useState([])
  const [selectedBookId, setSelectedBookId] = useState('')
  const [reviews, setReviews] = useState([])
  const [rating, setRating] = useState(5)
  const [readingStatus, setReadingStatus] = useState('Completed')
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    api.get('/books')
      .then((response) => {
        const nextBooks = response.data || []
        setBooks(nextBooks)

        const requestedBookId = searchParams.get('book')
        if (requestedBookId && nextBooks.some((book) => String(book.id) === requestedBookId)) {
          setSelectedBookId(requestedBookId)
          return
        }

        if (nextBooks.length > 0) {
          setSelectedBookId(String(nextBooks[0].id))
        }
      })
      .catch(() => {
        setBooks([])
        setSelectedBookId('')
      })
  }, [searchParams])

  useEffect(() => {
    if (!selectedBookId) {
      setReviews([])
      return
    }

    api.get(`/books/${selectedBookId}/reviews`)
      .then((response) => setReviews(response.data || []))
      .catch(() => setReviews([]))
  }, [selectedBookId])

  const selectedBook = useMemo(
    () => books.find((book) => String(book.id) === String(selectedBookId)),
    [books, selectedBookId]
  )

  const handleBookChange = (event) => {
    const nextBookId = event.target.value
    setSelectedBookId(nextBookId)
    setSearchParams(nextBookId ? { book: nextBookId } : {})
  }

  const handleSubmitReview = async (event) => {
    event.preventDefault()
    setError('')

    if (!selectedBookId) {
      setError('Select a book first.')
      return
    }

    if (!comment.trim()) {
      setError('Please write your review before posting.')
      return
    }

    try {
      setIsSubmitting(true)
      const response = await api.post(`/books/${selectedBookId}/reviews`, {
        rating,
        readingStatus,
        comment: comment.trim(),
      })

      setReviews((previousReviews) => [response.data, ...previousReviews])
      setComment('')
      setRating(5)
      setReadingStatus('Completed')
    } catch (err) {
      setError(errorMessage(err, 'Could not publish review. Try again.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpvoteReview = async (reviewId) => {
    if (!selectedBookId) {
      return
    }

    try {
      const response = await api.post(`/books/${selectedBookId}/reviews/${reviewId}/upvote`)
      const updatedReview = response.data
      setReviews((previousReviews) => previousReviews.map((review) => (
        review.id === updatedReview.id ? updatedReview : review
      )))
    } catch {
      setError('Could not upvote this review right now.')
    }
  }

  return (
    <Page>
      <AppHeader
        title="Community Reviews"
        subtitle="Pick any shared book and post your review for everyone to read."
        primaryAction={{ to: '/books/new', label: 'Share A New Book' }}
      />

      <Container>
        <Card className="space-y-6">
          <Field id="communityBook" label="Choose book">
            <select id="communityBook" className={inputClass} value={selectedBookId} onChange={handleBookChange}>
              {books.length === 0 ? (
                <option value="">No books available yet</option>
              ) : (
                books.map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.title} by {book.author}
                  </option>
                ))
              )}
            </select>
          </Field>

          {selectedBook ? (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-sm border border-gold/60 bg-parchment p-5">
              <div className="space-y-1">
                <h2 className="font-display text-2xl text-sepia">{selectedBook.title}</h2>
                <p className="italic text-sepia/70">
                  {selectedBook.author} • {selectedBook.genre || 'Unclassified genre'}
                </p>
              </div>
              <Link
                to={`/books/${selectedBook.id}`}
                className="rounded-sm border border-gold px-4 py-2 font-display hover:border-burgundy hover:text-burgundy"
              >
                View details
              </Link>
            </div>
          ) : (
            <p className="italic text-sepia/70">Add the first book to start community reviews.</p>
          )}

          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmitReview}>
            <h3 className="font-display text-xl text-sepia md:col-span-2">Post your review</h3>

            <Field id="communityRating" label="Rating (0-5)">
              <input
                id="communityRating"
                type="number"
                min="0"
                max="5"
                className={inputClass}
                value={rating}
                onChange={(event) => setRating(Number(event.target.value))}
              />
            </Field>

            <Field id="communityStatus" label="Your status">
              <select
                id="communityStatus"
                className={inputClass}
                value={readingStatus}
                onChange={(event) => setReadingStatus(event.target.value)}
              >
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>

            <div className="md:col-span-2">
              <Field id="communityComment" label="Review comment">
                <textarea
                  id="communityComment"
                  rows="4"
                  className={inputClass}
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Share your thoughts about this book."
                />
              </Field>
            </div>

            {error && (
              <div className="md:col-span-2">
                <Notice tone="error">{error}</Notice>
              </div>
            )}

            <div className="md:col-span-2">
              <Button type="submit" variant="primary" disabled={isSubmitting || !selectedBookId}>
                {isSubmitting ? 'Posting…' : 'Post Review'}
              </Button>
            </div>
          </form>
        </Card>

        <Card>
          <SectionTitle>What readers are saying</SectionTitle>
          {reviews.length === 0 ? (
            <p className="italic text-sepia/70">No reviews yet for this book. Start the conversation.</p>
          ) : (
            <ul className="space-y-5">
              {reviews.map((review) => (
                <li key={review.id} className="space-y-3 border-b border-gold/40 pb-5 last:border-b-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <Avatar user={{ username: review.reviewerUsername }} size="sm" />
                    <strong className="font-display text-sepia">{review.reviewerUsername}</strong>
                    <Badge>{review.readingStatus}</Badge>
                    <span className="text-sm text-sepia/70">Rating: {review.rating}/5</span>
                    <span className="text-sm text-sepia/70">Upvotes: {review.upvotes ?? 0}</span>
                  </div>
                  <p className="leading-relaxed text-sepia/90">{review.comment}</p>
                  <Button variant="outline" onClick={() => handleUpvoteReview(review.id)}>
                    Upvote
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </Container>
    </Page>
  )
}
