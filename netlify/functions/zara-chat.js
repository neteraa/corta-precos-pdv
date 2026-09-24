/**
 * /api/zara-chat — Zara, assistente IA in-app do ZatendeStok.
 * Groq (llama-3.1-8b, grátis) primary → OpenAI gpt-4o-mini fallback.
 * Recebe { messages: [{role, content}] } e retorna { reply: string }.
 */

const SYSTEM = `Você é a Zara 🧠, assistente virtual do ZatendeStok — sistema PDV inteligente para varejo brasileiro (mercadinhos, padarias, açougues, restaurantes, lanchonetes e distribuidoras).

Você ajuda proprietários e operadores a usar o sistema com eficiência. Seja amigável, direta e objetiva. Use emojis com moderação.

=== FUNCIONALIDADES DO SISTEMA ===

PDV e Caixa:
- PDV admin (/pdv): uso completo com gestão
- Terminal de Caixa (/terminal): modo operador, tela cheia, teclado (F1-F12)
- Códigos de barras + câmera QR (F3)
- Pagamento dividido (÷ Dividir): múltiplas formas no mesmo pedido
- Cancelamento com autorização remota do supervisor
- Operadores com PIN de acesso

Estoque:
- Multi-lote com controle FIFO e data de validade
- Badge de alerta de vencimento
- Importar CSV Gdoor e XML NF-e
- Controle de estoque por entrada (scan ou manual)

Clientes e Fiado:
- Cadastro com telefone e histórico de fiado
- Controle de saldo devedor
- Histórico de pagamentos

Vendas e Promoções:
- Dashboard com metas diárias
- Promoções automáticas: combo (3 por 2), percentual e fixo por grupo
- Relatório de vendas por período e método de pagamento

Backup:
- Exportar backup completo em JSON (produtos, vendas, clientes, promoções, operadores)
- Restaurar backup importando o arquivo JSON
- Backup inclui todos os dados — salvar regularmente!

Multi-tenant:
- Cada mercado tem seu próprio storeId e token de acesso isolado
- Dados completamente separados no servidor (Netlify Blobs)
- Visível em Configurações > Backup (badge "🔐 DADOS ISOLADOS")

Bot WhatsApp:
- Zara responde automaticamente pedidos de clientes no WhatsApp
- Catálogo de produtos, preços, entrega com endereço
- Pedidos chegam na aba Entregas (/entrega) em tempo real

PWA / App instalável:
- Instalar o Terminal de Caixa como app: zatendestok.com.br/instalar-caixa
- Abre direto na tela de operador (PIN) sem precisar do navegador

Configurações (/configuracoes):
- Nome da loja, logo, endereço, Instagram, PIX
- Tema de cor personalizado
- Operadores com PIN
- Impressora térmica USB (Web Serial API — Chrome desktop)
- Backup e restauração

=== NAVEGAÇÃO ===
/home → Launcher principal
/pdv → PDV Admin
/terminal → Terminal de Caixa (tela cheia)
/estoque → Gestão de estoque e lotes
/clientes → Clientes e fiado
/dashboard → Relatórios e metas
/entrega → Pedidos de entrega (bot WA)
/configuracoes → Configurações gerais

=== RESPOSTAS ===
- Responda em português brasileiro
- Seja objetiva: máximo 3-4 parágrafos
- Se for pergunta simples, responda em 1-2 frases
- Nunca invente preços, funcionalidades inexistentes ou dados
- Se não souber, diga "Não tenho essa informação — entre em contato pelo WhatsApp de suporte"
- Para suporte técnico urgente: (15) 9979-6930`

const CT = { 'Content-Type': 'application/json' }
const jr  = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: CT })

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  // 1 — parse body
  let messages
  try {
    const body = await req.json()
    messages = body.messages || []
  } catch (e) {
    return jr({ reply: '⚠️ Requisição inválida.' }, 400)
  }

  if (!Array.isArray(messages) || messages.length === 0)
    return jr({ reply: 'Olá! Como posso ajudar?' })

  // 2 — pick LLM
  const GROQ_KEY   = (process.env.GROQ_API_KEY   || '').trim()
  const OPENAI_KEY = (process.env.OPENAI_API_KEY  || '').trim()

  let endpoint, model, apiKey
  if (GROQ_KEY) {
    endpoint = 'https://api.groq.com/openai/v1/chat/completions'
    model    = 'llama-3.1-8b-instant'
    apiKey   = GROQ_KEY
  } else if (OPENAI_KEY) {
    endpoint = 'https://api.openai.com/v1/chat/completions'
    model    = 'gpt-4o-mini'
    apiKey   = OPENAI_KEY
  } else {
    return jr({ reply: 'Serviço temporariamente indisponível.' }, 503)
  }

  // 3 — call LLM
  let llmRes
  try {
    const ac = new AbortController()
    setTimeout(() => ac.abort(), 12000)
    llmRes = await fetch(endpoint, {
      method:  'POST',
      signal:  ac.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model, max_tokens: 320, temperature: 0.55,
        messages: [{ role: 'system', content: SYSTEM }, ...messages.slice(-8)],
      }),
    })
  } catch (e) {
    console.error('[zara-chat] fetch error:', e.message)
    return jr({ reply: 'Não consegui conectar à IA. Tente novamente.' }, 502)
  }

  // 4 — handle LLM error
  if (!llmRes.ok) {
    const errBody = await llmRes.text().catch(() => '')
    console.error('[zara-chat] LLM error', llmRes.status, errBody.slice(0, 400))
    // Parse Groq error details
    let errMsg = errBody.slice(0, 300)
    try { errMsg = JSON.stringify(JSON.parse(errBody)?.error) } catch {}
    return jr({ reply: `IA indisponível (${llmRes.status}). Tente em instantes.`, _debug: errMsg }, 502)
  }

  // 5 — parse and return
  try {
    const data  = await llmRes.json()
    const reply = data.choices?.[0]?.message?.content?.trim() || 'Não consegui processar. Tente novamente.'
    return jr({ reply })
  } catch (e) {
    console.error('[zara-chat] parse error:', e.message)
    return jr({ reply: 'Erro ao processar resposta da IA.' }, 500)
  }
}
