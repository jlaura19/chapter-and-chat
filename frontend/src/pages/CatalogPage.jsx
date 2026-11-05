import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import BookCard from '../components/BookCard'
import AppHeader from '../components/AppHeader'
import { Container, Page, inputClass } from '../components/ui'
import { getCurrentUsername } from '../services/session'

const statusOptions = ['All', 'To Read', 'Reading', 'Completed']

export default function CatalogPage() {
  const [books, setBooks] = useState([])
  const [filter, setFilter] = useState('All')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const currentUsername = getCurrentUsername()

  useEffect(() => {
    api.get('/books')
      .then((response) => setBooks(response.data))
      .catch(() => setBooks([]))
      .finally(() => setLoading(false))
  }, [])

  const handleDeleteBook = async (bookId) => {
    try {
      await api.delete(`/books/${bookId}`)
      setBooks((previousBooks) => previousBooks.filter((book) => book.id !== bookId))
    } catch {
      window.alert('Failed to delete book. You can only delete books you created.')
    }
  }

  const filteredBooks = useMemo(() => {
    return books.filter((book) => {
      const matchesQuery = `${book.title} ${book.author} ${book.genre}`
        .toLowerCase()
        .includes(query.toLowerCase())
      const matchesStatus = filter === 'All' || book.readingStatus === filter
      return matchesQuery && matchesStatus
    })
  }, [books, filter, query])

  return (
    <Page>
      <AppHeader
        title="Catalog"
        subtitle="Browse all shared books, then jump into reviews and discussion."
        primaryAction={{ to: '/books/new', label: 'Add New Book' }}
      />

      <Container>
      <section className="grid gap-4 md:grid-cols-[1fr_220px]">
        <input
          className={inputClass}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by title, author, or genre"
        />
        <select className={inputClass} value={filter} onChange={(event) => setFilter(event.target.value)}>
          {statusOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </section>

      {loading ? (
        <p className="italic text-sepia/70">Loading your book collection…</p>
      ) : filteredBooks.length === 0 ? (
        <div className="space-y-3 rounded-md border border-dashed border-gold p-8 text-center">
          <p className="italic text-sepia/70">No books found. Try adjusting your search or adding a new book.</p>
          <Link to="/books/new" className="inline-block rounded-sm border border-gold px-4 py-2 font-display hover:border-burgundy hover:text-burgundy">
            Add a book
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredBooks.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              canManage={book.ownerUsername === currentUsername}
              onDelete={handleDeleteBook}
            />
          ))}
        </div>
      )}
      </Container>
    </Page>
  )
}
