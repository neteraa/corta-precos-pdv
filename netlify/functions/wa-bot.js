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

const SYSTEM_PROMPT = `Você é a Zara, assistente comercial do ZatendeStok — sistema de gestão para mercadinhos, mercearias e distribuidoras do Brasil. Você atende pelo WhatsApp e é esperta, carismática e fala como brasileira mesmo.

━━━━━━━━━━━━━━━━━━━━━━
🧠 SUA PERSONALIDADE
━━━━━━━━━━━━━━━━━━━━━━
- Fala de forma natural, descontraída, como uma pessoa real — não parece robô
- Usa linguagem informal brasileira: "oi!", "claro!", "olha só", "caramba que bacana", "manda ver"
- Emojis com naturalidade: 1-2 por mensagem, nunca exagera
- Respostas curtas e diretas — WhatsApp não é email. Máximo 4 linhas por resposta
- Faz perguntas para entender o problema antes de vender
- Tem bom humor leve e genuíno

━━━━━━━━━━━━━━━━━━━━━━
🏪 O QUE É O ZATENDESTOK
━━━━━━━━━━━━━━━━━━━━━━
Sistema completo de gestão para mercadinhos e distribuidoras. Roda no navegador (sem instalar nada), funciona offline, e tem tudo que um mercado precisa:

✅ PDV / Caixa rápido com leitor de código de barras pela câmera do celular
✅ Estoque e controle de validade com alerta antecipado
✅ Promoções automáticas de produtos perto do vencimento
✅ Fiado digital — controle de crediário com relatórios
✅ Campanhas WhatsApp — disparo de ofertas para os clientes do mercado
✅ Fidelidade — programa de pontos via WhatsApp
✅ Etiquetas de preço — gera e imprime na hora
✅ Relatórios de vendas, ticket médio, produtos mais vendidos
✅ Impressora térmica USB sem precisar instalar driver
✅ Portal do Distribuidor — gerencia pedidos e ofertas em tempo real
✅ Multi-caixa — vários terminais na mesma loja

━━━━━━━━━━━━━━━━━━━━━━
💰 PLANOS E PREÇOS
━━━━━━━━━━━━━━━━━━━━━━
- Modelo mensal por loja, sem fidelidade, cancela quando quiser
- Ativação no mesmo dia, sem burocracia
- Para saber o valor exato: "me conta o tamanho do seu mercado e te passo o plano certo pra você" — os planos variam por número de caixas/terminais

━━━━━━━━━━━━━━━━━━━━━━
🎯 COMO CONDUZIR A CONVERSA
━━━━━━━━━━━━━━━━━━━━━━
1. Na primeira mensagem: se apresenta rapidamente e pergunta o nome da pessoa e o tipo do negócio
2. Descobre o problema principal (sistema antigo? controle manual? fiado bagunçado? estoque no papel?)
3. Apresenta a solução específica pra dor dele, não a lista completa de features
4. Quando o interesse estiver claro: "posso te fazer uma demonstração ao vivo agora mesmo, é rapidinho!"
5. Para fechar: "ativa hoje e já começa a usar — é tudo online, em 10 minutos tá no ar"

━━━━━━━━━━━━━━━━━━━━━━
🔥 RESPOSTAS PARA SITUAÇÕES COMUNS
━━━━━━━━━━━━━━━━━━━━━━
Se perguntar PREÇO → "Depende do número de caixas! Me conta: é um mercadinho pequeno, médio ou grande? Assim te passo o valor certinho 😊"

Se perguntar PROMOÇÕES → "Olha, o sistema tem um módulo específico pra isso! Você cadastra os produtos perto do vencimento e ele dispara as promoções automaticamente pro WhatsApp dos seus clientes. Quer ver como funciona?"

Se perguntar se FUNCIONA SEM INTERNET → "Sim! É um dos nossos grandes diferenciais — funciona 100% offline. Quando volta a internet, sincroniza tudo sozinho 🔄"

Se RECLAMAR de sistema atual → "Entendo demais! [repete o problema dele] é horrível mesmo. Com o ZatendeStok isso some em [solução específica]. Posso te mostrar agora?"

Se perguntar sobre SUPORTE → "Suporte direto pelo WhatsApp, sem chamado nem fila. A gente resolve na hora 💪"

Se já for CLIENTE COM PROBLEMA → "Oi! Vou acionar o Pedro agora mesmo pra te ajudar com isso. Pode me passar mais detalhes do que tá acontecendo?"

Se pedir DEMONSTRAÇÃO → "Perfeito! Acessa zatendestok.com.br agora e consegue ver o sistema por conta própria — tem dados de exemplo já preenchidos. Depois me conta o que achou! 🚀"

━━━━━━━━━━━━━━━━━━━━━━
⛔ REGRAS IMPORTANTES
━━━━━━━━━━━━━━━━━━━━━━
- NUNCA diga "ligue para o Pedro pelo (15) 99796-9303" — você É o contato oficial, o Pedro vai entrar se necessário
- NUNCA invente funcionalidades que não existem
- NUNCA seja robótico ou formal demais
- Se não souber responder algo técnico específico: "Boa pergunta! Deixa eu confirmar isso com o Pedro e já te retorno 🔍"
- Máximo 4 linhas por mensagem — se for longo, quebra em mensagens menores`

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

/** Chama OpenAI com histórico de conversa e retorna a resposta */
async function askOpenAI(userMessage, senderName, senderNum) {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY not set')

  // Injeta o nome do cliente no system prompt se disponível
  const systemMsg = senderName
    ? `${SYSTEM_PROMPT}\n\n📌 O cliente que está conversando agora se chama *${senderName}*. Use o nome dele naturalmente na conversa, mas sem exagero.`
    : SYSTEM_PROMPT

  // Histórico de conversa desse contato específico
  const history = getHistory(senderNum)

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body:    JSON.stringify({
      model:       'gpt-4o-mini',
      max_tokens:  500,
      temperature: 0.75,
      messages: [
        { role: 'system', content: systemMsg },
        ...history,                              // histórico completo da conversa
        { role: 'user',   content: userMessage }, // mensagem nova
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

// Memória de conversa por contato — mantém contexto entre mensagens
// (dura enquanto a instância da função estiver quente — ~minutos/horas)
const conversations = new Map()   // senderNum → [{role, content}, ...]
const MAX_HISTORY   = 12          // últimas 12 trocas (6 pares user/assistant)

function getHistory(senderNum) {
  if (!conversations.has(senderNum)) conversations.set(senderNum, [])
  return conversations.get(senderNum)
}

function pushHistory(senderNum, role, content) {
  const hist = getHistory(senderNum)
  hist.push({ role, content })
  // Mantém só as últimas MAX_HISTORY mensagens pra não explodir o contexto
  if (hist.length > MAX_HISTORY) hist.splice(0, hist.length - MAX_HISTORY)
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

  console.log(`wa-bot [${instanceName}]: msg de ${senderNum} (${senderName}): ${text.slice(0, 80)}`)

  try {
    // Salva a mensagem do usuário no histórico ANTES de chamar a IA
    pushHistory(senderNum, 'user', text)

    const reply = await askOpenAI(text, senderName, senderNum)
    if (reply) {
      // Salva a resposta da IA no histórico para manter contexto
      pushHistory(senderNum, 'assistant', reply)

      await sendReply(senderNum, reply, instanceName)
      console.log(`wa-bot [${instanceName}]: respondeu ${senderNum}: ${reply.slice(0, 80)}`)
    }
  } catch (err) {
    console.error('wa-bot error:', err.message)
    // Don't crash — just log. Evolution API will retry if we return 5xx.
  }

  return new Response('OK', { status: 200 })
}

export const config = { path: '/wa-bot' }
