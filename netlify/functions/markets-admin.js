import { getStore } from '@netlify/blobs'
import { createHash, randomBytes } from 'crypto'

const APP_SALT = 'zs_2026_corta'
const MASTER_KEY = process.env.ZS_MASTER_KEY || ''

async function sendWelcomeWA(phone, storeName, username, password) {
  const evoUrl = process.env.EVOLUTION_API_URL?.replace(/\/$/, '')
  const evoKey = process.env.EVOLUTION_API_KEY
  const evoInst = process.env.EVOLUTION_INSTANCE || 'zatendeapi'
  if (!evoUrl || !evoKey || !phone) return

  const num = '55' + phone.replace(/\D/g, '').replace(/^55/, '').replace(/^0/, '').slice(-11)
  const msg = `✅ *Sua conta no ZatendeStok está ativa!*

Olá! Aqui é a equipe ZatendeStok 🚀

Seu sistema está pronto pra usar:
🔗 *zatendestok.com.br*
👤 Usuário: *${username}*
🔑 Senha: *${password}*

Acessa agora e já começa a cadastrar seus produtos! Se precisar de alguma ajuda, é só chamar aqui mesmo. A gente resolve na hora 💪

_Bem-vindo(a), ${storeName}!_ 🎉`

  try {
    await fetch(`${evoUrl}/message/sendText/${evoInst}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: evoKey },
      body: JSON.stringify({ number: num, text: msg }),
    })
  } catch (e) { console.error('sendWelcomeWA error:', e.message) }
}

const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }

function hashPwd(pwd, salt) {
  return createHash('sha256').update(`${APP_SALT}:${salt}:${pwd}`).digest('hex')
}

function slugify(str = '') {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 32) || 'mercado'
}

function makeUniqueStoreId(username, markets) {
  const base = slugify(username)
  if (!markets.some(m => m.storeId === base)) return base
  let suffix = 2
  let candidate = `${base.slice(0, 27)}_${suffix}`
  while (markets.some(m => m.storeId === candidate)) {
    suffix++
    candidate = `${base.slice(0, 27)}_${suffix}`
  }
  return candidate
}

function auth(req) {
  if (!MASTER_KEY) return false
  return new URL(req.url).searchParams.get('mk') === MASTER_KEY
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS })
  if (!auth(req)) return new Response(JSON.stringify({ ok: false, error: 'Não autorizado' }), { status: 401, headers: CORS })

  const store = getStore('zs-auth')

  if (req.method === 'GET') {
    const raw = await store.get('markets')
    const markets = raw ? JSON.parse(raw) : []
    return new Response(JSON.stringify({
      ok: true,
      markets: markets.map(({ passwordHash, salt, ...safe }) => safe),
    }), { headers: CORS })
  }

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

    if (action === 'set-expiry') {
      const m = markets.find(m => m.id === body.id)
      if (!m) return new Response(JSON.stringify({ ok: false, error: 'Mercado não encontrado' }), { status: 404, headers: CORS })
      if (body.expiresAt) {
        const d = new Date(body.expiresAt)
        if (Number.isNaN(d.getTime())) return new Response(JSON.stringify({ ok: false, error: 'Data inválida' }), { status: 400, headers: CORS })
      }
      m.expiresAt = body.expiresAt || null
      await store.set('markets', JSON.stringify(markets))
      return new Response(JSON.stringify({ ok: true, expiresAt: m.expiresAt }), { headers: CORS })
    }

    if (action === 'set-plan' || action === 'set-niche') {
      const m = markets.find(m => m.id === body.id)
      if (!m) return new Response(JSON.stringify({ ok: false, error: 'Mercado não encontrado' }), { status: 404, headers: CORS })
      if (action === 'set-plan') m.plan = body.plan || null
      else m.niche = body.niche || 'mercado'
      await store.set('markets', JSON.stringify(markets))
      return new Response(JSON.stringify({ ok: true, ...(action === 'set-plan' ? { plan: m.plan } : { niche: m.niche }) }), { headers: CORS })
    }

    if (action === 'reset-pass') {
      const m = markets.find(m => m.id === body.id)
      if (!m) return new Response(JSON.stringify({ ok: false, error: 'Mercado não encontrado' }), { status: 404, headers: CORS })
      if (!body.password) return new Response(JSON.stringify({ ok: false, error: 'Senha obrigatória' }), { status: 400, headers: CORS })
      m.salt = randomBytes(16).toString('hex')
      m.passwordHash = hashPwd(body.password, m.salt)
      await store.set('markets', JSON.stringify(markets))
      return new Response(JSON.stringify({ ok: true }), { headers: CORS })
    }

    const { storeName, username, password, storePhone = '', email = '' } = body
    if (!storeName || !username || !password)
      return new Response(JSON.stringify({ ok: false, error: 'storeName, username e password são obrigatórios' }), { status: 400, headers: CORS })

    const uname = username.trim().toLowerCase()
    if (markets.some(m => m.username === uname))
      return new Response(JSON.stringify({ ok: false, error: 'Usuário já existe' }), { status: 409, headers: CORS })

    const salt = randomBytes(16).toString('hex')
    const market = {
      id: `mkt_${Date.now()}_${randomBytes(4).toString('hex')}`,
      storeName: storeName.trim(),
      storePhone: storePhone.trim(),
      email: email.trim(),
      username: uname,
      passwordHash: hashPwd(password, salt),
      salt,
      storeId: makeUniqueStoreId(uname, markets),
      active: true,
      createdAt: new Date().toISOString(),
      lastLogin: null,
    }

    markets.push(market)
    await store.set('markets', JSON.stringify(markets))
    sendWelcomeWA(storePhone, storeName.trim(), uname, password).catch(() => {})

    return new Response(JSON.stringify({ ok: true, storeId: market.storeId, username: market.username }), { headers: CORS })
  }

  return new Response('Method not allowed', { status: 405 })
}

export const config = { path: '/api/markets-admin' }
