const dateTime = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const relative = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })

export function formatDateTime(iso: string | null, fallback = 'Non enregistrée'): string {
  if (!iso) return fallback
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? fallback : dateTime.format(date)
}

export function timeAgo(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''

  const seconds = Math.round((date.getTime() - Date.now()) / 1000)
  const abs = Math.abs(seconds)

  if (abs < 45) return 'à l’instant'
  if (abs < 3600) return relative.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return relative.format(Math.round(seconds / 3600), 'hour')
  if (abs < 86400 * 7) return relative.format(Math.round(seconds / 86400), 'day')

  return dateTime.format(date)
}

export function percent(part: number, total: number): string {
  return total === 0 ? '0 %' : `${Math.round((part / total) * 100)} %`
}
