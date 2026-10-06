import { NextResponse } from 'next/server'

// The extension (content script / service worker) syncs events from any origin,
// so all API routes answer preflights permissively.
export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  }
}

export function json(data: unknown, init?: number | ResponseInit) {
  const responseInit: ResponseInit = typeof init === 'number' ? { status: init } : init ?? {}
  responseInit.headers = { ...corsHeaders(), ...(responseInit.headers ?? {}) }
  return NextResponse.json(data, responseInit)
}
