/**
 * delivery — pedidos de entrega do Corta Preços
 *
 * GET  /api/delivery?storeId=X               → lista pedidos (requer x-zs-token)
 * PATCH /api/delivery?storeId=X&id=del_123   → atualiza status (requer x-zs-token)
 */
import { getStore } from '@netlify/blobs'
import { createHmac } from 'crypto'

const PERSIST_SECRET = process.env.ZS_PERSIST_SECRET || ''
const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }

function makeStoreToken(storeId) {
  return createHmac('sha256', PERSIST_SECRET).update(storeId).digest('hex').slice(0, 32)
}

function cortaPrecosStore() {
  return getStore({ name: 'corta-precos', consistency: 'strong' })
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS })

  const url     = new URL(req.url)
  const storeId = url.searchParams.get('storeId') || 'cortaprecos_1789770018182'
  const token   = req.headers.get('x-zs-token') || ''

  // Auth via storeToken HMAC
  if (PERSIST_SECRET && token !== makeStoreToken(storeId)) {
    return new Response(JSON.stringify({ ok: false, error: 'Não autorizado' }), { status: 403, headers: CORS })
  }

  const store = cortaPrecosStore()
  const key   = `${storeId}:cp_deliveries`

  if (req.method === 'GET') {
    const raw    = await store.get(key, { type: 'text' }).catch(() => null)
    const orders = raw ? JSON.parse(raw) : []
    return new Response(JSON.stringify({ ok: true, orders }), { headers: CORS })
  }

  if (req.method === 'PATCH') {
    const orderId = url.searchParams.get('id')
    if (!orderId) return new Response(JSON.stringify({ ok: false, error: 'id obrigatório' }), { status: 400, headers: CORS })

    let body
    try { body = await req.json() } catch {
      return new Response(JSON.stringify({ ok: false, error: 'JSON inválido' }), { status: 400, headers: CORS })
    }

    const raw    = await store.get(key, { type: 'text' }).catch(() => null)
    const orders = raw ? JSON.parse(raw) : []
    const idx    = orders.findIndex(o => o.id === orderId)
    if (idx < 0) return new Response(JSON.stringify({ ok: false, error: 'Pedido não encontrado' }), { status: 404, headers: CORS })

    orders[idx] = { ...orders[idx], ...body, updatedAt: new Date().toISOString() }
    await store.set(key, JSON.stringify(orders))
    return new Response(JSON.stringify({ ok: true, order: orders[idx] }), { headers: CORS })
  }

  return new Response('Method Not Allowed', { status: 405, headers: CORS })
}

export const config = { path: '/api/delivery' }
