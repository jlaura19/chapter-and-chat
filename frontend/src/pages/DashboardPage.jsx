import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppHeader from '../components/AppHeader'
import ReaderSuite from '../components/dashboard/ReaderSuite'
import ClubHub from '../components/dashboard/ClubHub'
import { Container, Notice, Page } from '../components/ui'
import api from '../services/api'
import { errorMessage } from '../services/errors'
import { getCurrentUsername } from '../services/session'

export default function DashboardPage() {
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const currentUsername = getCurrentUsername()

  useEffect(() => {
    api.get('/books/mine')
      .then((response) => setBooks(response.data))
      .catch((err) => setError(errorMessage(err, 'Could not load your books.')))
      .finally(() => setLoading(false))
  }, [])

  const handleDeleteBook = async (bookId) => {
    try {
      await api.delete(`/books/${bookId}`)
      setBooks((previousBooks) => previousBooks.filter((book) => book.id !== bookId))
    } catch (err) {
      setError(errorMessage(err, 'Failed to delete book. You can only delete books you created.'))
    }
  }

  return (
    <Page>
      <AppHeader
        title="Your Reading Desk"
        subtitle="Your personal shelf and journal, alongside the clubs you read with."
        primaryAction={{ to: '/books/new', label: 'Add New Book' }}
      />

      <Container>
        {error && <Notice>{error}</Notice>}

        <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <section aria-labelledby="reader-suite-title" className="space-y-6">
            <header>
              <p className="font-display text-xs uppercase tracking-[0.25em] text-burgundy"> · Personal</p>
              <h2 id="reader-suite-title" className="font-display text-3xl">Personal Reader Suite</h2>
              <p className="italic text-sepia/70">Only you can see your shelf, goals, and journal.</p>
            </header>
            <ReaderSuite
              books={books}
              loading={loading}
              currentUsername={currentUsername}
              onDeleteBook={handleDeleteBook}
            />
          </section>

          <section aria-labelledby="club-hub-title" className="space-y-6">
            <header>
              <p className="font-display text-xs uppercase tracking-[0.25em] text-burgundy"> Community</p>
              <h2 id="club-hub-title" className="font-display text-3xl">Club &amp; Community Hub</h2>
              <p className="italic text-sepia/70">
                Current read, discussions, meetups, and votes.{' '}
                <Link to="/clubs" className="text-burgundy underline">Browse all clubs</Link>
              </p>
            </header>
            <ClubHub currentUsername={currentUsername} />
          </section>
        </div>

        <div className="flex justify-center border-t border-gold/50 pt-6">
          <Link to="/community" className="font-display text-burgundy underline-offset-4 hover:underline">
            Explore shared book reviews
          </Link>
        </div>
      </Container>
    </Page>
  )
}
