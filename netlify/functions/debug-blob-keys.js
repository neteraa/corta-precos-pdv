/**
 * DEBUG TEMPORÁRIO: Lista todas as keys de chat_history no blob
 * GET /api/debug-blob-keys?mk=MASTER_KEY
 */

import { getStore } from '@netlify/blobs'

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS })

  const url = new URL(req.url)
  const mk = url.searchParams.get('mk')

  if (mk !== process.env.ZS_MASTER_KEY) {
    return new Response(JSON.stringify({ ok: false, error: 'Não autorizado' }), { status: 401, headers: CORS })
  }

  try {
    const store = getStore({ name: 'wa-leads', consistency: 'strong' })
    const { blobs } = await store.list()
    
    // Filtra apenas keys de chat_history
    const chatKeys = blobs
      .filter(b => b.key.startsWith('chat_history:'))
      .map(b => {
        const parts = b.key.split(':')
        return {
          key: b.key,
          storeId: parts[1] || '?',
          phone: parts[2] || '?',
          size: b.size,
        }
      })

    return new Response(JSON.stringify({
      ok: true,
      total: chatKeys.length,
      keys: chatKeys,
    }, null, 2), { headers: CORS })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500, headers: CORS })
  }
}
