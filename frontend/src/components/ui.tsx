import type { ReactNode } from 'react'
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react'
import { STATUS_META, STATUS_ORDER, rank } from '../lib/status'
import { formatDateTime } from '../lib/format'
import type { ShipmentEvent, Status } from '../lib/types'

export function StatusBadge({ status }: { status: Status }) {
  const meta = STATUS_META[status]
  const Icon = meta.icon

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${meta.badge}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {meta.label}
    </span>
  )
}

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} aria-hidden="true" />
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <div role="alert" className="card flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-danger/10 text-danger">
        <AlertTriangle className="h-6 w-6" aria-hidden="true" />
      </span>
      <h2 className="text-base font-bold">Impossible de charger les données</h2>
      <p className="mt-1 max-w-sm text-sm text-muted">{message}</p>
      {onRetry && (
        <button type="button" className="btn-secondary mt-5" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Réessayer
        </button>
      )}
    </div>
  )
}

// Hand-drawn parcel on a route line, used by every empty state.
function ParcelIllustration() {
  return (
    <svg viewBox="0 0 160 110" className="h-28 w-40" fill="none" aria-hidden="true">
      <path
        d="M8 92c26 0 26-26 52-26s26 20 52 20 26-34 40-34"
        stroke="rgb(var(--line))"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="2 9"
      />
      <circle cx="8" cy="92" r="5" fill="rgb(var(--line))" />
      <circle cx="152" cy="52" r="5" fill="rgb(var(--accent))" />
      <g transform="translate(52 12)">
        <path
          d="M28 4 54 17v30L28 60 2 47V17z"
          fill="rgb(var(--card))"
          stroke="rgb(var(--ink))"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path
          d="M2 17 28 30l26-13M28 30v30"
          stroke="rgb(var(--ink))"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path d="M15 10.5 41 23.5" stroke="rgb(var(--accent))" strokeWidth="4" strokeLinecap="round" />
      </g>
    </svg>
  )
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string
  message: string
  action?: ReactNode
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <ParcelIllustration />
      <h2 className="mt-4 text-lg font-bold">{title}</h2>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{message}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

// The tracker rail: created → in transit → delivered.
// Timestamps come only from recorded status events.
export function TrackerRail({
  status,
  events = [],
}: {
  status: Status
  events?: ShipmentEvent[]
}) {
  const current = rank(status)

  const reachedAt = (stage: Status): string | null => {
    if (rank(stage) > current) return null
    const match = [...events].reverse().find((event) => event.to_status === stage)
    return match ? match.occurred_at : null
  }

  return (
    <div className="relative">
      <div className="absolute left-[16.666%] right-[16.666%] top-[19px] h-[3px] rounded-full bg-line" />
      <div
        className="absolute left-[16.666%] top-[19px] h-[3px] rounded-full bg-accent transition-[width] duration-700 ease-out"
        style={{ width: `${(current / (STATUS_ORDER.length - 1)) * 66.666}%` }}
      />

      <ol className="relative grid grid-cols-3">
        {STATUS_ORDER.map((stage, index) => {
          const meta = STATUS_META[stage]
          const Icon = meta.icon
          const done = index <= current
          const isCurrent = index === current
          const when = reachedAt(stage)

          return (
            <li
              key={stage}
              className="flex flex-col items-center px-1 text-center"
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span
                className={`grid h-10 w-10 place-items-center rounded-full border-2 transition-colors duration-500 ${
                  done
                    ? `${meta.node} border-card ${isCurrent ? 'ring-4 ring-accent/25' : ''}`
                    : 'border-line bg-card text-muted'
                }`}
              >
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
              <span className={`mt-2.5 text-sm font-bold ${done ? '' : 'text-muted'}`}>
                {meta.label}
              </span>
              <span className="mt-0.5 min-h-[2.25rem] text-xs leading-snug text-muted">
                {done ? (when ? formatDateTime(when) : isCurrent ? 'Statut actuel' : '') : 'À venir'}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

// Compact version for table rows: decorative, the badge carries the meaning.
export function MiniRail({ status }: { status: Status }) {
  const current = rank(status)

  return (
    <span className="inline-flex items-center" aria-hidden="true">
      {STATUS_ORDER.map((stage, index) => (
        <span key={stage} className="inline-flex items-center">
          <span
            className={`h-2.5 w-2.5 rounded-full ${index <= current ? 'bg-accent' : 'bg-line'}`}
          />
          {index < STATUS_ORDER.length - 1 && (
            <span className={`h-0.5 w-4 ${index < current ? 'bg-accent' : 'bg-line'}`} />
          )}
        </span>
      ))}
    </span>
  )
}
