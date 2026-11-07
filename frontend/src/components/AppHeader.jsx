import { useEffect, useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import api from '../services/api'
import { getCurrentUsername, clearToken } from '../services/session'
import { Avatar } from './ui'
import NotificationBell from './NotificationBell'

export default function AppHeader({ title, subtitle, primaryAction }) {
  const [me, setMe] = useState(null)

  useEffect(() => {
    api.get('/profile')
      .then((response) => setMe(response.data))
      .catch(() => {})
  }, [])

  const navClass = ({ isActive }) =>
    `border-b-2 pb-0.5 font-display transition ${isActive ? 'border-burgundy text-burgundy' : 'border-transparent text-sepia/70 hover:text-sepia'}`

  return (
    <header className="border-b border-gold bg-parchment px-6 py-5 font-body text-sepia">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <Link to="/dashboard" className="flex items-center" aria-label="Chapter & Chat home">
            <img src="/chapter-and-chat-logo.png" alt="" className="brand-mark h-14 w-[4.5rem] object-contain" />
          </Link>
          <div>
            <h1 className="font-display text-3xl">{title}</h1>
            <p className="text-sm text-sepia/70">{subtitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {primaryAction && (
            <Link to={primaryAction.to} className="rounded-sm bg-burgundy px-4 py-2 font-display text-parchment hover:bg-burgundy/90">
              {primaryAction.label}
            </Link>
          )}
          <NotificationBell />
          <Link to="/profile" className="flex items-center gap-2 rounded-full border border-gold py-1 pl-1 pr-3 font-display text-sm hover:border-burgundy">
            <Avatar user={me ?? { username: getCurrentUsername() }} size="sm" />
            <span>{me?.displayName || getCurrentUsername() || 'Reader'}</span>
          </Link>
          {me && <button
            type="button"
            onClick={() => {
              clearToken()
              window.dispatchEvent(new Event('chapter-chat:session-expired'))
            }}
            className="rounded-full border border-gold/70 px-3 py-1 text-xs text-sepia/70 hover:border-burgundy hover:text-burgundy"
          >
            {me.email ? 'Sign out' : 'Create Account'}
          </button>}
        </div>
      </div>

      <nav className="mt-4 flex flex-wrap gap-6" aria-label="Main">
        <NavLink to="/dashboard" className={navClass}>Dashboard</NavLink>
        <NavLink to="/catalog" className={navClass}>Catalog</NavLink>
        <NavLink to="/clubs" className={navClass}>Clubs</NavLink>
        <NavLink to="/community" className={navClass}>Reviews</NavLink>
        <NavLink to="/profile" className={navClass}>Profile</NavLink>
      </nav>
    </header>
  )
}
