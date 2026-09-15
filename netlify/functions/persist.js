import { getStore } from '@netlify/blobs'

export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const { key, value, storeId = 'default' } = await req.json()
    if (!key || !value) return new Response('Missing key or value', { status: 400 })

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
