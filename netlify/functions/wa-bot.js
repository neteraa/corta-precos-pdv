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

// ─── Netlify Blobs ────────────────────────────────────────────────────────────
import { getStore } from '@netlify/blobs'

function leadsStore() {
  return getStore({ name: 'wa-leads', consistency: 'strong' })
}

// ─── Corta Preços: catálogo de produtos e promos (cache 20 min) ───────────────
// CRÍTICO: StoreId SEM timestamp pra consistência com login!
const CORTA_PRECOS_STORE_ID = 'cortaprecos'
const catalogCache = { data: null, ts: 0 }

// ─── Mapeamento Instance Name (Evolution API) → StoreId (Sistema) ─────────────
// IMPORTANTE: instanceName vem do webhook Evolution API (payload.instance)
// StoreId é o ID único do mercado no sistema (usado no login e blob storage)
// SEMPRE usar storeId SEM timestamp pra evitar duplicatas!
const INSTANCE_TO_STOREID = {
  'cortaprecos':   'cortaprecos',  // Corta Preços (SEM timestamp!)
  'zatendeapi':    'zara',         // Zara (bot de vendas ZatendeStok)
  'zara':          'zara',         // Zara (alternativa)
  // Adicionar outros mercados aqui conforme forem criados
  // SEMPRE sem timestamp! Ex: 'mercadox': 'mercadox'
}

/** Resolve instanceName → storeId (para consistência nas keys do blob) */
function getStoreIdFromInstance(instanceName) {
  if (!instanceName) return 'zara' // fallback
  return INSTANCE_TO_STOREID[instanceName] || instanceName
}

async function loadStoreCatalog() {
  const TTL = 20 * 60 * 1000
  if (catalogCache.data && (Date.now() - catalogCache.ts) < TTL) return catalogCache.data
  try {
    const store = getStore({ name: 'corta-precos', consistency: 'eventual' })
    const [prodRaw, promoRaw] = await Promise.all([
      store.get(`${CORTA_PRECOS_STORE_ID}:cp_products`, { type: 'text' }).catch(() => null),
      store.get(`${CORTA_PRECOS_STORE_ID}:cp_promos`,   { type: 'text' }).catch(() => null),
    ])
    const products = prodRaw  ? JSON.parse(prodRaw)  : []
    const promos   = promoRaw ? JSON.parse(promoRaw) : []
    catalogCache.data = { products, promos }
    catalogCache.ts   = Date.now()
    return catalogCache.data
  } catch (e) {
    console.error('loadStoreCatalog:', e.message)
    return { products: [], promos: [] }
  }
}

function buildCatalogText(products, promos) {
  // Agrupa TODOS os produtos por categoria (sem limite)
  const active = products.filter(p => p.price > 0 && p.active !== false)
  const byCategory = {}
  for (const p of active) {
    const cat = p.category || 'Outros'
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(`• ${p.name}: R$${p.price.toFixed(2).replace('.', ',')}`)
  }

  // Formata: lista completa POR CATEGORIA (sem truncar)
  const lines = []
  for (const [cat, items] of Object.entries(byCategory)) {
    lines.push(`\n📦 ${cat}:\n${items.join('\n')}`)
  }

  // Lista só os nomes das categorias (para o bot sugerir)
  const categoryList = Object.keys(byCategory).map(cat => `📦 ${cat}`).join('\n')

  const promoLines = promos
    .filter(pr => pr.active)
    .map(pr => `• ${pr.name}`)

  return {
    catalogText: lines.join('\n') || 'Catálogo sendo atualizado.',
    categoryList,  // NOVO: lista de categorias
    promoText: promoLines.join('\n') || 'Nenhuma promoção ativa no momento.',
  }
}

async function saveDeliveryOrder(order) {
  try {
    const store = getStore({ name: 'corta-precos', consistency: 'strong' })
    const key   = `${CORTA_PRECOS_STORE_ID}:cp_deliveries`
    const raw   = await store.get(key, { type: 'text' }).catch(() => null)
    const orders = raw ? JSON.parse(raw) : []
    
    const newOrder = {
      ...order,
      id:        `del_${Date.now()}`,
      createdAt: new Date().toISOString(),
      status:    order.status || 'awaiting_pix', // aguarda confirmação do painel
    }
    
    orders.unshift(newOrder)
    await store.set(key, JSON.stringify(orders.slice(0, 300)))
    
    // NOVO: Atualiza histórico no perfil do cliente
    if (order.phone) {
      const customerProfile = await loadLead(order.phone)
      const orderHistory = customerProfile.orders || []
      
      orderHistory.unshift({
        id: newOrder.id,
        date: newOrder.createdAt,
        items: order.items,
        total: order.total,
        deliveryFee: order.deliveryFee || 7,
        status: newOrder.status,
      })
      
      await saveLead(order.phone, {
        orders: orderHistory.slice(0, 50), // mantém últimos 50 pedidos
        lastOrderDate: newOrder.createdAt,
        totalOrders: orderHistory.length,
        totalSpent: orderHistory.reduce((sum, o) => sum + (o.total || 0), 0),
      })
    }
  } catch (e) { console.error('saveDeliveryOrder:', e.message) }
}

function buildCortaPrecosPrompt(catalogText, categoryList, promoText) {
  return `Você é a Zara, atendente virtual do CORTA PREÇOS. Responde pelo WhatsApp de forma simpática, rápida e informal — como uma atendente boa de mercadinho.

━━━━━━━━━━━━━━━━━━━━━━
🏪 NOSSA LOJA
━━━━━━━━━━━━━━━━━━━━━━
• Mercado CORTA PREÇOS — Itapeva-SP
• Endereço: Rua Capão Bonito, 20 - Itapeva-SP
• WhatsApp: (15) 9979-6930
• Horário de funcionamento:
  - Segunda a Sábado: 9h às 19h
  - Domingo: 9h às 13h
• Pagamento: PIX, Dinheiro, Débito, Crédito
• Delivery: taxa fixa R$7,00 — pagamento SOMENTE por PIX
• Chave PIX do delivery: CNPJ 60.662.362/0001-70 (Corta Preços)

━━━━━━━━━━━━━━━━━━━━━━
🛒 PRODUTOS E PREÇOS
━━━━━━━━━━━━━━━━━━━━━━

🎯 ESTRATÉGIA IMPORTANTE: Temos 35+ produtos!
• Se cliente perguntar "lista de produtos" ou "catálogo" → Mostre APENAS as CATEGORIAS abaixo e pergunte qual quer ver
• Se cliente pedir categoria específica (ex: "Higiene", "Biscoitos") → Aí sim liste os produtos daquela categoria

CATEGORIAS DISPONÍVEIS:
${categoryList}

CATÁLOGO COMPLETO (use SOMENTE quando cliente pedir categoria específica):
${catalogText}

━━━━━━━━━━━━━━━━━━━━━━
🔥 PROMOÇÕES DE HOJE
━━━━━━━━━━━━━━━━━━━━━━
${promoText}

━━━━━━━━━━━━━━━━━━━━━━
🛵 ENTREGA EM CASA
━━━━━━━━━━━━━━━━━━━━━━
Taxa fixa: R$7,00 · Pagamento: SOMENTE PIX

CHAVE PIX DELIVERY: CNPJ 60.662.362/0001-70 — Corta Preços

FLUXO DE ENTREGA (siga SEMPRE nessa ordem exata):
1. Cliente quer entrega → pergunta o endereço completo (rua, número, bairro)
2. Confirma os produtos que ele quer e lista com preços
3. Calcula: total dos produtos + R$7 entrega = TOTAL FINAL
4. Manda exatamente esta mensagem de pagamento (substitua os valores):
   "✅ Pedido confirmado! Total: R$XX,XX (produtos + R$7 entrega)\n💳 Pague via PIX:\nCNPJ: 60.662.362/0001-70\nFavorecido: Corta Preços\nApós pagar, me manda o comprovante aqui 📸"
   E INCLUA (antes da mensagem ao cliente) a tag interna de rascunho:
   <zs_pending>{"address":"ENDEREÇO","items":"PRODUTOS COM QTD","total":VALOR_FLOAT_APENAS_PRODUTOS_SEM_ENTREGA}</zs_pending>

5. Quando a mensagem for "[comprovante enviado]":
   OBRIGATÓRIO: inclua SEMPRE na sua resposta a tag abaixo (ANTES da mensagem ao cliente).
   A tag é interna — o sistema a remove automaticamente. NUNCA omita a tag nessa situação.

   <zs_delivery>{"phone":"NUMERO_DO_CLIENTE","name":"NOME_DO_CLIENTE","address":"ENDEREÇO_COMPLETO","items":"LISTA_DE_ITENS_COM_QTD","total":VALOR_APENAS_PRODUTOS_SEM_ENTREGA,"deliveryFee":7}</zs_delivery>

   Depois da tag, escreva ao cliente exatamente:
   "✅ Comprovante recebido! Assim que confirmarmos o PIX, seu pedido sai na hora 🛵 Te avisamos assim que confirmar!"

REGRAS DO COMPROVANTE:
- "[comprovante enviado]" → CONFIRME com a mensagem acima e emita a tag <zs_delivery>
- "[imagem enviada]" → NÃO é comprovante automático. Pergunte: "Que foto! O que você tá querendo? 😊"
- Cliente diz "paguei" sem foto → "Consegue mandar o comprovante pra gente confirmar? 📸"
- NUNCA cancele pedido — apenas incentive o envio do comprovante
- O TOTAL na tag <zs_delivery> e <zs_pending> é SOMENTE o valor dos produtos (sem os R$7 de entrega)

━━━━━━━━━━━━━━━━━━━━━━
🧠 COMO SE COMPORTAR
━━━━━━━━━━━━━━━━━━━━━━
• Linguagem natural e informal — "oi!", "claro!", "perfeito!", "pode deixar!"
• Respostas CURTAS — WhatsApp não é e-mail. Máximo 3-4 linhas
• Emojis naturais (1-2 por mensagem)
• Quando perguntar preço: responde direto com o valor
• Quando perguntar promoção: informa com entusiasmo!
• Se produto não existir no catálogo: "Esse não temos, mas temos [sugestão]"
• Para entrega: segue o fluxo acima sem pular etapas

━━━━━━━━━━━━━━━━━━━━━━
🚫 NUNCA DIZER
━━━━━━━━━━━━━━━━━━━━━━
• Custo, margem, fornecedores
• Dados financeiros internos ou de gestão
• Que você é uma IA ou robô — você é a Zara, atendente da loja`
}

/** Extrai <zs_delivery>{...}</zs_delivery> da resposta */
function parseDeliveryTag(rawReply) {
  const match = rawReply?.match(/<zs_delivery>([\s\S]*?)<\/zs_delivery>/i)
  if (!match) return { clean: rawReply, delivery: null }
  try {
    const delivery = JSON.parse(match[1].trim())
    const clean    = rawReply.replace(/<zs_delivery>[\s\S]*?<\/zs_delivery>/gi, '').trim()
    return { clean, delivery }
  } catch {
    return { clean: rawReply.replace(/<zs_delivery>[\s\S]*?<\/zs_delivery>/gi, '').trim(), delivery: null }
  }
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
Você é CONFIANTE e VENCEDORA. Não é só vendedora — você tá ajudando o cara a DOMINAR o negócio dele.

- Linguagem natural e informal: "oi!", "olha só", "é isso mesmo", "caramba", "showw!", "demais!"
- Emojis com naturalidade — 1 a 2 por mensagem, sem exagero
- Respostas CURTAS — WhatsApp não é email. Máximo 4 linhas
- Pergunta antes de vender — descobre o problema antes de apresentar solução
- Bom humor genuíno, não forçado
- CONFIANÇA SEM SER ARROGANTE — você sabe que o sistema é foda, mas não força a barra
- Usa números e fatos reais — "nosso cliente economizou R$3.000/mês" > "você vai economizar muito"
- Quando lead compara com concorrente: destaca nossos diferenciais (offline, sem instalar, bot incluído)
- TOM VENCEDOR: não é "se quiser testar...", é "testa agora e me conta o que achou!"

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
🏆 POR QUE SOMOS DIFERENTES
━━━━━━━━━━━━━━━━━━━━━━
Enquanto outros sistemas são engessados, caros e complicados, o ZatendeStok é:

✅ FUNCIONA OFFLINE — PDV nunca trava por falta de internet. Sincroniza sozinho depois.
✅ SEM INSTALAR NADA — abre no navegador e já tá pronto. Celular, PC, tablet... qualquer um.
✅ IMPRESSORA SEM DRIVER — conecta direto na USB ou WiFi. Não precisa instalar nada.
✅ BOT WHATSAPP IA INCLUÍDO — atendimento 24h pros seus clientes. Outros cobram à parte.
✅ VALIDADE INTELIGENTE — alerta automático 7/15/30 dias antes do vencimento via WhatsApp.
✅ FIADO DIGITAL COM COBRANÇA — cliente recebe lembrete e paga direto. Sem mais calote.
✅ ETIQUETAS COM CÓDIGO DE BARRAS — gera na hora, imprime em lote. Economiza tempo.
✅ ATIVA NO MESMO DIA — em 2 horas você tá usando. Outros demoram semanas.
✅ SEM CONTRATO — não gostou? Cancela quando quiser, sem multa, sem burocracia.
✅ SUPORTE REAL POR WHATSAPP — não é robô, não é ticket. Pessoa de verdade te atende.
✅ 100% BRASILEIRO — desenvolvido em Itapeva-SP. Time presente e sempre melhorando.

Use esses diferenciais quando compararem com "outros sistemas" ou perguntarem "por que vocês?". Mostre que não é só mais um sistema — é O sistema.

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

💡 ARGUMENTO MATADOR: "R$497/mês parece muito? Pensa assim: com fiado organizado você reduz 20% de calote (R$1.000+ recuperado), com validade você economiza 10% em perdas (R$500+), e com fidelidade você aumenta 15% em vendas. O sistema SE PAGA SOZINHO no primeiro mês."

Quando perguntarem sobre preço: apresente os 3 de forma natural, destaque o Profissional com o argumento acima, e pergunte "quantos caixas você usa?" pra indicar o plano certo.

━━━━━━━━━━━━━━━━━━━━━━
🎯 CASES DE SUCESSO (use pra dar confiança!)
━━━━━━━━━━━━━━━━━━━━━━
Nossos clientes estão DOMINANDO:

📈 Mercado em Itapeva-SP: reduziu 70% do calote com fiado digital + aumentou 25% nas vendas com bot WhatsApp em 3 meses
📊 Padaria em São Paulo: economizou R$3.000/mês só eliminando perdas por validade vencida
🚀 Açougue no interior: fidelizou 200+ clientes em 2 meses com programa de pontos automático
💰 Distribuidora: automatizou 90% dos pedidos com bot WhatsApp IA — time focou em crescer, não em atender

Quando o lead estiver em dúvida, use esses números reais pra mostrar que FUNCIONA de verdade. Não é promessa, é resultado.

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
🥊 OBJEÇÕES — RESPOSTAS MATADORAS
━━━━━━━━━━━━━━━━━━━━━━
"Tá caro" → "R$9,90/dia — menos que um café. Olha: um cliente nosso reduziu 70% de calote no fiado. Recuperou R$1.000+ no primeiro mês. O sistema SE PAGA em 10 dias. Quer ver funcionando antes de decidir?"

"Já tenho sistema" → "Qual você usa? Deixa eu te perguntar: ele funciona offline? Tem bot WhatsApp incluído? Cobra automático no fiado? A maioria não tem. Quer ver o nosso funcionando pra comparar?"

"Vou pensar" → "Fechou! Mas me conta: é o preço, alguma funcionalidade, ou só quer ver funcionando primeiro? Às vezes é só um detalhe que eu resolvo agora 😊"

"Não sei usar tecnologia" → "Mais fácil que WhatsApp, juro! Abre no navegador e já tá pronto — celular, PC, tablet. Sem instalar, sem complicação. Testa agora: zatendestok.com.br/demo — 2 minutos e você vê"

"Não conheço vocês" → "Normal! Somos de Itapeva-SP, 100% brasileiros. Nosso cliente em São Paulo economizou R$3.000/mês com o sistema. Testa ao vivo agora: zatendestok.com.br/demo — sem cadastro. E cancela quando quiser, sem contrato 🤝"

"Outro sistema é mais barato" → "Entendo! Mas me conta: esse outro funciona offline? Tem bot WhatsApp IA incluído? Porque no nosso tem — e os outros cobram isso à parte. No final, sai mais caro lá. Quer comparar?"

"Preciso falar com meu sócio" → "Show! Manda o link do demo pro seu sócio também: zatendestok.com.br/demo/[nicho]. Vocês testam juntos e depois me chamam. Ou prefere que eu explique direto pra ele?"

━━━━━━━━━━━━━━━━━━━━━━
🔥 GARANTIA SEM RISCOS
━━━━━━━━━━━━━━━━━━━━━━
Use isso quando o lead tiver medo de contratar:

✅ SEM CONTRATO — cancela quando quiser, sem multa, sem burocracia
✅ ATIVA EM 2 HORAS — não precisa esperar semanas pra começar a usar
✅ TESTE REAL ANTES — acessa o demo e vê funcionando. Sem precisar cadastrar.
✅ SUPORTE DIRETO — se travar algo, chama no WhatsApp. Pessoa real te atende.
✅ MIGRAÇÃO GRÁTIS — traz seus dados do sistema antigo. A gente ajuda.

"Olha, você não tem NADA a perder: testa o demo agora, ativa em 2 horas se gostar, e se não der certo, cancela quando quiser. Zero risco. Bora?"

━━━━━━━━━━━━━━━━━━━━━━
🎯 FECHAMENTO
━━━━━━━━━━━━━━━━━━━━━━
Lead INTERESSADO → "Perfeito! Ativa hoje e em 2 horas você já tá usando. Não gostou? Cancela sem burocracia. Zero risco. Bora começar?"
Lead pediu DEMO → "Show! Acessa zatendestok.com.br/demo/[nicho] agora — é ao vivo, sem cadastro. Testa e me conta o que achou!"
Lead disse QUERO CONTRATAR → "SHOWW! 🎉 Vou passar pro Pedro ativar. Me confirma: nome do negócio e quantos caixas precisa?"
Lead em DÚVIDA → "Entendo! Me fala: o que tá te segurando? Preço? Funcionalidade? Às vezes é algo simples que eu resolvo agora 😊"

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

/** Extrai o texto de qualquer tipo de mensagem do Evolution API.
 *  Imagens sem legenda → "[imagem enviada]" (genérico).
 *  A lógica de comprovante é decidida pelo contexto da conversa, não aqui.
 */
function extractText(data) {
  const msg = data?.message
  if (!msg) return null
  return (
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    (msg.imageMessage ? '[imagem enviada]' : null) ||
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
    return Promise.resolve()
  }

  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 8000) // desiste em 8s

  return fetch(`${url}/message/sendText/${inst}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': key },
    body:    JSON.stringify({ number, text }),
    signal:  ac.signal,
  }).then(r => {
    clearTimeout(timer)
    if (!r.ok) return r.text().then(b => console.error(`wa-bot: sendText ${r.status} — ${b.slice(0,200)}`))
    console.log(`wa-bot: sendText OK → ${number}`)
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

// Sinaliza ausência de crédito/cota em qualquer provedor LLM
class OpenAIQuotaError extends Error {}

/**
 * Chama LLM: usa Groq (gratuito, meta-llama/llama-4-scout-17b-16e-instruct) se GROQ_API_KEY estiver setada,
 * caso contrário usa OpenAI gpt-4o-mini como fallback.
 */
async function askLLM(userMessage, senderNum, systemMsg, instanceName = 'default') {
  const groqKey = process.env.GROQ_API_KEY
  const oaiKey  = process.env.OPENAI_API_KEY
  const useGroq  = !!groqKey

  const key      = useGroq ? groqKey : oaiKey
  const endpoint = useGroq
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions'
  const model    = useGroq ? 'qwen/qwen3.8-27b' : 'gpt-4o-mini'

  if (!key) throw new OpenAIQuotaError('sem_credito')

  // CRÍTICO: Busca histórico isolado por instanceName!
  const history = getHistory(senderNum, instanceName)
  const ac = new AbortController()
  setTimeout(() => ac.abort(), 10000)

  const res = await fetch(endpoint, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    signal:  ac.signal,
    body:    JSON.stringify({
      model,
      max_tokens:  180,
      temperature: 0.45,
      messages: [
        { role: 'system', content: systemMsg },
        ...history,
        { role: 'user',   content: userMessage },
      ],
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    if (res.status === 429) throw new OpenAIQuotaError('sem_credito')
    throw new Error(`LLM error ${res.status}: ${body}`)
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
// CRÍTICO: Chave = instanceName:senderNum (ISOLA cada bot completamente!)
const conversations  = new Map()   // "instanceName:senderNum" → [{role, content}, ...]
const MAX_HISTORY    = 12          // 12 msgs — garante endereço + itens + total no contexto delivery

// ─── Rate limiting por número ─────────────────────────────────────────────────
// Evita dreno de crédito por spam ou loops involuntários
const rateMap = new Map()   // senderNum → { count, windowStart }
const RATE_WINDOW_MS  = 60 * 60 * 1000  // janela de 1 hora
const RATE_MAX_PER_HR = 20              // máx 20 mensagens por número por hora

function checkRateLimit(senderNum) {
  const now  = Date.now()
  const prev = rateMap.get(senderNum) || { count: 0, windowStart: now }
  if (now - prev.windowStart > RATE_WINDOW_MS) {
    // nova janela
    rateMap.set(senderNum, { count: 1, windowStart: now })
    return true
  }
  if (prev.count >= RATE_MAX_PER_HR) return false   // bloqueado
  rateMap.set(senderNum, { count: prev.count + 1, windowStart: prev.windowStart })
  return true
}

function getHistory(senderNum, instanceName = 'default') {
  // CRÍTICO: Chave única por bot! instanceName:senderNum
  const key = `${instanceName}:${senderNum}`
  if (!conversations.has(key)) conversations.set(key, [])
  return conversations.get(key)
}

function pushHistory(senderNum, role, content, instanceName = null) {
  // CRÍTICO: Usa instanceName na chave pra isolar bots!
  const hist = getHistory(senderNum, instanceName || 'default')
  hist.push({ role, content })
  // Mantém só as últimas MAX_HISTORY mensagens pra não explodir o contexto
  if (hist.length > MAX_HISTORY) hist.splice(0, hist.length - MAX_HISTORY)
  // Salva no blob para persistência (fire-and-forget) - ISOLADO POR INSTANCE/STOREID
  if (instanceName) {
    saveChatHistory(instanceName, senderNum, role, content).catch(e => console.error('saveChatHistory:', e.message))
  }
}

/** Persiste histórico de chat no blob (append-only) - ISOLADO POR STOREID */
async function saveChatHistory(instanceName, phone, role, content) {
  try {
    const store = leadsStore()
    // Mapeia instanceName → storeId para consistência com o login
    const storeId = getStoreIdFromInstance(instanceName)
    // KEY: chat_history:{storeId}:{phone} — ISOLAMENTO POR CLIENTE!
    const key = `chat_history:${storeId}:${phone}`
    const raw = await store.get(key, { type: 'json' }).catch(() => null)
    const messages = raw || []
    messages.push({
      role,
      content,
      timestamp: new Date().toISOString(),
    })
    // Mantém últimas 200 mensagens por cliente
    if (messages.length > 200) messages.splice(0, messages.length - 200)
    await store.set(key, JSON.stringify(messages))
    console.log(`[saveChatHistory] instance:${instanceName} → storeId:${storeId} → key:${key}`)
  } catch (e) { console.error('saveChatHistory:', e.message) }
}

/** Extrai <zs_pending>{...}</zs_pending> da resposta do bot (passo 4 do fluxo). */
function parsePendingTag(rawReply) {
  const match = rawReply?.match(/<zs_pending>([\s\S]*?)<\/zs_pending>/i)
  if (!match) return { clean: rawReply, pending: null }
  try {
    const pending = JSON.parse(match[1].trim())
    const clean   = rawReply.replace(/<zs_pending>[\s\S]*?<\/zs_pending>/gi, '').trim()
    return { clean, pending }
  } catch {
    return { clean: rawReply.replace(/<zs_pending>[\s\S]*?<\/zs_pending>/gi, '').trim(), pending: null }
  }
}

/**
 * Persiste draft do pedido no Netlify Blob quando bot envia msg de pagamento PIX.
 * Usa dados da <zs_pending> tag (LLM) ou extração por regex como fallback.
 * Sobrevive a cold starts da função.
 */
async function maybeStorePendingOrder(botReply, senderNum, senderName, pendingFromTag, instanceName = 'default') {
  // Preferir dados da tag <zs_pending> (LLM já extraiu address, items, total corretos)
  let pending = null
  if (pendingFromTag?.total && pendingFromTag.total > 7) {
    pending = {
      phone:       senderNum,
      name:        senderName,
      address:     pendingFromTag.address || 'Ver conversa WhatsApp',
      items:       pendingFromTag.items   || 'Ver conversa WhatsApp',
      total:       pendingFromTag.total,
      deliveryFee: 7,
    }
  } else if (/pague via pix|cnpj.*60\.662|pagar.*pix/i.test(botReply)) {
    // Fallback: sem tag → tenta regex no texto do bot
    const totalMatch = botReply.match(/total[^:]*:\s*r?\$?\s*([\d,.]+)/i)
                    || botReply.match(/r\$\s*([\d]{2,}[.,][\d]{2})/i) // ex: R$50,40
    if (totalMatch) {
      const total = parseFloat(totalMatch[1].replace(/\./g, '').replace(',', '.'))
      if (!isNaN(total) && total > 7) {
        const hist     = getHistory(senderNum, instanceName)
        const addrMsg  = [...hist].reverse().find(m => m.role === 'user' && m.content.length > 5 && !/^\[/.test(m.content))
        const itemsMsg = [...hist].find(m => m.role === 'user' && /\dx\s|\d+\s*(kg|l\b|un|pack)|coca|arroz|feij|frango|biscoito/i.test(m.content))
        pending = {
          phone: senderNum, name: senderName,
          address: addrMsg?.content?.slice(0, 200) || 'Ver conversa WhatsApp',
          items:   itemsMsg?.content?.slice(0, 300) || 'Ver conversa WhatsApp',
          total, deliveryFee: 7,
        }
      }
    }
  }
  if (!pending) return

  try {
    const blobStore = getStore({ name: 'corta-precos', consistency: 'strong' })
    await blobStore.set(`pending_delivery:${senderNum}`, JSON.stringify(pending))
    console.log(`wa-bot: pendingOrder blob para ${senderNum} — R$${pending.total} | ${pending.items?.slice(0,50)}`)
  } catch (e) { console.error('wa-bot: erro pendingOrder blob:', e.message) }
}

/** Lê e apaga o draft do blob — retorna null se não existir. */
async function popPendingOrder(senderNum) {
  try {
    const blobStore = getStore({ name: 'corta-precos', consistency: 'strong' })
    const key = `pending_delivery:${senderNum}`
    const raw = await blobStore.get(key, { type: 'text' })
    if (!raw) return null
    await blobStore.delete(key)
    return JSON.parse(raw)
  } catch (e) { console.error('wa-bot: erro popPendingOrder:', e.message); return null }
}

// Track recently processed message IDs to avoid duplicate responses
const recentIds = new Set()

// ─── Fast-path sem LLM para o bot Corta Preços ───────────────────────────────
// Cobre saudações, promoções, horário, pagamento e busca de preços no catálogo.
// Retorna string pronta ou null (→ cai no LLM). Economiza ~60% das chamadas.

function normStr(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

function findProduct(query, products) {
  if (!products?.length) return null
  const q = normStr(query)
  if (q.length < 3) return null
  // Exact name match first
  let hit = products.find(p => normStr(p.name) === q)
  if (hit) return hit
  // Name contains query
  hit = products.find(p => normStr(p.name).includes(q))
  if (hit) return hit
  // Query contains first word of product name (ex: "arroz" → "Arroz Tipo 1 5kg")
  hit = products.find(p => {
    const words = normStr(p.name).split(' ')
    return words.length > 0 && q.includes(words[0]) && words[0].length > 3
  })
  return hit || null
}

function quickReply(text, senderName, promoText, products) {
  const t   = normStr(text)
  const nom = senderName ? `, ${senderName.split(' ')[0]}` : ''

  // Saudação pura
  if (/^(oi+|ola+|hello|hi+|e[- ]?ai+|ei+|hey|bom dia|boa tarde|boa noite|tudo bem|tudo bom|oi tudo|ola tudo|boas|salve)[\s!.,?]*$/.test(t)) {
    return `Oi${nom}! 👋 Bem-vindo ao Corta Preços!\n\n🛒 Preços · 🔥 Promoções · 🛵 Delivery\n\nMe fala o que você precisa! 😊`
  }

  // Promoções / ofertas
  if (/^(promocoes?|ofertas?|promocao|o que.*promo|qual.*promo|tem.*promo|promo.*hoje|descontos?|novidade)[\s!?]*$/.test(t)) {
    const p = promoText || 'Nenhuma promoção ativa agora.'
    return `🔥 Promoções de hoje${nom}:\n${p}\n\nQuer fazer um pedido? 🛒`
  }

  // Horário
  if (/horario|que hora|abre|fecha|funcionamento|ta aberto|esta aberto|ficam aberto/.test(t) && t.length < 55) {
    return `⏰ Horário Corta Preços${nom}:\n• Segunda a Sábado: 9h às 19h\n• Domingo: 9h às 13h\n\nTe espero aqui! 😊`
  }

  // Pagamento / PIX
  if (/pagamento|aceita|pix|cartao|dinheiro|forma de pag|como pago|como pagar/.test(t) && t.length < 65) {
    return `💳 Pagamentos${nom}:\nPIX ✅ | Dinheiro ✅ | Débito ✅ | Crédito ✅\n\nDelivery: somente PIX (CNPJ 60.662.362/0001-70) 🛵`
  }

  // Endereço / localização
  if (/endereco|localizacao|onde fica|onde voces ficam|como chegar|maps|googl/.test(t) && t.length < 60) {
    return `📍 Corta Preços${nom}:\nRua Capão Bonito, 20 - Itapeva-SP\nWhatsApp: (15) 9979-6930\n\nQuer fazer um pedido por entrega? 🛵`
  }

  // Taxa de entrega
  if (/taxa|frete|entrega.*custa|custa.*entrega|quanto.*entrega|entrega.*quanto|delivery.*taxa/.test(t) && t.length < 60) {
    return `🛵 Taxa de entrega${nom}: R$7,00 fixo!\nPagamento somente PIX.\n\nMe passa seu endereço pra começar o pedido 😊`
  }

  // Busca de preço: "preço do arroz", "quanto custa leite", "tem feijão?", "valor da carne"
  const priceRx = /^(?:preco d[oa]?|quanto custa|valor d[oa]?|tem |qual.*preco|me fala.*preco|preco)\s+(.+)$/
  const priceM  = t.match(priceRx)
  if (priceM) {
    const query = priceM[1].replace(/[?!.]+$/, '').trim()
    const found = findProduct(query, products)
    if (found) {
      const preco = `R$${Number(found.price).toFixed(2).replace('.', ',')}`
      return `🏷️ ${found.name}: ${preco}${nom}\n\nQuer pedir? Me passa seu endereço! 🛵`
    }
    // Produto não encontrado no catálogo → deixa o LLM responder
    return null
  }

  // "tem X?" simples
  const temRx = /^tem\s+(.+)[?!.]?$/
  const temM  = t.match(temRx)
  if (temM) {
    const query = temM[1].trim()
    const found = findProduct(query, products)
    if (found) {
      const preco = `R$${Number(found.price).toFixed(2).replace('.', ',')}`
      return `Sim${nom}! Temos ${found.name} por ${preco} 🛒\nQuer pedir?`
    }
    return null  // deixa LLM sugerir alternativa
  }

  return null  // sem fast-path → LLM
}

export default async (req, context) => {
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
  
  // DEBUG: Log completo do webhook para investigar
  console.log('━━━ WEBHOOK RECEBIDO ━━━')
  console.log('payload.instance:', payload?.instance)
  console.log('instanceName (final):', instanceName)
  console.log('storeId mapeado:', getStoreIdFromInstance(instanceName))
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━')

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

  // ── Rate limit — bloqueia spam antes de gastar tokens ────────────────────
  if (!checkRateLimit(senderNum)) {
    console.warn(`wa-bot: rate limit atingido para ${senderNum} — ignorando`)
    return new Response('OK', { status: 200 })
  }

  console.log(`wa-bot [${instanceName}]: msg de ${senderNum} (${senderName}): ${text.slice(0, 80)}`)

  // ── Instâncias: Corta Preços store bot vs Zara sales bot ─────────────────
  // CRÍTICO: Separação correta entre mercado (Corta Preços) e vendas (Zara)
  const CORTA_PRECOS_INSTANCES = ['cortaprecos', 'cortaprecos_1789770018182']
  const ZARA_INSTANCES = ['zara', 'zatendeapi', 'zatendestok']  // VENDAS do sistema
  
  const isCortaPrecos = CORTA_PRECOS_INSTANCES.includes(instanceName?.toLowerCase())
                     || String(instanceName || '').toLowerCase().startsWith('cortaprecos_')
  const isZara        = ZARA_INSTANCES.includes(instanceName?.toLowerCase())

  try {
    let systemMsg
    let rawReply

    if (isCortaPrecos) {
      // ── MODO CORTA PREÇOS: bot de atendimento + delivery + produtos ───────
      
      // Carrega/cria perfil do cliente (salva lead na primeira mensagem)
      const customerProfile = await loadLead(senderNum)
      const isFirstContact = !customerProfile.createdAt
      
      if (isFirstContact) {
        await saveLead(senderNum, {
          waName: senderName || 'Cliente',
          type: 'customer',  // diferencia de 'lead' (Zara)
          source: 'cortaprecos',
          firstContact: new Date().toISOString(),
        })
        console.log(`[CortaPrecos] Novo cliente: ${senderName} (${senderNum})`)
      } else {
        // Atualiza nome se mudou
        if (senderName && senderName !== customerProfile.waName) {
          await saveLead(senderNum, { waName: senderName })
        }
      }
      
      const { products, promos } = await loadStoreCatalog()
      const { catalogText, categoryList, promoText } = buildCatalogText(products, promos)
      systemMsg = buildCortaPrecosPrompt(catalogText, categoryList, promoText)

      // Personalização baseada no perfil do cliente
      if (senderName) {
        systemMsg += `\n\n📌 Cliente: ${senderName}. Use o nome naturalmente.`
      }
      
      // Se cliente já comprou antes, mencione sutilmente (sem ser invasivo)
      if (customerProfile.orders && customerProfile.orders.length > 0) {
        const totalPedidos = customerProfile.orders.length
        const lastOrder = customerProfile.orders[0] // mais recente
        systemMsg += `\n\n🛒 HISTÓRICO DO CLIENTE:\n• Total de pedidos: ${totalPedidos}\n• Último pedido: ${lastOrder.items} (${new Date(lastOrder.date).toLocaleDateString('pt-BR')})\n• Total gasto: R$${customerProfile.totalSpent?.toFixed(2) || '0,00'}\n\n💡 DICA: Se cliente já comprou antes, seja receptivo tipo "Oi de novo!" ou "Que bom te ver por aqui!". NÃO mencione valores ou histórico diretamente (privacidade), apenas seja mais caloroso com clientes recorrentes.`
      } else if (isFirstContact) {
        systemMsg += `\n\n👋 Este é o PRIMEIRO CONTATO deste cliente! Seja extra simpático e receptivo.`
      }

      // Imagem sem legenda: só vira "[comprovante enviado]" se o bot tinha acabado de pedir
      let finalText = text
      if (text === '[imagem enviada]') {
        const hist = getHistory(senderNum, instanceName)
        const lastBot = [...hist].reverse().find(m => m.role === 'assistant')
        const botPediuComprovante = lastBot?.content &&
          (lastBot.content.includes('comprovante') ||
           lastBot.content.includes('📸') ||
           lastBot.content.includes('Pague via PIX'))
        if (botPediuComprovante) finalText = '[comprovante enviado]'
      }

      // Fast-path: responde saudações/promoções/horário/preços sem chamar LLM
      const quick = quickReply(finalText, senderName, promoText, products)
      if (quick) {
        pushHistory(senderNum, 'user', finalText, instanceName)
        pushHistory(senderNum, 'assistant', quick, instanceName)
        context.waitUntil(sendReply(senderNum, quick, instanceName))
        console.log(`wa-bot [CortaPrecos]: fast-path para ${senderNum}: ${quick.slice(0, 60)}`)
        return new Response('OK', { status: 200 })
      }

      pushHistory(senderNum, 'user', finalText, instanceName)
      rawReply = await askLLM(finalText, senderNum, systemMsg, instanceName)
      if (!rawReply) return new Response('OK', { status: 200 })

      // Extrai tags internas — <zs_pending> (passo 4) e <zs_delivery> (passo 5)
      const { clean: afterPending, pending: pendingData } = parsePendingTag(rawReply)
      const { clean: cpReply,      delivery }              = parseDeliveryTag(afterPending)

      let tagSaved = false
      if (delivery && delivery.address) {
        context.waitUntil(saveDeliveryOrder({ ...delivery, waName: senderName || delivery.name || senderNum }))
        console.log(`wa-bot [CortaPrecos]: delivery via tag para ${senderNum}:`, JSON.stringify(delivery))
        tagSaved = true
        // Limpa draft do blob — tag já salvou
        const bs = getStore({ name: 'corta-precos', consistency: 'strong' })
        bs.delete(`pending_delivery:${senderNum}`).catch(() => {})
      }

      // Fallback: LLM não emitiu <zs_delivery> mas comprovante chegou — usa draft do blob
      if (!tagSaved && finalText === '[comprovante enviado]') {
        const pending = await popPendingOrder(senderNum)
        if (pending) {
          context.waitUntil(saveDeliveryOrder({ ...pending, waName: senderName }))
          console.log(`wa-bot [CortaPrecos]: delivery via fallback blob para ${senderNum}:`, JSON.stringify(pending))
        }
      }

      // Se bot enviou msg de pagamento PIX (passo 4), persiste draft no blob com dados da <zs_pending> tag
      context.waitUntil(maybeStorePendingOrder(cpReply, senderNum, senderName, pendingData, instanceName))

      pushHistory(senderNum, 'assistant', cpReply, instanceName)
      context.waitUntil(sendReply(senderNum, cpReply, instanceName))
      console.log(`wa-bot [CortaPrecos]: respondeu ${senderNum}: ${cpReply.slice(0, 80)}`)

    } else if (isZara) {
      // ── MODO ZARA: bot de vendas do ZatendeStok ──────────────────────────
      const [leadProfile, existingMarket] = await Promise.all([
        loadLead(senderNum),
        findMarketByPhone(senderNum),
      ])

      let profileCtx

      if (existingMarket) {
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
      pushHistory(senderNum, 'user', text, instanceName)
      rawReply = await askLLM(text, senderNum, systemMsg, instanceName)
      if (!rawReply) return new Response('OK', { status: 200 })

      const { clean: reply, lead: extracted } = parseLeadTag(rawReply)
      pushHistory(senderNum, 'assistant', reply, instanceName)

      if (extracted && Object.keys(extracted).length) {
        await saveLead(senderNum, { ...leadProfile, ...extracted, waName: leadProfile.waName || senderName || null })
        console.log(`wa-bot: lead atualizado ${senderNum}:`, JSON.stringify(extracted))
      } else if (!leadProfile.waName && senderName) {
        await saveLead(senderNum, { waName: senderName, stage: leadProfile.stage || 'novo' })
      }

      context.waitUntil(sendReply(senderNum, reply, instanceName))
      console.log(`wa-bot [Zara]: respondeu ${senderNum}: ${reply.slice(0, 80)}`)

    } else {
      // ── MODO MERCADO: bot de atendimento ao cliente da loja ──────────────
      const marketProfile = await loadMarketProfile(instanceName)
      systemMsg = buildMarketPrompt(marketProfile)

      // Injeta nome do cliente se disponível
      if (senderName) {
        systemMsg += `\n\n📌 O cliente que está falando agora se chama *${senderName}*. Use o nome naturalmente.`
      }

      pushHistory(senderNum, 'user', text, instanceName)
      rawReply = await askLLM(text, senderNum, systemMsg, instanceName)
      if (!rawReply) return new Response('OK', { status: 200 })

      // Bot do mercado não usa <zs_lead> — resposta direta
      pushHistory(senderNum, 'assistant', rawReply, instanceName)
      context.waitUntil(sendReply(senderNum, rawReply, instanceName))
      console.log(`wa-bot [${instanceName}]: respondeu ${senderNum}: ${rawReply.slice(0, 80)}`)
    }

  } catch (err) {
    // Crédito OpenAI esgotado → resposta de fallback humanizada
    if (err instanceof OpenAIQuotaError) {
      console.error('wa-bot: OpenAI sem crédito — enviando fallback')
      let fallback
      if (isCortaPrecos) {
        // Fallback inteligente por palavras-chave quando OpenAI está sem crédito
        const t = text.toLowerCase()
        if (/promo|desconto|oferta|promoção/.test(t)) {
          fallback = `Oi${senderName ? ', ' + senderName.split(' ')[0] : ''}! 🔥 Passando pelas promoções agora temos os combos especiais!\nLiga pra gente no (15) 9979-6930 e a gente te conta tudo 😊`
        } else if (/entrega|delivery|manda|mandar|entreg/.test(t)) {
          fallback = `Oi${senderName ? ', ' + senderName.split(' ')[0] : ''}! 🛵 Fazemos entrega sim! Taxa fixa R$7,00, pagamento por PIX (CNPJ: 60.662.362/0001-70).\nMe manda o seu endereço + o que você quer pedir! 📦`
        } else if (/preço|valor|quanto|custa|custo|price/.test(t)) {
          fallback = `Oi${senderName ? ', ' + senderName.split(' ')[0] : ''}! 😊 Para consultar preços liga no (15) 9979-6930 ou passa aqui na loja — Corta Preços, Rua Capão Bonito 20, Itapeva-SP!`
        } else if (/hora|horário|abre|fecha|funcionamento/.test(t)) {
          fallback = `Oi${senderName ? ', ' + senderName.split(' ')[0] : ''}! ⏰ Nosso horário:\n• Segunda a Sábado: 9h às 19h\n• Domingo: 9h às 13h\n\nTe espero aqui! 😊`
        } else {
          fallback = `Oi${senderName ? ', ' + senderName.split(' ')[0] : ''}! 👋 Tô com uma instabilidade técnica agora, mas já resolvo.\nPode ligar direto: (15) 9979-6930 📱 Estamos aqui!`
        }
      } else if (isZara) {
        fallback = `Oi${senderName ? ', ' + senderName : ''}! 👋 Tô aqui sim — só tive um probleminha técnico agora.\nVou chamar o Pedro pra te atender direitinho. Já te retorno! 😊`
      } else {
        fallback = `Oi! Estamos com uma instabilidade agora, mas já resolvemos em breve. Obrigado pela paciência! 😊`
      }
      context.waitUntil(sendReply(senderNum, fallback, instanceName))
    } else {
      console.error('wa-bot error:', err.message)
    }
  }

  return new Response('OK', { status: 200 })
}

export const config = { path: '/wa-bot' }
