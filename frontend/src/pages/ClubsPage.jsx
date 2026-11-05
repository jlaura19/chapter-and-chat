import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppHeader from '../components/AppHeader'
import { Badge, Button, Card, Container, Field, Notice, Page, SectionTitle, inputClass } from '../components/ui'
import api from '../services/api'
import { parseInviteLink } from '../services/clubLinks'
import { errorMessage } from '../services/errors'

const emptyClub = {
  name: '',
  description: '',
  privacy: 'public',
  currentReadTitle: '',
  currentReadAuthor: '',
  currentReadPages: '',
}

const FILTERS = [
  { value: 'all', label: 'All clubs' },
  { value: 'mine', label: 'My clubs' },
  { value: 'discover', label: 'Discover' },
]

export default function ClubsPage() {
  const navigate = useNavigate()
  const [clubs, setClubs] = useState([])
  const [filter, setFilter] = useState('all')
  const [form, setForm] = useState(emptyClub)
  const [inviteText, setInviteText] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)

  const loadClubs = () => {
    setLoading(true)
    api.get('/clubs')
      .then((response) => setClubs(response.data))
      .catch((err) => setError(errorMessage(err, 'Could not load clubs.')))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadClubs()
  }, [])

  const visible = useMemo(() => {
    if (filter === 'mine') {
      return clubs.filter((club) => club.isMember)
    }
    if (filter === 'discover') {
      return clubs.filter((club) => !club.isMember)
    }
    return clubs
  }, [clubs, filter])

  const handleCreate = async (event) => {
    event.preventDefault()
    setError('')
    try {
      const response = await api.post('/clubs', {
        name: form.name.trim(),
        description: form.description.trim(),
        privacy: form.privacy,
        currentReadTitle: form.currentReadTitle.trim(),
        currentReadAuthor: form.currentReadAuthor.trim(),
        currentReadPages: Number(form.currentReadPages) || 0,
      })
      navigate(`/clubs/${response.data.id}`)
    } catch (err) {
      setError(errorMessage(err, 'Could not create the club.'))
    }
  }

  const handleJoin = async (club) => {
    setError('')
    setNotice('')
    try {
      const response = await api.post(`/clubs/${club.id}/join`, {})
      if (response.data.status === 'joined') {
        navigate(`/clubs/${club.id}`)
        return
      }
      setNotice(`Request sent to the admins of ${club.name}.`)
      loadClubs()
    } catch (err) {
      setError(errorMessage(err, 'Could not join the club.'))
    }
  }

  const handlePasteInvite = (event) => {
    event.preventDefault()
    const parsed = parseInviteLink(inviteText)
    if (!parsed) {
      setError('That does not look like a club invite link.')
      return
    }
    navigate(`/clubs/${parsed.clubId}?invite=${encodeURIComponent(parsed.code)}`)
  }

  return (
    <Page>
      <AppHeader title="Book Clubs" subtitle="Gather a circle of readers around a shared shelf" />
      <Container>
        <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
          <section className="space-y-6">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter clubs">
              {FILTERS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  role="tab"
                  aria-selected={filter === item.value}
                  onClick={() => setFilter(item.value)}
                  className={`rounded-sm border px-4 py-1.5 font-display transition ${
                    filter === item.value ? 'border-burgundy bg-burgundy text-parchment' : 'border-gold hover:border-burgundy'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {loading && <p className="italic text-sepia/70">Loading clubs…</p>}
            {!loading && visible.length === 0 && (
              <Card>
                <p className="italic text-sepia/70">
                  {filter === 'mine' ? 'You have not joined a club yet.' : 'No clubs to show here yet.'}
                </p>
              </Card>
            )}

            <ul className="grid gap-5 md:grid-cols-2">
              {visible.map((club) => (
                <li key={club.id}>
                  <Card className="flex h-full flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-display text-xl">{club.name}</h3>
                      <Badge tone={club.isMember ? 'burgundy' : 'neutral'}>
                        {club.isMember ? club.myRole : club.privacy}
                      </Badge>
                    </div>
                    <p className="line-clamp-3 text-sm text-sepia/80">{club.description || 'No description yet.'}</p>
                    {club.currentReadTitle && (
                      <p className="text-sm italic">
                        Reading <span className="font-display not-italic">{club.currentReadTitle}</span>
                        {club.currentReadAuthor && ` by ${club.currentReadAuthor}`}
                      </p>
                    )}
                    <p className="text-xs uppercase tracking-wide text-sepia/60">{club.memberCount} members</p>
                    <div className="mt-auto pt-2">
                      {club.isMember ? (
                        <Link to={`/clubs/${club.id}`} className="font-display text-burgundy underline-offset-4 hover:underline">
                          Open club →
                        </Link>
                      ) : (
                        <Button className="px-3 py-1.5 text-sm" onClick={() => handleJoin(club)}>
                          {club.privacy === 'private' ? 'Request to join' : 'Join instantly'}
                        </Button>
                      )}
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          </section>

          <aside className="space-y-6">
            {notice && <Notice tone="info">{notice}</Notice>}
            {error && <Notice>{error}</Notice>}

            <Card>
              <SectionTitle>Have an invite?</SectionTitle>
              <form className="space-y-3" onSubmit={handlePasteInvite}>
                <Field id="inviteLink" label="Paste invite link">
                  <input id="inviteLink" className={inputClass} placeholder="https://…/clubs/3?invite=…"
                    value={inviteText} onChange={(e) => setInviteText(e.target.value)} />
                </Field>
                <Button type="submit" variant="outline" className="w-full" disabled={!inviteText.trim()}>
                  Open invite
                </Button>
              </form>
            </Card>

            <Card>
              <SectionTitle>Start a club</SectionTitle>
              <form className="space-y-3" onSubmit={handleCreate}>
                <Field id="clubName" label="Name">
                  <input id="clubName" className={inputClass} required minLength={3} maxLength={120}
                    value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </Field>
                <Field id="clubDesc" label="Description">
                  <textarea id="clubDesc" className={inputClass} rows={3} maxLength={2000}
                    value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </Field>
                <Field id="clubPrivacy" label="Privacy">
                  <select id="clubPrivacy" className={inputClass} value={form.privacy}
                    onChange={(e) => setForm({ ...form, privacy: e.target.value })}>
                    <option value="public">Public: anyone can join</option>
                    <option value="private">Private: listed, join by approval or invite</option>
                  </select>
                </Field>
                <Field id="clubBook" label="Current read">
                  <input id="clubBook" className={inputClass} maxLength={255} placeholder="Title"
                    value={form.currentReadTitle} onChange={(e) => setForm({ ...form, currentReadTitle: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field id="clubAuthor" label="Author">
                    <input id="clubAuthor" className={inputClass} maxLength={255}
                      value={form.currentReadAuthor} onChange={(e) => setForm({ ...form, currentReadAuthor: e.target.value })} />
                  </Field>
                  <Field id="clubPages" label="Pages">
                    <input id="clubPages" type="number" min={0} max={100000} className={inputClass}
                      value={form.currentReadPages} onChange={(e) => setForm({ ...form, currentReadPages: e.target.value })} />
                  </Field>
                </div>
                <Button type="submit" className="w-full">Create club</Button>
              </form>
            </Card>
          </aside>
        </div>
      </Container>
    </Page>
  )
}
