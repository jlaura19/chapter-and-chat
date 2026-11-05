import { useState } from 'react'
import api from '../../services/api'
import { errorMessage } from '../../services/errors'
import { Button, Card, Field, Notice, SectionTitle, inputClass } from '../ui'

export default function ClubSettingsPanel({ club, onSaved, onDeleted }) {
  const [form, setForm] = useState(() => toForm(club))
  const [confirmName, setConfirmName] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')
    setSaving(true)
    try {
      const response = await api.put(`/clubs/${club.id}`, {
        name: form.name.trim(),
        description: form.description.trim(),
        privacy: form.privacy,
        currentReadTitle: form.currentReadTitle.trim(),
        currentReadAuthor: form.currentReadAuthor.trim(),
        currentReadPages: Number(form.currentReadPages) || 0,
      })
      setNotice('Club settings saved.')
      onSaved?.(response.data)
    } catch (err) {
      setError(errorMessage(err, 'Could not save the club settings.'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setError('')
    try {
      await api.delete(`/clubs/${club.id}`)
      onDeleted?.()
    } catch (err) {
      setError(errorMessage(err, 'Could not delete the club.'))
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <SectionTitle>Club details</SectionTitle>
        <form className="space-y-3" onSubmit={handleSave}>
          <Field id="setName" label="Name">
            <input id="setName" className={inputClass} required minLength={3} maxLength={120}
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field id="setDesc" label="Description">
            <textarea id="setDesc" className={inputClass} rows={3} maxLength={2000}
              value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field id="setPrivacy" label="Privacy">
            <select id="setPrivacy" className={inputClass} value={form.privacy}
              onChange={(e) => setForm({ ...form, privacy: e.target.value })}>
              <option value="public">Public: anyone can join instantly</option>
              <option value="private">Private: listed, join by approval or invite</option>
            </select>
          </Field>
          <Field id="setBook" label="Current read">
            <input id="setBook" className={inputClass} maxLength={255} placeholder="Title"
              value={form.currentReadTitle} onChange={(e) => setForm({ ...form, currentReadTitle: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="setAuthor" label="Author">
              <input id="setAuthor" className={inputClass} maxLength={255}
                value={form.currentReadAuthor} onChange={(e) => setForm({ ...form, currentReadAuthor: e.target.value })} />
            </Field>
            <Field id="setPages" label="Total pages">
              <input id="setPages" type="number" min={0} max={100000} className={inputClass}
                value={form.currentReadPages} onChange={(e) => setForm({ ...form, currentReadPages: e.target.value })} />
            </Field>
          </div>
          <Button type="submit" className="w-full" disabled={saving}>Save changes</Button>
        </form>
        {notice && <div className="mt-4"><Notice tone="info">{notice}</Notice></div>}
        {error && <div className="mt-4"><Notice>{error}</Notice></div>}
      </Card>

      <Card>
        <SectionTitle>Delete club</SectionTitle>
        <p className="mb-4 text-sm text-sepia/80">
          Deleting removes the club, its boards, messages, meetups, and nominations for everyone. This cannot be undone.
        </p>
        <Field id="confirmName" label={`Type "${club.name}" to confirm`}>
          <input id="confirmName" className={inputClass} value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
        </Field>
        <Button variant="danger" className="mt-4 w-full" disabled={confirmName !== club.name} onClick={handleDelete}>
          Delete this club
        </Button>
      </Card>
    </div>
  )
}

function toForm(club) {
  return {
    name: club.name ?? '',
    description: club.description ?? '',
    privacy: club.privacy ?? 'public',
    currentReadTitle: club.currentReadTitle ?? '',
    currentReadAuthor: club.currentReadAuthor ?? '',
    currentReadPages: club.currentReadPages ?? 0,
  }
}
