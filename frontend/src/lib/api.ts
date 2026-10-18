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

export interface AuthInfo {
  username: string
  csrf_token: string
}

let csrfToken: string | null = null

export async function getSession(): Promise<AuthInfo> {
  const info = (await request<AuthInfo>('/auth/me')).data
  csrfToken = info.csrf_token
  return info
}

export async function login(username: string, password: string): Promise<AuthInfo> {
  const info = (await request<AuthInfo>('/auth/login', {
    method: 'POST', body: JSON.stringify({ username, password }),
  })).data
  csrfToken = info.csrf_token
  return info
}

export async function logout(): Promise<void> {
  try {
    await request<{ message: string }>('/auth/logout', { method: 'POST' })
  } finally {
    csrfToken = null
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
    const headers = new Headers(init.headers)
    headers.set('Accept', 'application/json')
    if (init.body) headers.set('Content-Type', 'application/json')
    if (csrfToken && init.method && init.method !== 'GET') {
      headers.set('X-CSRF-Token', csrfToken)
    }
    response = await fetch(path, { ...init, credentials: 'same-origin', headers })
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

    if (response.status === 401) {
      if (path !== '/auth/login') {
        csrfToken = null
        window.dispatchEvent(new Event('secureship-auth-expired'))
      }
      throw new ApiError(
        path === '/auth/login' ? 'Identifiant ou mot de passe incorrect.' : 'Session expirée. Reconnectez-vous.',
        401,
      )
    }

    if (response.status === 403) {
      throw new ApiError('Requête refusée : vérification de sécurité (CSRF).', 403)
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
