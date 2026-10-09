// TESTE IMEDIATO: Simula como o bot vai responder sobre promoções (SEM CACHE!)
const { getStore } = require('@netlify/blobs')

const CORTA_PRECOS_STORE_ID = 'cortaprecos'

exports.handler = async (event) => {
  try {
    const store = getStore({ name: 'corta-precos', consistency: 'strong', siteID: process.env.SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN })
    
    // Carrega DIRETO do blob (sem cache!)
    const [prodRaw, promoRaw] = await Promise.all([
      store.get(`${CORTA_PRECOS_STORE_ID}:cp_products`, { type: 'text' }).catch(() => null),
      store.get(`${CORTA_PRECOS_STORE_ID}:cp_promos`, { type: 'text' }).catch(() => null),
    ])
    
    const products = prodRaw ? JSON.parse(prodRaw) : []
    const promos = promoRaw ? JSON.parse(promoRaw) : []
    
    // Aplica a MESMA lógica do bot (copia exata!)
    const promoLines = promos
      .filter(pr => pr.active)
      .map(pr => {
        const promoProducts = products.filter(p => p.promoGroup === pr.group && p.price > 0)
        
        if (promoProducts.length === 0) {
          return null
        }
        
        const type = pr.type || 'combo'
        const price = pr.totalPrice?.toFixed(2).replace('.', ',') || '0,00'
        
        // MIX AND MATCH: 2+ produtos
        if (promoProducts.length >= 2) {
          const firstProductCat = promoProducts[0].category || 'produtos'
          const categoryName = firstProductCat.toLowerCase()
          
          return `🔥 Leve ${pr.qty} ${categoryName} variados: R$${price}`
        }
        
        // PRODUTO ESPECÍFICO: 1 produto
        const productName = promoProducts[0].name
        
        if (type === 'combo') {
          return `🔥 ${pr.qty} ${productName}: R$${price}`
        }
        
        if (type === 'percent' && pr.discountPct) {
          return `🔥 ${pr.qty} ${productName}: ${pr.discountPct}% OFF`
        }
        
        if (type === 'fixed' && pr.discountAmt) {
          return `🔥 ${pr.qty} ${productName}: R$${pr.discountAmt.toFixed(2).replace('.', ',')} OFF`
        }
        
        return `🔥 ${pr.qty} ${productName}: R$${price}`
      })
      .filter(line => line !== null)
    
    const hasActivePromos = promos.filter(pr => pr.active).length > 0
    let finalPromoText = promoLines.join('\n')
    
    if (!finalPromoText) {
      if (hasActivePromos) {
        finalPromoText = 'Estamos atualizando nossas promoções. Em breve teremos novidades! 🔥'
      } else {
        finalPromoText = 'No momento não temos promoções ativas, mas nossos preços são sempre os melhores! 😊'
      }
    }
    
    // Monta resposta EXATA que o bot vai dar
    const botResponse = `Oi! Temos várias ofertas hoje! 🔥\n\n${finalPromoText}\n\n🛵 Quer aproveitar? Me passa seu endereço!`
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: `═══════════════════════════════════════════
🤖 TESTE DO BOT - RESPOSTA EXATA
═══════════════════════════════════════════

Cliente pergunta: "tem promoção?"

Bot responde:
───────────────────────────────────────────
${botResponse}
───────────────────────────────────────────

📊 ESTATÍSTICAS:
• Total de promoções: ${promos.length}
• Promoções ativas: ${promos.filter(pr => pr.active).length}
• Promoções com produtos: ${promoLines.length}
• Total de produtos: ${products.length}

✅ Deploy: v1791407533328
⏱️ Testado em: ${new Date().toLocaleString('pt-BR')}

═══════════════════════════════════════════

${promoLines.length > 0 ? '✅ TÁ FUNCIONANDO!' : '⚠️ NENHUMA PROMOÇÃO COM PRODUTOS VINCULADOS!'}
`
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/plain' },
      body: `❌ ERRO: ${error.message}\n\nEntre em contato com suporte!`
    }
  }
}
