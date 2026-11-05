import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import BookCard from '../BookCard'
import { Badge, Button, Card, Field, Notice, SectionTitle, inputClass } from '../ui'
import api from '../../services/api'
import { errorMessage } from '../../services/errors'
import { formatWhen } from '../../services/format'

const JOURNAL_KINDS = [
  { value: 'note', label: 'Margin note' },
  { value: 'quote', label: 'Quote' },
]

export default function ReaderSuite({ books, loading, currentUsername, onDeleteBook }) {
  const [goal, setGoal] = useState(0)
  const [entries, setEntries] = useState([])
  const [kindFilter, setKindFilter] = useState('note')
  const [form, setForm] = useState({ kind: 'note', bookTitle: '', page: '', body: '' })
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/profile')
      .then((response) => setGoal(response.data.readingGoal || 0))
      .catch(() => {})
    api.get('/journal')
      .then((response) => setEntries(response.data))
      .catch(() => setEntries([]))
  }, [])

  const completedCount = books.filter((book) => book.readingStatus === 'Completed').length
  const readingCount = books.filter((book) => book.readingStatus === 'Reading').length
  const toReadCount = books.filter((book) => book.readingStatus === 'To Read').length
  const goalPercent = goal > 0 ? Math.min(100, Math.round((completedCount / goal) * 100)) : 0
  const visibleEntries = entries.filter((entry) => entry.kind === kindFilter)

  const handleAddEntry = async (event) => {
    event.preventDefault()
    setError('')
    try {
      const response = await api.post('/journal', {
        kind: form.kind,
        bookTitle: form.bookTitle.trim() || null,
        page: form.page === '' ? null : Number(form.page),
        body: form.body.trim(),
      })
      setEntries((previous) => [response.data, ...previous])
      setKindFilter(form.kind)
      setForm({ kind: form.kind, bookTitle: '', page: '', body: '' })
    } catch (err) {
      setError(errorMessage(err, 'Could not save that entry.'))
    }
  }

  const handleDeleteEntry = async (entryId) => {
    try {
      await api.delete(`/journal/${entryId}`)
      setEntries((previous) => previous.filter((entry) => entry.id !== entryId))
    } catch (err) {
      setError(errorMessage(err, 'Could not delete that entry.'))
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle aside={<Link to="/profile" className="font-display text-sm text-burgundy hover:underline">Edit goal</Link>}>
          Reading goal
        </SectionTitle>
        {goal > 0 ? (
          <div className="space-y-3">
            <p className="font-display text-lg">
              {completedCount} of {goal} books finished this year
            </p>
            <div className="h-3 overflow-hidden rounded-full border border-gold bg-parchment" role="progressbar"
              aria-valuenow={goalPercent} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-gradient-to-r from-gold to-burgundy transition-all" style={{ width: `${goalPercent}%` }} />
            </div>
          </div>
        ) : (
          <p className="italic text-sepia/70">
            Set a yearly reading goal in <Link to="/profile" className="text-burgundy underline">your profile</Link> to track it here.
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="burgundy">{completedCount} finished</Badge>
          <Badge>{readingCount} reading</Badge>
          <Badge>{toReadCount} to read</Badge>
        </div>
      </Card>

      <Card>
        <SectionTitle aside={<Link to="/catalog" className="font-display text-sm text-burgundy hover:underline">Full catalog</Link>}>
          Your shelf
        </SectionTitle>
        {loading ? (
          <p className="italic text-sepia/70">Pulling your books off the shelf…</p>
        ) : books.length === 0 ? (
          <p className="italic text-sepia/70">Your shelf is empty. Add a book to start your collection.</p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">
            {books.slice(0, 6).map((book) => (
              <BookCard
                key={book.id}
                book={book}
                canManage={book.ownerUsername === currentUsername}
                onDelete={onDeleteBook}
              />
            ))}
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle aside={
          <div role="tablist" className="flex gap-2">
            {JOURNAL_KINDS.map((kind) => (
              <button key={kind.value} type="button" role="tab" aria-selected={kindFilter === kind.value}
                onClick={() => setKindFilter(kind.value)}
                className={`rounded-sm border px-3 py-1 font-display text-sm ${kindFilter === kind.value ? 'border-burgundy bg-burgundy text-parchment' : 'border-gold hover:border-burgundy'}`}>
                {kind.label}s
              </button>
            ))}
          </div>
        }>
          Commonplace journal
        </SectionTitle>

        {error && <div className="mb-4"><Notice>{error}</Notice></div>}

        <form className="mb-6 grid gap-3 rounded-sm border border-dashed border-gold bg-parchment/60 p-4 md:grid-cols-[1fr_1fr_120px]" onSubmit={handleAddEntry}>
          <Field id="journalKind" label="Entry type">
            <select id="journalKind" className={inputClass} value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              {JOURNAL_KINDS.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
            </select>
          </Field>
          <Field id="journalBook" label="Book">
            <input id="journalBook" maxLength={255} className={inputClass} placeholder="Optional"
              value={form.bookTitle} onChange={(e) => setForm({ ...form, bookTitle: e.target.value })} />
          </Field>
          <Field id="journalPage" label="Page">
            <input id="journalPage" type="number" min={0} className={inputClass} value={form.page}
              onChange={(e) => setForm({ ...form, page: e.target.value })} />
          </Field>
          <div className="md:col-span-3">
            <Field id="journalBody" label={form.kind === 'quote' ? 'Quotation' : 'Margin note'}>
              <textarea id="journalBody" rows={3} maxLength={5000} required className={inputClass}
                value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            </Field>
          </div>
          <div className="md:col-span-3">
            <Button type="submit" variant="outline">Add to journal</Button>
          </div>
        </form>

        {visibleEntries.length === 0 ? (
          <p className="italic text-sepia/70">No {kindFilter === 'quote' ? 'quotes' : 'margin notes'} yet.</p>
        ) : (
          <ul className="space-y-4">
            {visibleEntries.map((entry) => (
              <li key={entry.id} className="border-l-2 border-gold pl-4">
                <p className={`text-lg leading-relaxed ${entry.kind === 'quote' ? 'font-display italic' : ''}`}>
                  {entry.kind === 'quote' ? `“${entry.body}”` : entry.body}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-sepia/70">
                  {entry.bookTitle && <span className="italic">{entry.bookTitle}</span>}
                  {entry.page !== null && entry.page !== undefined && <span>p. {entry.page}</span>}
                  <span>{formatWhen(entry.createdAt)}</span>
                  <button type="button" className="text-burgundy hover:underline" onClick={() => handleDeleteEntry(entry.id)}>
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
