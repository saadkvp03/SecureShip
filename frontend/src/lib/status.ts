import { CheckCircle2, Package, Truck, type LucideIcon } from 'lucide-react'
import type { Status } from './types'

export const STATUS_ORDER: Status[] = ['created', 'in_transit', 'delivered']

export interface StatusMeta {
  label: string
  icon: LucideIcon
  // Full class names are written out so Tailwind can detect them.
  badge: string
  chip: string
  node: string
  cssVar: string
}

export const STATUS_META: Record<Status, StatusMeta> = {
  created: {
    label: 'Créée',
    icon: Package,
    badge: 'bg-created/15 text-created-ink ring-created/30',
    chip: 'bg-created/15 text-created-ink',
    node: 'bg-created text-white',
    cssVar: 'var(--created)',
  },
  in_transit: {
    label: 'En transit',
    icon: Truck,
    badge: 'bg-transit/15 text-transit-ink ring-transit/30',
    chip: 'bg-transit/15 text-transit-ink',
    node: 'bg-transit text-white',
    cssVar: 'var(--transit)',
  },
  delivered: {
    label: 'Livrée',
    icon: CheckCircle2,
    badge: 'bg-delivered/15 text-delivered-ink ring-delivered/30',
    chip: 'bg-delivered/15 text-delivered-ink',
    node: 'bg-delivered text-white',
    cssVar: 'var(--delivered)',
  },
}

export function rank(status: Status): number {
  return STATUS_ORDER.indexOf(status)
}

// The next step in the workflow, used by quick actions.
export function nextStatus(status: Status): Status | null {
  const next = STATUS_ORDER[rank(status) + 1]
  return next ?? null
}

export const ADVANCE_LABEL: Record<Status, string> = {
  created: '',
  in_transit: 'Marquer en transit',
  delivered: 'Marquer livrée',
}

// Wording for a recorded status change.
export function eventTitle(from: Status | null, to: Status): string {
  if (from === null) return 'Expédition créée'
  if (rank(to) < rank(from)) return `Remise au statut « ${STATUS_META[to].label} »`
  return to === 'in_transit' ? 'Passée en transit' : 'Livrée'
}
