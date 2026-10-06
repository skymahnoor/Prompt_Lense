import { db } from '@/lib/db'
import { json } from '@/lib/cors'
import type { ExtensionEventPayload } from '@/lib/types'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

// OPTIONS — CORS preflight (extension syncs from chrome-extension:// origins)
export async function OPTIONS() {
  return new Response(null, { status: 204 })
}

// GET /api/events?limit=&offset=&site=&action=&type=&q=
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const limit = Math.min(parseInt(sp.get('limit') ?? '50', 10) || 50, 200)
  const offset = Math.max(parseInt(sp.get('offset') ?? '0', 10) || 0, 0)
  const site = sp.get('site') ?? undefined
  const action = sp.get('action') ?? undefined
  const type = sp.get('type') ?? undefined
  const q = sp.get('q') ?? undefined

  const where: Record<string, unknown> = {}
  if (site) where.site = site
  if (action) where.action = action
  if (q) where.maskedText = { contains: q }

  const rows = await db.interceptEvent.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  })

  // type filter is inside the JSON items column — filter post-query
  let events = rows.map(serialize)
  if (type) events = events.filter((e) => e.items.some((i) => i.type === type))

  return json({ events, total: events.length })
}

// POST /api/events — extension batch sync (also accepts a single object)
export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const list: ExtensionEventPayload[] = Array.isArray(body)
    ? (body as ExtensionEventPayload[])
    : Array.isArray((body as { events?: unknown })?.events)
      ? (body as { events: ExtensionEventPayload[] }).events
      : [body as ExtensionEventPayload]

  if (list.length === 0) return json({ error: 'No events provided' }, 400)
  if (list.length > 500) return json({ error: 'Batch too large (max 500)' }, 413)

  const toInsert = []
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue
    const e = raw as ExtensionEventPayload
    if (!e.site || !e.action) continue // minimal contract
    const items = Array.isArray(e.items) ? e.items : []
    const totalPii =
      typeof e.totalPii === 'number'
        ? e.totalPii
        : items.reduce((acc, i) => acc + (i.count ?? 0), 0)
    toInsert.push({
      clientId: e.clientId ?? undefined,
      createdAt: e.createdAt ? new Date(e.createdAt) : undefined,
      site: String(e.site).slice(0, 120),
      url: e.url ? String(e.url).slice(0, 500) : null,
      action: String(e.action),
      totalPii,
      severity: e.severity ?? 'low',
      items: JSON.stringify(items),
      maskedText: e.maskedText ? String(e.maskedText).slice(0, 4000) : null,
      source: 'extension',
    })
  }

  if (toInsert.length === 0) return json({ error: 'No valid events' }, 400)

  let inserted = 0
  let skipped = 0
  for (const data of toInsert) {
    try {
      await db.interceptEvent.create({ data })
      inserted++
    } catch {
      // clientId unique conflict → already synced, skip
      skipped++
    }
  }

  return json({ ok: true, inserted, skipped })
}

// DELETE /api/events — clear all history
export async function DELETE() {
  const res = await db.interceptEvent.deleteMany({})
  return json({ ok: true, deleted: res.count })
}

function serialize(row: {
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
  let items: unknown[] = []
  try {
    items = JSON.parse(row.items ?? '[]')
  } catch {
    items = []
  }
  return { ...row, items }
}
