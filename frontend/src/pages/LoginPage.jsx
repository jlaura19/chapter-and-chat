import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { errorMessage } from '../services/errors'
import { setSession } from '../services/session'

const USERNAME_RE = /^[a-zA-Z0-9_]{3,32}$/

export default function LoginPage({ onAuthenticated }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mode, setMode] = useState('sign-in')
  const navigate = useNavigate()
  const isSignUp = mode === 'sign-up'

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    const trimmedUsername = username.trim()

    if (!USERNAME_RE.test(trimmedUsername)) {
      setError('Username must be 3-32 characters: letters, numbers, and underscores only.')
      return
    }

    if (isSignUp && password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (!password) {
      setError('Enter your password to continue.')
      return
    }

    try {
      setIsSubmitting(true)
      const endpoint = isSignUp ? '/auth/signup' : '/auth/login'
      const { data } = await api.post(endpoint, { username: trimmedUsername, password })
      setSession(data)
      onAuthenticated?.()
      navigate('/dashboard', { replace: true })
    } catch (err) {
      if (!err.response) {
        setError('Cannot reach the server. Make sure the backend is running on port 8000.')
        return
      }
      setError(errorMessage(err, isSignUp
        ? 'Unable to create your account. Please try again.'
        : 'Unable to sign in. Check your username and password.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleMode = (nextMode) => {
    setMode(nextMode)
    setError('')
    setPassword('')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-parchment px-4 py-12 font-body text-sepia">
      <section className="relative w-full max-w-md rounded-sm border border-gold bg-parchment p-8 shadow-card ring-1 ring-gold/60 ring-offset-4 ring-offset-parchment">
        <div className="border-b border-gold pb-4 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-burgundy">Est. for readers</p>
          <h1 className="mt-2 font-display text-3xl">USIU Africa Book Club</h1>
          <p className="mt-1 italic text-sepia/70">Your personal library, shared with your club</p>
        </div>

        <div className="mt-6 flex justify-center gap-6 font-display text-lg">
          <button
            type="button"
            className={`border-b-2 pb-1 transition ${mode === 'sign-in' ? 'border-burgundy text-burgundy' : 'border-transparent text-sepia/60 hover:text-sepia'}`}
            onClick={() => toggleMode('sign-in')}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`border-b-2 pb-1 transition ${mode === 'sign-up' ? 'border-burgundy text-burgundy' : 'border-transparent text-sepia/60 hover:text-sepia'}`}
            onClick={() => toggleMode('sign-up')}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label htmlFor="username" className="block font-display text-sm">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="e.g. jane_reader"
              disabled={isSubmitting}
              autoFocus
              className="mt-1 w-full border-0 border-b border-gold bg-transparent px-1 py-2 focus:border-burgundy focus:outline-none"
            />
            <span className="text-xs italic text-sepia/60">3-32 characters: letters, numbers, underscores.</span>
          </div>

          <div>
            <label htmlFor="password" className="block font-display text-sm">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={isSignUp ? 'At least 8 characters' : 'Your password'}
              disabled={isSubmitting}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              className="mt-1 w-full border-0 border-b border-gold bg-transparent px-1 py-2 focus:border-burgundy focus:outline-none"
            />
          </div>

          {error && (
            <div role="alert" className="border-l-4 border-burgundy bg-burgundy/5 px-3 py-2 text-sm text-burgundy">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !username.trim() || !password}
            className="w-full rounded-sm bg-burgundy px-4 py-2.5 font-display tracking-wide text-parchment transition hover:bg-burgundy/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (isSignUp ? 'Creating account...' : 'Signing in...') : (isSignUp ? 'Create account' : 'Sign in')}
          </button>
        </form>
      </section>
    </main>
  )
}
