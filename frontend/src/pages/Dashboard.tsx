import { ArrowRight, Boxes, Plus } from 'lucide-react'
import { useApp } from '../app-context'
import { DonutChart } from '../components/DonutChart'
import { EmptyState, ErrorState, Skeleton } from '../components/ui'
import { getStats } from '../lib/api'
import { formatDateTime, percent, timeAgo } from '../lib/format'
import { useAsync } from '../lib/hooks'
import { STATUS_META, STATUS_ORDER, eventTitle } from '../lib/status'
import type { Stats, Status } from '../lib/types'

const PLURAL: Record<Status, string> = {
  created: 'Créées',
  in_transit: 'En transit',
  delivered: 'Livrées',
}

function StatCards({ stats }: { stats: Stats | null }) {
  const total = stats?.total ?? 0

  const cards = [
    {
      key: 'total',
      href: '#/shipments',
      label: 'Total des expéditions',
      value: total,
      note: 'Toutes les expéditions',
      icon: Boxes,
      chip: 'bg-accent/15 text-accent-ink',
    },
    ...STATUS_ORDER.map((status) => ({
      key: status,
      href: `#/shipments?status=${status}`,
      label: PLURAL[status],
      value: stats?.by_status[status] ?? 0,
      note: `${percent(stats?.by_status[status] ?? 0, total)} du total`,
      icon: STATUS_META[status].icon,
      chip: STATUS_META[status].chip,
    })),
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ key, href, label, value, note, icon: Icon, chip }) => (
        <a
          key={key}
          href={href}
          className="card group p-5 transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-pop"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-muted">{label}</span>
            <span className={`grid h-9 w-9 place-items-center rounded-lg ${chip}`}>
              <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
          </div>
          {stats ? (
            <div className="mt-3 text-4xl font-extrabold tabular-nums tracking-tight">{value}</div>
          ) : (
            <Skeleton className="mt-3 h-10 w-16" />
          )}
          <div className="mt-1 text-xs text-muted">{note}</div>
        </a>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { openCreate, version } = useApp()
  const { data, error, reload } = useAsync((signal) => getStats(signal), [version])

  if (error) return <ErrorState message={error.message} onRetry={reload} />

  if (data && data.total === 0) {
    return (
      <EmptyState
        title="Aucune expédition pour le moment"
        message="Créez votre première expédition : elle apparaîtra ici avec son statut, son numéro de suivi et son historique."
        action={
          <button type="button" className="btn-primary" onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Créer la première expédition
          </button>
        }
      />
    )
  }

  return (
    <div className="space-y-6">
      <StatCards stats={data} />

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="card p-6 lg:col-span-2" aria-labelledby="chart-title">
          <h2 id="chart-title" className="mb-5 text-base font-bold">
            Répartition des statuts
          </h2>
          {data ? (
            <DonutChart counts={data.by_status} total={data.total} />
          ) : (
            <Skeleton className="mx-auto h-44 w-44 rounded-full" />
          )}
        </section>

        <section className="card p-6 lg:col-span-3" aria-labelledby="activity-title">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="activity-title" className="text-base font-bold">
              Activité récente
            </h2>
            <a
              href="#/shipments"
              className="inline-flex items-center gap-1 text-sm font-semibold text-accent-ink hover:underline"
            >
              Toutes les expéditions
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>

          {!data ? (
            <div className="space-y-4">
              {[0, 1, 2, 3].map((index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : data.recent_activity.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              L’activité apparaîtra ici dès qu’une expédition sera créée ou mise à jour.
            </p>
          ) : (
            <ul className="-mx-2 divide-y divide-line">
              {data.recent_activity.map((item) => {
                const meta = STATUS_META[item.to_status]
                const Icon = meta.icon

                return (
                  <li key={item.id}>
                    <a
                      href={`#/shipments/${item.shipment_id}`}
                      className="flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-raised"
                    >
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${meta.chip}`}>
                        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {eventTitle(item.from_status, item.to_status)}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {item.recipient} vers {item.destination}
                        </span>
                      </span>
                      <span className="hidden rounded-md bg-raised px-2 py-1 font-mono text-xs font-medium sm:block">
                        {item.tracking_ref}
                      </span>
                      <time
                        dateTime={item.occurred_at}
                        title={formatDateTime(item.occurred_at)}
                        className="w-24 shrink-0 text-right text-xs text-muted"
                      >
                        {timeAgo(item.occurred_at)}
                      </time>
                    </a>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
