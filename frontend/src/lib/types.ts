export type Status = 'created' | 'in_transit' | 'delivered'

export interface Shipment {
  id: number
  tracking_ref: string
  recipient: string
  destination: string
  origin: string | null
  notes: string | null
  status: Status
  created_at: string | null
  updated_at: string | null
}

export interface ShipmentEvent {
  id: number
  from_status: Status | null
  to_status: Status
  occurred_at: string
}

export interface ShipmentDetail extends Shipment {
  events: ShipmentEvent[]
}

export interface Activity {
  id: number
  shipment_id: number
  tracking_ref: string
  recipient: string
  destination: string
  from_status: Status | null
  to_status: Status
  occurred_at: string
}

export interface Stats {
  total: number
  by_status: Record<Status, number>
  recent_activity: Activity[]
}

export type SortKey = 'id' | 'recipient' | 'destination' | 'status'

export interface ListParams {
  q: string
  status: Status | ''
  sort: SortKey
  order: 'asc' | 'desc'
  limit: number
  offset: number
}

export interface NewShipment {
  recipient: string
  destination: string
  origin?: string
  notes?: string
}
