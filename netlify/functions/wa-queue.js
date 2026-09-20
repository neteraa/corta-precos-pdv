/**
 * wa-queue — Fila persistente de prospects para prospecção via Zara
 *
 * GET  /api/wa-queue         → lista a fila completa
 * POST /api/wa-queue
 *   action=add     { contacts:[{phone,name}] }  → adiciona à fila
 *   action=update  { id, status, error? }       → atualiza status
 *   action=clear   { mode:'done'|'all' }        → limpa enviados ou tudo
 */

import { getStore } from '@netlify/blobs'

const QUEUE_KEY  = 'prospect-queue'
const DAILY_KEY  = () => `prospect-daily-${new Date().toISOString().slice(0, 10)}`
const DAILY_LIMIT = 20  // mais seguro pra cold outreach em número novo
const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }

function authOk(req) {
  const mk = req.headers.get('x-master-key') || ''
  return mk === (process.env.ZS_MASTER_KEY || 'zatende2026master')
}

function store() {
  return getStore({ name: 'prospect-queue', consistency: 'strong' })
}

async function loadQueue() {
  try {
    const raw = await store().get(QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

async function saveQueue(q) {
  await store().set(QUEUE_KEY, JSON.stringify(q))
}

async function getDailySent() {
  try {
    const raw = await store().get(DAILY_KEY())
    return raw ? parseInt(raw, 10) : 0
  } catch { return 0 }
}

async function incDailySent() {
  const cur = await getDailySent()
  await store().set(DAILY_KEY(), String(cur + 1))
  return cur + 1
}

function normalizePhone(raw) {
  const d = raw.replace(/\D/g, '').replace(/^0+/, '')
  if (d.startsWith('55') && d.length >= 12) return d
  if (d.length === 11) return `55${d}`
  if (d.length === 10) return `55${d}`
  return null
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS })
  if (!authOk(req)) return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: CORS })

  // ── GET: listar fila ─────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const queue    = await loadQueue()
    const dailySent = await getDailySent()
    const pending  = queue.filter(c => c.status === 'pending').length
    const sent     = queue.filter(c => c.status === 'sent').length
    const failed   = queue.filter(c => c.status === 'failed').length
    return new Response(JSON.stringify({
      ok: true, queue, stats: { pending, sent, failed, dailySent, dailyLimit: DAILY_LIMIT },
    }), { headers: CORS })
  }

  if (req.method !== 'POST')
    return new Response(JSON.stringify({ error: 'GET ou POST apenas' }), { status: 405, headers: CORS })

  let body
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'JSON inválido' }), { status: 400, headers: CORS })
  }

  const { action } = body

  // ── ADD: adicionar contatos ──────────────────────────────────────────────
  if (action === 'add') {
    const { contacts = [] } = body
    const queue = await loadQueue()
    const existing = new Set(queue.map(c => c.phone))
    let added = 0, dupes = 0

    for (const { phone: rawPhone, name = '' } of contacts) {
      const phone = normalizePhone(rawPhone)
      if (!phone) continue
      if (existing.has(phone)) { dupes++; continue }
      queue.push({ id: uid(), phone, name: name.trim(), status: 'pending', addedAt: new Date().toISOString(), sentAt: null, error: null })
      existing.add(phone)
      added++
    }
    await saveQueue(queue)
    return new Response(JSON.stringify({ ok: true, added, dupes, total: queue.length }), { headers: CORS })
  }

  // ── UPDATE: marcar enviado/falhou ────────────────────────────────────────
  if (action === 'update') {
    const { id, status, error = null } = body
    if (!id || !status) return new Response(JSON.stringify({ error: 'id e status obrigatórios' }), { status: 400, headers: CORS })
    const queue = await loadQueue()
    const idx = queue.findIndex(c => c.id === id)
    if (idx === -1) return new Response(JSON.stringify({ error: 'Contato não encontrado' }), { status: 404, headers: CORS })
    queue[idx] = { ...queue[idx], status, error, sentAt: status === 'sent' ? new Date().toISOString() : queue[idx].sentAt }
    if (status === 'sent') await incDailySent()
    await saveQueue(queue)
    return new Response(JSON.stringify({ ok: true }), { headers: CORS })
  }

  // ── CLEAR: limpar fila ────────────────────────────────────────────────────
  if (action === 'clear') {
    const { mode = 'done' } = body
    let queue = await loadQueue()
    const before = queue.length
    queue = mode === 'all' ? [] : queue.filter(c => c.status === 'pending')
    await saveQueue(queue)
    return new Response(JSON.stringify({ ok: true, removed: before - queue.length, remaining: queue.length }), { headers: CORS })
  }

  // ── SAVE-CAMPAIGN: salvar resumo de um disparo concluído ────────────────
  if (action === 'save-campaign') {
    const { sent = 0, failed = 0, startedAt, endedAt } = body
    const CAMP_KEY = 'campaign-history'
    let campaigns = []
    try { const raw = await store().get(CAMP_KEY); campaigns = raw ? JSON.parse(raw) : [] } catch {}
    campaigns.unshift({ id: uid(), sent, failed, startedAt, endedAt })
    if (campaigns.length > 100) campaigns = campaigns.slice(0, 100)
    await store().set(CAMP_KEY, JSON.stringify(campaigns))
    return new Response(JSON.stringify({ ok: true }), { headers: CORS })
  }

  // ── GET-CAMPAIGNS: histórico de disparos ─────────────────────────────────
  if (action === 'get-campaigns') {
    try {
      const raw = await store().get('campaign-history')
      const campaigns = raw ? JSON.parse(raw) : []
      return new Response(JSON.stringify({ ok: true, campaigns }), { headers: CORS })
    } catch {
      return new Response(JSON.stringify({ ok: true, campaigns: [] }), { headers: CORS })
    }
  }

  return new Response(JSON.stringify({ error: 'action inválida' }), { status: 400, headers: CORS })
}

export const config = { path: '/api/wa-queue' }
