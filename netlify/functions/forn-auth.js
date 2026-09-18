/**
 * POST /api/forn-auth
 * body: { username, password }
 *
 * Server-side authentication for distributor accounts.
 * Credentials stored hashed in Netlify Blobs (zs-forn-auth).
 *
 * On first call, seeds the legacy hardcoded "mega" distributor
 * so existing data isn't lost.
 */
import { getStore } from '@netlify/blobs'
import { createHash, randomBytes } from 'crypto'

const APP_SALT = 'zs_2026_forn'

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
}

function hashPwd(pwd, salt) {
  return createHash('sha256').update(`${APP_SALT}:${salt}:${pwd}`).digest('hex')
}

/** One-time seed for the legacy "megatudo" distributor */
async function seedLegacy(store) {
  const raw  = await store.get('distributors')
  const list = raw ? JSON.parse(raw) : []
  if (list.find(d => d.tenantId === 'mega')) return list   // already seeded

  const salt = randomBytes(16).toString('hex')
  list.push({
    id:           'forn_mega',
    tenantId:     'mega',           // maps to legacy TENANTS[0].id in Fornecedor.jsx
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
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  try {
    const { username, password } = await req.json()
    if (!username || !password)
      return new Response(JSON.stringify({ ok: false, error: 'Credenciais inválidas' }), { status: 400, headers: CORS })

    const store = getStore('zs-forn-auth')
    const list  = await seedLegacy(store)

    const dist  = list.find(d => d.username === username.trim().toLowerCase())

    if (!dist || !dist.active)
      return new Response(JSON.stringify({ ok: false, error: 'Usuário ou senha incorretos' }), { status: 401, headers: CORS })

    if (hashPwd(password, dist.salt) !== dist.passwordHash)
      return new Response(JSON.stringify({ ok: false, error: 'Usuário ou senha incorretos' }), { status: 401, headers: CORS })

    // Bump lastLogin async
    dist.lastLogin = new Date().toISOString()
    store.set('distributors', JSON.stringify(list)).catch(() => {})

    return new Response(JSON.stringify({
      ok:         true,
      tenantId:   dist.tenantId,
      id:         dist.id,
      storeName:  dist.storeName,
      storePhone: dist.storePhone,
      themeColor: dist.themeColor,
    }), { headers: CORS })

  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: CORS })
  }
}

export const config = { path: '/api/forn-auth' }
