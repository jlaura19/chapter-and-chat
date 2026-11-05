import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import { errorMessage } from '../../services/errors'
import { countdownParts, formatWhen, parseDate } from '../../services/format'
import { Avatar, Badge, Button, Card, Field, Notice, SectionTitle, inputClass } from '../ui'

const RSVP_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'no', label: 'No' },
]

const primaryLinkClass = 'inline-block rounded-sm bg-burgundy px-4 py-2 font-display text-parchment hover:bg-burgundy/90'

function fetchHub(clubId) {
  return Promise.all([
    api.get(`/clubs/${clubId}/progress`),
    api.get(`/clubs/${clubId}/events`),
    api.get(`/clubs/${clubId}/boards`),
    api.get(`/clubs/${clubId}/members`),
    api.get(`/clubs/${clubId}/nominations`),
  ]).then(([progress, events, boards, members, nominations]) => ({
    progress: progress.data,
    events: events.data,
    boards: boards.data,
    members: members.data,
    nominations: nominations.data,
  }))
}

export default function ClubHub({ currentUsername }) {
  const [clubs, setClubs] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [hub, setHub] = useState(null)
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [progressOpen, setProgressOpen] = useState(false)
  const [progressForm, setProgressForm] = useState({ page: '', chapter: '' })
  const [draft, setDraft] = useState('')

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    api.get('/clubs')
      .then((response) => {
        const mine = response.data.filter((club) => club.isMember)
        setClubs(mine)
        setSelectedId((current) => current ?? mine[0]?.id ?? null)
      })
      .catch((err) => {
        setError(errorMessage(err, 'Could not load your clubs.'))
        setClubs([])
      })
  }, [])

  useEffect(() => {
    if (!selectedId) {
      return undefined
    }
    let cancelled = false
    setHub(null)
    setProgressOpen(false)
    fetchHub(selectedId)
      .then((data) => {
        if (!cancelled) {
          setHub(data)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(errorMessage(err, 'Could not load this club.'))
        }
      })
    return () => {
      cancelled = true
    }
  }, [selectedId])

  const refreshHub = () => {
    if (!selectedId) {
      return
    }
    fetchHub(selectedId)
      .then(setHub)
      .catch((err) => setError(errorMessage(err, 'Could not refresh this club.')))
  }

  const runAction = async (action, fallback) => {
    setError('')
    try {
      await action()
      refreshHub()
    } catch (err) {
      setError(errorMessage(err, fallback))
    }
  }

  if (clubs === null) {
    return (
      <Card>
        <p className="italic text-sepia/70">Gathering your clubs…</p>
      </Card>
    )
  }

  const club = clubs.find((item) => item.id === selectedId) ?? null

  if (!club) {
    return (
      <Card>
        <SectionTitle>Club & Community</SectionTitle>
        {error && <div className="mb-4"><Notice>{error}</Notice></div>}
        <p className="mb-4 italic text-sepia/70">You are not in a club yet. Find one to start reading together.</p>
        <Link to="/clubs" className={primaryLinkClass}>Discover clubs</Link>
      </Card>
    )
  }

  const pages = club.currentReadPages || 0
  const progressRows = hub?.progress ?? []
  const myProgress = progressRows.find((row) => row.user.username === currentUsername)
  const readPercent = pages > 0 ? Math.min(100, Math.round(((myProgress?.page ?? 0) / pages) * 100)) : 0
  const upcomingEvents = (hub?.events ?? [])
    .filter((event) => (parseDate(event.startsAt)?.getTime() ?? 0) > now)
    .slice(0, 3)
  const nextEvent = upcomingEvents[0]
  const countdown = nextEvent ? countdownParts(nextEvent.startsAt, now) : null
  const boards = [...(hub?.boards ?? [])]
    .sort((a, b) => (parseDate(b.lastActivityAt)?.getTime() ?? 0) - (parseDate(a.lastActivityAt)?.getTime() ?? 0))
    .slice(0, 4)
  const shareBoard = hub?.boards.find((board) => board.kind === 'chat') ?? hub?.boards[0]
  const nominations = [...(hub?.nominations ?? [])].sort((a, b) => b.votes - a.votes)
  const readingByUser = new Map(progressRows.map((row) => [row.user.username, row]))

  const openProgress = () => {
    setProgressForm({ page: myProgress?.page ?? '', chapter: myProgress?.chapter ?? '' })
    setProgressOpen((open) => !open)
  }

  const saveProgress = (event) => {
    event.preventDefault()
    runAction(async () => {
      await api.put(`/clubs/${club.id}/progress`, {
        page: Number(progressForm.page) || 0,
        chapter: progressForm.chapter.trim(),
      })
      setProgressOpen(false)
    }, 'Could not save your progress.')
  }

  const rsvp = (eventId, response) =>
    runAction(() => api.put(`/clubs/${club.id}/events/${eventId}/rsvp`, { response }), 'Could not record your RSVP.')

  const toggleVote = (nomination) =>
    runAction(
      () => (nomination.myVote
        ? api.delete(`/clubs/${club.id}/nominations/${nomination.id}/vote`)
        : api.post(`/clubs/${club.id}/nominations/${nomination.id}/vote`)),
      'Could not update your vote.',
    )

  const shareThought = (event) => {
    event.preventDefault()
    const body = draft.trim()
    if (!body || !shareBoard) {
      return
    }
    runAction(async () => {
      await api.post(`/clubs/${club.id}/boards/${shareBoard.id}/messages`, { body })
      setDraft('')
    }, 'Could not share your thought.')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {clubs.length > 1 ? (
          <Field id="hubClub" label="Club">
            <select id="hubClub" className={inputClass} value={club.id} onChange={(e) => setSelectedId(Number(e.target.value))}>
              {clubs.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </Field>
        ) : (
          <p className="font-display text-xl">{club.name}</p>
        )}
        <Link to={`/clubs/${club.id}`} className="font-display text-sm text-burgundy hover:underline">Open club</Link>
      </div>

      {error && <Notice>{error}</Notice>}

      <Card className="bg-gradient-to-br from-white/80 to-gold/20">
        <p className="font-display text-xs uppercase tracking-[0.2em] text-burgundy">Book of the month</p>
        <h3 className="mt-2 font-display text-3xl leading-tight">{club.currentReadTitle || 'No book chosen yet'}</h3>
        {club.currentReadAuthor && <p className="italic text-sepia/70">by {club.currentReadAuthor}</p>}

        {pages > 0 && (
          <div className="mt-5 space-y-2">
            <div className="h-2.5 overflow-hidden rounded-full border border-gold bg-parchment" role="progressbar"
              aria-valuenow={readPercent} aria-valuemin={0} aria-valuemax={100} aria-label="Your reading progress">
              <div className="h-full bg-gradient-to-r from-gold to-burgundy transition-all" style={{ width: `${readPercent}%` }} />
            </div>
            <p className="text-sm text-sepia/80">
              Page {myProgress?.page ?? 0} of {pages} • Chapter {myProgress?.chapter || '—'}
            </p>
          </div>
        )}

        <div className="mt-5 rounded-sm border border-gold/60 bg-parchment/70 p-3">
          <p className="font-display text-xs uppercase tracking-wide text-sepia/70">Next live meeting</p>
          {nextEvent ? (
            <p className="mt-1">
              <span className="font-display text-lg">{nextEvent.title}</span>
              <span className="ml-2 text-sepia/80">
                {countdown && `in ${countdown.days}d ${countdown.hours}h ${countdown.minutes}m`} • {formatWhen(nextEvent.startsAt)}
              </span>
            </p>
          ) : (
            <p className="mt-1 italic text-sepia/70">Nothing scheduled yet.</p>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link to={`/clubs/${club.id}`} className={primaryLinkClass}>Join Next Discussion</Link>
          <Button variant="outline" onClick={openProgress} aria-expanded={progressOpen}>Update My Progress</Button>
        </div>

        {progressOpen && (
          <form className="mt-4 grid gap-3 rounded-sm border border-dashed border-gold p-4 sm:grid-cols-[140px_1fr_auto]" onSubmit={saveProgress}>
            <Field id="progPage" label="Page">
              <input id="progPage" type="number" min={0} max={100000} required className={inputClass} value={progressForm.page}
                onChange={(e) => setProgressForm({ ...progressForm, page: e.target.value })} />
            </Field>
            <Field id="progChapter" label="Chapter">
              <input id="progChapter" maxLength={64} className={inputClass} value={progressForm.chapter}
                onChange={(e) => setProgressForm({ ...progressForm, chapter: e.target.value })} />
            </Field>
            <div className="flex items-end">
              <Button type="submit">Save</Button>
            </div>
          </form>
        )}
      </Card>

      <Card>
        <SectionTitle aside={<Link to={`/clubs/${club.id}`} className="font-display text-sm text-burgundy hover:underline">All threads</Link>}>
          Trending discussions
        </SectionTitle>
        {boards.length === 0 ? (
          <p className="italic text-sepia/70">No discussion boards yet.</p>
        ) : (
          <ul className="space-y-3">
            {boards.map((board) => (
              <li key={board.id} className="flex items-start justify-between gap-4 rounded-sm border border-gold/50 bg-parchment/60 p-3">
                <div>
                  <p className="font-display text-lg">{board.title}</p>
                  {board.prompt && <p className="italic text-sepia/70">{board.prompt}</p>}
                </div>
                <Badge tone={board.replyCount > 0 ? 'burgundy' : 'neutral'}>{board.replyCount} replies</Badge>
              </li>
            ))}
          </ul>
        )}

        <form className="mt-5 space-y-2" onSubmit={shareThought}>
          <Field id="shareThought" label="Share a thought or quote">
            <textarea id="shareThought" rows={2} maxLength={2000} className={inputClass} disabled={!shareBoard}
              placeholder={shareBoard ? `Post to ${shareBoard.title}` : 'Create a discussion board to start talking'}
              value={draft} onChange={(e) => setDraft(e.target.value)} />
          </Field>
          <Button type="submit" variant="outline" disabled={!shareBoard || !draft.trim()}>Share</Button>
        </form>
      </Card>

      <Card>
        <SectionTitle aside={<span className="text-sm text-sepia/70">{hub?.members.length ?? 0} members</span>}>
          Who is reading
        </SectionTitle>
        <ul className="flex flex-wrap gap-2">
          {(hub?.members ?? []).slice(0, 12).map((member) => {
            const reading = readingByUser.get(member.user.username)
            return (
              <li key={member.user.id} className="flex items-center gap-2 rounded-full border border-gold/70 bg-parchment py-1 pl-1 pr-3 text-sm">
                <Avatar user={member.user} size="sm" />
                <span>{member.user.displayName || member.user.username}</span>
                {reading && <span className="text-xs text-burgundy">p. {reading.page}</span>}
              </li>
            )
          })}
        </ul>
      </Card>

      <Card>
        <SectionTitle>Upcoming meetings</SectionTitle>
        {upcomingEvents.length === 0 ? (
          <p className="italic text-sepia/70">No meetings scheduled. Admins can add one from the club page.</p>
        ) : (
          <ul className="space-y-4">
            {upcomingEvents.map((event) => (
              <li key={event.id} className="flex flex-wrap items-center justify-between gap-4 border-b border-gold/40 pb-4 last:border-0 last:pb-0">
                <div>
                  <p className="font-display text-lg">{event.title}</p>
                  <p className="text-sm text-sepia/80">{formatWhen(event.startsAt)}{event.location ? ` • ${event.location}` : ''}</p>
                  <p className="text-xs text-sepia/60">
                    Yes {event.rsvpCounts.yes} · Maybe {event.rsvpCounts.maybe} · No {event.rsvpCounts.no}
                  </p>
                </div>
                <div role="group" aria-label={`RSVP to ${event.title}`} className="flex gap-2">
                  {RSVP_OPTIONS.map((option) => {
                    const selected = event.myRsvp === option.value
                    return (
                      <button key={option.value} type="button" aria-pressed={selected}
                        onClick={() => rsvp(event.id, option.value)}
                        className={`rounded-sm border px-3 py-1 font-display text-sm transition ${selected ? 'border-burgundy bg-burgundy text-parchment' : 'border-gold hover:border-burgundy'}`}>
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionTitle aside={<Link to={`/clubs/${club.id}`} className="font-display text-sm text-burgundy hover:underline">Propose a book</Link>}>
          Up for the next vote
        </SectionTitle>
        {nominations.length === 0 ? (
          <p className="italic text-sepia/70">No nominations yet.</p>
        ) : (
          <div className="flex snap-x gap-4 overflow-x-auto pb-3">
            {nominations.map((nomination) => (
              <article key={nomination.id} className="flex w-56 shrink-0 snap-start flex-col justify-between gap-4 rounded-md border border-gold/70 bg-parchment p-4 shadow-card">
                <div>
                  <p className="line-clamp-2 font-display text-lg leading-snug">{nomination.title}</p>
                  {nomination.author && <p className="italic text-sepia/70">{nomination.author}</p>}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-sm text-burgundy">{nomination.votes} {nomination.votes === 1 ? 'vote' : 'votes'}</span>
                  <Button variant={nomination.myVote ? 'primary' : 'outline'} className="px-3 py-1 text-sm" onClick={() => toggleVote(nomination)}
                    aria-pressed={nomination.myVote}>
                    {nomination.myVote ? 'Voted' : 'Vote'}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
