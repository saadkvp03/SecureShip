import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Search, X } from 'lucide-react'
import { useApp } from '../app-context'
import { EmptyState, ErrorState, MiniRail, Skeleton, Spinner, StatusBadge } from '../components/ui'
import { ApiError, listShipments, updateStatus } from '../lib/api'
import { formatDateTime } from '../lib/format'
import { useAsync, useDebounced } from '../lib/hooks'
import { navigate, type Route } from '../lib/router'
import { ADVANCE_LABEL, STATUS_META, STATUS_ORDER, nextStatus } from '../lib/status'
import type { Shipment, SortKey, Status } from '../lib/types'

const PAGE_SIZE = 10

const SORTS: Array<{ value: string; label: string; sort: SortKey; order: 'asc' | 'desc' }> = [
  { value: 'newest', label: 'Plus récentes', sort: 'id', order: 'desc' },
  { value: 'oldest', label: 'Plus anciennes', sort: 'id', order: 'asc' },
  { value: 'recipient', label: 'Destinataire (A à Z)', sort: 'recipient', order: 'asc' },
  { value: 'destination', label: 'Destination (A à Z)', sort: 'destination', order: 'asc' },
  { value: 'status', label: 'Statut (créée à livrée)', sort: 'status', order: 'asc' },
]

const FILTERS: Array<[Status | '', string]> = [
  ['', 'Toutes'],
  ...STATUS_ORDER.map((value): [Status, string] => [value, STATUS_META[value].label]),
]

function isStatus(value: string | null): value is Status {
  return value !== null && (STATUS_ORDER as string[]).includes(value)
}

function AdvanceButton({
  shipment,
  busy,
  onAdvance,
}: {
  shipment: Shipment
  busy: boolean
  onAdvance: (shipment: Shipment, to: Status) => void
}) {
  const next = nextStatus(shipment.status)
  if (!next) return null

  return (
    <button
      type="button"
      className="btn-secondary btn-sm"
      disabled={busy}
      onClick={(event) => {
        event.stopPropagation()
        onAdvance(shipment, next)
      }}
    >
      {busy && <Spinner className="h-3.5 w-3.5" />}
      {ADVANCE_LABEL[next]}
    </button>
  )
}

export default function Shipments({ route }: { route: Extract<Route, { name: 'shipments' }> }) {
  const { openCreate, notify, bump, version } = useApp()

  const urlStatus = route.query.get('status')
  const [status, setStatus] = useState<Status | ''>(isStatus(urlStatus) ? urlStatus : '')
  const [search, setSearch] = useState('')
  const [sortValue, setSortValue] = useState('newest')
  const [page, setPage] = useState(0)
  const [busyId, setBusyId] = useState<number | null>(null)

  const query = useDebounced(search)
  const sort = SORTS.find((item) => item.value === sortValue) ?? SORTS[0]

  // Links such as #/shipments?status=delivered (from the dashboard).
  useEffect(() => {
    setStatus(isStatus(urlStatus) ? urlStatus : '')
    setPage(0)
  }, [urlStatus])

  const { data, error, loading, reload } = useAsync(
    (signal) =>
      listShipments(
        {
          q: query,
          status,
          sort: sort.sort,
          order: sort.order,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        },
        signal,
      ),
    [query, status, sort.sort, sort.order, page, version],
  )

  const filtering = query.trim() !== '' || status !== ''
  const total = data?.total ?? 0
  const lastPage = Math.max(Math.ceil(total / PAGE_SIZE) - 1, 0)

  // If the last page disappears (e.g. after a filter change), step back.
  useEffect(() => {
    if (data && page > lastPage) setPage(lastPage)
  }, [data, page, lastPage])

  function resetFilters() {
    setSearch('')
    setStatus('')
    setPage(0)
    if (urlStatus) navigate('/shipments')
  }

  async function advance(shipment: Shipment, to: Status) {
    setBusyId(shipment.id)

    try {
      await updateStatus(shipment.id, to)
      notify('success', `${shipment.tracking_ref} : statut « ${STATUS_META[to].label} » enregistré.`)
      bump()
    } catch (err) {
      notify('error', err instanceof ApiError ? err.message : 'La mise à jour a échoué.')
    } finally {
      setBusyId(null)
    }
  }

  if (error) return <ErrorState message={error.message} onRetry={reload} />

  if (data && total === 0 && !filtering) {
    return (
      <EmptyState
        title="Aucune expédition enregistrée"
        message="Les expéditions que vous créez sont conservées dans la base SQLite et listées ici, avec recherche, filtres et tri."
        action={
          <button type="button" className="btn-primary" onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Créer la première expédition
          </button>
        }
      />
    )
  }

  const rows = data?.items ?? []
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1
  const to = Math.min((page + 1) * PAGE_SIZE, total)

  return (
    <div className="space-y-4">
      <div className="card flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <label htmlFor="search" className="sr-only">
            Rechercher une expédition
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            id="search"
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(0)
            }}
            placeholder="Rechercher par destinataire, destination ou numéro de suivi"
            className="input pl-9"
            autoComplete="off"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrer par statut">
          {FILTERS.map(
            ([value, label]) => (
              <button
                key={value || 'all'}
                type="button"
                aria-pressed={status === value}
                onClick={() => {
                  setStatus(value)
                  setPage(0)
                }}
                className={`h-10 rounded-lg px-3.5 text-sm font-semibold transition-colors ${
                  status === value
                    ? 'bg-ink text-bg'
                    : 'border border-line text-muted hover:bg-raised hover:text-ink'
                }`}
              >
                {label}
              </button>
            ),
          )}
        </div>

        <div>
          <label htmlFor="sort" className="sr-only">
            Trier les expéditions
          </label>
          <select
            id="sort"
            value={sortValue}
            onChange={(event) => {
              setSortValue(event.target.value)
              setPage(0)
            }}
            className="input lg:w-56"
          >
            {SORTS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!data ? (
        <div className="card divide-y divide-line">
          {[0, 1, 2, 3, 4].map((index) => (
            <div key={index} className="flex items-center gap-4 p-4">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 flex-1" />
              <Skeleton className="hidden h-5 w-28 sm:block" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="Aucun résultat"
          message="Aucune expédition ne correspond à votre recherche ou à ce filtre."
          action={
            <button type="button" className="btn-secondary" onClick={resetFilters}>
              <X className="h-4 w-4" aria-hidden="true" />
              Réinitialiser les filtres
            </button>
          }
        />
      ) : (
        <div className={`card overflow-hidden transition-opacity ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
          {/* Table on tablets and desktops */}
          <table className="hidden w-full text-left text-sm md:table">
            <caption className="sr-only">Liste des expéditions</caption>
            <thead className="border-b border-line bg-raised text-xs font-semibold text-muted">
              <tr>
                <th scope="col" className="px-5 py-3">Suivi</th>
                <th scope="col" className="px-3 py-3">Destinataire</th>
                <th scope="col" className="px-3 py-3">Destination</th>
                <th scope="col" className="px-3 py-3">Statut</th>
                <th scope="col" className="hidden px-3 py-3 xl:table-cell">Progression</th>
                <th scope="col" className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((shipment) => (
                <tr
                  key={shipment.id}
                  onClick={() => navigate(`/shipments/${shipment.id}`)}
                  className="cursor-pointer transition-colors hover:bg-raised"
                >
                  <td className="px-5 py-3.5">
                    <span className="rounded-md bg-raised px-2 py-1 font-mono text-xs font-medium">
                      {shipment.tracking_ref}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 font-semibold">
                    <a href={`#/shipments/${shipment.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                      {shipment.recipient}
                    </a>
                  </td>
                  <td className="px-3 py-3.5 text-muted">{shipment.destination}</td>
                  <td className="px-3 py-3.5">
                    <StatusBadge status={shipment.status} />
                  </td>
                  <td className="hidden px-3 py-3.5 xl:table-cell">
                    <MiniRail status={shipment.status} />
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <AdvanceButton shipment={shipment} busy={busyId === shipment.id} onAdvance={advance} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Cards on phones */}
          <ul className="divide-y divide-line md:hidden">
            {rows.map((shipment) => (
              <li key={shipment.id} className="p-4">
                <a href={`#/shipments/${shipment.id}`} className="block">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{shipment.recipient}</div>
                      <div className="truncate text-sm text-muted">{shipment.destination}</div>
                    </div>
                    <StatusBadge status={shipment.status} />
                  </div>
                  <div className="mt-2 font-mono text-xs text-muted">{shipment.tracking_ref}</div>
                  <div className="mt-1 text-xs text-muted">{formatDateTime(shipment.created_at, '')}</div>
                </a>
                <div className="mt-3">
                  <AdvanceButton shipment={shipment} busy={busyId === shipment.id} onAdvance={advance} />
                </div>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
            <p className="text-sm text-muted" aria-live="polite">
              {from}–{to} sur {total} {total > 1 ? 'expéditions' : 'expédition'}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary btn-sm"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                Précédent
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm"
                disabled={page >= lastPage}
                onClick={() => setPage(page + 1)}
              >
                Suivant
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
