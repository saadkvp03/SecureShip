import { useState, type ReactNode } from 'react'
import { ArrowLeft, Check, Copy, History, MapPin, StickyNote, User } from 'lucide-react'
import { useApp } from '../app-context'
import { ErrorState, Skeleton, Spinner, StatusBadge, TrackerRail } from '../components/ui'
import { ApiError, getShipment, updateStatus } from '../lib/api'
import { formatDateTime } from '../lib/format'
import { useAsync } from '../lib/hooks'
import { STATUS_META, STATUS_ORDER, eventTitle } from '../lib/status'
import type { Status } from '../lib/types'

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof User
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex gap-3 py-3.5">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-raised text-muted">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <dt className="text-xs font-semibold text-muted">{label}</dt>
        <dd className="mt-0.5 break-words text-sm font-semibold">{children}</dd>
      </div>
    </div>
  )
}

export default function Detail({ id }: { id: number }) {
  const { notify, bump, version } = useApp()
  const { data: loaded, error, reload } = useAsync((signal) => getShipment(id, signal), [id, version])
  // Never show the previous shipment while another one is loading.
  const data = loaded && loaded.id === id ? loaded : null
  const [saving, setSaving] = useState<Status | null>(null)
  const [copied, setCopied] = useState(false)

  async function change(status: Status) {
    if (!data || status === data.status) return
    setSaving(status)

    try {
      await updateStatus(data.id, status)
      notify('success', `Statut « ${STATUS_META[status].label} » enregistré.`)
      bump()
    } catch (err) {
      notify('error', err instanceof ApiError ? err.message : 'La mise à jour a échoué.')
    } finally {
      setSaving(null)
    }
  }

  async function copy() {
    if (!data) return

    try {
      await navigator.clipboard.writeText(data.tracking_ref)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      notify('error', 'La copie n’est pas disponible dans ce navigateur.')
    }
  }

  if (error) {
    return (
      <div className="space-y-4">
        <a href="#/shipments" className="inline-flex items-center gap-2 text-sm font-semibold text-accent-ink hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Retour aux expéditions
        </a>
        <ErrorState message={error.message} onRetry={error.status === 404 ? undefined : reload} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <a href="#/shipments" className="inline-flex items-center gap-2 text-sm font-semibold text-accent-ink hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Retour aux expéditions
      </a>

      {!data ? (
        <div className="space-y-6">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          <section className="card p-6" aria-labelledby="shipment-title">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 id="shipment-title" className="font-mono text-2xl font-bold tracking-tight">
                    {data.tracking_ref}
                  </h2>
                  <button
                    type="button"
                    onClick={copy}
                    className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-raised hover:text-ink"
                    aria-label="Copier le numéro de suivi"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-accent-ink" aria-hidden="true" />
                    ) : (
                      <Copy className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
                <p className="mt-1 truncate text-sm text-muted">
                  Pour {data.recipient}, vers {data.destination}
                </p>
              </div>
              <StatusBadge status={data.status} />
            </div>

            <div className="mx-auto mt-8 max-w-2xl pb-2">
              <TrackerRail status={data.status} events={data.events} />
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-5">
            <div className="space-y-6 lg:col-span-3">
              <section className="card p-6" aria-labelledby="info-title">
                <h2 id="info-title" className="mb-1 text-base font-bold">
                  Informations
                </h2>
                <dl className="divide-y divide-line">
                  <InfoRow icon={User} label="Destinataire">
                    {data.recipient}
                  </InfoRow>
                  <InfoRow icon={MapPin} label="Destination">
                    {data.destination}
                  </InfoRow>
                  <InfoRow icon={MapPin} label="Origine">
                    {data.origin ?? <span className="font-normal text-muted">Non renseignée</span>}
                  </InfoRow>
                  <InfoRow icon={StickyNote} label="Notes">
                    {data.notes ? (
                      <span className="whitespace-pre-wrap font-medium">{data.notes}</span>
                    ) : (
                      <span className="font-normal text-muted">Aucune note</span>
                    )}
                  </InfoRow>
                  <InfoRow icon={History} label="Créée le">
                    {formatDateTime(data.created_at)}
                  </InfoRow>
                  <InfoRow icon={History} label="Dernière mise à jour">
                    {formatDateTime(data.updated_at)}
                  </InfoRow>
                </dl>
              </section>
            </div>

            <div className="space-y-6 lg:col-span-2">
              <section className="card p-6" aria-labelledby="status-title">
                <h2 id="status-title" className="text-base font-bold">
                  Modifier le statut
                </h2>
                <div className="mt-4 grid gap-2" role="radiogroup" aria-labelledby="status-title">
                  {STATUS_ORDER.map((status) => {
                    const meta = STATUS_META[status]
                    const Icon = meta.icon
                    const selected = data.status === status

                    return (
                      <button
                        key={status}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={saving !== null}
                        onClick={() => change(status)}
                        className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-sm font-semibold transition-colors disabled:cursor-not-allowed ${
                          selected
                            ? 'border-accent bg-accent/10'
                            : 'border-line hover:bg-raised'
                        }`}
                      >
                        <span className={`grid h-8 w-8 place-items-center rounded-lg ${meta.chip}`}>
                          {saving === status ? <Spinner /> : <Icon className="h-4 w-4" aria-hidden="true" />}
                        </span>
                        <span className="flex-1">{meta.label}</span>
                        {selected && <Check className="h-4 w-4 text-accent-ink" aria-hidden="true" />}
                      </button>
                    )
                  })}
                </div>
              </section>

              <section className="card p-6" aria-labelledby="history-title">
                <h2 id="history-title" className="mb-4 text-base font-bold">
                  Historique
                </h2>

                {data.events.length === 0 ? (
                  <p className="text-sm leading-relaxed text-muted">
                    Aucun historique enregistré. Cette expédition a été créée avant l’ajout du suivi des
                    changements de statut ; les prochains changements apparaîtront ici.
                  </p>
                ) : (
                  <ol className="relative space-y-5 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-line">
                    {[...data.events].reverse().map((event) => {
                      const meta = STATUS_META[event.to_status]
                      const Icon = meta.icon

                      return (
                        <li key={event.id} className="relative flex gap-3">
                          <span className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full ring-4 ring-card ${meta.chip}`}>
                            <Icon className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <div>
                            <div className="text-sm font-semibold">
                              {eventTitle(event.from_status, event.to_status)}
                            </div>
                            <time dateTime={event.occurred_at} className="text-xs text-muted">
                              {formatDateTime(event.occurred_at)}
                            </time>
                          </div>
                        </li>
                      )
                    })}
                  </ol>
                )}
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
