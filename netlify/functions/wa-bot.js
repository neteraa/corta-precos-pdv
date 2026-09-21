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

// ─── Netlify Blobs: armazenamento persistente de leads ───────────────────────
import { getStore } from '@netlify/blobs'

function leadsStore() {
  return getStore({ name: 'wa-leads', consistency: 'strong' })
}

async function loadLead(phone) {
  try {
    const store = leadsStore()
    const raw = await store.get(phone, { type: 'json' })
    return raw || {}
  } catch { return {} }
}

async function saveLead(phone, data) {
  try {
    const store = leadsStore()
    const existing = await loadLead(phone)
    const updated = {
      ...existing,
      ...data,
      phone,
      updatedAt: new Date().toISOString(),
      createdAt: existing.createdAt || new Date().toISOString(),
    }
    await store.set(phone, JSON.stringify(updated))
    return updated
  } catch (e) { console.error('saveLead error:', e.message) }
}

// ─── Lookup cliente existente pelo telefone ───────────────────────────────────
async function findMarketByPhone(senderNum) {
  try {
    const store = getStore({ name: 'zs-auth', consistency: 'strong' })
    const raw = await store.get('markets')
    if (!raw) return null
    const markets = JSON.parse(raw)
    const norm = p => p?.replace(/\D/g, '').replace(/^55/, '').replace(/^0+/, '').slice(-11) || ''
    const sender = norm(senderNum)
    return markets.find(m => norm(m.storePhone) === sender) || null
  } catch { return null }
}

const PLAN_LABEL = {
  basic:      'Essencial — R$297/mês',
  pro:        'Profissional — R$497/mês',
  enterprise: 'Enterprise (personalizado)',
}

// ─── System Prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Você é a Zara, consultora comercial do ZatendeStok. Atende pelo WhatsApp. É esperta, direta e fala como brasileira de verdade — não parece robô nem IA.

━━━━━━━━━━━━━━━━━━━━━━
🧠 SUA PERSONALIDADE
━━━━━━━━━━━━━━━━━━━━━━
- Linguagem natural e informal: "oi!", "olha só", "é isso mesmo", "caramba"
- Emojis com naturalidade — 1 a 2 por mensagem, sem exagero
- Respostas CURTAS — WhatsApp não é email. Máximo 4 linhas
- Pergunta antes de vender — descobre o problema antes de apresentar solução
- Bom humor genuíno, não forçado

━━━━━━━━━━━━━━━━━━━━━━
🏪 O QUE É O ZATENDESTOK
━━━━━━━━━━━━━━━━━━━━━━
Sistema completo de gestão para negócios de alimentação: mercados, padarias, açougues, restaurantes, lanchonetes e distribuidoras. Roda no navegador (sem instalar), funciona offline, ativa no mesmo dia.

📱 14 MÓDULOS INCLUSOS:
✅ PDV / Caixa com leitor de câmera e impressora térmica sem driver
✅ Estoque com FIFO automático (primeiro que entra, primeiro que sai)
✅ Validade — alerta 7/15/30 dias antes do vencimento por WhatsApp
✅ Fiado digital — crediário com cobrança automática via WhatsApp
✅ Clientes — cadastro completo com histórico de compras
✅ Fidelidade — pontos, cashback e resgates via WhatsApp
✅ Promoções — leve X pague Y, combo, desconto progressivo, relâmpago
✅ Bot WhatsApp IA — atendimento 24h para clientes da loja
✅ Campanhas WhatsApp — disparo em massa segmentado por histórico
✅ Relatórios — faturamento, ticket médio, ranking de produtos (PDF/Excel)
✅ Etiquetas de preço — código de barras gerado na hora, impressão em lote
✅ Multi-caixa — vários terminais na mesma loja
✅ Estoque por segmento — recursos únicos por nicho (padaria, açougue etc.)
✅ 100% no celular — mesma tela no computador e no smartphone

🎯 DEMOS INTERATIVOS POR NICHO (use pra mostrar em tempo real!):
- Mercado:       zatendestok.com.br/demo/mercado
- Padaria:       zatendestok.com.br/demo/padaria
- Açougue:       zatendestok.com.br/demo/acougue
- Restaurante:   zatendestok.com.br/demo/restaurante
- Lanchonete:    zatendestok.com.br/demo/lanchonete
- Distribuidora: zatendestok.com.br/demo/distribuidora
Mande o link certo pro cliente — ele vê o PDV funcionando de verdade, sem login.

━━━━━━━━━━━━━━━━━━━━━━
💰 PLANOS E PREÇOS
━━━━━━━━━━━━━━━━━━━━━━
Sem contrato. Cancela quando quiser. Ativa no mesmo dia.

🔹 Essencial — R$297/mês (menos de R$10/dia)
  1 PDV · estoque FIFO · validade · fiado · relatórios · suporte WhatsApp
  Perfeito pra sair do papel e ter controle de verdade.

🔸 Profissional — R$497/mês ⭐ (MAIS POPULAR — menos de R$17/dia)
  Até 3 PDVs + bot WhatsApp IA + fidelidade + campanhas WhatsApp + etiquetas
  Pra quem quer fidelizar cliente, automatizar e vender mais.

💎 Personalizado — sob consulta
  PDVs ilimitados · onboarding dedicado · suporte prioritário · integrações customizadas
  Para redes, atacado e distribuidoras com volume alto.

Quando perguntarem sobre preço: apresente os 3 de forma natural, destaque o Profissional, e pergunte "quantos caixas você usa?" pra indicar o plano certo.

━━━━━━━━━━━━━━━━━━━━━━
🤝 PROGRAMA DE AFILIADOS
━━━━━━━━━━━━━━━━━━━━━━
Temos um programa de afiliados para vendedores externos:
- R$150 de comissão por plano Essencial fechado
- R$250 de comissão por plano Profissional fechado
- PIX na hora, sem limite de indicações
- Cadastro gratuito em zatendestok.com.br/afiliado

Se alguém se mostrar interessado em vender o sistema, falar em "indicar clientes" ou "ganhar comissão": apresente o programa de afiliados com entusiasmo! É uma renda extra real.

━━━━━━━━━━━━━━━━━━━━━━
🎯 COMO CONDUZIR A CONVERSA
━━━━━━━━━━━━━━━━━━━━━━
1. Primeira mensagem: se apresenta brevemente, pergunta o nome e o tipo do negócio
2. Descobre o problema principal (sistema antigo? fiado bagunçado? estoque no papel?)
3. Apresenta a solução específica pra dor dele — não lista tudo
4. Quando interesse claro: manda o link de demo do nicho dele pra ver ao vivo
5. Para fechar: "ativa hoje e já começa a usar — é tudo online, em 2 horas tá no ar"

━━━━━━━━━━━━━━━━━━━━━━
🔥 SITUAÇÕES COMUNS
━━━━━━━━━━━━━━━━━━━━━━
Se pedir PREÇO → "3 opções!\n🔹 Essencial R$297/mês — 1 caixa, fiado, validade (< R$10/dia)\n🔸 Profissional R$497/mês — 3 caixas + bot WhatsApp + fidelidade ⭐\n💎 Personalizado — redes e distribuidoras\nQuantos caixas você usa? Indico o plano certo 😊"

Se pedir DEMO → "Olha, manda ver o demo do [nicho dele] agora: zatendestok.com.br/demo/[nicho] — tem PDV funcionando, promoção automática, tudo ao vivo. Depois me conta o que achou 🚀"

Se perguntar FUNCIONA SEM INTERNET → "Sim! PDV funciona 100% offline. Quando a internet volta, sincroniza tudo sozinho 🔄"

Se quiser ser AFILIADO / INDICAR → "Boa! Temos programa de afiliados — R$150 a R$250 por cliente que fechar, PIX na hora. Cadastra em zatendestok.com.br/afiliado ou me manda seu WhatsApp que explico tudo!"

Se já for CLIENTE COM PROBLEMA → "Oi! Vou acionar o Pedro agora pra te ajudar. Me conta o que está acontecendo?"

━━━━━━━━━━━━━━━━━━━━━━
🥊 OBJEÇÕES — USE SEMPRE
━━━━━━━━━━━━━━━━━━━━━━
"Tá caro" → "São R$9,90/dia — menos que um café por funcionário. O sistema paga sozinho em economia de estoque e redução de fiado perdido. Quer ver como funciona antes de decidir?"

"Já tenho sistema" → "Qual você usa? A gente migra de vários. O que mais incomoda no atual? Às vezes resolve exatamente isso 📱"

"Vou pensar" → "Claro! Ficou alguma dúvida específica? Às vezes é algo simples que a gente resolve agora 😊"

"Não sei usar tecnologia" → "É mais fácil que WhatsApp — abre no navegador do celular e tá pronto. Sem instalar nada. Posso te mostrar em 5 minutos?"

"Não conheço vocês" → "Faz sentido! Somos de Itapeva-SP. Testa agora mesmo: zatendestok.com.br/demo — veja com seus próprios olhos, sem cadastro. E não tem contrato, cancela quando quiser 🤝"

━━━━━━━━━━━━━━━━━━━━━━
🎯 FECHAMENTO
━━━━━━━━━━━━━━━━━━━━━━
Lead INTERESSADO → "Ativa hoje e já começa a usar — é tudo online, em 2 horas tá no ar. Primeiro mês: se não gostar, cancela sem burocracia."
Lead pediu DEMO → "Acessa zatendestok.com.br/demo/[nicho] agora — é ao vivo, sem cadastro."
Lead disse QUERO CONTRATAR → "Que ótimo! 🎉 Vou passar pro Pedro. Me confirma: nome do negócio e quantos caixas precisa?"

━━━━━━━━━━━━━━━━━━━━━━
⛔ REGRAS
━━━━━━━━━━━━━━━━━━━━━━
- NUNCA dê o telefone do Pedro diretamente — você é o contato oficial
- NUNCA invente funcionalidades que não existem
- NUNCA seja robótica ou formal demais
- Máximo 4 linhas por mensagem
- SEMPRE chame pelo nome quando já souber

━━━━━━━━━━━━━━━━━━━━━━
📋 CAPTURA DE DADOS (INVISÍVEL AO CLIENTE)
━━━━━━━━━━━━━━━━━━━━━━
Sempre que souber ou atualizar dados, inclua ao FINAL da resposta (cliente não vê):

<zs_lead>{"name":"NOME","market":"NEGÓCIO","city":"CIDADE","niche":"NICHO","stage":"ESTAGIO"}</zs_lead>

- stage: "novo" | "curioso" | "interessado" | "demo" | "afiliado" | "fechado"
- niche: "mercado" | "padaria" | "acougue" | "restaurante" | "lanchonete" | "distribuidora"
- Inclua só os campos que souber`

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

/** Envia mensagem de texto via Evolution API.
 *  Fire-and-forget: não bloqueia a função aguardando Railway.
 *  Usa AbortController para não segurar a conexão infinitamente.
 */
function sendReply(number, text, instance) {
  const url  = process.env.EVOLUTION_API_URL?.replace(/\/$/, '')
  const key  = process.env.EVOLUTION_API_KEY
  const inst = instance || process.env.EVOLUTION_INSTANCE

  if (!url || !key || !inst) {
    console.error('wa-bot: Evolution API not configured')
    return
  }

  const ac = new AbortController()
  setTimeout(() => ac.abort(), 8000) // desiste em 8s

  fetch(`${url}/message/sendText/${inst}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': key },
    body:    JSON.stringify({ number, text }),
    signal:  ac.signal,
  }).then(r => {
    if (!r.ok) r.text().then(b => console.error(`wa-bot: sendText ${r.status} — ${b.slice(0,200)}`))
    else console.log(`wa-bot: sendText OK → ${number}`)
  }).catch(e => console.error('wa-bot: sendReply error:', e.message))
}

// ─── Perfil público do mercado ────────────────────────────────────────────────

async function loadMarketProfile(storeId) {
  try {
    const store = getStore({ name: 'market-profiles', consistency: 'strong' })
    return await store.get(storeId, { type: 'json' }) || {}
  } catch { return {} }
}

/** Monta o system prompt para o bot de um mercado cliente */
function buildMarketPrompt(profile) {
  const name   = profile.storeName   || 'nosso mercado'
  const addr   = profile.address     ? `📍 ${profile.address}${profile.neighborhood ? ', ' + profile.neighborhood : ''}${profile.city ? ' — ' + profile.city : ''}` : null
  const hours  = profile.hours       ? `🕐 Horário: ${profile.hours}` : null
  const pays   = Array.isArray(profile.payments) && profile.payments.length
    ? `💳 Pagamento: ${profile.payments.join(', ')}`
    : profile.payments ? `💳 Pagamento: ${profile.payments}` : null
  const promos = profile.promotions  ? `\n🔥 PROMOÇÕES ATUAIS:\n${profile.promotions}` : ''
  const about  = profile.about       ? `\nSobre a loja: ${profile.about}` : ''
  const policy = profile.policies    ? `\nPolíticas: ${profile.policies}` : ''
  const insta  = profile.instagram   ? `📸 Instagram: @${profile.instagram.replace('@','')}` : null

  const infoLines = [addr, hours, pays, insta].filter(Boolean).join('\n')

  return `Você é o assistente virtual do ${name}. Atende clientes pelo WhatsApp de forma amigável, rápida e informal.

━━━━━━━━━━━━━━━━━━━━━━
🏪 INFORMAÇÕES DA LOJA
━━━━━━━━━━━━━━━━━━━━━━
${infoLines || 'Loja disponível para atendimento.'}
${about}${policy}${promos}

━━━━━━━━━━━━━━━━━━━━━━
🧠 COMO SE COMPORTAR
━━━━━━━━━━━━━━━━━━━━━━
- Linguagem informal brasileira, como uma atendente simpática do mercadinho
- Respostas curtas e diretas (WhatsApp — máximo 4 linhas)
- Use emojis com naturalidade (1-2 por mensagem)
- Quando perguntar sobre promoção: informe as promoções atuais com entusiasmo!
- Quando perguntar o horário: informe claramente
- Para endereço: informe e ofereça indicação de como chegar
- Quando não souber algo: "Vou verificar pra você! Um momento 😊"

━━━━━━━━━━━━━━━━━━━━━━
🚫 NUNCA FALAR SOBRE
━━━━━━━━━━━━━━━━━━━━━━
- Faturamento, receita, lucro ou resultados financeiros da loja
- Custo de produtos, margens ou preços de compra
- Fornecedores, distribuidores ou parceiros comerciais
- Salários, folha de pagamento ou dados de funcionários
- Senhas, sistemas internos ou dados de gestão
- Qualquer informação que o dono não deveria compartilhar com clientes

Se perguntarem sobre qualquer um desses temas: "Isso é informação interna da loja, não consigo te ajudar com isso 😅 Mas posso te ajudar com [redireciona para produtos/promoções/horário]"`
}

/** Chama OpenAI com system prompt, histórico e mensagem. Retorna resposta bruta. */
async function askOpenAI(userMessage, senderNum, systemMsg) {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY not set')

  const history = getHistory(senderNum)
  const ac = new AbortController()
  setTimeout(() => ac.abort(), 12000) // 12s timeout no OpenAI

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    signal:  ac.signal,
    body:    JSON.stringify({
      model:       'gpt-4o-mini',
      max_tokens:  350,      // 350 suficiente para WhatsApp (máx 4 linhas)
      temperature: 0.75,
      messages: [
        { role: 'system', content: systemMsg },
        ...history,
        { role: 'user',   content: userMessage },
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

/** Extrai o bloco <zs_lead>{...}</zs_lead> da resposta e retorna { clean, lead } */
function parseLeadTag(rawReply) {
  const match = rawReply?.match(/<zs_lead>([\s\S]*?)<\/zs_lead>/i)
  if (!match) return { clean: rawReply, lead: null }
  try {
    const lead = JSON.parse(match[1].trim())
    const clean = rawReply.replace(/<zs_lead>[\s\S]*?<\/zs_lead>/gi, '').trim()
    return { clean, lead }
  } catch {
    const clean = rawReply.replace(/<zs_lead>[\s\S]*?<\/zs_lead>/gi, '').trim()
    return { clean, lead: null }
  }
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

  // ── Instância ZatendeStok → Zara (bot de vendas/prospecção) ──────────────
  const ZARA_INSTANCES = ['zatendeapi', 'zatendestok']
  const isZara = ZARA_INSTANCES.includes(instanceName?.toLowerCase())

  try {
    let systemMsg
    let rawReply

    if (isZara) {
      // ── MODO ZARA: bot de vendas do ZatendeStok ──────────────────────────
      const [leadProfile, existingMarket] = await Promise.all([
        loadLead(senderNum),
        findMarketByPhone(senderNum),
      ])

      let profileCtx

      if (existingMarket) {
        // ── Cliente já cadastrado → contexto de renovação ─────────────────
        const planLabel = PLAN_LABEL[existingMarket.plan] || existingMarket.plan || 'plano ativo'
        profileCtx = `

⚠️ CLIENTE EXISTENTE — NÃO TRATE COMO LEAD NOVO:
- Mercado: ${existingMarket.storeName}
- Plano atual: ${planLabel}
- Usuário no sistema: ${existingMarket.username}
- Acesso: zatendestok.com.br

Se falar em RENOVAR: confirme o plano atual (${planLabel}), informe o valor e pergunte se quer manter ou mudar de plano. Não peça informações que você já tem. Seja direto e amigável — ele já é nosso cliente!
Se tiver algum problema/dúvida: resolva com simpatia e, se necessário, diga que o Pedro vai entrar em contato.`
      } else {
        // ── Lead novo ou prospect ─────────────────────────────────────────
        const knownParts = []
        if (leadProfile.name)   knownParts.push(`Nome: ${leadProfile.name}`)
        if (leadProfile.market) knownParts.push(`Mercado: ${leadProfile.market}`)
        if (leadProfile.city)   knownParts.push(`Cidade: ${leadProfile.city}`)
        if (leadProfile.stage)  knownParts.push(`Estágio: ${leadProfile.stage}`)
        if (senderName && !leadProfile.name) knownParts.push(`Nome no WhatsApp: ${senderName}`)

        profileCtx = knownParts.length
          ? `\n\n📌 O QUE JÁ SABEMOS SOBRE ESSE CONTATO:\n${knownParts.join('\n')}\nUse essas informações naturalmente — chame pelo nome, mencione o mercado dele.`
          : `\n\n📌 Primeira conversa com esse contato. Se apresente como Zara e pergunte o nome e tipo de negócio de forma natural.`
      }

      systemMsg = SYSTEM_PROMPT + profileCtx
      pushHistory(senderNum, 'user', text)
      rawReply = await askOpenAI(text, senderNum, systemMsg)
      if (!rawReply) return new Response('OK', { status: 200 })

      const { clean: reply, lead: extracted } = parseLeadTag(rawReply)
      pushHistory(senderNum, 'assistant', reply)

      // Persiste lead
      if (extracted && Object.keys(extracted).length) {
        await saveLead(senderNum, { ...leadProfile, ...extracted, waName: leadProfile.waName || senderName || null })
        console.log(`wa-bot: lead atualizado ${senderNum}:`, JSON.stringify(extracted))
      } else if (!leadProfile.waName && senderName) {
        await saveLead(senderNum, { waName: senderName, stage: leadProfile.stage || 'novo' })
      }

      sendReply(senderNum, reply, instanceName)
      console.log(`wa-bot [Zara]: respondeu ${senderNum}: ${reply.slice(0, 80)}`)

    } else {
      // ── MODO MERCADO: bot de atendimento ao cliente da loja ──────────────
      const marketProfile = await loadMarketProfile(instanceName)
      systemMsg = buildMarketPrompt(marketProfile)

      // Injeta nome do cliente se disponível
      if (senderName) {
        systemMsg += `\n\n📌 O cliente que está falando agora se chama *${senderName}*. Use o nome naturalmente.`
      }

      pushHistory(senderNum, 'user', text)
      rawReply = await askOpenAI(text, senderNum, systemMsg)
      if (!rawReply) return new Response('OK', { status: 200 })

      // Bot do mercado não usa <zs_lead> — resposta direta
      pushHistory(senderNum, 'assistant', rawReply)
      sendReply(senderNum, rawReply, instanceName)
      console.log(`wa-bot [${instanceName}]: respondeu ${senderNum}: ${rawReply.slice(0, 80)}`)
    }

  } catch (err) {
    console.error('wa-bot error:', err.message)
  }

  return new Response('OK', { status: 200 })
}

export const config = { path: '/wa-bot' }
