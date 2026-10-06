'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ActionBadge, SeverityBadge, siteLabel, timeAgo, typeMeta } from '@/components/dashboard/shared'
import type { InterceptEventDTO } from '@/lib/types'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'

const PAGE_SIZE = 25

export function History({ refreshKey }: { refreshKey: number }) {
  const [events, setEvents] = useState<InterceptEventDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [site, setSite] = useState('all')
  const [action, setAction] = useState('all')
  const [type, setType] = useState('all')
  const [page, setPage] = useState(0)
  const [detail, setDetail] = useState<InterceptEventDTO | null>(null)
  const [sites, setSites] = useState<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '200' })
      if (q) params.set('q', q)
      if (site !== 'all') params.set('site', site)
      if (action !== 'all') params.set('action', action)
      if (type !== 'all') params.set('type', type)
      const res = await fetch(`/api/events?${params}`)
      const data = await res.json()
      setEvents(data.events ?? [])
    } finally {
      setLoading(false)
    }
  }, [q, site, action, type])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load, refreshKey])

  useEffect(() => {
    fetch('/api/events?limit=200')
      .then((r) => r.json())
      .then((d) => {
        const uniq = [...new Set((d.events ?? []).map((e: InterceptEventDTO) => e.site))]
        setSites(uniq)
      })
      .catch(() => {})
  }, [refreshKey])

  const pages = Math.max(1, Math.ceil(events.length / PAGE_SIZE))
  const visible = events.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(0)
            }}
            placeholder="Search masked prompt text…"
            className="pl-8"
          />
        </div>
        <Select
          value={site}
          onValueChange={(v) => {
            setSite(v)
            setPage(0)
          }}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Site" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sites</SelectItem>
            {sites.map((s) => (
              <SelectItem key={s} value={s}>
                {siteLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={action}
          onValueChange={(v) => {
            setAction(v)
            setPage(0)
          }}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            <SelectItem value="masked">Masked</SelectItem>
            <SelectItem value="sent_anyway">Sent anyway</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={type}
          onValueChange={(v) => {
            setType(v)
            setPage(0)
          }}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="PII type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All PII types</SelectItem>
            {Object.entries(typeMeta).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="border-border/60">
        <CardContent className="p-0">
          <div className="pl-scroll overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">When</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Detected</TableHead>
                  <TableHead className="hidden md:table-cell">Masked prompt</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                )}
                {!loading && visible.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      No matching events.
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  visible.map((e) => (
                    <TableRow
                      key={e.id}
                      className="cursor-pointer"
                      onClick={() => setDetail(e)}
                    >
                      <TableCell className="pl-4 whitespace-nowrap text-xs text-muted-foreground">
                        {timeAgo(e.createdAt)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm font-medium">
                        {siteLabel(e.site)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {e.items.slice(0, 4).map((i) => {
                            const meta = typeMeta(i.type)
                            return (
                              <span
                                key={i.type}
                                className="rounded px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap"
                                style={{ background: `${meta.color}1a`, color: meta.color }}
                              >
                                {meta.label} ×{i.count}
                              </span>
                            )
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="hidden max-w-72 md:table-cell">
                        <span className="pl-mono block truncate text-xs text-muted-foreground">
                          {e.maskedText ?? '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <SeverityBadge severity={e.severity} />
                      </TableCell>
                      <TableCell>
                        <ActionBadge action={e.action} />
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {events.length} events · page {page + 1}/{pages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="size-4" /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {siteLabel(detail.site)} · {new Date(detail.createdAt).toLocaleString()}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2 pt-1">
                  <ActionBadge action={detail.action} />
                  <SeverityBadge severity={detail.severity} />
                  <span className="text-xs">{detail.totalPii} PII items</span>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {detail.items.map((i) => {
                    const meta = typeMeta(i.type)
                    return (
                      <span
                        key={i.type}
                        className="rounded-md px-2 py-1 text-xs font-medium"
                        style={{ background: `${meta.color}1a`, color: meta.color }}
                      >
                        {meta.label} ×{i.count}
                      </span>
                    )
                  })}
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                    What was sent to the AI:
                  </p>
                  <p className="pl-mono max-h-64 overflow-y-auto text-xs leading-relaxed whitespace-pre-wrap pl-scroll">
                    {detail.maskedText ?? '—'}
                  </p>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
