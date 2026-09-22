/**
 * GET /api/priceref?name=Coca-Cola+2L&ean=7894900011630&storeId=STORE_ID
 *
 * Retorna a cadeia de preço cruzando dados de estoque, ofertas e PDV.
 * Os dados do PDV são tenant-scoped quando storeId é informado.
 */
import { getStore } from '@netlify/blobs'

function normalize(s = '') {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

function score(a, b) {
  const wa = normalize(a).split(' ').filter(Boolean)
  const wb = normalize(b).split(' ').filter(Boolean)
  const hits = wa.filter(w => w.length >= 3 && wb.some(x => x.includes(w) || w.includes(x)))
  return hits.length / Math.max(wa.length, 1)
}

async function readJson(store, key) {
  const raw = await store.get(key, { type: 'text' })
  return raw ? JSON.parse(raw) : []
}

export default async (req) => {
  const url = new URL(req.url)
  const name = url.searchParams.get('name') || ''
  const ean = url.searchParams.get('ean') || ''
  const storeId = url.searchParams.get('storeId') || 'default'

  if (!name && !ean) {
    return new Response(JSON.stringify({ error: 'name or ean required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const store = getStore('corta-precos')
    const [estoque, offers, prods] = await Promise.all([
      readJson(store, 'cp_fornecedor_estoque'),
      readJson(store, 'cp_supplier_offers'),
      readJson(store, storeId === 'default' ? 'cp_products' : `${storeId}:cp_products`),
    ])

    const offer = offers.find(o =>
      (ean && (o.sku === ean || o.barcode === ean)) || score(o.productName, name) >= 0.4
    ) || null

    const stock = estoque.find(e =>
      (ean && (e.sku === ean || e.barcode === ean)) || score(e.productName, name) >= 0.4
    ) || null

    const lookup = name || offer?.productName || stock?.productName || ''
    let bestProd = null
    let bestScore = 0
    for (const p of prods) {
      if (ean && (p.sku === ean || p.barcode === ean)) {
        bestProd = p
        bestScore = 1
        break
      }
      const s = score(p.name, lookup)
      if (s > bestScore) { bestScore = s; bestProd = p }
    }
    const pdvProd = bestScore >= 0.35 ? bestProd : null

    const cost = stock?.cost ?? offer?.cost ?? null
    const offerPrice = offer?.offerPrice ?? null
    const retailPrice = pdvProd?.price ?? null
    const retailCost = pdvProd?.cost ?? null
    const costMarkup = cost && offerPrice ? +((offerPrice / cost - 1) * 100).toFixed(1) : null
    const retailMarkup = offerPrice && retailPrice ? +((retailPrice / offerPrice - 1) * 100).toFixed(1) : null
    const totalMarkup = cost && retailPrice ? +((retailPrice / cost - 1) * 100).toFixed(1) : null

    return new Response(JSON.stringify({
      cost, offerPrice, retailPrice, retailCost,
      costMarkup, retailMarkup, totalMarkup,
      offLabel: offer?.productName || null,
      retailName: pdvProd?.name || null,
      stockName: stock?.productName || null,
      found: cost !== null || offerPrice !== null || retailPrice !== null,
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

export const config = { path: '/api/priceref' }
