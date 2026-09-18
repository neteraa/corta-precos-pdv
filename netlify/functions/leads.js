/**
 * leads — API de leads capturados pelo bot WhatsApp
 *
 * GET  /api/leads?mk=MASTER_KEY              → lista todos os leads
 * GET  /api/leads?mk=MASTER_KEY&phone=55...  → lead específico
 * DELETE /api/leads?mk=MASTER_KEY&phone=55.. → remove lead
 */

import { getStore } from '@netlify/blobs'

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
}

function leadsStore() {
  return getStore({ name: 'wa-leads', consistency: 'strong' })
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS })

  const url = new URL(req.url)
  const mk    = url.searchParams.get('mk')
  const phone = url.searchParams.get('phone')

  if (mk !== process.env.ZS_MASTER_KEY) {
    return new Response(JSON.stringify({ ok: false, error: 'Não autorizado' }), { status: 401, headers: CORS })
  }

  const store = leadsStore()

  // ── DELETE: remove lead ────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    if (!phone) return new Response(JSON.stringify({ ok: false, error: 'phone obrigatório' }), { status: 400, headers: CORS })
    await store.delete(phone)
    return new Response(JSON.stringify({ ok: true }), { headers: CORS })
  }

  // ── GET: lista ou lead específico ──────────────────────────────────────────
  if (req.method === 'GET') {
    // Lead específico
    if (phone) {
      const raw = await store.get(phone, { type: 'json' })
      return new Response(JSON.stringify(raw || null), { headers: CORS })
    }

    // Lista todos os leads
    const { blobs } = await store.list()
    const leads = await Promise.all(
      blobs.map(async b => {
        try { return await store.get(b.key, { type: 'json' }) }
        catch { return null }
      })
    )

    // Ordena por updatedAt desc, remove nulos
    const sorted = leads
      .filter(Boolean)
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))

    return new Response(JSON.stringify({ ok: true, total: sorted.length, leads: sorted }), { headers: CORS })
  }

  return new Response('Method Not Allowed', { status: 405, headers: CORS })
}

export const config = { path: '/api/leads' }
