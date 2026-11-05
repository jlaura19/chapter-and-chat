import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import AppHeader from '../components/AppHeader'
import DiscussionBoards from '../components/club/DiscussionBoards'
import ClubSettingsPanel from '../components/club/ClubSettingsPanel'
import MembersPanel from '../components/club/MembersPanel'
import NominationsBoard from '../components/club/NominationsBoard'
import ScheduleBoard from '../components/club/ScheduleBoard'
import { Badge, Button, Card, Container, Notice, Page } from '../components/ui'
import api from '../services/api'
import { errorMessage } from '../services/errors'

const TABS = [
  { value: 'discussions', label: 'Discussions' },
  { value: 'schedule', label: 'Schedule' },
  { value: 'nominations', label: 'Nominations' },
  { value: 'members', label: 'Members' },
  { value: 'settings', label: 'Settings', ownerOnly: true },
]

export default function ClubDetailPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const inviteCode = searchParams.get('invite') || ''
  const navigate = useNavigate()

  const [club, setClub] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('discussions')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    try {
      const response = await api.get(`/clubs/${id}`)
      setClub(response.data)
      setNotFound(false)
    } catch (err) {
      setClub(null)
      setNotFound(err.response?.status === 404)
      if (err.response?.status !== 404) {
        setError(errorMessage(err, 'Could not load this club.'))
      }
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  const runJoin = async (body, successMessage) => {
    setError('')
    setNotice('')
    try {
      const response = await api.post(`/clubs/${id}/join`, body)
      if (response.data.status === 'joined') {
        setNotice(successMessage)
        await load()
      } else {
        setNotice('Your request was sent. An admin will review it.')
      }
    } catch (err) {
      setError(errorMessage(err, 'Could not join this club.'))
    }
  }

  const handleLeave = async () => {
    if (!window.confirm(`Leave ${club.name}?`)) {
      return
    }
    try {
      await api.post(`/clubs/${id}/leave`)
      navigate('/clubs')
    } catch (err) {
      setError(errorMessage(err, 'Could not leave the club.'))
    }
  }

  if (loading) {
    return (
      <Page>
        <AppHeader title="Club" subtitle="Loading…" />
      </Page>
    )
  }

  if (!club) {
    return (
      <Page>
        <AppHeader title="Club" subtitle="Unavailable" />
        <Container>
          <Card className="mx-auto max-w-lg space-y-4 text-center">
            <h2 className="font-display text-2xl">{notFound ? 'Club not found' : 'Club unavailable'}</h2>
            {error && <Notice>{error}</Notice>}
            <Link to="/clubs" className="block font-display text-burgundy underline-offset-4 hover:underline">
              Back to clubs
            </Link>
          </Card>
        </Container>
      </Page>
    )
  }

  const isMember = club.isMember
  const isOwner = club.myRole === 'owner'
  const isAdmin = isOwner || club.myRole === 'admin'
  const visibleTabs = TABS.filter((item) => !item.ownerOnly || isOwner)
  const activeTab = visibleTabs.some((item) => item.value === tab) ? tab : 'discussions'

  return (
    <Page>
      <AppHeader
        title={club.name}
        subtitle={club.description || (club.privacy === 'private' ? 'Private club' : 'Public club')}
      />
      <Container>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={isMember ? 'burgundy' : 'neutral'}>{isMember ? club.myRole : club.privacy}</Badge>
            <span className="text-sm text-sepia/70">{club.memberCount} members</span>
            {club.currentReadTitle && (
              <span className="text-sm italic">
                Reading <span className="font-display not-italic">{club.currentReadTitle}</span>
                {club.currentReadAuthor && ` by ${club.currentReadAuthor}`}
                {club.currentReadPages > 0 && ` • ${club.currentReadPages} pages`}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {!isMember && club.privacy === 'public' && (
              <Button onClick={() => runJoin({}, 'Welcome to the club!')}>Join club</Button>
            )}
            {!isMember && club.privacy === 'private' && inviteCode && (
              <Button onClick={() => runJoin({ inviteCode }, 'Welcome to the club!')}>Join with invite</Button>
            )}
            {!isMember && club.privacy === 'private' && (
              <Button variant="outline" onClick={() => runJoin({}, '')}>Request to join</Button>
            )}
            {isMember && !isOwner && (
              <Button variant="outline" onClick={handleLeave}>Leave club</Button>
            )}
          </div>
        </div>

        {(notice || error) && (
          <div className="space-y-2">
            {notice && <Notice tone="info">{notice}</Notice>}
            {error && <Notice>{error}</Notice>}
          </div>
        )}

        {isMember ? (
          <>
            <nav className="flex flex-wrap gap-6 border-b border-gold/60" aria-label="Club sections">
              {visibleTabs.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  aria-current={activeTab === item.value ? 'page' : undefined}
                  onClick={() => setTab(item.value)}
                  className={`-mb-px border-b-2 pb-2 font-display transition ${
                    activeTab === item.value ? 'border-burgundy text-burgundy' : 'border-transparent text-sepia/70 hover:text-sepia'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            {activeTab === 'discussions' && <DiscussionBoards clubId={club.id} />}
            {activeTab === 'schedule' && <ScheduleBoard clubId={club.id} isAdmin={isAdmin} />}
            {activeTab === 'nominations' && <NominationsBoard clubId={club.id} />}
            {activeTab === 'members' && (
              <MembersPanel club={club} isOwner={isOwner} isAdmin={isAdmin} onRefresh={load} />
            )}
            {activeTab === 'settings' && isOwner && (
              <ClubSettingsPanel club={club} onSaved={load} onDeleted={() => navigate('/clubs')} />
            )}
          </>
        ) : (
          <Card>
            <p className="italic text-sepia/70">
              {club.privacy === 'public'
                ? 'Join this club to see its discussions, meetups, and members.'
                : 'This is a private club. Request to join and an admin will review it, or use an invite link. Discussions, meetups, and members are shared with members only.'}
            </p>
          </Card>
        )}
      </Container>
    </Page>
  )
}
