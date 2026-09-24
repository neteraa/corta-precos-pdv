import { getStore }   from '@netlify/blobs'
import { createHmac } from 'crypto'

const PERSIST_SECRET = process.env.ZS_PERSIST_SECRET || ''  // empty → fail closed below

const ALLOWED_KEYS = new Set([
  'cp_products','cp_sales','cp_customers','cp_promos','cp_fiado','cp_cash',
  'cp_goal','cp_operators','cp_store_name','cp_supplier_offers',
  'cp_fornecedor_estoque','cp_supplier_orders','cp_distribuidor_markets',
  'cp_forn_profile_v1','cp_sellout_events','cp_settings',
  'cp_cancel_requests',
])

function makeStoreToken(storeId) {
  return createHmac('sha256', PERSIST_SECRET).update(storeId).digest('hex').slice(0, 32)
}

export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const { key, value, storeId = 'default' } = await req.json()
    if (!key || value === undefined || value === null) return new Response('Missing key or value', { status: 400 })

    // Key whitelist — reject arbitrary keys that are not part of the data model
    if (!ALLOWED_KEYS.has(key)) {
      return new Response(JSON.stringify({ ok: false, error: 'Chave não permitida' }), { status: 403 })
    }

    // Token check — obrigatório para storeIds reais (non-default).
    // Sem segredo configurado → endpoint falha fechado (503), nunca aberto.
    if (storeId !== 'default') {
      if (!PERSIST_SECRET) {
        return new Response(JSON.stringify({ ok: false, error: 'Serviço indisponível' }), { status: 503 })
      }
      const token = req.headers.get('x-zs-token') || ''
      if (token !== makeStoreToken(storeId)) {
        return new Response(JSON.stringify({ ok: false, error: 'Não autorizado' }), { status: 403 })
      }
    }

    const store   = getStore('corta-precos')
    const blobKey = `${storeId}:${key}`   // e.g. "cortaprecos:cp_products"
    await store.set(blobKey, value)

    // Keep legacy flat key in sync for Corta Preços (storeId='default') so
    // old restores still work during transition window.
    if (storeId === 'default') await store.set(key, value).catch(() => {})

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export const config = { path: '/api/persist' }
