import { useEffect, useRef, useState } from 'react'
import api from '../services/api'
import { formatWhen } from '../services/format'

export default function NotificationBell() {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)
  const unread = items.filter((item) => !item.read).length

  const load = () => {
    api.get('/notifications')
      .then((response) => setItems(response.data))
      .catch(() => {})
  }

  useEffect(() => {
    load()
    const timer = setInterval(load, 60000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const handleClick = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) {
      load()
    }
  }

  const markAllRead = async () => {
    try {
      await api.post('/notifications/read-all')
      setItems((current) => current.map((item) => ({ ...item, read: true })))
    } catch {
      load()
    }
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={toggle}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        className="relative rounded-sm border border-gold px-3 py-2 font-display hover:border-burgundy"
      >
        Alerts
        {unread > 0 && (
          <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-burgundy px-1.5 text-xs text-parchment">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-md border border-gold bg-parchment p-4 shadow-card">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-lg">Notifications</h2>
            {unread > 0 && (
              <button type="button" onClick={markAllRead} className="text-sm text-burgundy underline-offset-4 hover:underline">
                Mark all read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="text-sm italic text-sepia/70">You are all caught up.</p>
          ) : (
            <ul className="max-h-96 space-y-2 overflow-y-auto">
              {items.map((item) => (
                <li key={item.id} className={`rounded-sm border p-3 text-sm ${item.read ? 'border-gold/40 text-sepia/70' : 'border-gold bg-surface/60'}`}>
                  <p>{item.message}</p>
                  <p className="mt-1 text-xs text-sepia/60">{formatWhen(item.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
