import { db } from '@/lib/db'
import { json } from '@/lib/cors'
import type { PiiItem, PiiSeverity } from '@/lib/types'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return new Response(null, { status: 204 })
}

const SITES = ['chatgpt.com', 'claude.ai', 'gemini.google.com', 'perplexity.ai', 'chat.deepseek.com']
const ACTIONS = ['masked', 'masked', 'masked', 'masked', 'masked', 'masked', 'masked', 'sent_anyway', 'sent_anyway', 'cancelled']

const TYPE_POOL: { type: string; label: string; severity: PiiSeverity; weight: number; samples: string[] }[] = [
  { type: 'EMAIL', label: 'Email address', severity: 'high', weight: 9, samples: ['j•••@g•••.com → [EMAIL_1]', 'sarah.m•••@outlook.com → [EMAIL_1]'] },
  { type: 'PHONE', label: 'Phone number', severity: 'medium', weight: 7, samples: ['+1 ••• ••• 4521 → [PHONE_1]', '+92 3•• •••8890 → [PHONE_1]'] },
  { type: 'NAME', label: 'Person name', severity: 'low', weight: 6, samples: ['Sarah Ahmed → [NAME_1]'] },
  { type: 'API_KEY', label: 'API key / secret', severity: 'critical', weight: 3, samples: ['sk-••••••••3fa9 → [API_KEY_1]', 'ghp_••••••••91cd → [API_KEY_1]'] },
  { type: 'ADDRESS', label: 'Physical address', severity: 'medium', weight: 4, samples: ['[ADDRESS_1]'] },
  { type: 'CREDIT_CARD', label: 'Card number', severity: 'critical', weight: 2, samples: ['•••• •••• •••• 4242 → [CREDIT_CARD_1]'] },
  { type: 'IP_ADDRESS', label: 'IP address', severity: 'medium', weight: 3, samples: ['192.168.•••.4 → [IP_ADDRESS_1]'] },
  { type: 'SSN', label: 'Social security no.', severity: 'critical', weight: 1, samples: ['•••-••-7289 → [SSN_1]'] },
  { type: 'DOB', label: 'Date of birth', severity: 'medium', weight: 2, samples: ['[DOB_1]'] },
  { type: 'CNIC', label: 'National ID (CNIC)', severity: 'high', weight: 2, samples: ['42101-•••••••-8 → [CNIC_1]'] },
]

const SNIPPETS = [
  'Hi, my name is Sarah Ahmed and my email is sarah.ahmed@gmail.com. I need help drafting a complaint letter about my recent order.',
  'Can you review this contract? The client phone number is +1 (415) 555-4521, address is 742 Evergreen Terrace, Springfield.',
  'I keep getting a card decline. My card is 4532 0151 1283 4242, can you help me figure out why the payment fails?',
  'Please debug this: my AWS key is AKIAIOSFODNN7EXAMPLE — keep getting invalid signature errors from the SDK.',
  'Draft a leave request. Employee CNIC is 42101-1234567-8, DOB is 1994-03-21, joining date was last March.',
  'Write an SQL query to find users with IP 192.168.4.77 who logged in more than 5 times yesterday.',
  'My SSN is 512-44-7289 and I need to write a dispute letter for a credit report error, can you help?',
  'Help me write an email to john.doe@company.com about renewing our API token sk-proj-9x2KpLmNqR4tUv8W.',
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function weightedType() {
  const total = TYPE_POOL.reduce((a, t) => a + t.weight, 0)
  let r = Math.random() * total
  for (const t of TYPE_POOL) {
    r -= t.weight
    if (r <= 0) return t
  }
  return TYPE_POOL[0]
}

// POST /api/seed — generate realistic demo history (skipped when data exists unless ?force=1)
export async function POST(req: NextRequest) {
  const force = req.nextUrl.searchParams.get('force') === '1'
  const existing = await db.interceptEvent.count()
  if (existing > 0 && !force) {
    return json({ ok: true, seeded: 0, message: 'Data already exists' })
  }

  const events = []
  const now = Date.now()

  for (let d = 13; d >= 0; d--) {
    // weekdays busier, ramping up recently
    const base = 3 + Math.floor((13 - d) / 3)
    const date = new Date(now - d * 86400000)
    const count = base + Math.floor(Math.random() * 4)
    for (let i = 0; i < count; i++) {
      const site = pick(SITES)
      const action = pick(ACTIONS)
      const nTypes = 1 + Math.floor(Math.random() * 2.4)
      const chosen = new Set<string>()
      const items: PiiItem[] = []
      for (let t = 0; t < nTypes; t++) {
        const tp = weightedType()
        if (chosen.has(tp.type)) continue
        chosen.add(tp.type)
        items.push({
          type: tp.type,
          label: tp.label,
          severity: tp.severity,
          count: 1 + Math.floor(Math.random() * 2),
          samples: [pick(tp.samples)],
        })
      }
      const totalPii = items.reduce((a, i) => a + i.count, 0)
      const sevRank: Record<PiiSeverity, number> = { critical: 3, high: 2, medium: 1, low: 0 }
      const severity = items.reduce<PiiSeverity>((acc, i) => (sevRank[i.severity] > sevRank[acc] ? i.severity : acc), 'low')
      const createdAt = new Date(date)
      createdAt.setHours(9 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60), 0, 0)
      events.push({
        clientId: `demo-${d}-${i}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt,
        site,
        url: `https://${site}/`,
        action,
        totalPii,
        severity,
        items: JSON.stringify(items),
        maskedText: pick(SNIPPETS),
        source: 'demo',
      })
    }
  }

  await db.interceptEvent.createMany({ data: events })
  return json({ ok: true, seeded: events.length })
}
