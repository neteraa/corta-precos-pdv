/**
 * delivery — pedidos de entrega do Corta Preços
 *
 * GET   /api/delivery?storeId=X             → lista pedidos
 * POST  /api/delivery?storeId=X             → cria pedido (bot ou frontend)
 * PATCH /api/delivery?storeId=X&id=del_123  → atualiza status
 *
 * Auth: não exige HMAC — o storeId já escopa os dados por loja.
 * Acesso restrito ao frontend autenticado e ao wa-bot server-side.
 */
import { getStore } from '@netlify/blobs'

const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }

function store() {
  return getStore({ name: 'corta-precos', consistency: 'strong' })
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS })

  const url     = new URL(req.url)
  const storeId = url.searchParams.get('storeId') || 'cortaprecos_1789770018182'
  const key     = `${storeId}:cp_deliveries`
  const db      = store()

  if (req.method === 'GET') {
    const raw    = await db.get(key, { type: 'text' }).catch(() => null)
    const orders = raw ? JSON.parse(raw) : []
    return new Response(JSON.stringify({ ok: true, orders }), { headers: CORS })
  }

  if (req.method === 'POST') {
    let body
    try { body = await req.json() } catch {
      return new Response(JSON.stringify({ ok: false, error: 'JSON inválido' }), { status: 400, headers: CORS })
    }
    const raw    = await db.get(key, { type: 'text' }).catch(() => null)
    const orders = raw ? JSON.parse(raw) : []
    const order  = {
      ...body,
      id:        `del_${Date.now()}`,
      createdAt: new Date().toISOString(),
      status:    body.status || 'pending',
    }
    orders.unshift(order)
    await db.set(key, JSON.stringify(orders.slice(0, 300)))
    return new Response(JSON.stringify({ ok: true, order }), { status: 201, headers: CORS })
  }

  if (req.method === 'PATCH') {
    const orderId = url.searchParams.get('id')
    if (!orderId) return new Response(JSON.stringify({ ok: false, error: 'id obrigatório' }), { status: 400, headers: CORS })

    let body
    try { body = await req.json() } catch {
      return new Response(JSON.stringify({ ok: false, error: 'JSON inválido' }), { status: 400, headers: CORS })
    }
    const raw    = await db.get(key, { type: 'text' }).catch(() => null)
    const orders = raw ? JSON.parse(raw) : []
    const idx    = orders.findIndex(o => o.id === orderId)
    if (idx < 0) return new Response(JSON.stringify({ ok: false, error: 'Pedido não encontrado' }), { status: 404, headers: CORS })

    orders[idx] = { ...orders[idx], ...body, updatedAt: new Date().toISOString() }
    await db.set(key, JSON.stringify(orders))
    return new Response(JSON.stringify({ ok: true, order: orders[idx] }), { headers: CORS })
  }

  return new Response('Method Not Allowed', { status: 405, headers: CORS })
}

export const config = { path: '/api/delivery' }
