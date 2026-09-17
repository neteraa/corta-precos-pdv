/**
 * GET /api/market-check?storeId=xxx
 *
 * Returns the public status of a market (active + payment expiry).
 * No auth needed — storeId is not secret, just an identifier.
 * Called by the frontend on every app load to enforce the kill switch.
 */
import { getStore } from '@netlify/blobs'

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS })

  const url     = new URL(req.url)
  const storeId = url.searchParams.get('storeId')

  if (!storeId)
    return new Response(JSON.stringify({ ok: false, error: 'storeId required' }), { status: 400, headers: CORS })

  try {
    const store   = getStore('zs-auth')
    const raw     = await store.get('markets')
    const markets = raw ? JSON.parse(raw) : []

    const market = markets.find(m => m.storeId === storeId)

    if (!market)
      return new Response(JSON.stringify({ ok: true, status: 'unknown', active: true }), { headers: CORS })

    const now      = Date.now()
    const expires  = market.expiresAt ? new Date(market.expiresAt).getTime() : null
    const daysLeft = expires ? Math.ceil((expires - now) / 86_400_000) : null
    const expired  = expires ? now > expires : false

    return new Response(JSON.stringify({
      ok:       true,
      active:   market.active,
      expired,
      daysLeft,
      expiresAt: market.expiresAt || null,
      storeName: market.storeName,
    }), { headers: CORS })

  } catch (err) {
    // On error, allow access — never block due to infra failure
    return new Response(JSON.stringify({ ok: true, status: 'error', active: true }), { headers: CORS })
  }
}

export const config = { path: '/api/market-check' }
