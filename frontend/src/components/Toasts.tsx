import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import type { ToastKind } from '../app-context'

export interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

const STYLE: Record<ToastKind, { icon: typeof Info; tone: string }> = {
  success: { icon: CheckCircle2, tone: 'text-delivered-ink bg-delivered/15' },
  error: { icon: AlertTriangle, tone: 'text-danger bg-danger/10' },
  info: { icon: Info, tone: 'text-transit-ink bg-transit/15' },
}

export function Toasts({
  items,
  onDismiss,
}: {
  items: ToastItem[]
  onDismiss: (id: number) => void
}) {
  return (
    <div
      className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6"
      role="status"
      aria-live="polite"
    >
      {items.map((toast) => {
        const { icon: Icon, tone } = STYLE[toast.kind]

        return (
          <div
            key={toast.id}
            className="pointer-events-auto flex w-full max-w-sm animate-toast items-start gap-3 rounded-xl border border-line bg-card p-3.5 shadow-pop"
          >
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tone}`}>
              <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <p className="flex-1 pt-1 text-sm font-medium">{toast.message}</p>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Fermer la notification"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted hover:bg-raised hover:text-ink"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
