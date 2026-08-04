import { getStore } from '@netlify/blobs'

const KEYS = ['cp_products', 'cp_sales', 'cp_customers', 'cp_promos', 'cp_fiado', 'cp_cash', 'cp_goal', 'cp_operators', 'cp_supplier_offers', 'cp_fornecedor_estoque', 'cp_supplier_orders', 'cp_distribuidor_markets']

export default async (_req, _context) => {
  try {
    const store = getStore('corta-precos')
    const data = {}

    await Promise.all(
      KEYS.map(async (key) => {
        const val = await store.get(key)
        if (val) data[key] = val
      })
    )

    return new Response(JSON.stringify({ ok: true, data }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, data: {}, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export const config = { path: '/api/restore' }
