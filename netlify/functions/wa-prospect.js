/**
 * wa-prospect — Zara manda a primeira mensagem pra prospects (outbound)
 *
 * POST /api/wa-prospect
 * Body: { contacts: [{phone, name, templateIdx?}] }
 *
 * Anti-ban: delay 45-90s, 6 templates rotativos, max 20/dia
 */

const EVO_URL = () => (process.env.EVOLUTION_API_URL || '').replace(/\/$/, '')
const EVO_KEY = () => process.env.EVOLUTION_API_KEY || ''
const INSTANCE = () => process.env.EVOLUTION_INSTANCE || 'zatendeapi'

// Anti-ban: delay realista pra cold outreach (45-90s)
const DELAY_MIN = 45_000
const DELAY_MAX = 90_000

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }
function randomDelay() { return DELAY_MIN + Math.floor(Math.random() * (DELAY_MAX - DELAY_MIN)) }

function cleanPhone(raw) {
  const d = raw.replace(/\D/g, '').replace(/^0+/, '')
  if (d.startsWith('55') && d.length >= 12) return d
  if (d.length === 11) return `55${d}`
  if (d.length === 10) return `55${d}`
  return null
}

// 6 templates variados — mesmo contexto, texto diferente (evita padrão detectado pelo WA)
const TEMPLATES = [
  (n) => `Oi${n ? `, *${n}*` : ''}! 👋\n\nVi o mercado de vocês aqui na região. Trabalho com um sistema simples que ajuda mercadinhos a controlar o estoque e vender mais pelo WhatsApp — tudo no celular, menos de R$10/dia.\n\nTem uns minutinhos pra eu mostrar? Sem compromisso 😊`,

  (n) => `Olá${n ? `, *${n}*` : ''}! 🤝\n\nSou Pedro, desenvolvi um sistema de gestão especialmente pra mercados como o de vocês.\n\n📦 Controle de estoque pelo celular\n💰 Relatório de vendas no dia\n📲 Clientes pelo WhatsApp\n\nMenos de R$10/dia, sem instalação nenhuma. Tem 10 min pra ver como funciona?`,

  (n) => `Bom dia${n ? `, *${n}*` : ''}! ☀️\n\nPassei aqui pra apresentar uma coisa que desenvolvemos pra mercadinhos da região.\n\nControla estoque, registra vendas e ainda captura clientes pelo WhatsApp — tudo pelo celular, simples e rápido.\n\nPosso te mostrar num videozinho rápido? 🙂`,

  (n) => `Oi${n ? `, *${n}*` : ''}! Tudo bem? 😊\n\nTrabalho com tecnologia pra mercadinhos e vi vocês aqui na região. Tenho um sistema que muitos mercadinhos tão usando pra:\n\n✅ Saber o estoque em tempo real\n✅ Ver o caixa do dia\n✅ Mandar promoções pelo WhatsApp\n\nFunciona no celular mesmo. Custa menos que uma pizza por dia. Quer ver?`,

  (n) => `Boa tarde${n ? `, *${n}*` : ''}! 👋\n\nSou Pedro, trabalho com um sistema de gestão feito pro mercadinho brasileiro. Vi o mercado de vocês e queria te mostrar uma coisa.\n\nÉ simples: você controla estoque, vê as vendas e ainda manda oferta pros clientes pelo WhatsApp. Tudo pelo celular, sem papel.\n\nTem um tempinho pra eu te mostrar como funciona?`,

  (n) => `Oi${n ? `, *${n}*` : ''}! 🛒\n\nVi o mercado de vocês no Maps e queria apresentar um sisteminha que desenvolvemos especialmente pra mercados como o de vocês.\n\nAjuda a controlar estoque, registrar vendas e capturar clientes pelo WhatsApp. Tudo simples, sem instalar nada, funciona no celular.\n\nPostei ser menos de R$10 por dia. Posso te mostrar rapidinho? 😊`,
]

function buildMessage(name, idx) {
  const template = TEMPLATES[idx % TEMPLATES.length]
  return template(name?.trim() || '')
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

  const mk = req.headers.get('x-master-key') || ''
  if (mk !== (process.env.ZS_MASTER_KEY || 'zatende2026master'))
    return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: CORS })

  let body
  try { body = await req.json() } catch { return new Response(JSON.stringify({ error: 'JSON inválido' }), { status: 400, headers: CORS }) }

  const { contacts = [] } = body
  if (!contacts.length) return new Response(JSON.stringify({ error: 'contacts[] vazio' }), { status: 400, headers: CORS })

  let sent = 0, failed = 0
  const results = []
  const toSend  = contacts.slice(0, 20)  // hard cap anti-ban

  // índice global de template — rota entre os 6 pra nunca mandar o mesmo duas vezes seguidas
  const baseIdx = Math.floor(Math.random() * TEMPLATES.length)

  for (let i = 0; i < toSend.length; i++) {
    const { phone: rawPhone, name = '', templateIdx } = toSend[i]
    const phone = cleanPhone(rawPhone)

    if (!phone) {
      results.push({ phone: rawPhone, ok: false, error: 'Telefone inválido' })
      failed++
      continue
    }

    // Usa templateIdx do contato se disponível, senão rota pelo índice global
    const tIdx   = templateIdx !== undefined ? templateIdx : (baseIdx + i)
    const message = buildMessage(name, tIdx)

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
