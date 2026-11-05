import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import CatalogPage from './pages/CatalogPage'
import BookFormPage from './pages/BookFormPage'
import CommunityPage from './pages/CommunityPage'
import ClubsPage from './pages/ClubsPage'
import ClubDetailPage from './pages/ClubDetailPage'
import ProfilePage from './pages/ProfilePage'
import api from './services/api'
import { clearToken, getToken } from './services/session'

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)

  useEffect(() => {
    const verifySession = async () => {
      if (!getToken()) {
        setIsCheckingSession(false)
        return
      }

      try {
        await api.get('/auth/me')
        setIsAuthenticated(true)
      } catch {
        clearToken()
        setIsAuthenticated(false)
      } finally {
        setIsCheckingSession(false)
      }
    }

    verifySession()
  }, [])

  useEffect(() => {
    const handleForcedLogout = () => {
      setIsAuthenticated(false)
    }

    window.addEventListener('bookclub:logout', handleForcedLogout)
    return () => window.removeEventListener('bookclub:logout', handleForcedLogout)
  }, [])

  if (isCheckingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-parchment font-body text-sepia">
        <p className="italic text-sepia/70">Checking session…</p>
      </main>
    )
  }

  return (
    <Routes>
      <Route
        path="/"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage onAuthenticated={() => setIsAuthenticated(true)} />}
      />
      <Route
        path="/dashboard"
        element={isAuthenticated ? <DashboardPage /> : <Navigate to="/" replace />}
      />
      <Route
        path="/catalog"
        element={isAuthenticated ? <CatalogPage /> : <Navigate to="/" replace />}
      />
      <Route
        path="/books/:id"
        element={isAuthenticated ? <BookFormPage /> : <Navigate to="/" replace />}
      />
      <Route
        path="/books/new"
        element={isAuthenticated ? <BookFormPage /> : <Navigate to="/" replace />}
      />
      <Route
        path="/community"
        element={isAuthenticated ? <CommunityPage /> : <Navigate to="/" replace />}
      />
      <Route
        path="/clubs"
        element={isAuthenticated ? <ClubsPage /> : <Navigate to="/" replace />}
      />
      <Route
        path="/clubs/:id"
        element={isAuthenticated ? <ClubDetailPage /> : <Navigate to="/" replace />}
      />
      <Route
        path="/profile"
        element={isAuthenticated ? <ProfilePage /> : <Navigate to="/" replace />}
      />
      <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/'} replace />} />
    </Routes>
  )
}
