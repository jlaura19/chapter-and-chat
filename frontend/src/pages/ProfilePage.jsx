import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppHeader from '../components/AppHeader'
import { Avatar, Button, Card, Container, Field, Notice, Page, SectionTitle, inputClass } from '../components/ui'
import api from '../services/api'
import { errorMessage } from '../services/errors'
import { clearToken, getCurrentUsername } from '../services/session'

const THEMES = [
  { value: 'LIGHT', label: 'Parchment (light)' },
  { value: 'DARK', label: 'Midnight (dark)' },
  { value: 'SYSTEM', label: 'Match my system' },
]

const TOGGLES = [
  { key: 'notifyMeetings', label: 'Meetup and RSVP alerts' },
  { key: 'notifyMessages', label: 'New discussion messages' },
  { key: 'notifyReactions', label: 'Reactions to my thoughts' },
  { key: 'showAvatars', label: 'Show member avatars' },
]

export default function ProfilePage() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmUsername, setConfirmUsername] = useState('')
  const [deletePassword, setDeletePassword] = useState('')

  useEffect(() => {
    api.get('/profile')
      .then((response) => {
        setProfile(response.data)
        setForm(toForm(response.data))
      })
      .catch((err) => setError(errorMessage(err, 'Could not load your profile.')))
  }, [])

  const handleSave = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const response = await api.put('/profile', {
        displayName: form.displayName.trim(),
        bio: form.bio.trim(),
        favoriteGenres: form.favoriteGenres.trim(),
        readingGoal: Number(form.readingGoal) || 0,
        themePreference: form.themePreference,
        notifyMeetings: form.notifyMeetings,
        notifyMessages: form.notifyMessages,
        notifyReactions: form.notifyReactions,
        showAvatars: form.showAvatars,
      })
      setProfile(response.data)
      setForm(toForm(response.data))
      setNotice('Profile saved.')
    } catch (err) {
      setError(errorMessage(err, 'Could not save your profile.'))
    } finally {
      setSaving(false)
    }
  }

  const handleAvatar = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }
    const body = new FormData()
    body.append('avatar', file)
    setError('')
    try {
      const response = await api.post('/profile/avatar', body)
      setProfile(response.data)
      setNotice('Avatar updated.')
    } catch (err) {
      setError(errorMessage(err, 'Could not upload that image.'))
    }
  }

  const handleRemoveAvatar = async () => {
    try {
      const response = await api.delete('/profile/avatar')
      setProfile(response.data)
    } catch (err) {
      setError(errorMessage(err, 'Could not remove your avatar.'))
    }
  }

  const handleDeleteAccount = async () => {
    setError('')
    try {
      await api.delete('/profile', { data: { confirm: confirmUsername, password: deletePassword } })
      clearToken()
      window.dispatchEvent(new Event('bookclub:logout'))
      navigate('/', { replace: true })
    } catch (err) {
      setError(errorMessage(err, 'Could not delete your account.'))
    }
  }

  return (
    <Page>
      <AppHeader title="My Profile" subtitle="Your reader identity and preferences" />
      <Container>
        {error && <Notice>{error}</Notice>}
        {notice && <Notice tone="info">{notice}</Notice>}

        {!form ? (
          !error && <p className="italic text-sepia/70">Loading your profile…</p>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
            <Card className="flex flex-col items-center gap-4 text-center">
              <Avatar user={profile} size="lg" />
              <p className="font-display text-xl">{profile.displayName || profile.username}</p>
              <p className="text-sm text-sepia/70">@{profile.username}</p>
              <label className="cursor-pointer rounded-sm border border-gold px-4 py-2 font-display hover:border-burgundy">
                Upload avatar
                <input type="file" accept="image/*" className="sr-only" onChange={handleAvatar} />
              </label>
              {profile.avatarUrl && (
                <Button variant="ghost" onClick={handleRemoveAvatar}>Remove avatar</Button>
              )}
            </Card>

            <div className="space-y-8">
              <Card>
                <SectionTitle>Details</SectionTitle>
                <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSave}>
                  <Field id="pDisplay" label="Display name">
                    <input id="pDisplay" maxLength={64} className={inputClass} value={form.displayName}
                      onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
                  </Field>
                  <Field id="pGoal" label="Reading goal (books this year)">
                    <input id="pGoal" type="number" min={0} max={500} className={inputClass} value={form.readingGoal}
                      onChange={(e) => setForm({ ...form, readingGoal: e.target.value })} />
                  </Field>
                  <div className="md:col-span-2">
                    <Field id="pBio" label="About me">
                      <textarea id="pBio" rows={3} maxLength={300} className={inputClass} value={form.bio}
                        onChange={(e) => setForm({ ...form, bio: e.target.value })} />
                    </Field>
                  </div>
                  <div className="md:col-span-2">
                    <Field id="pGenres" label="Favorite genres">
                      <input id="pGenres" maxLength={255} className={inputClass} placeholder="Gothic, mystery, history"
                        value={form.favoriteGenres} onChange={(e) => setForm({ ...form, favoriteGenres: e.target.value })} />
                    </Field>
                  </div>
                  <Field id="pTheme" label="Theme">
                    <select id="pTheme" className={inputClass} value={form.themePreference}
                      onChange={(e) => setForm({ ...form, themePreference: e.target.value })}>
                      {THEMES.map((theme) => <option key={theme.value} value={theme.value}>{theme.label}</option>)}
                    </select>
                  </Field>
                  <fieldset className="space-y-2">
                    <legend className="font-display text-sm uppercase tracking-wide text-sepia/80">Notifications</legend>
                    {TOGGLES.map((toggle) => (
                      <label key={toggle.key} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={form[toggle.key]}
                          onChange={(e) => setForm({ ...form, [toggle.key]: e.target.checked })} />
                        {toggle.label}
                      </label>
                    ))}
                  </fieldset>
                  <div className="md:col-span-2">
                    <Button type="submit" disabled={saving}>Save profile</Button>
                  </div>
                </form>
              </Card>

              <Card className="border-burgundy/50">
                <SectionTitle>Delete account</SectionTitle>
                <p className="mb-4 text-sm text-sepia/80">
                  This permanently removes your account, books, reviews, journal, and club memberships. Clubs you own
                  must be deleted or handed over first.
                </p>
                <Field id="confirmUser" label={`Type "${getCurrentUsername() || profile.username}" to confirm`}>
                  <input id="confirmUser" className={inputClass} value={confirmUsername}
                    onChange={(e) => setConfirmUsername(e.target.value)} />
                </Field>
                <Field id="deletePassword" label="Your password">
                  <input id="deletePassword" type="password" autoComplete="current-password" className={inputClass}
                    value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} />
                </Field>
                <Button variant="danger" className="mt-4"
                  disabled={confirmUsername !== profile.username || !deletePassword}
                  onClick={handleDeleteAccount}>
                  Delete my account
                </Button>
              </Card>
            </div>
          </div>
        )}
      </Container>
    </Page>
  )
}

function toForm(profile) {
  return {
    displayName: profile.displayName ?? '',
    bio: profile.bio ?? '',
    favoriteGenres: profile.favoriteGenres ?? '',
    readingGoal: profile.readingGoal ?? 0,
    themePreference: profile.themePreference ?? 'LIGHT',
    notifyMeetings: profile.notifyMeetings ?? true,
    notifyMessages: profile.notifyMessages ?? true,
    notifyReactions: profile.notifyReactions ?? true,
    showAvatars: profile.showAvatars ?? true,
  }
}
