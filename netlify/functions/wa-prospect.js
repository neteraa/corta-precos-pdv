/**
 * wa-prospect — Zara manda a primeira mensagem pra prospects (outbound)
 *
 * POST /api/wa-prospect
 * Body: { mk, contacts: [{phone, name}], template? }
 *
 * Anti-ban: máx 30/dia, delay aleatório 12-25s entre envios
 */

const EVO_URL = () => (process.env.EVOLUTION_API_URL || '').replace(/\/$/, '')
const EVO_KEY = () => process.env.EVOLUTION_API_KEY || ''
const INSTANCE = () => process.env.EVOLUTION_INSTANCE || 'zatendeapi'

const DAILY_LIMIT = 30
const DELAY_MIN   = 12_000
const DELAY_MAX   = 25_000

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

function randomDelay() {
  return DELAY_MIN + Math.floor(Math.random() * (DELAY_MAX - DELAY_MIN))
}

function cleanPhone(raw) {
  const digits = raw.replace(/\D/g, '').replace(/^0+/, '')
  // Garante formato 55 + DDD (2) + número (8 ou 9)
  if (digits.startsWith('55') && digits.length >= 12) return digits
  if (digits.length === 11) return `55${digits}`
  if (digits.length === 10) return `55${digits}`
  return null
}

function buildMessage(name) {
  const greet = name ? `Oi, *${name}*! 👋` : 'Oi! 👋'
  return `${greet}

Vi o mercado de vocês aqui na região e queria apresentar uma coisa rápida.

Tenho um sistema que ajuda mercadinhos a:
✅ Controlar estoque pelo celular
✅ Fazer vendas sem papel
✅ Vender mais pelo WhatsApp

Tudo por menos de *R$10 por dia* — e começa a funcionar no mesmo dia.

Posso te mostrar em 10 minutinhos? Sem compromisso 😊`
}

async function sendText(phone, message) {
  const res = await fetch(`${EVO_URL()}/message/sendText/${INSTANCE()}`, {
    method:  'POST',
    headers: { 'apikey': EVO_KEY(), 'Content-Type': 'application/json' },
    body:    JSON.stringify({ number: phone, textMessage: { text: message } }),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS })
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers: CORS })

  let body
  try { body = await req.json() } catch { return new Response(JSON.stringify({ error: 'JSON inválido' }), { status: 400, headers: CORS }) }

  const { contacts = [], template } = body
  if (!contacts.length) return new Response(JSON.stringify({ error: 'contacts[] vazio' }), { status: 400, headers: CORS })

  // Checa limite diário via Netlify Blob
  let sent = 0, failed = 0
  const results = []

  // Limita ao máximo diário
  const toSend = contacts.slice(0, DAILY_LIMIT)

  for (let i = 0; i < toSend.length; i++) {
    const { phone: rawPhone, name = '' } = toSend[i]
    const phone = cleanPhone(rawPhone)

    if (!phone) {
      results.push({ phone: rawPhone, ok: false, error: 'Telefone inválido' })
      failed++
      continue
    }

    const message = template || buildMessage(name)

    try {
      const result = await sendText(phone, message)
      if (result.ok) {
        results.push({ phone, name, ok: true })
        sent++
      } else {
        results.push({ phone, name, ok: false, error: result.data?.message || `status ${result.status}` })
        failed++
      }
    } catch (e) {
      results.push({ phone, name, ok: false, error: e.message })
      failed++
    }

    // Anti-ban: delay entre mensagens (exceto na última)
    if (i < toSend.length - 1) {
      await delay(randomDelay())
    }
  }

  return new Response(JSON.stringify({ ok: true, sent, failed, results }), { status: 200, headers: CORS })
}

export const config = { path: '/api/wa-prospect' }
