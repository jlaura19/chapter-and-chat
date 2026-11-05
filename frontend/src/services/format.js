// Backend timestamps are UTC but may arrive without a zone suffix.
export function parseDate(value) {
  if (!value) {
    return null
  }
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(value)
  const date = new Date(hasZone ? value : `${value}Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatWhen(value) {
  const date = parseDate(value)
  if (!date) {
    return ''
  }
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function toDateTimeLocal(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function localInputToIso(value) {
  return new Date(value).toISOString()
}

export function countdownParts(value, now = Date.now()) {
  const target = parseDate(value)?.getTime()
  if (target === undefined) {
    return null
  }
  const diff = Math.max(0, target - now)
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    past: target <= now,
  }
}
