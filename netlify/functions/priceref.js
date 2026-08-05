/**
 * GET /api/priceref?name=Coca-Cola+2L&ean=7894900011630
 *
 * Retorna a cadeia de preço completa cruzando dados da rede:
 *   cost         → o que o distribuidor pagou (estoque)
 *   offerPrice   → o que o distribuidor cobra do mercado (ofertas)
 *   retailPrice  → o que o mercado cobra do consumidor (PDV)
 *   offLabel     → nome do produto nas ofertas
 *   retailName   → nome do produto no PDV (pode diferir levemente)
 *
 * Zero dependência externa. Dados 100% da nossa rede.
 */
import { getStore } from '@netlify/blobs'

function normalize(s = '') {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // remove acentos
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

function score(a, b) {
  const wa = normalize(a).split(' ').filter(Boolean)
  const wb = normalize(b).split(' ').filter(Boolean)
  // conta quantas palavras significativas (3+ chars) coincidem
  const hits = wa.filter(w => w.length >= 3 && wb.some(x => x.includes(w) || w.includes(x)))
  return hits.length / Math.max(wa.length, 1)
}

export default async (req) => {
  const url    = new URL(req.url)
  const name   = url.searchParams.get('name') || ''
  const ean    = url.searchParams.get('ean')  || ''

  if (!name && !ean) {
    return new Response(JSON.stringify({ error: 'name or ean required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const store = getStore('corta-precos')
    const [rawEst, rawOff, rawProds] = await Promise.all([
      store.get('cp_fornecedor_estoque', { type: 'text' }),
      store.get('cp_supplier_offers',    { type: 'text' }),
      store.get('cp_products',           { type: 'text' }),
    ])

    const estoque = rawEst  ? JSON.parse(rawEst)  : []
    const offers  = rawOff  ? JSON.parse(rawOff)  : []
    const prods   = rawProds ? JSON.parse(rawProds) : []

    /* ── find in offers by name / ean ── */
    const offer = offers.find(o =>
      (ean && o.sku === ean) || score(o.productName, name) >= 0.4
    ) || null

    /* ── find in estoque by name / ean ── */
    const stock = estoque.find(e =>
      (ean && e.sku === ean) || score(e.productName, name) >= 0.4
    ) || null

    /* ── find in PDV products by name / ean ── */
    const lookup = name || offer?.productName || stock?.productName || ''
    let bestProd = null, bestScore = 0
    for (const p of prods) {
      if (ean && (p.sku === ean || p.barcode === ean)) { bestProd = p; break }
      const s = score(p.name, lookup)
      if (s > bestScore) { bestScore = s; bestProd = p }
    }
    const pdvProd = bestScore >= 0.35 ? bestProd : null

    /* ── build price chain ── */
    const cost        = stock?.cost        ?? offer?.cost   ?? null
    const offerPrice  = offer?.offerPrice  ?? null
    const retailPrice = pdvProd?.price     ?? null
    const retailCost  = pdvProd?.cost      ?? null   // what market paid (should ≈ offerPrice)

    const costMarkup   = cost && offerPrice ? +((offerPrice / cost - 1) * 100).toFixed(1) : null
    const retailMarkup = offerPrice && retailPrice ? +((retailPrice / offerPrice - 1) * 100).toFixed(1) : null
    const totalMarkup  = cost && retailPrice ? +((retailPrice / cost - 1) * 100).toFixed(1) : null

    return new Response(JSON.stringify({
      // core data
      cost, offerPrice, retailPrice, retailCost,
      // markup %
      costMarkup, retailMarkup, totalMarkup,
      // source labels
      offLabel:   offer?.productName   || null,
      retailName: pdvProd?.name        || null,
      stockName:  stock?.productName   || null,
      // meta
      found: !!(cost || offerPrice || retailPrice),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
}
