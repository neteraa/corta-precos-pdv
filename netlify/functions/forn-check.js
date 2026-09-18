/**
 * GET /api/forn-check?tenantId=mega
 * Returns distributor status for kill-switch enforcement.
 * Fail-open: on infra error, always allows access.
 */
import { getStore } from '@netlify/blobs'

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS })

  const tenantId = new URL(req.url).searchParams.get('tenantId')
  if (!tenantId)
    return new Response(JSON.stringify({ ok: false, error: 'tenantId required' }), { status: 400, headers: CORS })

  try {
    const store = getStore('zs-forn-auth')
    const raw   = await store.get('distributors')
    const list  = raw ? JSON.parse(raw) : []
    const dist  = list.find(d => d.tenantId === tenantId)

    if (!dist)
      return new Response(JSON.stringify({ ok: true, status: 'unknown', active: true }), { headers: CORS })

    const now     = Date.now()
    const expires = dist.expiresAt ? new Date(dist.expiresAt).getTime() : null
    const daysLeft = expires ? Math.ceil((expires - now) / 86_400_000) : null
    const expired  = expires ? now > expires : false

    return new Response(JSON.stringify({
      ok: true, active: dist.active, expired, daysLeft, expiresAt: dist.expiresAt || null,
    }), { headers: CORS })

  } catch {
    return new Response(JSON.stringify({ ok: true, status: 'error', active: true }), { headers: CORS })
  }
}

export const config = { path: '/api/forn-check' }
