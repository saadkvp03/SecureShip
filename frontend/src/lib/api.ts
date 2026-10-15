import type {
  ListParams,
  NewShipment,
  Shipment,
  ShipmentDetail,
  Stats,
  Status,
} from './types'

export class ApiError extends Error {
  status: number
  fields: Record<string, string>

  constructor(message: string, status = 0, fields: Record<string, string> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fields = fields
  }
}

interface ValidationItem {
  loc?: Array<string | number>
  type?: string
  ctx?: Record<string, unknown>
}

function describeValidation(item: ValidationItem): string {
  const max = item.ctx?.max_length

  switch (item.type) {
    case 'string_too_short':
    case 'missing':
      return 'Ce champ est obligatoire.'
    case 'string_too_long':
      return typeof max === 'number'
        ? `Ce champ est limité à ${max} caractères.`
        : 'Ce texte est trop long.'
    default:
      return 'Cette valeur n’est pas valide.'
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<{ data: T; total: number | null }> {
  let response: Response

  try {
    response = await fetch(path, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    throw new ApiError(
      'Impossible de joindre le serveur SecureShip. Vérifiez qu’il est démarré.',
    )
  }

  if (!response.ok) {
    let body: unknown = null

    try {
      body = await response.json()
    } catch {
      // The error response was not JSON; the generic message below is used.
    }

    const detail = (body as { detail?: unknown } | null)?.detail

    if (response.status === 422 && Array.isArray(detail)) {
      const fields: Record<string, string> = {}

      for (const item of detail as ValidationItem[]) {
        const field = String(item.loc?.[item.loc.length - 1] ?? '')
        if (field && !(field in fields)) fields[field] = describeValidation(item)
      }

      throw new ApiError('Certains champs sont invalides.', 422, fields)
    }

    if (response.status === 404) {
      throw new ApiError('Expédition introuvable.', 404)
    }

    throw new ApiError(
      `Le serveur a répondu par une erreur (${response.status}).`,
      response.status,
    )
  }

  const header = response.headers.get('X-Total-Count')

  return {
    data: (await response.json()) as T,
    total: header === null ? null : Number(header),
  }
}

export async function getStats(signal?: AbortSignal): Promise<Stats> {
  return (await request<Stats>('/stats', { signal })).data
}

export async function listShipments(
  params: ListParams,
  signal?: AbortSignal,
): Promise<{ items: Shipment[]; total: number }> {
  const query = new URLSearchParams({
    sort: params.sort,
    order: params.order,
    limit: String(params.limit),
    offset: String(params.offset),
  })

  if (params.q.trim()) query.set('q', params.q.trim())
  if (params.status) query.set('status', params.status)

  const { data, total } = await request<Shipment[]>(`/shipments?${query}`, {
    signal,
  })

  return { items: data, total: total ?? data.length }
}

export async function getShipment(
  id: number,
  signal?: AbortSignal,
): Promise<ShipmentDetail> {
  return (await request<ShipmentDetail>(`/shipments/${id}`, { signal })).data
}

export async function createShipment(input: NewShipment): Promise<Shipment> {
  return (
    await request<Shipment>('/shipments', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  ).data
}

export async function updateStatus(id: number, status: Status): Promise<Shipment> {
  return (
    await request<Shipment>(`/shipments/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  ).data
}
