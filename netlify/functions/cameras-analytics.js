/**
 * cameras-analytics — Persistência de sessões de analytics de câmera
 *
 * GET  /api/cameras-analytics?storeId=X&date=YYYY-MM-DD
 *   → retorna analytics do dia (padrão: hoje)
 *   → com &range=7 retorna array dos últimos 7 dias
 *
 * POST /api/cameras-analytics
 *   Body: { storeId, sessionId, zones:[{name,visits,avgDwellSec,maxDwellSec,peakCount}], startedAt, endedAt }
 *   → merge com dados existentes do dia no Blob (acumula visitas, recalcula médias ponderadas)
 *   → retorna { ok, date, totalVisits }
 *
 * Blob store: 'corta-precos'
 * Key: {storeId}:zs_cameras:{YYYY-MM-DD}
 */
import { getStore } from '@netlify/blobs'

const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }

function db() {
  return getStore({ name: 'corta-precos', consistency: 'strong' })
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function blobKey(storeId, date) {
  return `${storeId}:zs_cameras:${date}`
}

/* Merge two zone arrays: accumulate visits, recalculate weighted avg dwell */
function mergeZones(existing, incoming) {
  const map = {}
  for (const z of existing) map[z.name] = { ...z }

  for (const z of incoming) {
    if (!map[z.name]) {
      map[z.name] = { ...z }
    } else {
      const prev = map[z.name]
      const totalVisits = prev.visits + z.visits
      // Weighted average dwell
      const avgDwell = totalVisits > 0
        ? (prev.avgDwellSec * prev.visits + z.avgDwellSec * z.visits) / totalVisits
        : 0
      map[z.name] = {
        name:        z.name,
        visits:      totalVisits,
        avgDwellSec: +avgDwell.toFixed(1),
        maxDwellSec: Math.max(prev.maxDwellSec || 0, z.maxDwellSec || 0),
        peakCount:   Math.max(prev.peakCount   || 0, z.peakCount   || 0),
      }
    }
  }

  return Object.values(map)
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS })

  const url     = new URL(req.url)
  const storeId = url.searchParams.get('storeId')
  const store   = db()

  /* ── GET ───────────────────────────────────────────────── */
  if (req.method === 'GET') {
    if (!storeId) return new Response(JSON.stringify({ ok: false, error: 'storeId obrigatório' }), { status: 400, headers: CORS })

    const rangeParam = url.searchParams.get('range')
    const dateParam  = url.searchParams.get('date') || todayStr()

    if (rangeParam) {
      const days = Math.min(parseInt(rangeParam, 10) || 7, 30)
      const results = []
      const now = new Date()
      for (let i = 0; i < days; i++) {
        const d = new Date(now)
        d.setDate(d.getDate() - i)
        const dateStr = d.toISOString().slice(0, 10)
        const raw = await store.get(blobKey(storeId, dateStr), { type: 'text' }).catch(() => null)
        if (raw) {
          results.push({ date: dateStr, ...JSON.parse(raw) })
        }
      }
      return new Response(JSON.stringify({ ok: true, results }), { headers: CORS })
    }

    const raw = await store.get(blobKey(storeId, dateParam), { type: 'text' }).catch(() => null)
    const data = raw ? JSON.parse(raw) : null
    return new Response(JSON.stringify({ ok: true, date: dateParam, data }), { headers: CORS })
  }

  /* ── POST ──────────────────────────────────────────────── */
  if (req.method === 'POST') {
    let body
    try { body = await req.json() }
    catch { return new Response(JSON.stringify({ ok: false, error: 'JSON inválido' }), { status: 400, headers: CORS }) }

    const { storeId: sid, sessionId, zones = [], startedAt, endedAt } = body
    if (!sid) return new Response(JSON.stringify({ ok: false, error: 'storeId obrigatório' }), { status: 400, headers: CORS })

    const date = todayStr()
    const key  = blobKey(sid, date)
    const raw  = await store.get(key, { type: 'text' }).catch(() => null)
    const existing = raw ? JSON.parse(raw) : { sessions: [], zones: [] }

    const merged = {
      date,
      sessions: [...(existing.sessions || []), { sessionId, startedAt, endedAt }].slice(-50),
      zones: mergeZones(existing.zones || [], zones),
      updatedAt: new Date().toISOString(),
    }

    await store.set(key, JSON.stringify(merged))

    const totalVisits = merged.zones.reduce((s, z) => s + (z.visits || 0), 0)
    return new Response(JSON.stringify({ ok: true, date, totalVisits }), { status: 201, headers: CORS })
  }

  return new Response('Method Not Allowed', { status: 405, headers: CORS })
}

export const config = { path: '/api/cameras-analytics' }
