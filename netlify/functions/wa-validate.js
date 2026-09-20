/**
 * wa-validate — Verifica em lote se números têm WhatsApp ativo
 * Usa o endpoint /chat/whatsappNumbers da Evolution API
 *
 * POST /api/wa-validate
 * Body: { phones: ["5515999999999", ...] }
 * Returns: [{ phone, exists, name? }]
 */

const EVO_URL      = () => (process.env.EVOLUTION_API_URL || '').replace(/\/$/, '')
const EVO_KEY      = () => process.env.EVOLUTION_API_KEY || ''
const INSTANCE     = () => process.env.EVOLUTION_INSTANCE || 'zatendeapi'
const CORS         = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
const BATCH_SIZE   = 50  // Evolution API aceita até 50 por chamada

function authOk(req) {
  const mk = req.headers.get('x-master-key') || ''
  return mk === (process.env.ZS_MASTER_KEY || 'zatende2026master')
}

function normalizePhone(raw) {
  const d = raw.replace(/\D/g, '').replace(/^0+/, '')
  if (d.startsWith('55') && d.length >= 12) return d
  if (d.length === 11) return `55${d}`
  if (d.length === 10) return `55${d}`
  return null
}

async function checkBatch(phones) {
  const res = await fetch(
    `${EVO_URL()}/chat/whatsappNumbers/${INSTANCE()}`,
    {
      method:  'POST',
      headers: { apikey: EVO_KEY(), 'Content-Type': 'application/json' },
      body:    JSON.stringify({ numbers: phones }),
    }
  )
  if (!res.ok) throw new Error(`Evolution API ${res.status}`)
  return await res.json()  // [{ jid, exists, number, name? }]
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS })
  if (!authOk(req))
    return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: CORS })
  if (req.method !== 'POST')
    return new Response(JSON.stringify({ error: 'POST apenas' }), { status: 405, headers: CORS })

  let body
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'JSON inválido' }), { status: 400, headers: CORS })
  }

  const rawPhones = (body.phones || []).slice(0, 200)
  const normalized = [...new Set(rawPhones.map(normalizePhone).filter(Boolean))]

  if (!normalized.length)
    return new Response(JSON.stringify({ ok: true, results: [], valid: 0, invalid: 0 }), { headers: CORS })

  try {
    const results = []
    // processa em lotes de BATCH_SIZE
    for (let i = 0; i < normalized.length; i += BATCH_SIZE) {
      const batch = normalized.slice(i, i + BATCH_SIZE)
      const data  = await checkBatch(batch)
      for (const item of data) {
        results.push({
          phone:  item.number || item.jid?.replace('@s.whatsapp.net', ''),
          exists: !!item.exists,
          name:   item.name || null,
        })
      }
    }
    const valid   = results.filter(r => r.exists).length
    const invalid = results.filter(r => !r.exists).length
    return new Response(JSON.stringify({ ok: true, results, valid, invalid }), { headers: CORS })
  } catch (e) {
    console.error('wa-validate error:', e.message)
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500, headers: CORS })
  }
}

export const config = { path: '/api/wa-validate' }
