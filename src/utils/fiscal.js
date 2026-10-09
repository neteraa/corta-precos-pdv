// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📊 SISTEMA FISCAL NACIONAL - ZATENDESTOK
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
// Sistema flexível que funciona pra QUALQUER mercado do Brasil:
// - Campos fiscais OPCIONAIS (quem quer, preenche)
// - Alíquotas padrão por estado (se não preencher)
// - Cálculo automático de impostos
// - Não quebra nada que já funciona!
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ── ALÍQUOTAS DE ICMS POR ESTADO (2024) ──────────────────────────────
// Fonte: Confaz/Sefaz - Alíquota geral de cada estado
export const ICMS_POR_ESTADO = {
  'AC': 17, 'AL': 18, 'AP': 18, 'AM': 18, 'BA': 18,
  'CE': 18, 'DF': 18, 'ES': 17, 'GO': 17, 'MA': 18,
  'MT': 17, 'MS': 17, 'MG': 18, 'PA': 17, 'PB': 18,
  'PR': 18, 'PE': 18, 'PI': 18, 'RJ': 18, 'RN': 18,
  'RS': 18, 'RO': 17.5, 'RR': 17, 'SC': 17, 'SP': 18,
  'SE': 18, 'TO': 18
}

// ── REGIMES TRIBUTÁRIOS ──────────────────────────────────────────────
export const REGIMES = {
  simples: {
    nome: 'Simples Nacional',
    icms_destacado: false,    // Simples NÃO destaca ICMS na nota
    pis_destacado: false,     // PIS/COFINS inclusos no DAS
    cofins_destacado: false,
    info: 'Impostos aproximados inclusos conforme Simples Nacional'
  },
  presumido: {
    nome: 'Lucro Presumido',
    icms_destacado: true,
    pis_destacado: true,
    cofins_destacado: true,
    info: 'Tributos conforme Lucro Presumido'
  },
  real: {
    nome: 'Lucro Real',
    icms_destacado: true,
    pis_destacado: true,
    cofins_destacado: true,
    info: 'Tributos conforme Lucro Real'
  }
}

// ── CONFIGURAÇÃO FISCAL PADRÃO (se loja não configurar) ──────────────
export const FISCAL_DEFAULT = {
  estado: 'SP',
  regime: 'simples',
  mostrar_impostos_nota: false,  // Desligado por padrão (não quebra)
  icms_padrao: 18,
  pis_padrao: 0.65,
  cofins_padrao: 3.0,
}

// ── CALCULA IMPOSTOS DE UM ITEM ──────────────────────────────────────
/**
 * Calcula impostos de um item baseado em:
 * 1. Dados fiscais do produto (se tiver)
 * 2. Configuração da loja (se tiver)
 * 3. Defaults nacionais (fallback)
 * 
 * @param {object} item - { productId, qty, price, name }
 * @param {object} product - Produto completo (com dados fiscais opcionais)
 * @param {object} configFiscal - Configuração fiscal da loja (opcional)
 * @returns {object} { icms, pis, cofins, total, detalhes }
 */
export function calcularImpostosItem(item, product, configFiscal = {}) {
  // Merge config da loja com defaults
  const config = { ...FISCAL_DEFAULT, ...configFiscal }
  const regime = REGIMES[config.regime] || REGIMES.simples
  
  const subtotal = item.qty * item.price
  
  // Se Simples Nacional → impostos aproximados (não destacados)
  if (config.regime === 'simples') {
    // Simples Nacional: aproximadamente 5-15% dependendo da faixa
    // Usamos 8% como estimativa média
    const totalAproximado = subtotal * 0.08
    
    return {
      icms: 0,
      pis: 0,
      cofins: 0,
      total: totalAproximado,
      aproximado: true,
      detalhes: {
        info: regime.info,
        percentual: 8.0,
        destacado: false
      }
    }
  }
  
  // Lucro Presumido ou Real → calcula cada imposto
  const aliqICMS = product?.icms_aliquota ?? config.icms_padrao
  const aliqPIS = product?.pis_aliquota ?? config.pis_padrao
  const aliqCOFINS = product?.cofins_aliquota ?? config.cofins_padrao
  
  const icms = (subtotal * aliqICMS) / 100
  const pis = (subtotal * aliqPIS) / 100
  const cofins = (subtotal * aliqCOFINS) / 100
  
  return {
    icms,
    pis,
    cofins,
    total: icms + pis + cofins,
    aproximado: false,
    detalhes: {
      info: regime.info,
      aliquotas: {
        icms: aliqICMS,
        pis: aliqPIS,
        cofins: aliqCOFINS
      },
      destacado: true
    }
  }
}

// ── CALCULA IMPOSTOS DE UMA VENDA COMPLETA ───────────────────────────
/**
 * Calcula impostos totais de todos itens da venda
 * 
 * @param {array} items - Array de itens da venda
 * @param {array} products - Array de produtos (pra pegar dados fiscais)
 * @param {object} configFiscal - Config fiscal da loja
 * @returns {object} { icms, pis, cofins, total, itens, aproximado }
 */
export function calcularImpostosVenda(items, products, configFiscal = {}) {
  const config = { ...FISCAL_DEFAULT, ...configFiscal }
  
  // Se desligado, retorna zerado
  if (!config.mostrar_impostos_nota) {
    return {
      icms: 0,
      pis: 0,
      cofins: 0,
      total: 0,
      itens: [],
      mostrar: false
    }
  }
  
  let totalICMS = 0
  let totalPIS = 0
  let totalCOFINS = 0
  let aproximado = false
  const detalhesItens = []
  
  items.forEach(item => {
    const product = products.find(p => p.id === item.productId)
    const impostos = calcularImpostosItem(item, product, config)
    
    totalICMS += impostos.icms
    totalPIS += impostos.pis
    totalCOFINS += impostos.cofins
    
    if (impostos.aproximado) aproximado = true
    
    detalhesItens.push({
      productId: item.productId,
      name: item.name,
      ...impostos
    })
  })
  
  return {
    icms: totalICMS,
    pis: totalPIS,
    cofins: totalCOFINS,
    total: totalICMS + totalPIS + totalCOFINS,
    itens: detalhesItens,
    aproximado,
    mostrar: true,
    regime: config.regime
  }
}

// ── FORMATA VALOR FISCAL (BRL) ───────────────────────────────────────
export function formatarValorFiscal(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(valor)
}

// ── TEXTO INFORMATIVO SOBRE IMPOSTOS (pra nota) ──────────────────────
export function getTextoImpostosNota(impostos) {
  if (!impostos.mostrar) return null
  
  if (impostos.aproximado) {
    // Simples Nacional
    const percentual = ((impostos.total / (impostos.total + 100)) * 100).toFixed(1)
    return {
      titulo: 'TRIBUTOS APROXIMADOS',
      linhas: [
        `Valor aproximado: ${formatarValorFiscal(impostos.total)}`,
        'Conforme Lei 12.741/2012 (Simples Nacional)'
      ]
    }
  }
  
  // Lucro Presumido/Real
  return {
    titulo: 'TRIBUTOS',
    linhas: [
      `ICMS: ${formatarValorFiscal(impostos.icms)}`,
      `PIS: ${formatarValorFiscal(impostos.pis)}`,
      `COFINS: ${formatarValorFiscal(impostos.cofins)}`,
      `TOTAL: ${formatarValorFiscal(impostos.total)}`
    ]
  }
}
