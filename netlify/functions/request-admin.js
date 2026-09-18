/**
 * /api/request-admin
 *
 * POST (público, sem mk) — cliente envia solicitação de cadastro
 * body: { nome, mercado, cidade, telefone, email? }
 *
 * GET  ?mk=...           — admin lista solicitações pendentes/todas
 * POST ?mk=... + action  — admin aprova/rejeita/arquiva
 *   actions: 'approve' | 'reject' | 'delete'
 *   approve cria a conta automaticamente via markets-admin logic
 */
import { getStore } from '@netlify/blobs'
import { createHash, randomBytes } from 'crypto'

const MASTER_KEY = process.env.ZS_MASTER_KEY || 'zatende2026master'
const APP_SALT   = 'zs_2026_corta'

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function auth(req) {
  return new URL(req.url).searchParams.get('mk') === MASTER_KEY
}

function slugify(str = '') {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 24) || 'mercado'
}

function hashPwd(pwd, salt) {
  return createHash('sha256').update(`${APP_SALT}:${salt}:${pwd}`).digest('hex')
}

function genPass() {
  return randomBytes(4).toString('hex') // 8-char hex password
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS })

  const isAdmin = auth(req)
  const store   = getStore('zs-auth')

  /* ── PUBLIC: submit request ─────────────────────────────── */
  if (req.method === 'POST' && !isAdmin) {
    let body
    try { body = await req.json() } catch {
      return new Response(JSON.stringify({ ok: false, error: 'JSON inválido' }), { status: 400, headers: CORS })
    }

    const { nome, mercado, cidade, telefone, email } = body
    if (!nome || !mercado || !cidade || !telefone) {
      return new Response(JSON.stringify({ ok: false, error: 'Campos obrigatórios: nome, mercado, cidade, telefone' }), { status: 400, headers: CORS })
    }

    const raw = await store.get('pending-requests')
    const list = raw ? JSON.parse(raw) : []

    const request = {
      id:        `req_${Date.now()}`,
      nome:      nome.trim(),
      mercado:   mercado.trim(),
      cidade:    cidade.trim(),
      telefone:  telefone.trim(),
      email:     (email || '').trim(),
      status:    'pending',  // 'pending' | 'approved' | 'rejected'
      createdAt: new Date().toISOString(),
    }

    list.push(request)
    await store.set('pending-requests', JSON.stringify(list))

    return new Response(JSON.stringify({ ok: true, id: request.id }), { headers: CORS })
  }

  /* ── ADMIN required from here ───────────────────────────── */
  if (!isAdmin) {
    return new Response(JSON.stringify({ ok: false, error: 'Não autorizado' }), { status: 401, headers: CORS })
  }

  /* ── GET: list requests ─────────────────────────────────── */
  if (req.method === 'GET') {
    const raw   = await store.get('pending-requests')
    const list  = raw ? JSON.parse(raw) : []
    const url   = new URL(req.url)
    const filter = url.searchParams.get('status') || 'pending' // 'pending' | 'all'
    const result = filter === 'all' ? list : list.filter(r => r.status === 'pending')
    return new Response(JSON.stringify({ ok: true, requests: result }), { headers: CORS })
  }

  /* ── POST admin actions ─────────────────────────────────── */
  if (req.method === 'POST') {
    let body
    try { body = await req.json() } catch {
      return new Response(JSON.stringify({ ok: false, error: 'JSON inválido' }), { status: 400, headers: CORS })
    }

    const { action, id } = body
    const raw  = await store.get('pending-requests')
    const list = raw ? JSON.parse(raw) : []
    const idx  = list.findIndex(r => r.id === id)

    if (idx === -1) {
      return new Response(JSON.stringify({ ok: false, error: 'Solicitação não encontrada' }), { status: 404, headers: CORS })
    }

    /* ── reject ── */
    if (action === 'reject') {
      list[idx].status     = 'rejected'
      list[idx].rejectedAt = new Date().toISOString()
      await store.set('pending-requests', JSON.stringify(list))
      return new Response(JSON.stringify({ ok: true }), { headers: CORS })
    }

    /* ── delete ── */
    if (action === 'delete') {
      list.splice(idx, 1)
      await store.set('pending-requests', JSON.stringify(list))
      return new Response(JSON.stringify({ ok: true }), { headers: CORS })
    }

    /* ── approve: create market account ── */
    if (action === 'approve') {
      const req2 = list[idx]

      // Generate credentials
      const password  = genPass()
      const salt      = randomBytes(16).toString('hex')
      const pwdHash   = hashPwd(password, salt)
      const username  = slugify(req2.mercado)
      const storeId   = `${username}_${Date.now()}`

      // Load markets and add new entry
      const mRaw    = await store.get('markets')
      const markets = mRaw ? JSON.parse(mRaw) : []

      // Avoid duplicate username
      const existsUser = markets.some(m => m.username === username)
      const finalUser  = existsUser ? `${username}${markets.length}` : username

      const newMarket = {
        id:           storeId,
        storeId:      storeId,
        storeName:    req2.mercado,
        username:     finalUser,
        passwordHash: hashPwd(password, salt),
        salt,
        email:        req2.email || '',
        storePhone:   req2.telefone,
        active:       true,
        plan:         'basic',
        createdAt:    new Date().toISOString(),
        requestId:    req2.id,
      }

      markets.push(newMarket)
      await store.set('markets', JSON.stringify(markets))

      // Mark request as approved
      list[idx].status     = 'approved'
      list[idx].approvedAt = new Date().toISOString()
      list[idx].username   = finalUser
      list[idx].storeId    = storeId
      await store.set('pending-requests', JSON.stringify(list))

      // Try to send welcome email if address provided
      let emailResult = null
      if (req2.email) {
        try {
          const base    = new URL(req.url).origin
          const emailRes = await fetch(`${base}/api/send-email?mk=${MASTER_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to:        req2.email,
              type:      'market',
              storeName: req2.mercado,
              username:  finalUser,
              password,
            }),
          })
          emailResult = await emailRes.json()
        } catch {}
      }

      return new Response(JSON.stringify({
        ok:       true,
        username: finalUser,
        password,
        storeId,
        emailResult,
      }), { headers: CORS })
    }

    return new Response(JSON.stringify({ ok: false, error: 'Ação inválida' }), { status: 400, headers: CORS })
  }

  return new Response('Method not allowed', { status: 405 })
}

export const config = { path: '/api/request-admin' }
