import { useState } from 'react'
import { STATUS_META, STATUS_ORDER } from '../lib/status'
import { percent } from '../lib/format'
import type { Status } from '../lib/types'

const SIZE = 184
const STROKE = 24
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function DonutChart({
  counts,
  total,
}: {
  counts: Record<Status, number>
  total: number
}) {
  const [active, setActive] = useState<Status | null>(null)

  let offset = 0
  const segments = STATUS_ORDER.map((status) => {
    const length = total === 0 ? 0 : (counts[status] / total) * CIRCUMFERENCE
    const segment = { status, length, offset }
    offset += length
    return segment
  })

  const summary = STATUS_ORDER.map(
    (status) => `${counts[status]} ${STATUS_META[status].label.toLowerCase()}`,
  ).join(', ')

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
      <div className="relative shrink-0">
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={`Répartition des ${total} expéditions : ${summary}`}
          className="-rotate-90"
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="rgb(var(--line))"
            strokeWidth={STROKE}
          />
          {segments.map(({ status, length, offset: start }) =>
            length > 0 ? (
              <circle
                key={status}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={`rgb(${STATUS_META[status].cssVar})`}
                strokeWidth={STROKE}
                strokeDasharray={`${Math.max(length - (total > counts[status] ? 3 : 0), 0.5)} ${CIRCUMFERENCE}`}
                strokeDashoffset={-start}
                style={{
                  opacity: active && active !== status ? 0.3 : 1,
                  transition: 'opacity 150ms, stroke-dasharray 600ms ease-out',
                }}
              />
            ) : null,
          )}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="text-3xl font-extrabold tabular-nums">{total}</div>
            <div className="text-xs text-muted">{total > 1 ? 'expéditions' : 'expédition'}</div>
          </div>
        </div>
      </div>

      <ul className="w-full space-y-1">
        {STATUS_ORDER.map((status) => {
          const meta = STATUS_META[status]

          return (
            <li key={status}>
              <a
                href={`#/shipments?status=${status}`}
                className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-raised"
                onMouseEnter={() => setActive(status)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(status)}
                onBlur={() => setActive(null)}
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: `rgb(${meta.cssVar})` }}
                  aria-hidden="true"
                />
                <span className="flex-1 text-sm font-semibold">{meta.label}</span>
                <span className="text-sm tabular-nums text-muted">{percent(counts[status], total)}</span>
                <span className="w-8 text-right text-sm font-bold tabular-nums">{counts[status]}</span>
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
