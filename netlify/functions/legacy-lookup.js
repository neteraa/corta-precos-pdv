/**
 * GET /api/legacy-lookup?code=BARCODE&q=NOME
 *
 * Busca produtos na base legada do Corta Preços (storeId cortaprecos_1789770018182)
 * como fallback de pesquisa — somente leitura, sem autenticação.
 *
 * Parâmetros (pelo menos um):
 *   code — código de barras / SKU (busca exata)
 *   q    — texto para busca por nome (fuzzy, até 15 resultados)
 *
 * Retorna: { ok: true, products: [...] }
 */

import { getStore } from '@netlify/blobs'

const LEGACY_STORE_ID = 'cortaprecos_1789770018182'
const BLOB_NAMESPACE  = 'corta-precos'
const BLOB_KEY        = `${LEGACY_STORE_ID}:cp_products`
const CACHE_TTL_MS    = 10 * 60 * 1000   // 10 min cache in memory

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, max-age=600',
}

// In-memory cache (lives for the duration of the function container)
let _cache = null
let _cacheAt = 0

async function getProducts() {
  if (_cache && Date.now() - _cacheAt < CACHE_TTL_MS) return _cache
  const store = getStore(BLOB_NAMESPACE)
  const raw   = await store.get(BLOB_KEY).catch(() => null)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    _cache   = Array.isArray(parsed) ? parsed : []
    _cacheAt = Date.now()
    return _cache
  } catch {
    return []
  }
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS })

  const url   = new URL(req.url)
  const code  = (url.searchParams.get('code') || '').trim()
  const query = (url.searchParams.get('q')    || '').trim().toLowerCase()

  if (!code && !query) {
    return new Response(JSON.stringify({ ok: false, error: 'Informe code ou q' }), { status: 400, headers: CORS })
  }

  try {
    const products = await getProducts()

    let results
    if (code) {
      // Busca exata por barcode / sku (sem zeros à esquerda)
      const stripped = code.replace(/^0+/, '') || code
      results = products.filter(p =>
        p.barcode === code || p.sku === code ||
        (p.barcode || '').replace(/^0+/, '') === stripped ||
        (p.sku     || '').replace(/^0+/, '') === stripped
      ).slice(0, 5)
    } else {
      // Busca fuzzy por nome
      results = products
        .filter(p => p.name && p.name.toLowerCase().includes(query))
        .sort((a, b) => {
          // Produtos que começam com a query vêm primeiro
          const aStarts = a.name.toLowerCase().startsWith(query)
          const bStarts = b.name.toLowerCase().startsWith(query)
          if (aStarts !== bStarts) return aStarts ? -1 : 1
          return a.name.localeCompare(b.name)
        })
        .slice(0, 15)
    }

    // Retorna apenas campos seguros (sem IDs internos)
    const safe = results.map(({ name, price, cost, category, unit, barcode, sku }) => ({
      name, price, cost, category, unit, barcode, sku,
      source: 'legacy',
    }))

    return new Response(JSON.stringify({ ok: true, products: safe }), { headers: CORS })

  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: CORS })
  }
}

export const config = { path: '/api/legacy-lookup' }
