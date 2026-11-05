import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../services/api'
import { errorMessage } from '../services/errors'
import { resolveMediaUrl } from '../services/media'
import AppHeader from '../components/AppHeader'
import { Button, Card, Container, Field, Notice, Page, inputClass } from '../components/ui'

const statusOptions = ['To Read', 'Reading', 'Completed']

export default function BookFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [genre, setGenre] = useState('')
  const [readingStatus, setReadingStatus] = useState('To Read')
  const [rating, setRating] = useState(0)
  const [reviewNotes, setReviewNotes] = useState('')
  const [coverImageFile, setCoverImageFile] = useState(null)
  const [coverPreview, setCoverPreview] = useState('')
  const [existingCover, setExistingCover] = useState('')
  const [error, setError] = useState('')

  const isEditing = Boolean(id)

  useEffect(() => {
    if (!isEditing) {
      setCoverPreview('')
      return
    }

    api.get(`/books/${id}`)
      .then((response) => {
        const book = response.data
        setTitle(book.title || '')
        setAuthor(book.author || '')
        setGenre(book.genre || '')
        setReadingStatus(book.readingStatus || 'To Read')
        setRating(book.rating || 0)
        setReviewNotes(book.reviewNotes || '')
        setExistingCover(book.coverImageUrl || '')
      })
      .catch(() => navigate('/catalog'))
  }, [id, isEditing, navigate])

  useEffect(() => {
    if (!coverImageFile) {
      return
    }

    const previewUrl = URL.createObjectURL(coverImageFile)
    setCoverPreview(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [coverImageFile])

  const titleText = useMemo(() => (isEditing ? 'Edit Book' : 'Add Book'), [isEditing])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!title.trim() || !author.trim()) {
      setError('Please provide both the title and author.')
      return
    }

    const formData = new FormData()
    const bookPayload = {
      title: title.trim(),
      author: author.trim(),
      genre: genre.trim(),
      readingStatus,
      rating,
      reviewNotes: reviewNotes.trim(),
    }

    formData.append('book', new Blob([JSON.stringify(bookPayload)], { type: 'application/json' }))
    if (coverImageFile) {
      formData.append('coverImage', coverImageFile)
    }

    try {
      if (isEditing) {
        await api.put(`/books/${id}`, formData)
      } else {
        await api.post('/books', formData)
      }
      navigate('/catalog')
    } catch (err) {
      setError(errorMessage(err, 'Failed to save the book. Please try again.'))
    }
  }

  const previewSrc = coverPreview || (existingCover ? resolveMediaUrl(existingCover) : '')

  return (
    <Page>
      <AppHeader
        title={titleText}
        subtitle="Create a shared book entry and track your reading status."
        primaryAction={{ to: '/community', label: 'Open Community' }}
      />

      <Container>
        <Card>
          <form className="grid gap-5 md:grid-cols-2" onSubmit={handleSubmit}>
            <Field id="title" label="Title">
              <input
                id="title"
                className={inputClass}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
              />
            </Field>

            <Field id="author" label="Author">
              <input
                id="author"
                className={inputClass}
                value={author}
                onChange={(event) => setAuthor(event.target.value)}
                required
              />
            </Field>

            <Field id="genre" label="Genre">
              <input
                id="genre"
                className={inputClass}
                value={genre}
                onChange={(event) => setGenre(event.target.value)}
              />
            </Field>

            <Field id="readingStatus" label="Reading status">
              <select
                id="readingStatus"
                className={inputClass}
                value={readingStatus}
                onChange={(event) => setReadingStatus(event.target.value)}
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </Field>

            <Field id="rating" label="Rating (0-5)">
              <input
                id="rating"
                type="number"
                min="0"
                max="5"
                className={inputClass}
                value={rating}
                onChange={(event) => setRating(Number(event.target.value))}
              />
            </Field>

            <Field id="coverImage" label="Cover image">
              <input
                id="coverImage"
                type="file"
                accept="image/*"
                className="text-sm text-sepia file:mr-3 file:rounded-sm file:border file:border-gold file:bg-parchment file:px-3 file:py-2 file:font-display file:text-sepia hover:file:border-burgundy"
                onChange={(event) => setCoverImageFile(event.target.files?.[0] || null)}
              />
            </Field>

            <div className="md:col-span-2">
              <Field id="reviewNotes" label="Review notes">
                <textarea
                  id="reviewNotes"
                  rows="4"
                  className={inputClass}
                  value={reviewNotes}
                  onChange={(event) => setReviewNotes(event.target.value)}
                />
              </Field>
            </div>

            {previewSrc && (
              <div className="md:col-span-2">
                <img
                  alt="Cover preview"
                  src={previewSrc}
                  className="max-h-72 rounded-sm border border-gold object-contain shadow-card"
                />
              </div>
            )}

            {error && (
              <div className="md:col-span-2">
                <Notice tone="error">{error}</Notice>
              </div>
            )}

            <div className="flex flex-wrap gap-3 md:col-span-2">
              <Button type="submit" variant="primary">
                {isEditing ? 'Update book' : 'Add book'}
              </Button>
              <Button variant="outline" onClick={() => navigate('/catalog')}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      </Container>
    </Page>
  )
}
