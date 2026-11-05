import { useCallback, useEffect, useState } from 'react'
import api from '../../services/api'
import { errorMessage } from '../../services/errors'
import { formatWhen, localInputToIso, parseDate, toDateTimeLocal } from '../../services/format'
import { Button, Card, Field, Notice, SectionTitle, inputClass } from '../ui'

const RSVP_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'no', label: 'No' },
]

const emptyEvent = { title: '', description: '', location: '', meetLink: '', startsAt: '', notifyMembers: true }

export default function ScheduleBoard({ clubId, isAdmin }) {
  const [events, setEvents] = useState([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [eventForm, setEventForm] = useState(emptyEvent)
  const [announcement, setAnnouncement] = useState('')
  const [busyEventId, setBusyEventId] = useState(null)

  const loadEvents = useCallback(() => {
    api.get(`/clubs/${clubId}/events`)
      .then((response) => setEvents(response.data))
      .catch((err) => setError(errorMessage(err, 'Could not load the schedule.')))
  }, [clubId])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  const handleRsvp = async (eventId, response) => {
    setBusyEventId(eventId)
    setError('')
    try {
      await api.put(`/clubs/${clubId}/events/${eventId}/rsvp`, { response })
      loadEvents()
    } catch (err) {
      setError(errorMessage(err, 'Could not save your RSVP.'))
    } finally {
      setBusyEventId(null)
    }
  }

  const handleCreateEvent = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')
    if (!eventForm.startsAt) {
      setError('Pick a date and time for the meetup.')
      return
    }
    try {
      await api.post(`/clubs/${clubId}/events`, { ...eventForm, startsAt: localInputToIso(eventForm.startsAt) })
      setEventForm(emptyEvent)
      setNotice(eventForm.notifyMembers ? 'Meetup scheduled and members notified.' : 'Meetup scheduled.')
      loadEvents()
    } catch (err) {
      setError(errorMessage(err, 'Could not schedule the meetup.'))
    }
  }

  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm('Cancel and remove this meetup?')) {
      return
    }
    try {
      await api.delete(`/clubs/${clubId}/events/${eventId}`)
      loadEvents()
    } catch (err) {
      setError(errorMessage(err, 'Could not remove the meetup.'))
    }
  }

  const handleAnnouncement = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')
    try {
      await api.post(`/clubs/${clubId}/announcements`, { message: announcement.trim() })
      setAnnouncement('')
      setNotice('Announcement sent to members.')
    } catch (err) {
      setError(errorMessage(err, 'Could not send the announcement.'))
    }
  }

  const now = Date.now()
  const upcoming = events.filter((event) => (parseDate(event.startsAt)?.getTime() ?? 0) >= now)
  const past = events.filter((event) => (parseDate(event.startsAt)?.getTime() ?? 0) < now)

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <Card>
          <SectionTitle>Upcoming meetups</SectionTitle>
          {upcoming.length === 0 ? (
            <p className="italic text-sepia/70">Nothing scheduled yet.</p>
          ) : (
            <ul className="space-y-4">
              {upcoming.map((item) => (
                <EventItem
                  key={item.id}
                  item={item}
                  isAdmin={isAdmin}
                  busy={busyEventId === item.id}
                  onRsvp={handleRsvp}
                  onDelete={handleDeleteEvent}
                />
              ))}
            </ul>
          )}
        </Card>

        {past.length > 0 && (
          <Card className="opacity-80">
            <SectionTitle>Past meetups</SectionTitle>
            <ul className="space-y-4">
              {past.map((item) => (
                <EventItem key={item.id} item={item} isAdmin={isAdmin} busy={false} onRsvp={handleRsvp} onDelete={handleDeleteEvent} />
              ))}
            </ul>
          </Card>
        )}

        {error && <Notice>{error}</Notice>}
        {notice && <Notice tone="info">{notice}</Notice>}
      </div>

      {isAdmin && (
        <aside className="space-y-6">
          <Card>
            <SectionTitle>Schedule a meetup</SectionTitle>
            <form className="space-y-3" onSubmit={handleCreateEvent}>
              <Field id="eventTitle" label="Title">
                <input id="eventTitle" className={inputClass} required minLength={2} maxLength={160}
                  placeholder="Chapters 1–5 sync" value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} />
              </Field>
              <Field id="eventStart" label="When">
                <input id="eventStart" type="datetime-local" className={inputClass} required
                  min={toDateTimeLocal(new Date())} value={eventForm.startsAt}
                  onChange={(e) => setEventForm({ ...eventForm, startsAt: e.target.value })} />
              </Field>
              <Field id="eventLocation" label="Location">
                <input id="eventLocation" className={inputClass} maxLength={160} placeholder="Campus Library, Room 2"
                  value={eventForm.location} onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })} />
              </Field>
              <Field id="eventLink" label="Meet link">
                <input id="eventLink" className={inputClass} maxLength={255} placeholder="https://meet.example.com/…"
                  value={eventForm.meetLink} onChange={(e) => setEventForm({ ...eventForm, meetLink: e.target.value })} />
              </Field>
              <Field id="eventNotes" label="Notes">
                <textarea id="eventNotes" className={inputClass} rows={3} maxLength={4000}
                  value={eventForm.description} onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={eventForm.notifyMembers}
                  onChange={(e) => setEventForm({ ...eventForm, notifyMembers: e.target.checked })} />
                Notify members
              </label>
              <Button type="submit" className="w-full">Publish meetup</Button>
            </form>
          </Card>

          <Card>
            <SectionTitle>Announcement</SectionTitle>
            <form className="space-y-3" onSubmit={handleAnnouncement}>
              <label htmlFor="announcement" className="sr-only">Announcement message</label>
              <textarea id="announcement" className={inputClass} rows={3} maxLength={1000} required
                placeholder="Broadcast a note to every member…" value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)} />
              <Button type="submit" variant="outline" className="w-full" disabled={!announcement.trim()}>
                Broadcast
              </Button>
            </form>
          </Card>
        </aside>
      )}
    </div>
  )
}

function EventItem({ item, isAdmin, busy, onRsvp, onDelete }) {
  const counts = item.rsvpCounts
  return (
    <li className="rounded-sm border border-gold/50 bg-parchment p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg">{item.title}</h3>
          <p className="text-sm text-sepia/80">
            {formatWhen(item.startsAt)}
            {item.location && ` • ${item.location}`}
          </p>
          {item.meetLink && (
            <a href={item.meetLink} target="_blank" rel="noreferrer" className="text-sm text-burgundy underline-offset-4 hover:underline">
              Join link
            </a>
          )}
          {item.description && <p className="mt-2 italic text-sepia/70">{item.description}</p>}
        </div>
        {isAdmin && (
          <Button variant="danger" className="px-3 py-1 text-sm" onClick={() => onDelete(item.id)}>
            Cancel
          </Button>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label={`RSVP for ${item.title}`}>
        {RSVP_OPTIONS.map((option) => {
          const active = item.myRsvp === option.value
          return (
            <button
              key={option.value}
              type="button"
              disabled={busy}
              aria-pressed={active}
              onClick={() => onRsvp(item.id, option.value)}
              className={`rounded-sm border px-3 py-1 font-display text-sm transition disabled:opacity-50 ${
                active ? 'border-burgundy bg-burgundy text-parchment' : 'border-gold text-sepia hover:border-burgundy'
              }`}
            >
              {option.label} · {counts[option.value]}
            </button>
          )
        })}
      </div>
    </li>
  )
}
