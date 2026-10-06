// Shared types for PromptLens dashboard + extension sync contract
export type PiiSeverity = 'critical' | 'high' | 'medium' | 'low'
export type InterceptAction = 'masked' | 'sent_anyway' | 'cancelled'

export interface PiiItem {
  type: string // EMAIL, PHONE, CREDIT_CARD, ...
  label: string // "Email address"
  severity: PiiSeverity
  count: number
  samples: string[] // masked previews, max 3
}

export interface InterceptEventDTO {
  id: string
  createdAt: string
  site: string
  url?: string | null
  action: InterceptAction
  totalPii: number
  severity: PiiSeverity
  items: PiiItem[]
  maskedText?: string | null
  source: string
}

// Payload the extension POSTs to /api/events
export interface ExtensionEventPayload {
  clientId?: string
  createdAt?: string
  site: string
  url?: string
  action: InterceptAction
  totalPii?: number
  severity?: PiiSeverity
  items?: PiiItem[]
  maskedText?: string
}

export const SEVERITY_ORDER: Record<PiiSeverity, number> = {
  critical: 3,
  high: 2,
  medium: 1,
  low: 0,
}

export interface StatsResponse {
  totals: {
    totalEvents: number
    totalPii: number
    maskedEvents: number
    maskedPii: number
    leakedEvents: number
    leakedPii: number
    cancelledEvents: number
    todayEvents: number
    activeSites: number
    protectionRate: number
  }
  byDay: { date: string; total: number; masked: number; leaked: number }[]
  byType: { type: string; label: string; count: number; severity: string }[]
  bySite: { site: string; count: number; pii: number }[]
  bySeverity: { critical: number; high: number; medium: number; low: number }
  recent: InterceptEventDTO[]
  lastEventAt: string | null
}

export function topSeverity(sevs: PiiSeverity[]): PiiSeverity {
  return sevs.reduce<PiiSeverity>(
    (acc, s) => (SEVERITY_ORDER[s] > SEVERITY_ORDER[acc] ? s : acc),
    'low'
  )
}
