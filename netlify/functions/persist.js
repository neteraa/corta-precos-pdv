import { getStore } from '@netlify/blobs'

export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const { key, value } = await req.json()
    if (!key || !value) return new Response('Missing key or value', { status: 400 })

    const store = getStore('corta-precos')
    await store.set(key, value)

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
