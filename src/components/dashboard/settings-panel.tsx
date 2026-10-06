'use client'

import { useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import {
  Download,
  Info,
  RefreshCw,
  Trash2,
  ShieldCheck,
  EyeOff,
  BellRing,
  HardDriveDownload,
  ScanSearch,
  Upload,
  Lock,
} from 'lucide-react'

const STEPS = [
  {
    icon: ScanSearch,
    title: '1 · Detect',
    text: 'As you type or hit send on ChatGPT, Claude, Gemini, Perplexity, DeepSeek, Copilot or Poe, PromptLens scans the prompt for emails, phones, cards, API keys, IDs and more.',
  },
  {
    icon: BellRing,
    title: '2 · Warn',
    text: 'Found something sensitive? A warning card pops up listing every PII item with its severity — nothing is sent yet.',
  },
  {
    icon: EyeOff,
    title: '3 · Mask & replace',
    text: 'Accept and PromptLens replaces each item with a placeholder (e.g. j•••@g•••.com → [EMAIL_1]) before the prompt reaches the AI. You can also send unmasked or cancel.',
  },
  {
    icon: HardDriveDownload,
    title: '4 · Track locally',
    text: 'Every interception is logged in the extension\u2019s built-in dashboard — stored only in your browser, never transmitted. Export a JSON file to back it up or view it here.',
  },
]

export function SettingsPanel({ refreshKey, onDataChanged }: { refreshKey: number; onDataChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const seed = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/seed', { method: 'POST' })
      const data = await res.json()
      if (data.seeded > 0) toast.success(`Seeded ${data.seeded} demo events`)
      else toast.info(data.message ?? 'Nothing seeded')
      onDataChanged()
    } catch {
      toast.error('Seeding failed')
    } finally {
      setBusy(false)
    }
  }

  const clear = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/events', { method: 'DELETE' })
      const data = await res.json()
      toast.success(`Deleted ${data.deleted} events`)
      onDataChanged()
    } catch {
      toast.error('Clearing failed')
    } finally {
      setBusy(false)
    }
  }

  const exportJson = async () => {
    try {
      const res = await fetch('/api/events?limit=200')
      const data = await res.json()
      const blob = new Blob([JSON.stringify(data.events, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `promptlens-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Exported events JSON')
    } catch {
      toast.error('Export failed')
    }
  }

  // Import a PromptLens export file (e.g. from the extension's dashboard).
  // The file is read in the browser and posted to THIS local app — nothing
  // ever leaves your machine.
  const importJson = async (file: File) => {
    setBusy(true)
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      if (!Array.isArray(parsed)) throw new Error('expected a JSON array of events')
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: parsed }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'invalid payload')
      toast.success(`Imported ${data.inserted} events${data.skipped ? ` (${data.skipped} duplicates skipped)` : ''}`)
      onDataChanged()
    } catch (err) {
      toast.error(`Import failed: ${err instanceof Error ? err.message : 'unknown error'}`)
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Privacy-first */}
      <Card className="border-emerald-500/25 bg-emerald-500/[0.04]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="size-4.5 text-emerald-400" /> Privacy-first by design
          </CardTitle>
          <CardDescription>
            The PromptLens extension has <b className="text-foreground">no server, no account and no telemetry</b>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-400" />
              Detection, masking and logging run entirely inside your browser — at send time, on device.
            </li>
            <li className="flex gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-400" />
              Interception history lives only in the extension&apos;s local storage on your computer. Nothing is forwarded anywhere.
            </li>
            <li className="flex gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-400" />
              This web app is an <b className="text-foreground">optional local viewer</b>: export JSON from the extension dashboard and import it here for big-screen charts. It stays on your machine.
            </li>
          </ul>
          <Separator />
          <ol className="list-decimal space-y-1.5 pl-4 text-sm text-muted-foreground">
            <li>Install the extension (chrome://extensions → Developer mode → Load unpacked).</li>
            <li>Click the PromptLens icon → <b className="text-foreground">Open Dashboard</b> — that is the extension&apos;s built-in local dashboard.</li>
            <li>There: <b className="text-foreground">Settings → Export JSON</b> to save a snapshot file.</li>
            <li>Here: <b className="text-foreground">Data → Import JSON</b> (below) to view it with full charts.</li>
          </ol>
          <p className="text-xs text-muted-foreground">
            Want to see the warning in action without installing anything? Open the{' '}
            <a href="/pl-demo.html" target="_blank" rel="noreferrer" className="font-medium text-emerald-400 underline-offset-2 hover:underline">
              live interception demo ↗
            </a>{' '}
            — it runs the extension&apos;s real detection engine on a simulated AI chat.
          </p>
        </CardContent>
      </Card>

      {/* Data management */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="size-4.5 text-emerald-400" /> Data
          </CardTitle>
          <CardDescription>Demo data, import/export and history cleanup.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={seed} disabled={busy}>
              <RefreshCw className={busy ? 'size-4 animate-spin' : 'size-4'} /> Load demo data
            </Button>
            <Button variant="outline" onClick={exportJson} disabled={busy}>
              <Download className="size-4" /> Export JSON
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" /> Import JSON
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void importJson(f)
              }}
            />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={busy}>
                  <Trash2 className="size-4" /> Clear all
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete all tracked events?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently clears every interception record from this viewer. The
                    extension&apos;s own local history is untouched — it stays in your browser.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={clear}>Delete everything</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          <Separator />
          <p className="text-xs text-muted-foreground">
            Records shown here come from manual file imports or the demo seeder, and are stored in
            this app&apos;s local SQLite database on your machine. Prompt detection itself always runs
            100% locally in your browser — prompt text is never transmitted to any server.
          </p>
        </CardContent>
      </Card>

      {/* How it works */}
      <Card className="border-border/60 lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="size-4.5 text-emerald-400" /> How PromptLens works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.title} className="rounded-xl border border-border/50 bg-muted/25 p-4">
                <div className="mb-2 flex size-8 items-center justify-center rounded-lg bg-emerald-500/12 text-emerald-400">
                  <s.icon className="size-4" />
                </div>
                <p className="text-sm font-semibold">{s.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/8 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-400" />
            <span>
              <b className="text-foreground">Supported sites:</b> ChatGPT (chatgpt.com), Claude,
              Gemini, Perplexity, DeepSeek, Copilot and Poe. Detection covers emails, phone numbers,
              credit cards (Luhn-validated), SSNs, CNIC/Aadhaar, IBANs, API keys &amp; secrets, IP
              addresses, names, addresses, DOBs and more.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
