'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ActionBadge,
  SeverityBadge,
  siteColor,
  siteLabel,
  timeAgo,
  typeMeta,
} from '@/components/dashboard/shared'
import type { InterceptEventDTO, StatsResponse } from '@/lib/types'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  EyeOff,
  Crosshair,
  ShieldCheck,
  ShieldAlert,
  Globe2,
  type LucideIcon,
} from 'lucide-react'

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: LucideIcon
  label: string
  value: string | number
  sub?: string
  accent: string
}) {
  return (
    <Card className="pl-glow border-border/60">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {label}
            </p>
            <p className="mt-2 text-3xl font-semibold tabular-nums" style={{ color: accent }}>
              {value}
            </p>
            {sub && <p className="mt-1 truncate text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${accent}1f`, color: accent }}
          >
            <Icon className="size-4.5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ChartTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { name?: string; value?: number | string; color?: string }[]
  label?: string | number
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border/70 bg-popover px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-1.5 text-muted-foreground">
          <span className="size-1.5 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-semibold text-foreground">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

export function Overview({ stats }: { stats: StatsResponse | null }) {
  if (!stats) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="h-28 p-5" />
          </Card>
        ))}
      </div>
    )
  }

  const t = stats.totals
  const dayData = stats.byDay.map((d) => ({
    ...d,
    label: new Date(d.date + 'T12:00:00').toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    }),
  }))
  const typeData = stats.byType.slice(0, 8)

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          icon={Crosshair}
          label="Prompts intercepted"
          value={t.totalEvents}
          sub={`${t.todayEvents} today`}
          accent="#34d399"
        />
        <StatCard
          icon={EyeOff}
          label="PII items masked"
          value={t.maskedPii}
          sub={`${t.maskedEvents} prompts cleaned`}
          accent="#2dd4bf"
        />
        <StatCard
          icon={ShieldAlert}
          label="Sent unmasked"
          value={t.leakedPii}
          sub={`${t.leakedEvents} risky sends`}
          accent="#f43f5e"
        />
        <StatCard
          icon={ShieldCheck}
          label="Protection rate"
          value={`${t.protectionRate}%`}
          sub="of exposed PII was masked"
          accent="#a78bfa"
        />
        <StatCard
          icon={Globe2}
          label="AI sites covered"
          value={t.activeSites}
          sub="with tracked activity"
          accent="#eab308"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="border-border/60 lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Interceptions — last 14 days
            </CardTitle>
          </CardHeader>
          <CardContent className="h-64 px-2 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dayData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="gMasked" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gLeak" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={2} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="masked" name="Masked" stroke="#34d399" strokeWidth={2} fill="url(#gMasked)" />
                <Area type="monotone" dataKey="leaked" name="Sent anyway" stroke="#f43f5e" strokeWidth={2} fill="url(#gLeak)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/60 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              PII detected by type
            </CardTitle>
          </CardHeader>
          <CardContent className="h-64 pb-4">
            {typeData.length === 0 ? (
              <p className="pt-16 text-center text-sm text-muted-foreground">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={typeData}
                    dataKey="count"
                    nameKey="label"
                    innerRadius="58%"
                    outerRadius="85%"
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {typeData.map((d) => (
                      <Cell key={d.type} fill={typeMeta(d.type).color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="-mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
              {typeData.slice(0, 5).map((d) => (
                <span key={d.type} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="size-1.5 rounded-full" style={{ background: typeMeta(d.type).color }} />
                  {d.label}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sites + severity + recent */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="border-border/60 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Top AI sites</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.bySite.slice(0, 5).map((s) => {
              const max = stats.bySite[0]?.count || 1
              return (
                <div key={s.site}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium">{siteLabel(s.site)}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {s.count} · {s.pii} PII
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${(s.count / max) * 100}%`, background: siteColor(s.site) }}
                    />
                  </div>
                </div>
              )
            })}
            {stats.bySite.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">No activity yet</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 lg:col-span-3">
          <CardHeader className="flex items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="pl-scroll max-h-72 overflow-y-auto pr-1">
            <ScrollArea className="h-auto">
              <ul className="space-y-2">
                {stats.recent.map((e: InterceptEventDTO) => (
                  <li
                    key={e.id}
                    className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/25 px-3 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                        <span className="font-medium">{siteLabel(e.site)}</span>
                        <span className="text-xs text-muted-foreground">{e.totalPii} PII</span>
                        {e.items.slice(0, 3).map((i) => {
                          const meta = typeMeta(i.type)
                          return (
                            <span
                              key={i.type}
                              className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                              style={{ background: `${meta.color}1a`, color: meta.color }}
                            >
                              {meta.label} ×{i.count}
                            </span>
                          )
                        })}
                      </div>
                      <p className="mt-0.5 truncate pl-mono text-xs text-muted-foreground">
                        {e.maskedText ?? '—'}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <ActionBadge action={e.action} />
                      <span className="text-[10px] text-muted-foreground">{timeAgo(e.createdAt)}</span>
                    </div>
                    <SeverityBadge severity={e.severity} className="hidden sm:inline-flex" />
                  </li>
                ))}
                {stats.recent.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No activity yet — intercept some prompts or load demo data from Settings.
                  </p>
                )}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
