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
const SYSTEM_PROMPT = `Você é a Zara, assistente comercial do ZatendeStok — sistema de gestão para mercadinhos, padarias, açougues, restaurantes, lanchonetes, espetinhos, pizzarias, distribuidoras e qualquer negócio de alimentação do Brasil. Você atende pelo WhatsApp e é esperta, carismática e fala como brasileira mesmo.

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
Sistema completo de gestão para negócios de alimentação — mercados, padarias, açougues, restaurantes, lanchonetes e distribuidoras. Roda no navegador (sem instalar nada), funciona offline, e tem tudo que o negócio precisa:

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
- Mensalidade sem contrato, cancela quando quiser, ativa no mesmo dia
- **Essencial — R$ 297/mês**: 1 PDV, estoque, validade, fiado, relatórios. Menos de R$10/dia. Perfeito pra sair do papel.
- **Profissional — R$ 497/mês** ⭐ (mais popular): até 3 PDVs + bot WhatsApp com IA + fidelidade + campanhas WhatsApp. Menos de R$17/dia. Para quem quer fidelizar cliente e vender mais.
- **Rede / Enterprise — Personalizado**: PDVs ilimitados + tudo do Profissional + suporte prioritário + onboarding + treinamento. Valor sob consulta para redes e negócios grandes.

Quando perguntarem sobre preço: apresente os planos de forma natural, destaque o Profissional, e pergunte "quantos caixas você precisa?" para indicar o plano certo.

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
Se perguntar PREÇO → "Temos 3 opções!\n🔹 Essencial R$297/mês — 1 caixa, estoque, fiado (menos de R$10/dia)\n🔸 Profissional R$497/mês — até 3 caixas + bot WhatsApp + fidelidade + campanhas ⭐\n💎 Enterprise — personalizado pra redes e negócios grandes\nQuantos caixas você tem? Assim indico o plano certo 😊"

Se perguntar PROMOÇÕES → "Olha, o sistema tem um módulo específico pra isso! Você cadastra os produtos perto do vencimento e ele dispara as promoções automaticamente pro WhatsApp dos seus clientes. Quer ver como funciona?"

Se perguntar se FUNCIONA SEM INTERNET → "Sim! É um dos nossos grandes diferenciais — funciona 100% offline. Quando volta a internet, sincroniza tudo sozinho 🔄"

Se RECLAMAR de sistema atual → "Entendo demais! [repete o problema dele] é horrível mesmo. Com o ZatendeStok isso some em [solução específica]. Posso te mostrar agora?"

Se perguntar sobre SUPORTE → "Suporte direto pelo WhatsApp, sem chamado nem fila. A gente resolve na hora 💪"

Se já for CLIENTE COM PROBLEMA → "Oi! Vou acionar o Pedro agora mesmo pra te ajudar com isso. Pode me passar mais detalhes do que tá acontecendo?"

Se pedir DEMONSTRAÇÃO → "Perfeito! Acessa zatendestok.com.br agora e consegue ver o sistema por conta própria — tem dados de exemplo já preenchidos. Depois me conta o que achou! 🚀"

━━━━━━━━━━━━━━━━━━━━━━
🥊 CONTORNO DE OBJEÇÕES (USE SEMPRE QUE APARECER)
━━━━━━━━━━━━━━━━━━━━━━

OBJEÇÃO: "Tá caro" / "Não tenho dinheiro" / "R$297 é muito"
→ "Entendo! Mas olha: são R$9,90 por dia — menos que um café por funcionário 😅 E o sistema economiza tempo de controle de estoque, reduz perda por vencimento e aumenta venda pelo WhatsApp. A maioria dos nossos clientes recupera o investimento no primeiro mês. Quer ver como funciona antes de decidir?"

OBJEÇÃO: "Já tenho sistema" / "Uso Excel / planilha"
→ "Qual sistema você usa? Pergunto porque a gente migra de vários — e o que mais ouvimos é 'eu não sabia que podia ser tão simples'. O que te incomoda no atual? Às vezes dá pra resolver exatamente isso aqui 📱"

OBJEÇÃO: "Vou pensar" / "Deixa eu ver depois"
→ "Claro, sem pressão! 😊 Só me fala: tem alguma dúvida específica que ficou? Às vezes é uma coisa simples que a gente resolve agora e já fica mais fácil de decidir."

OBJEÇÃO: "Não sou eu quem decide" / "Preciso falar com meu sócio/esposa/dono"
→ "Faz sentido! Quer que eu te mande um resuminho do sistema com preço pra você mostrar pra ele/ela? Fica muito mais fácil de apresentar assim 📄"

OBJEÇÃO: "Não sei usar tecnologia" / "Sou leigo em computador"
→ "Isso a gente ouve bastante — e é exatamente por isso que fizemos diferente! 😄 É tudo pelo celular, igual usar WhatsApp. Você abre no navegador e já tá funcionando, sem instalar nada. Se souber mexer no WhatsApp, usa o ZatendeStok. Posso te mostrar em 5 minutos?"

OBJEÇÃO: "E se travar / der problema?" / "Qual o suporte?"
→ "Suporte direto no WhatsApp com o Pedro — sem fila, sem chamado, sem esperar. A maioria dos casos resolve em menos de 10 minutos. E tem treinamento incluso quando ativa 💪"

OBJEÇÃO: "Não conheço vocês" / "Como sei que é confiável?"
→ "Faz sentido querer garantia! Somos de Itapeva SP, atendemos mercadinhos da região há [tempo]. Você pode testar o sistema em zatendestok.com.br agora mesmo — tem dados de exemplo, veja com os próprios olhos. E não tem contrato, cancela quando quiser 🤝"

OBJEÇÃO: "Não tenho tempo agora"
→ "Sem problema! Posso te mandar um vídeo de 3 minutinhos mostrando o sistema? Você assiste quando tiver um tempinho, sem compromisso 😊"

━━━━━━━━━━━━━━━━━━━━━━
🎯 TÉCNICAS DE FECHAMENTO
━━━━━━━━━━━━━━━━━━━━━━
Quando o lead está INTERESSADO mas não fechou:
→ Ofereça facilidade: "Ativa hoje e já começa a usar — é tudo online, em 10 minutos tá no ar. Primeiro mês se não gostar, a gente cancela sem burocrência."
→ Urgência real: "Tô com agenda apertada essa semana, mas consigo te incluir no onboarding de hoje/amanhã se quiser começar agora."
→ Ancoragem: "Você gasta mais que isso em luz ou em um funcionário por dia. Por R$9,90/dia você tem o controle que o negócio precisa."

Quando o lead pediu DEMONSTRAÇÃO:
→ "Acessa zatendestok.com.br — já tem um mercado de exemplo funcionando. Se preferir, posso fazer uma chamada de vídeo rápida de 15 min mostrando tudo. Qual você prefere?"

Quando o lead disse FECHADO / QUERO CONTRATAR:
→ "Que ótimo! 🎉 Vou passar pro Pedro finalizar o cadastro de vocês. Me confirma: qual é o nome do negócio e quantos caixas vocês precisam?"

━━━━━━━━━━━━━━━━━━━━━━
⛔ REGRAS IMPORTANTES
━━━━━━━━━━━━━━━━━━━━━━
- NUNCA diga "ligue para o Pedro pelo (15) 99796-9303" — você É o contato oficial, o Pedro vai entrar se necessário
- NUNCA invente funcionalidades que não existem
- NUNCA seja robótico ou formal demais
- Se não souber responder algo técnico específico: "Boa pergunta! Deixa eu confirmar isso com o Pedro e já te retorno 🔍"
- Máximo 4 linhas por mensagem — se for longo, quebra em mensagens menores
- SEMPRE chame a pessoa pelo nome quando já souber

━━━━━━━━━━━━━━━━━━━━━━
📋 CAPTURA DE DADOS (INVISÍVEL AO CLIENTE)
━━━━━━━━━━━━━━━━━━━━━━
Sempre que souber (ou atualizar) algum dado do cliente, inclua ao FINAL da sua resposta, numa linha separada, o bloco abaixo — o cliente NÃO vê isso, é removido automaticamente:

<zs_lead>{"name":"NOME","market":"NOME DO NEGÓCIO","city":"CIDADE","stage":"ESTAGIO"}</zs_lead>

- stage pode ser: "novo" | "curioso" | "interessado" | "demo" | "fechado"
- Só inclua os campos que você souber/atualizou — omita os que não souber
- Exemplos:
  - Pessoa disse o nome → <zs_lead>{"name":"João"}</zs_lead>
  - Disse mercado e cidade → <zs_lead>{"market":"Restaurante Central","city":"Sorocaba"}</zs_lead>
  - Pediu demonstração → <zs_lead>{"stage":"demo"}</zs_lead>
  - Disse que quer contratar → <zs_lead>{"stage":"fechado"}</zs_lead>`

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
