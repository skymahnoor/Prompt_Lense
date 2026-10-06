'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  AtSign,
  CreditCard,
  Fingerprint,
  Globe,
  Hash,
  Home,
  IdCard,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  ScrollText,
  CalendarClock,
  type LucideIcon,
} from 'lucide-react'
import type { PiiSeverity } from '@/lib/types'

export const SEVERITY_STYLES: Record<
  PiiSeverity,
  { label: string; className: string; dot: string; rank: number }
> = {
  critical: {
    label: 'Critical',
    className: 'bg-rose-500/12 text-rose-400 border-rose-500/30',
    dot: 'bg-rose-400',
    rank: 3,
  },
  high: {
    label: 'High',
    className: 'bg-orange-500/12 text-orange-400 border-orange-500/30',
    dot: 'bg-orange-400',
    rank: 2,
  },
  medium: {
    label: 'Medium',
    className: 'bg-amber-500/12 text-amber-400 border-amber-500/30',
    dot: 'bg-amber-400',
    rank: 1,
  },
  low: {
    label: 'Low',
    className: 'bg-slate-500/12 text-slate-300 border-slate-500/30',
    dot: 'bg-slate-400',
    rank: 0,
  },
}

export function SeverityBadge({ severity, className }: { severity: string; className?: string }) {
  const s = SEVERITY_STYLES[(severity as PiiSeverity) ?? 'low'] ?? SEVERITY_STYLES.low
  return (
    <Badge variant="outline" className={cn('gap-1.5 capitalize', s.className, className)}>
      <span className={cn('size-1.5 rounded-full', s.dot)} />
      {s.label}
    </Badge>
  )
}

export const ACTION_STYLES: Record<string, { label: string; className: string }> = {
  masked: { label: 'Masked', className: 'bg-emerald-500/12 text-emerald-400 border-emerald-500/30' },
  sent_anyway: { label: 'Sent anyway', className: 'bg-rose-500/12 text-rose-400 border-rose-500/30' },
  cancelled: { label: 'Cancelled', className: 'bg-zinc-500/12 text-zinc-300 border-zinc-500/30' },
}

export function ActionBadge({ action, className }: { action: string; className?: string }) {
  const s = ACTION_STYLES[action] ?? { label: action, className: '' }
  return (
    <Badge variant="outline" className={cn(s.className, className)}>
      {s.label}
    </Badge>
  )
}

export const TYPE_META: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  EMAIL: { label: 'Email', icon: Mail, color: '#34d399' },
  PHONE: { label: 'Phone', icon: Phone, color: '#2dd4bf' },
  CREDIT_CARD: { label: 'Card', icon: CreditCard, color: '#f43f5e' },
  SSN: { label: 'SSN', icon: Fingerprint, color: '#f43f5e' },
  API_KEY: { label: 'API key', icon: KeyRound, color: '#fb923c' },
  IP_ADDRESS: { label: 'IP', icon: Globe, color: '#eab308' },
  NAME: { label: 'Name', icon: AtSign, color: '#c084fc' },
  ADDRESS: { label: 'Address', icon: MapPin, color: '#94a3b8' },
  DOB: { label: 'DOB', icon: CalendarClock, color: '#facc15' },
  CNIC: { label: 'CNIC', icon: IdCard, color: '#fb923c' },
  AADHAAR: { label: 'Aadhaar', icon: IdCard, color: '#fb923c' },
  IBAN: { label: 'IBAN', icon: Hash, color: '#f43f5e' },
  PASSPORT: { label: 'Passport', icon: ScrollText, color: '#fb923c' },
  ZIP: { label: 'ZIP', icon: Home, color: '#94a3b8' },
}

export function typeMeta(type: string) {
  return TYPE_META[type] ?? { label: type, icon: Hash, color: '#94a3b8' }
}

export const SITE_COLORS: Record<string, string> = {
  'chatgpt.com': '#34d399',
  'chat.openai.com': '#34d399',
  'claude.ai': '#e8734a',
  'gemini.google.com': '#7b8cf0',
  'perplexity.ai': '#2dd4bf',
  'chat.deepseek.com': '#818cf8',
  'copilot.microsoft.com': '#22d3ee',
  'poe.com': '#f472b6',
  'huggingface.co': '#facc15',
}

export function siteColor(site: string) {
  return SITE_COLORS[site] ?? '#34d399'
}

export function siteLabel(site: string) {
  return site.replace('www.', '')
}

export function timeAgo(dateStr: string | Date) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 14) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}
