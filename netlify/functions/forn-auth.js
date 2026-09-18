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
import { createHash } from 'crypto'

const APP_SALT = 'zs_2026_forn'

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
}

function hashPwd(pwd, salt) {
  return createHash('sha256').update(`${APP_SALT}:${salt}:${pwd}`).digest('hex')
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  try {
    const { username, password } = await req.json()
    if (!username || !password)
      return new Response(JSON.stringify({ ok: false, error: 'Credenciais inválidas' }), { status: 400, headers: CORS })

    const store = getStore('zs-forn-auth')
    const raw   = await store.get('distributors')
    const list  = raw ? JSON.parse(raw) : []

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
