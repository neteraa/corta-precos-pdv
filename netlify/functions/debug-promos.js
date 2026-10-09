// DEBUG: Endpoint pra ver o que o bot tá carregando de promoções
const { getStore } = require('@netlify/blobs')

const CORTA_PRECOS_STORE_ID = '1789770018182'

exports.handler = async (event) => {
  try {
    const store = getStore({ name: 'corta-precos', consistency: 'strong' })
    
    // Carrega promoções
    const promoRaw = await store.get(`cortaprecos_${CORTA_PRECOS_STORE_ID}:cp_promos`, { type: 'text' }).catch(() => null)
    const promos = promoRaw ? JSON.parse(promoRaw) : []
    
    // Carrega produtos
    const prodRaw = await store.get(`cortaprecos_${CORTA_PRECOS_STORE_ID}:cp_products`, { type: 'text' }).catch(() => null)
    const products = prodRaw ? JSON.parse(prodRaw) : []
    
    // Filtra promoções ativas
    const activePromos = promos.filter(pr => pr.active)
    
    // Para cada promoção, mostra quais produtos tão vinculados
    const debug = activePromos.map(pr => {
      const linkedProducts = products.filter(p => p.promoGroup === pr.group && p.price > 0)
      
      return {
        id: pr.id,
        name: pr.name,
        group: pr.group,
        active: pr.active,
        type: pr.type,
        qty: pr.qty,
        totalPrice: pr.totalPrice,
        discountPct: pr.discountPct,
        discountAmt: pr.discountAmt,
        linkedProductsCount: linkedProducts.length,
        linkedProducts: linkedProducts.map(p => ({
          name: p.name,
          promoGroup: p.promoGroup,
          price: p.price
        }))
      }
    })
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        totalPromos: promos.length,
        activePromos: activePromos.length,
        totalProducts: products.length,
        productsWithPromoGroup: products.filter(p => p.promoGroup).length,
        debug,
        // Mostra também como o bot tá montando o texto
        botOutput: buildPromoText(products, activePromos)
      }, null, 2)
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    }
  }
}

// Copia a mesma lógica do bot
function buildPromoText(products, promos) {
  const promoLines = promos
    .filter(pr => pr.active)
    .map(pr => {
      const promoProducts = products.filter(p => p.promoGroup === pr.group && p.price > 0)
      
      if (promoProducts.length === 0) {
        return null
      }
      
      const productName = promoProducts[0].name
      const type = pr.type || 'combo'
      
      if (type === 'combo' && pr.totalPrice) {
        return `🔥 ${pr.qty} ${productName}: R$${pr.totalPrice.toFixed(2).replace('.', ',')}`
      }
      
      if (type === 'percent' && pr.discountPct) {
        return `🔥 ${pr.qty} unid ${productName}: ${pr.discountPct}% OFF`
      }
      
      if (type === 'fixed' && pr.discountAmt) {
        return `🔥 ${pr.qty} unid ${productName}: R$${pr.discountAmt.toFixed(2).replace('.', ',')} OFF`
      }
      
      return `🔥 ${pr.qty} ${productName}: R$${pr.totalPrice?.toFixed(2).replace('.', ',') || '0,00'}`
    })
    .filter(line => line !== null)
  
  return {
    promoText: promoLines.join('\n') || 'Nenhuma promoção ativa no momento.',
    linesCount: promoLines.length
  }
}
