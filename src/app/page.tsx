'use client'

import { useCallback, useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Overview } from '@/components/dashboard/overview'
import { History } from '@/components/dashboard/history'
import { SettingsPanel } from '@/components/dashboard/settings-panel'
import type { StatsResponse } from '@/lib/types'
import { EyeOff, Globe, Radar, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function Home() {
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [tab, setTab] = useState('overview')

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats', { cache: 'no-store' })
      if (!res.ok) return
      setStats(await res.json())
    } catch {
      // network hiccup — keep previous stats
    }
  }, [])

  const onDataChanged = useCallback(() => {
    loadStats()
    setRefreshKey((k) => k + 1)
  }, [loadStats])

  useEffect(() => {
    loadStats()
    const t = setInterval(loadStats, 15000) // live-ish: imports/seed appear automatically
    return () => clearInterval(t)
  }, [loadStats])

  const lastEvent = stats?.lastEventAt ? new Date(stats.lastEventAt) : null

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-background">
      {/* ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-72 opacity-60"
        style={{
          background:
            'radial-gradient(60% 100% at 50% 0%, oklch(0.78 0.15 165 / 0.09) 0%, transparent 70%)',
        }}
      />

      <main className="relative mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6">
        {/* Header */}
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-400 ring-1 ring-emerald-500/25">
              <Radar className="size-6" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                PromptLens
                <span className="ml-2 align-middle text-xs font-medium text-emerald-400">
                  PII Guard
                </span>
              </h1>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Detect · Warn · Mask — before your prompt reaches the AI
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <EyeOff className="size-3.5 text-teal-400" />
              {stats?.totals.maskedPii ?? 0} masked
            </span>
            <span className="flex items-center gap-1.5">
              <Globe className="size-3.5 text-yellow-400" />
              {stats?.totals.activeSites ?? 0} sites
            </span>
            <span className="flex items-center gap-1.5">
              <span className="relative flex size-2">
                <span
                  className={cn(
                    'absolute inline-flex h-full w-full rounded-full opacity-60',
                    lastEvent && Date.now() - lastEvent.getTime() < 3600_000
                      ? 'animate-ping bg-emerald-400'
                      : 'bg-emerald-400/0'
                  )}
                />
                <span
                  className={cn(
                    'relative inline-flex size-2 rounded-full',
                    lastEvent ? 'bg-emerald-400' : 'bg-zinc-500'
                  )}
                />
              </span>
              {lastEvent ? `last event ${lastEvent.toLocaleTimeString()}` : 'awaiting first event'}
            </span>
          </div>
        </header>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="bg-muted/40">
            <TabsTrigger value="overview" className="gap-1.5">
              <ShieldCheck className="size-4" /> Overview
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5">
              <EyeOff className="size-4" /> Activity log
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5">
              <Globe className="size-4" /> Settings &amp; setup
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-2">
            <Overview stats={stats} />
          </TabsContent>
          <TabsContent value="history" className="mt-2">
            <History refreshKey={refreshKey} />
          </TabsContent>
          <TabsContent value="settings" className="mt-2">
            <SettingsPanel refreshKey={refreshKey} onDataChanged={onDataChanged} />
          </TabsContent>
        </Tabs>

        <footer className="mt-10 border-t border-border/50 pt-4 text-center text-xs text-muted-foreground">
          PromptLens · 100% local — detection and history live in your browser; this viewer only shows
          what you import on this machine.
        </footer>
      </main>
    </div>
  )
}
