import { useCallback, useEffect, useState } from 'react'
import api from '../../services/api'
import { errorMessage } from '../../services/errors'
import { buildInviteLink } from '../../services/clubLinks'
import { getCurrentUsername } from '../../services/session'
import { formatWhen } from '../../services/format'
import { Avatar, Badge, Button, Card, Field, Notice, SectionTitle, inputClass } from '../ui'

export default function MembersPanel({ club, isOwner, isAdmin, onRefresh }) {
  const clubId = club.id
  const [members, setMembers] = useState([])
  const [progress, setProgress] = useState([])
  const [requests, setRequests] = useState([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [progressForm, setProgressForm] = useState({ page: '', chapter: '' })
  const [copied, setCopied] = useState(false)
  const me = getCurrentUsername()

  const loadAll = useCallback(async () => {
    try {
      const [membersRes, progressRes] = await Promise.all([
        api.get(`/clubs/${clubId}/members`),
        api.get(`/clubs/${clubId}/progress`),
      ])
      setMembers(membersRes.data)
      setProgress(progressRes.data)
      const mine = progressRes.data.find((entry) => entry.user.username === me)
      setProgressForm({ page: mine ? String(mine.page) : '', chapter: mine?.chapter ?? '' })
      if (isAdmin) {
        const requestsRes = await api.get(`/clubs/${clubId}/requests`)
        setRequests(requestsRes.data)
      }
    } catch (err) {
      setError(errorMessage(err, 'Could not load members.'))
    }
  }, [clubId, isAdmin, me])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const flash = (message) => {
    setNotice(message)
    setError('')
  }

  const runAction = async (action, successMessage) => {
    setError('')
    setNotice('')
    try {
      await action()
      if (successMessage) {
        flash(successMessage)
      }
      await loadAll()
      onRefresh?.()
    } catch (err) {
      setError(errorMessage(err, 'Something went wrong. Please try again.'))
    }
  }

  const handleProgress = (event) => {
    event.preventDefault()
    runAction(
      () => api.put(`/clubs/${clubId}/progress`, {
        page: Number(progressForm.page),
        chapter: progressForm.chapter.trim(),
      }),
      'Your progress is saved.',
    )
  }

  const handleRole = (member, role) => {
    runAction(
      () => api.put(`/clubs/${clubId}/members/${member.user.id}/role`, { role }),
      `${member.user.username} is now ${role === 'admin' ? 'an admin' : 'a member'}.`,
    )
  }

  const handleRemove = (member) => {
    if (!window.confirm(`Remove ${member.user.username} from the club?`)) {
      return
    }
    runAction(() => api.delete(`/clubs/${clubId}/members/${member.user.id}`), `${member.user.username} was removed.`)
  }

  const handleDecision = (request, approve) => {
    runAction(
      () => api.post(`/clubs/${clubId}/requests/${request.id}`, { approve }),
      approve ? `${request.user.username} was approved.` : 'Request declined.',
    )
  }

  const handleRotate = () => {
    if (!window.confirm('Rotate the invite code? Old links will stop working.')) {
      return
    }
    runAction(() => api.post(`/clubs/${clubId}/invite-code`), 'A new invite code was generated.')
  }

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(buildInviteLink(clubId, club.inviteCode))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Copy failed. Select the link and copy it manually.')
    }
  }

  const progressByUser = new Map(progress.map((entry) => [entry.user.id, entry]))
  const totalPages = club.currentReadPages || 0
  const leader = progress.reduce((best, entry) => (!best || entry.page > best.page ? entry : best), null)

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <Card>
          <SectionTitle aside={<Badge>{members.length} members</Badge>}>Reading progress</SectionTitle>
          {leader && (
            <p className="mb-4 text-sm italic text-sepia/70">
              Furthest along: {leader.user.displayName || leader.user.username}, page {leader.page}
              {totalPages > 0 && ` of ${totalPages}`}.
            </p>
          )}
          <ul className="space-y-4">
            {members.map((member) => {
              const entry = progressByUser.get(member.user.id)
              const percent = entry && totalPages > 0 ? Math.min(100, Math.round((entry.page / totalPages) * 100)) : 0
              return (
                <li key={member.user.id} className="flex flex-wrap items-center gap-4">
                  <Avatar user={member.user} size="sm" />
                  <div className="min-w-[10rem] flex-1">
                    <p className="font-display">
                      {member.user.displayName || member.user.username}
                      <span className="ml-2 text-xs uppercase tracking-wide text-sepia/60">{member.role}</span>
                    </p>
                    {entry ? (
                      <>
                        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gold/30"
                          role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}
                          aria-label={`${member.user.username} progress`}>
                          <div className="h-full bg-burgundy" style={{ width: `${percent}%` }} />
                        </div>
                        <p className="mt-1 text-xs text-sepia/70">
                          Page {entry.page}{entry.chapter && ` • Chapter ${entry.chapter}`} • {formatWhen(entry.updatedAt)}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs italic text-sepia/60">Not started</p>
                    )}
                  </div>
                  {isOwner && member.role !== 'owner' && (
                    <Button variant="outline" className="px-3 py-1 text-sm"
                      onClick={() => handleRole(member, member.role === 'admin' ? 'member' : 'admin')}>
                      {member.role === 'admin' ? 'Demote' : 'Make admin'}
                    </Button>
                  )}
                  {isAdmin && member.role !== 'owner' && (isOwner || member.role !== 'admin') && (
                    <Button variant="danger" className="px-3 py-1 text-sm" onClick={() => handleRemove(member)}>
                      Remove
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        </Card>

        {isAdmin && club.privacy === 'private' && (
          <Card>
            <SectionTitle>Join requests</SectionTitle>
            {requests.length === 0 ? (
              <p className="italic text-sepia/70">No pending requests.</p>
            ) : (
              <ul className="space-y-3">
                {requests.map((request) => (
                  <li key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-gold/50 bg-parchment p-3">
                    <div>
                      <p className="font-display">{request.user.displayName || request.user.username}</p>
                      <p className="text-xs text-sepia/70">Requested {formatWhen(request.createdAt)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button className="px-3 py-1 text-sm" onClick={() => handleDecision(request, true)}>Approve</Button>
                      <Button variant="outline" className="px-3 py-1 text-sm" onClick={() => handleDecision(request, false)}>Decline</Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>

      <aside className="space-y-6">
        <Card>
          <SectionTitle>Your progress</SectionTitle>
          <form className="space-y-3" onSubmit={handleProgress}>
            <Field id="progPage" label="Page">
              <input id="progPage" type="number" min={0} max={100000} required className={inputClass}
                value={progressForm.page} onChange={(e) => setProgressForm({ ...progressForm, page: e.target.value })} />
            </Field>
            <Field id="progChapter" label="Chapter">
              <input id="progChapter" maxLength={64} className={inputClass} placeholder="12"
                value={progressForm.chapter} onChange={(e) => setProgressForm({ ...progressForm, chapter: e.target.value })} />
            </Field>
            <Button type="submit" className="w-full">Update my progress</Button>
          </form>
        </Card>

        {isAdmin && club.privacy === 'private' && club.inviteCode && (
          <Card>
            <SectionTitle>Invite link</SectionTitle>
            <p className="mb-3 break-all rounded-sm border border-gold/50 bg-parchment p-2 font-mono text-xs">
              {buildInviteLink(clubId, club.inviteCode)}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button className="px-3 py-1 text-sm" onClick={copyInvite}>{copied ? 'Copied' : 'Copy link'}</Button>
              <Button variant="outline" className="px-3 py-1 text-sm" onClick={handleRotate}>Rotate code</Button>
            </div>
          </Card>
        )}

        {error && <Notice>{error}</Notice>}
        {notice && <Notice tone="info">{notice}</Notice>}
      </aside>
    </div>
  )
}
