import { getStore } from '@netlify/blobs'
import { createHash, randomBytes } from 'crypto'

const APP_SALT   = 'zs_2026_corta'
// Set ZS_MASTER_KEY in Netlify → Site settings → Environment variables
const MASTER_KEY = process.env.ZS_MASTER_KEY || 'zatende2026master'

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
}

function hashPwd(pwd, salt) {
  return createHash('sha256').update(`${APP_SALT}:${salt}:${pwd}`).digest('hex')
}

function slugify(str = '') {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 32) || 'mercado'
}

function auth(req) {
  const url = new URL(req.url)
  return url.searchParams.get('mk') === MASTER_KEY
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS })

  if (!auth(req))
    return new Response(JSON.stringify({ ok: false, error: 'Não autorizado' }), { status: 401, headers: CORS })

  const store = getStore('zs-auth')

  // ── GET: list all markets ───────────────────────────────────
  if (req.method === 'GET') {
    const raw = await store.get('markets')
    const markets = raw ? JSON.parse(raw) : []
    return new Response(JSON.stringify({
      ok: true,
      markets: markets.map(({ passwordHash, salt, ...safe }) => safe),
    }), { headers: CORS })
  }

  // ── POST: create / toggle / delete / reset-pass ─────────────
  if (req.method === 'POST') {
    const body = await req.json()
    const { action } = body
    const raw = await store.get('markets')
    let markets = raw ? JSON.parse(raw) : []

    if (action === 'delete') {
      markets = markets.filter(m => m.id !== body.id)
      await store.set('markets', JSON.stringify(markets))
      return new Response(JSON.stringify({ ok: true }), { headers: CORS })
    }

    if (action === 'toggle') {
      const m = markets.find(m => m.id === body.id)
      if (m) m.active = !m.active
      await store.set('markets', JSON.stringify(markets))
      return new Response(JSON.stringify({ ok: true, active: m?.active }), { headers: CORS })
    }

    if (action === 'reset-pass') {
      const m = markets.find(m => m.id === body.id)
      if (!m) return new Response(JSON.stringify({ ok: false, error: 'Mercado não encontrado' }), { status: 404, headers: CORS })
      m.salt         = randomBytes(16).toString('hex')
      m.passwordHash = hashPwd(body.password, m.salt)
      await store.set('markets', JSON.stringify(markets))
      return new Response(JSON.stringify({ ok: true }), { headers: CORS })
    }

    // Default: create new market
    const { storeName, username, password, storePhone = '' } = body
    if (!storeName || !username || !password)
      return new Response(JSON.stringify({ ok: false, error: 'storeName, username e password são obrigatórios' }), { status: 400, headers: CORS })

    const uname = username.trim().toLowerCase()
    if (markets.find(m => m.username === uname))
      return new Response(JSON.stringify({ ok: false, error: 'Usuário já existe' }), { status: 409, headers: CORS })

    const salt   = randomBytes(16).toString('hex')
    const market = {
      id:           `mkt_${Date.now()}`,
      storeName:    storeName.trim(),
      storePhone:   storePhone.trim(),
      username:     uname,
      passwordHash: hashPwd(password, salt),
      salt,
      storeId:      slugify(uname),
      active:       true,
      createdAt:    new Date().toISOString(),
      lastLogin:    null,
    }

    markets.push(market)
    await store.set('markets', JSON.stringify(markets))

    return new Response(JSON.stringify({
      ok:       true,
      storeId:  market.storeId,
      username: market.username,
    }), { headers: CORS })
  }

  return new Response('Method not allowed', { status: 405 })
}

export const config = { path: '/api/markets-admin' }
