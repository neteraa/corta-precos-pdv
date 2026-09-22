import { getStore }   from '@netlify/blobs'
import { createHmac } from 'crypto'

const PERSIST_SECRET = process.env.ZS_PERSIST_SECRET || ''
const KEYS = ['cp_products', 'cp_sales', 'cp_customers', 'cp_promos', 'cp_fiado', 'cp_cash', 'cp_goal', 'cp_operators', 'cp_store_name', 'cp_supplier_offers', 'cp_fornecedor_estoque', 'cp_supplier_orders', 'cp_distribuidor_markets', 'cp_forn_profile_v1', 'cp_sellout_events']

function makeStoreToken(storeId) {
  return createHmac('sha256', PERSIST_SECRET).update(storeId).digest('hex').slice(0, 32)
}

export default async (req, _context) => {
  try {
    const url = new URL(req.url)
    const storeId = url.searchParams.get('storeId') || 'default'

    if (storeId !== 'default') {
      if (!PERSIST_SECRET) {
        return new Response(JSON.stringify({ ok: false, data: {}, error: 'Serviço indisponível' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        })
      }
      const token = req.headers.get('x-zs-token') || ''
      if (token !== makeStoreToken(storeId)) {
        return new Response(JSON.stringify({ ok: false, data: {}, error: 'Não autorizado' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        })
      }
    }

    const store = getStore('corta-precos')
    const data = {}
    await Promise.all(KEYS.map(async (key) => {
      const blobKey = `${storeId}:${key}`
      let val = await store.get(blobKey)
      if (!val && storeId === 'default') val = await store.get(key)
      if (val) data[key] = val
    }))

    return new Response(JSON.stringify({ ok: true, data }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, data: {}, error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
}

export const config = { path: '/api/restore' }
