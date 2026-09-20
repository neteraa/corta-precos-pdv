/**
 * wa-leads — Lista leads capturados pelo bot Zara (wa-bot.js)
 * GET /api/wa-leads   → todos os leads ordenados por data desc
 */

import { getStore } from '@netlify/blobs'

const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }

function authOk(req) {
  const url = new URL(req.url)
  const mk  = req.headers.get('x-master-key') || url.searchParams.get('mk') || ''
  return mk === (process.env.ZS_MASTER_KEY || 'zatende2026master')
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS })
  if (!authOk(req)) return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: CORS })

  try {
    const store = getStore({ name: 'wa-leads', consistency: 'strong' })
    const { blobs } = await store.list()

    const leads = (await Promise.all(
      blobs.slice(0, 300).map(async ({ key }) => {
        try {
          const data = await store.get(key, { type: 'json' })
          return data ? { phone: key, ...data } : null
        } catch { return null }
      })
    )).filter(Boolean)

    leads.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))

    return new Response(JSON.stringify({ ok: true, leads, total: leads.length }), { headers: CORS })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message, leads: [] }), { status: 500, headers: CORS })
  }
}

export const config = { path: '/api/wa-leads' }
