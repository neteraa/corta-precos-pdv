import { getStore } from '@netlify/blobs'
import { createHash } from 'crypto'

const APP_SALT = 'zs_2026_corta'

function hashPwd(pwd, salt) {
  return createHash('sha256').update(`${APP_SALT}:${salt}:${pwd}`).digest('hex')
}

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  try {
    const { username, password } = await req.json()
    if (!username || !password)
      return new Response(JSON.stringify({ ok: false, error: 'Credenciais inválidas' }), { status: 400, headers: CORS })

    const store = getStore('zs-auth')
    const raw = await store.get('markets')
    const markets = raw ? JSON.parse(raw) : []

    const market = markets.find(m => m.username === username.trim().toLowerCase())

    if (!market || !market.active)
      return new Response(JSON.stringify({ ok: false, error: 'Usuário ou senha incorretos' }), { status: 401, headers: CORS })

    if (hashPwd(password, market.salt) !== market.passwordHash)
      return new Response(JSON.stringify({ ok: false, error: 'Usuário ou senha incorretos' }), { status: 401, headers: CORS })

    // Bump lastLogin async — don't await so response is faster
    market.lastLogin = new Date().toISOString()
    store.set('markets', JSON.stringify(markets)).catch(() => {})

    return new Response(JSON.stringify({
      ok:         true,
      storeId:    market.storeId,
      storeName:  market.storeName,
      storePhone: market.storePhone || '',
      niche:      market.niche || 'mercado',
    }), { headers: CORS })

  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: CORS })
  }
}

export const config = { path: '/api/auth' }
