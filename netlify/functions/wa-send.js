/**
 * wa-send — Proxy seguro para enviar mensagens via Evolution API
 *
 * POST /api/wa-send
 * body: { instance, number, text }
 *
 * Env vars: EVOLUTION_API_URL, EVOLUTION_API_KEY
 */

export default async (req) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }

  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  const url = process.env.EVOLUTION_API_URL?.replace(/\/$/, '')
  const key = process.env.EVOLUTION_API_KEY

  if (!url || !key) {
    return new Response(JSON.stringify({ ok: false, error: 'Evolution API não configurada' }), { status: 503, headers })
  }

  let body
  try { body = await req.json() }
  catch { return new Response(JSON.stringify({ ok: false, error: 'Body inválido' }), { status: 400, headers }) }

  const { instance, number, text } = body
  if (!instance || !number || !text) {
    return new Response(JSON.stringify({ ok: false, error: 'Campos obrigatórios: instance, number, text' }), { status: 400, headers })
  }

  try {
    const res = await fetch(`${url}/message/sendText/${instance}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': key },
      body: JSON.stringify({ number, text }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return new Response(JSON.stringify({ ok: false, error: `Evolution API: ${res.status}`, detail: data }), { status: 502, headers })
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers })
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers })
  }
}

export const config = { path: '/wa-send' }
