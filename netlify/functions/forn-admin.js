/**
 * /api/forn-admin — Admin CRUD for distributor accounts.
 * Protected by ZS_MASTER_KEY query param (same as markets-admin).
 *
 * GET  ?mk=...              → list all distributors (passwords stripped)
 * POST ?mk=... { action }  → create | toggle | delete | reset-pass | set-expiry
 */
import { getStore } from '@netlify/blobs'
import { createHash, randomBytes } from 'crypto'

const APP_SALT   = 'zs_2026_forn'
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
    .slice(0, 32) || 'dist'
}

function auth(req) {
  return new URL(req.url).searchParams.get('mk') === MASTER_KEY
}

/** Seed legacy megatudo on first access (same as forn-auth.js) */
async function seedLegacy(store) {
  const raw  = await store.get('distributors')
  const list = raw ? JSON.parse(raw) : []
  if (list.find(d => d.tenantId === 'mega')) return list

  const salt = randomBytes(16).toString('hex')
  list.push({
    id:           'forn_mega',
    tenantId:     'mega',
    username:     'megatudo',
    passwordHash: hashPwd('mega2024', salt),
    salt,
    storeName:    'Mega Tudo Barato',
    storePhone:   '11 2815-1989',
    themeColor:   '#f97316',
    active:       true,
    expiresAt:    null,
    createdAt:    new Date().toISOString(),
    lastLogin:    null,
  })

  await store.set('distributors', JSON.stringify(list))
  return list
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS })

  if (!auth(req))
    return new Response(JSON.stringify({ ok: false, error: 'Não autorizado' }), { status: 401, headers: CORS })

  const store = getStore('zs-forn-auth')

  // ── GET: list ──────────────────────────────────────────────
  if (req.method === 'GET') {
    const list = await seedLegacy(store)
    return new Response(JSON.stringify({
      ok: true,
      distributors: list.map(({ passwordHash, salt, ...safe }) => safe),
    }), { headers: CORS })
  }

  // ── POST: mutate ───────────────────────────────────────────
  if (req.method === 'POST') {
    const body   = await req.json()
    const { action } = body
    const list   = await seedLegacy(store)

    if (action === 'delete') {
      const next = list.filter(d => d.id !== body.id)
      await store.set('distributors', JSON.stringify(next))
      return new Response(JSON.stringify({ ok: true }), { headers: CORS })
    }

    if (action === 'toggle') {
      const d = list.find(d => d.id === body.id)
      if (d) d.active = !d.active
      await store.set('distributors', JSON.stringify(list))
      return new Response(JSON.stringify({ ok: true, active: d?.active }), { headers: CORS })
    }

    if (action === 'set-expiry') {
      const d = list.find(d => d.id === body.id)
      if (!d) return new Response(JSON.stringify({ ok: false, error: 'Não encontrado' }), { status: 404, headers: CORS })
      d.expiresAt = body.expiresAt || null
      await store.set('distributors', JSON.stringify(list))
      return new Response(JSON.stringify({ ok: true, expiresAt: d.expiresAt }), { headers: CORS })
    }

    if (action === 'reset-pass') {
      const d = list.find(d => d.id === body.id)
      if (!d) return new Response(JSON.stringify({ ok: false, error: 'Não encontrado' }), { status: 404, headers: CORS })
      d.salt         = randomBytes(16).toString('hex')
      d.passwordHash = hashPwd(body.password, d.salt)
      await store.set('distributors', JSON.stringify(list))
      return new Response(JSON.stringify({ ok: true }), { headers: CORS })
    }

    // Default: create new distributor
    const { storeName, username, password, storePhone = '', email = '', themeColor = '#10b981' } = body
    if (!storeName || !username || !password)
      return new Response(JSON.stringify({ ok: false, error: 'storeName, username e password são obrigatórios' }), { status: 400, headers: CORS })

    const uname = username.trim().toLowerCase()
    if (list.find(d => d.username === uname))
      return new Response(JSON.stringify({ ok: false, error: 'Usuário já existe' }), { status: 409, headers: CORS })

    const salt = randomBytes(16).toString('hex')
    const dist = {
      id:           `forn_${Date.now()}`,
      tenantId:     slugify(uname),
      username:     uname,
      passwordHash: hashPwd(password, salt),
      salt,
      storeName:    storeName.trim(),
      storePhone:   storePhone.trim(),
      email:        email.trim(),
      themeColor,
      active:       true,
      expiresAt:    null,
      createdAt:    new Date().toISOString(),
      lastLogin:    null,
    }

    list.push(dist)
    await store.set('distributors', JSON.stringify(list))
    return new Response(JSON.stringify({ ok: true, id: dist.id, tenantId: dist.tenantId }), { headers: CORS })
  }

  return new Response('Method not allowed', { status: 405 })
}

export const config = { path: '/api/forn-admin' }
