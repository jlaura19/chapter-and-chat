import { useState } from 'react'
import api from '../services/api'
import { errorMessage } from '../services/errors'
import { getGuestId } from '../services/session'
import { Button, Field, Notice, inputClass } from '../components/ui'

export default function AuthPage({ onAuthenticated }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ displayName: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const isRegister = mode === 'register'
  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value })

  const submit = async (path, payload, fallback) => {
    setBusy(true)
    setError('')
    try {
      const { data } = await api.post(path, payload)
      onAuthenticated(data)
    } catch (err) {
      setError(errorMessage(err, fallback))
      setBusy(false)
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (isRegister) {
      submit('/auth/register', {
        email: form.email.trim(),
        password: form.password,
        displayName: form.displayName.trim(),
      }, 'Could not create your profile. Check your details and try again.')
    } else {
      submit('/auth/login', { email: form.email.trim(), password: form.password }, 'Could not sign you in.')
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-parchment px-6 py-10 font-body text-sepia">
      <div className="w-full max-w-md space-y-6 rounded-md border border-gold/70 bg-surface/70 p-8 shadow-card">
        <div className="text-center">
          <img src="/chapter-and-chat-logo.png" alt="Chapter and Chat" className="brand-mark mx-auto h-20 object-contain" />
          <h1 className="mt-3 font-display text-3xl">{isRegister ? 'Create your profile' : 'Welcome back'}</h1>
          <p className="text-sm text-sepia/70">
            {isRegister ? 'Sign up with your email to keep your books and clubs.' : 'Sign in with your email to continue.'}
          </p>
        </div>

        {error && <Notice>{error}</Notice>}

        <form className="space-y-4" onSubmit={handleSubmit}>
          {isRegister && (
            <Field id="authName" label="Display name">
              <input id="authName" maxLength={64} className={inputClass} value={form.displayName}
                onChange={update('displayName')} autoComplete="name" />
            </Field>
          )}
          <Field id="authEmail" label="Email">
            <input id="authEmail" type="email" required className={inputClass} value={form.email}
              onChange={update('email')} autoComplete="email" />
          </Field>
          <Field id="authPassword" label={isRegister ? 'Password (min 8 characters)' : 'Password'}>
            <input id="authPassword" type="password" required minLength={isRegister ? 8 : undefined} maxLength={128}
              className={inputClass} value={form.password} onChange={update('password')}
              autoComplete={isRegister ? 'new-password' : 'current-password'} />
          </Field>
          <Button type="submit" disabled={busy} className="w-full">
            {isRegister ? 'Create profile' : 'Sign in'}
          </Button>
        </form>

        <div className="flex flex-col items-center gap-2 text-sm">
          <button type="button" className="text-burgundy underline-offset-4 hover:underline"
            onClick={() => { setMode(isRegister ? 'login' : 'register'); setError('') }}>
            {isRegister ? 'Already have a profile? Sign in' : 'New here? Create a profile'}
          </button>
          <button type="button" disabled={busy} className="text-sepia/70 underline-offset-4 hover:underline"
            onClick={() => submit('/auth/guest', { guestId: getGuestId() }, 'Could not start a guest session.')}>
            Continue as guest
          </button>
        </div>
      </div>
    </main>
  )
}
