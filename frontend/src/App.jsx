import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import DashboardPage from './pages/DashboardPage'
import CatalogPage from './pages/CatalogPage'
import BookFormPage from './pages/BookFormPage'
import CommunityPage from './pages/CommunityPage'
import ClubsPage from './pages/ClubsPage'
import ClubDetailPage from './pages/ClubDetailPage'
import ProfilePage from './pages/ProfilePage'
import AuthPage from './pages/AuthPage'
import api from './services/api'
import { errorMessage } from './services/errors'
import { clearToken, getToken, setSession } from './services/session'
import { applyTheme } from './services/theme'

const INTRO_DURATION_MS = 2400

export default function App() {
  const [isStarting, setIsStarting] = useState(true)
  const [needsAuth, setNeedsAuth] = useState(false)
  const [startupError, setStartupError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false

    const restoreSession = async () => {
      const startedAt = Date.now()
      setIsStarting(true)
      setStartupError('')
      let authenticated = false
      try {
        if (getToken()) {
          const { data } = await api.get('/auth/me')
          if (!cancelled) {
            applyTheme(data.themePreference)
          }
          authenticated = true
        }
      } catch (error) {
        if (error.response?.status !== 401) {
          if (!cancelled) {
            const fallback = error.code === 'ECONNABORTED'
              ? 'The server took too long to respond. Check that the backend is running, then try again.'
              : 'Could not reach the server. Check that the backend is running, then try again.'
            setStartupError(errorMessage(error, fallback))
            setIsStarting(false)
          }
          return
        }
        clearToken()
      }
      await new Promise((resolve) => setTimeout(
        resolve,
        Math.max(0, INTRO_DURATION_MS - (Date.now() - startedAt)),
      ))
      if (!cancelled) {
        setNeedsAuth(!authenticated)
        setIsStarting(false)
      }
    }

    restoreSession()

    const handleSessionExpired = () => setAttempt((count) => count + 1)
    window.addEventListener('chapter-chat:session-expired', handleSessionExpired)
    return () => {
      cancelled = true
      window.removeEventListener('chapter-chat:session-expired', handleSessionExpired)
    }
  }, [attempt])

  if (!isStarting && !startupError && needsAuth) {
    return (
      <AuthPage
        onAuthenticated={(data) => {
          setSession(data)
          applyTheme(data.user.themePreference)
          setNeedsAuth(false)
        }}
      />
    )
  }

  if (isStarting || startupError) {
    return (
      <main className="opening-screen" aria-label="Opening reading space">
        <div className="opening-books" aria-hidden="true">
          <svg className="opening-book opening-book-one" viewBox="0 0 96 76">
            <path d="M12 17Q31 10 47 20v43Q29 53 12 61z" fill="#7a2e22" />
            <path d="M47 20q18-10 37-3v44q-17-8-37 2z" fill="#5c2219" />
            <path d="M47 20v43M18 22q13-4 23 1M18 29q13-4 23 1M54 23q13-5 24-2M54 30q13-5 24-2" fill="none" stroke="#e4d8c3" strokeWidth="2" />
            <path d="M47 24v34" stroke="#c5a880" strokeWidth="3" />
          </svg>
          <svg className="opening-book opening-book-two" viewBox="0 0 82 96">
            <path d="M19 11h49v70H19q-7 0-7-7V18q0-7 7-7" fill="#5c2219" />
            <path d="M24 18h37v56H24q-5 0-5-5V23q0-5 5-5" fill="none" stroke="#c5a880" strokeWidth="2" />
            <path d="M27 29h27M27 36h27M27 43h20" stroke="#e4d8c3" strokeWidth="2" />
            <path d="M12 22h7v50h-7" fill="#7a2e22" />
          </svg>
          <svg className="opening-book opening-book-three" viewBox="0 0 96 76">
            <path d="M10 19h75v46H10z" fill="#c5a880" />
            <path d="M15 14h72v46H15z" fill="#7a2e22" />
            <path d="M22 21h58v32H22z" fill="none" stroke="#fdfbf7" strokeWidth="2" />
            <path d="M20 14v46" stroke="#5c2219" strokeWidth="5" />
          </svg>
        </div>
        <img
          src="/chapter-and-chat-logo.png"
          alt="Chapter and Chat logo"
          className="opening-logo"
        />
        {startupError ? (
          <>
            <p role="alert" className="opening-error">{startupError}</p>
            <button
              type="button"
              onClick={() => setAttempt((count) => count + 1)}
              className="opening-retry"
            >
              Try again
            </button>
          </>
        ) : (
          <p className="opening-caption">Preparing your reading space…</p>
        )}
      </main>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/catalog" element={<CatalogPage />} />
      <Route path="/books/:id" element={<BookFormPage />} />
      <Route path="/books/new" element={<BookFormPage />} />
      <Route path="/community" element={<CommunityPage />} />
      <Route path="/clubs" element={<ClubsPage />} />
      <Route path="/clubs/:id" element={<ClubDetailPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
