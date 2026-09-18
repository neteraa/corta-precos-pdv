/**
 * wa-bot — Webhook Evolution API → OpenAI → resposta automática WhatsApp
 *
 * Env vars necessárias (configurar no Netlify Dashboard → Environment Variables):
 *   EVOLUTION_API_URL      ex: https://evolution.seuservidor.com
 *   EVOLUTION_API_KEY      apikey do painel Evolution
 *   EVOLUTION_INSTANCE     nome da instância (ex: zatendestok)
 *   OPENAI_API_KEY         sk-proj-...
 *   WA_BOT_SECRET          string aleatória para validar webhook (opcional)
 *
 * Webhook URL para configurar no Evolution API:
 *   https://zatendestok.com.br/.netlify/functions/wa-bot
 *
 * Eventos que precisam estar ativos no Evolution:
 *   messages.upsert
 */

const SYSTEM_PROMPT = `Você é o assistente virtual do ZatendeStok, sistema completo de gestão para mercados e distribuidores do Brasil.

SOBRE O ZATENDESTOK:
- Sistema web (zatendestok.com.br) que roda no navegador — sem instalar app de loja
- Funciona offline (PWA). Cobre: PDV/Caixa, Estoque, Validade, Promoções, Fiado, Etiquetas, Campanhas WhatsApp, Fidelidade, Relatórios
- Portal do Distribuidor integrado: gestão de lotes de leilão, disparo de ofertas, pedidos em tempo real
- Impressora térmica via Web Serial (sem driver), câmera como scanner, busca por voz
- Multi-terminal (vários caixas), importação NF-e XML, score RFM de clientes

PARA ATIVAR / CONTRATAR:
- Falar com Pedro pelo WhatsApp: (15) 99796-9303
- Ativação no mesmo dia, sem burocracia, modelo mensal por loja

DIFERENCIAIS ÚNICOS:
- Único sistema que conecta PDV do mercado + Portal do Distribuidor na mesma plataforma
- Funciona offline — vendas não param nem sem internet
- Impressora USB sem driver via Web Serial API
- Câmera do celular como scanner de código de barras

REGRAS DE RESPOSTA:
- Seja direto, amigável e use linguagem informal brasileira
- Máximo 3 parágrafos por resposta (WhatsApp — não abuse do texto)
- Use emojis com moderação (1-2 por mensagem)
- Se não souber algo específico (preço, prazo de entrega), oriente a falar com Pedro
- Nunca invente funcionalidades que não existem
- Para suporte técnico: oriente a falar com Pedro pelo (15) 99796-9303
- Se o cliente já é pagante e tem problema: priorize e diga para falar direto com Pedro

CONTEXTO: Você atende tanto prospects (interessados em contratar) quanto clientes pagantes com dúvidas de uso.`

/** Extrai o texto de qualquer tipo de mensagem do Evolution API */
function extractText(data) {
  const msg = data?.message
  if (!msg) return null
  return (
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    null
  )
}

/** Envia mensagem de texto via Evolution API
 *  instance: vem do payload do webhook (multi-tenant — cada loja usa a própria instância)
 */
async function sendReply(number, text, instance) {
  const url = process.env.EVOLUTION_API_URL?.replace(/\/$/, '')
  const key = process.env.EVOLUTION_API_KEY
  // Usa a instância do payload; fallback para env var legada
  const inst = instance || process.env.EVOLUTION_INSTANCE

  if (!url || !key || !inst) {
    console.error('wa-bot: Evolution API not configured')
    return
  }

  const res = await fetch(`${url}/message/sendText/${inst}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': key },
    body:    JSON.stringify({ number, text }),
  })
  if (!res.ok) {
    const body = await res.text()
    console.error(`wa-bot: sendText failed ${res.status} — ${body}`)
  }
}

/** Chama OpenAI e retorna a resposta gerada */
async function askOpenAI(userMessage, senderName) {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY not set')

  const systemMsg = senderName
    ? `${SYSTEM_PROMPT}\n\nO cliente se chama ${senderName}.`
    : SYSTEM_PROMPT

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body:    JSON.stringify({
      model:       'gpt-4o-mini',
      max_tokens:  400,
      temperature: 0.7,
      messages: [
        { role: 'system',  content: systemMsg },
        { role: 'user',    content: userMessage },
      ],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI error ${res.status}: ${err}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() || null
}

// Track recently processed message IDs to avoid duplicate responses
const recentIds = new Set()

export default async (req) => {
  if (req.method === 'GET') {
    // Webhook verification (some Evolution versions send GET)
    return new Response(JSON.stringify({ status: 'wa-bot online' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  let payload
  try {
    payload = await req.json()
  } catch {
    return new Response('Bad Request', { status: 400 })
  }

  // Only handle message upsert events (Evolution API v2 envia maiúsculo: "MESSAGES_UPSERT")
  const event = (payload?.event || '').toLowerCase()
  if (event !== 'messages.upsert' && event !== 'message' && event !== 'messages_upsert') {
    return new Response('OK', { status: 200 })
  }

  // Instância que recebeu a mensagem — multi-tenant: cada loja usa a própria
  const instanceName = payload?.instance || process.env.EVOLUTION_INSTANCE

  const data = payload?.data

  // Skip: from self, status broadcasts, group messages
  if (data?.key?.fromMe)                       return new Response('OK', { status: 200 })
  if (data?.key?.remoteJid === 'status@broadcast') return new Response('OK', { status: 200 })
  if (data?.key?.remoteJid?.endsWith('@g.us'))  return new Response('OK', { status: 200 }) // groups

  // Dedup: skip if we already processed this message ID
  const msgId = data?.key?.id
  if (msgId) {
    if (recentIds.has(msgId)) return new Response('OK', { status: 200 })
    recentIds.add(msgId)
    if (recentIds.size > 500) {
      // Trim oldest to prevent memory leak across warm invocations
      const iter = recentIds.values()
      for (let i = 0; i < 100; i++) recentIds.delete(iter.next().value)
    }
  }

  const text       = extractText(data)
  const senderJid  = data?.key?.remoteJid                           // 5515999999999@s.whatsapp.net
  const senderNum  = senderJid?.replace('@s.whatsapp.net', '')     // 5515999999999
  const senderName = data?.pushName || ''

  if (!text || !senderNum) return new Response('OK', { status: 200 })

  console.log(`wa-bot: msg from ${senderNum} (${senderName}): ${text.slice(0, 80)}`)

  try {
    const reply = await askOpenAI(text, senderName)
    if (reply) {
      await sendReply(senderNum, reply, instanceName)
      console.log(`wa-bot [${instanceName}]: replied to ${senderNum}: ${reply.slice(0, 80)}`)
    }
  } catch (err) {
    console.error('wa-bot error:', err.message)
    // Don't crash — just log. Evolution API will retry if we return 5xx.
  }

  return new Response('OK', { status: 200 })
}

export const config = { path: '/wa-bot' }
