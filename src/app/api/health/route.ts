import { json } from '@/lib/cors'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return new Response(null, { status: 204 })
}

// GET /api/health — extension connectivity test
export async function GET() {
  return json({ ok: true, service: 'promptlens-dashboard', time: new Date().toISOString() })
}
