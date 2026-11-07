import { Link } from 'react-router-dom'
import { resolveMediaUrl } from '../services/media'

const statusTone = {
  Completed: 'border-burgundy bg-burgundy text-parchment',
  Reading: 'border-gold bg-gold/30 text-sepia',
  'To Read': 'border-gold text-sepia/80',
}

export default function BookCard({ book, canManage = false, onDelete }) {
  const handleDelete = async () => {
    if (!onDelete) {
      return
    }

    const isConfirmed = window.confirm(`Delete "${book.title}"? This action cannot be undone.`)
    if (!isConfirmed) {
      return
    }

    await onDelete(book.id)
  }

  return (
    <article className="flex flex-col gap-3 rounded-md border border-gold/70 bg-surface/70 p-3 shadow-card transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative aspect-[2/3] overflow-hidden rounded-sm border border-gold/60 bg-gradient-to-br from-sepia/80 to-sepia">
        {book.coverImageUrl ? (
          <img src={resolveMediaUrl(book.coverImageUrl)} alt={`${book.title} cover`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center p-3 text-center font-display text-sm text-gold">
            {book.title}
          </div>
        )}
        <span className="absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-black/30 to-transparent" aria-hidden="true" />
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <h3 className="line-clamp-2 font-display text-lg leading-snug">{book.title}</h3>
        <p className="italic text-sepia/70">{book.author}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-full border px-2 py-0.5 font-display uppercase tracking-wide ${statusTone[book.readingStatus] || 'border-gold text-sepia/80'}`}>
            {book.readingStatus || 'Unknown'}
          </span>
          {book.genre && <span className="text-sepia/60">{book.genre}</span>}
          <span className="ml-auto text-sepia/70">{book.rating ? `★ ${book.rating}` : 'Unrated'}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-gold/40 pt-3 text-sm">
        <Link to={`/community?book=${book.id}`} className="rounded-sm border border-gold px-3 py-1 font-display hover:border-burgundy hover:text-burgundy">
          Reviews
        </Link>
        {canManage && (
          <>
            <Link to={`/books/${book.id}`} className="rounded-sm border border-gold px-3 py-1 font-display hover:border-burgundy hover:text-burgundy">
              Edit
            </Link>
            <button type="button" className="rounded-sm px-3 py-1 font-display text-burgundy hover:underline" onClick={handleDelete}>
              Delete
            </button>
          </>
        )}
      </div>
    </article>
  )
}
