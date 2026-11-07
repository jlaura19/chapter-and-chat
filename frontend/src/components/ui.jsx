import { resolveMediaUrl } from '../services/media'

export const inputClass =
  'w-full rounded-sm border border-gold/70 bg-parchment px-3 py-2 font-body text-sepia placeholder:text-sepia/40 focus:border-burgundy focus:outline-none'

const buttonVariants = {
  primary: 'bg-burgundy text-parchment hover:bg-burgundy/90',
  outline: 'border border-gold text-sepia hover:border-burgundy hover:text-burgundy',
  danger: 'border border-burgundy/60 text-burgundy hover:bg-burgundy hover:text-parchment',
  ghost: 'text-burgundy underline-offset-4 hover:underline',
}

export function Page({ children }) {
  return <main className="min-h-screen bg-parchment font-body text-sepia">{children}</main>
}

export function Container({ children, className = '' }) {
  return <div className={`mx-auto max-w-6xl space-y-8 px-6 py-8 ${className}`}>{children}</div>
}

export function Card({ children, className = '' }) {
  return (
    <section className={`rounded-md border border-gold/70 bg-surface/70 p-6 shadow-card ${className}`}>
      {children}
    </section>
  )
}

export function SectionTitle({ children, aside }) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3 border-b border-gold/50 pb-2">
      <h2 className="font-display text-2xl text-sepia">{children}</h2>
      {aside}
    </div>
  )
}

export function Button({ variant = 'primary', className = '', type = 'button', ...props }) {
  return (
    <button
      type={type}
      className={`rounded-sm px-4 py-2 font-display tracking-wide transition disabled:cursor-not-allowed disabled:opacity-50 ${buttonVariants[variant]} ${className}`}
      {...props}
    />
  )
}

export function Field({ id, label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-display text-sm uppercase tracking-wide text-sepia/80">
        {label}
      </label>
      {children}
    </div>
  )
}

export function Notice({ tone = 'error', children }) {
  const tones = {
    error: 'border-burgundy/60 text-burgundy',
    info: 'border-gold text-sepia',
  }
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-sm border bg-parchment px-3 py-2 text-sm italic ${tones[tone]}`}
    >
      {children}
    </p>
  )
}

export function Badge({ children, tone = 'neutral' }) {
  const tones = {
    neutral: 'border-gold text-sepia/80',
    burgundy: 'border-burgundy bg-burgundy text-parchment',
  }
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 font-display text-xs uppercase tracking-wide ${tones[tone]}`}>
      {children}
    </span>
  )
}

export function Avatar({ user, size = 'md' }) {
  const sizes = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-20 w-20 text-2xl',
  }
  const label = (user?.displayName || user?.username || '?').trim()
  const src = resolveMediaUrl(user?.avatarUrl)

  if (src) {
    return <img src={src} alt="" className={`${sizes[size]} rounded-full border border-gold object-cover`} />
  }

  return (
    <span className={`${sizes[size]} inline-flex items-center justify-center rounded-full border border-gold bg-parchment font-display text-burgundy`}>
      {label.slice(0, 2).toUpperCase()}
    </span>
  )
}
