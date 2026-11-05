import { useCallback, useEffect, useState } from 'react'
import api from '../../services/api'
import { errorMessage } from '../../services/errors'
import { Badge, Button, Card, Field, Notice, SectionTitle, inputClass } from '../ui'

export default function NominationsBoard({ clubId }) {
  const [nominations, setNominations] = useState([])
  const [form, setForm] = useState({ title: '', author: '' })
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(() => {
    api.get(`/clubs/${clubId}/nominations`)
      .then((response) => setNominations(response.data))
      .catch((err) => setError(errorMessage(err, 'Could not load nominations.')))
  }, [clubId])

  useEffect(() => {
    load()
  }, [load])

  const handleNominate = async (event) => {
    event.preventDefault()
    setError('')
    try {
      await api.post(`/clubs/${clubId}/nominations`, { title: form.title.trim(), author: form.author.trim() })
      setForm({ title: '', author: '' })
      load()
    } catch (err) {
      setError(errorMessage(err, 'Could not add the nomination.'))
    }
  }

  const handleVote = async (nomination) => {
    setBusyId(nomination.id)
    setError('')
    try {
      if (nomination.myVote) {
        await api.delete(`/clubs/${clubId}/nominations/${nomination.id}/vote`)
      } else {
        await api.post(`/clubs/${clubId}/nominations/${nomination.id}/vote`)
      }
      load()
    } catch (err) {
      setError(errorMessage(err, 'Could not update your vote.'))
    } finally {
      setBusyId(null)
    }
  }

  const sorted = [...nominations].sort((a, b) => b.votes - a.votes)

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <Card>
        <SectionTitle aside={<Badge>{nominations.length} nominated</Badge>}>Next cycle nominations</SectionTitle>
        {sorted.length === 0 ? (
          <p className="italic text-sepia/70">No nominations yet. Suggest the first one.</p>
        ) : (
          <ul className="space-y-3">
            {sorted.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-gold/50 bg-parchment p-4">
                <div>
                  <p className="font-display text-lg">{item.title}</p>
                  <p className="text-sm italic text-sepia/70">{item.author}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-display text-sm" aria-label={`${item.votes} votes`}>
                    {item.votes} {item.votes === 1 ? 'vote' : 'votes'}
                  </span>
                  <Button
                    variant={item.myVote ? 'primary' : 'outline'}
                    className="px-3 py-1 text-sm"
                    disabled={busyId === item.id}
                    aria-pressed={item.myVote}
                    onClick={() => handleVote(item)}
                  >
                    {item.myVote ? 'Voted' : 'Vote'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {error && <div className="mt-4"><Notice>{error}</Notice></div>}
      </Card>

      <Card>
        <SectionTitle>Nominate a book</SectionTitle>
        <form className="space-y-3" onSubmit={handleNominate}>
          <Field id="nomTitle" label="Title">
            <input id="nomTitle" className={inputClass} required minLength={1} maxLength={255}
              value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field id="nomAuthor" label="Author">
            <input id="nomAuthor" className={inputClass} required minLength={1} maxLength={255}
              value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
          </Field>
          <Button type="submit" className="w-full">Nominate</Button>
        </form>
      </Card>
    </div>
  )
}
