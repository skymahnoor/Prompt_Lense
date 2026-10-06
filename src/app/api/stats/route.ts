import { db } from '@/lib/db'
import { json } from '@/lib/cors'
import type { PiiItem, PiiSeverity } from '@/lib/types'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return new Response(null, { status: 204 })
}

// GET /api/stats — aggregated dashboard data
export async function GET(_req: NextRequest) {
  const since = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000)
  since.setHours(0, 0, 0, 0)

  const [allTime, recent] = await Promise.all([
    db.interceptEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 2000 }),
    db.interceptEvent.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
      take: 2000,
    }),
  ])

  const events = allTime.map(parse)
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const totals = {
    totalEvents: events.length,
    totalPii: events.reduce((a, e) => a + e.totalPii, 0),
    maskedEvents: events.filter((e) => e.action === 'masked').length,
    maskedPii: events.filter((e) => e.action === 'masked').reduce((a, e) => a + e.totalPii, 0),
    leakedEvents: events.filter((e) => e.action === 'sent_anyway').length,
    leakedPii: events.filter((e) => e.action === 'sent_anyway').reduce((a, e) => a + e.totalPii, 0),
    cancelledEvents: events.filter((e) => e.action === 'cancelled').length,
    todayEvents: events.filter((e) => new Date(e.createdAt) >= startOfToday).length,
    activeSites: new Set(events.map((e) => e.site)).size,
  }
  const exposure = totals.maskedPii + totals.leakedPii
  totals.protectionRate = exposure > 0 ? Math.round((totals.maskedPii / exposure) * 100) : 100

  // 14-day trend
  const byDayMap = new Map<string, { date: string; total: number; masked: number; leaked: number }>()
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    const key = d.toISOString().slice(0, 10)
    byDayMap.set(key, { date: key, total: 0, masked: 0, leaked: 0 })
  }
  for (const e of recent) {
    const key = new Date(e.createdAt).toISOString().slice(0, 10)
    const day = byDayMap.get(key)
    if (!day) continue
    day.total += 1
    if (e.action === 'masked') day.masked += 1
    if (e.action === 'sent_anyway') day.leaked += 1
  }
  const byDay = [...byDayMap.values()]

  // PII type breakdown (from items JSON)
  const typeMap = new Map<string, { type: string; label: string; count: number; severity: PiiSeverity }>()
  for (const e of events) {
    for (const item of e.items as PiiItem[]) {
      const prev = typeMap.get(item.type)
      if (prev) prev.count += item.count
      else typeMap.set(item.type, { type: item.type, label: item.label, count: item.count, severity: item.severity })
    }
  }
  const byType = [...typeMap.values()].sort((a, b) => b.count - a.count)

  // Site breakdown
  const siteMap = new Map<string, { site: string; count: number; pii: number }>()
  for (const e of events) {
    const prev = siteMap.get(e.site)
    if (prev) {
      prev.count++
      prev.pii += e.totalPii
    } else siteMap.set(e.site, { site: e.site, count: 1, pii: e.totalPii })
  }
  const bySite = [...siteMap.values()].sort((a, b) => b.count - a.count)

  // Severity breakdown
  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 }
  for (const e of events) {
    const s = e.severity as keyof typeof bySeverity
    if (s in bySeverity) bySeverity[s]++
  }

  return json({
    totals,
    byDay,
    byType,
    bySite,
    bySeverity,
    recent: events.slice(0, 8),
    lastEventAt: events.length ? events[0].createdAt : null,
  })
}

function parse(row: {
  id: string
  createdAt: Date
  site: string
  url: string | null
  action: string
  totalPii: number
  severity: string
  items: string
  maskedText: string | null
  source: string
}) {
  let items: PiiItem[] = []
  try {
    items = JSON.parse(row.items ?? '[]')
  } catch {
    items = []
  }
  return { ...row, items }
}
