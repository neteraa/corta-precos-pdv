/**
 * /api/barcode-lookup?ean={EAN}
 *
 * Cadeia de fontes para enriquecer dados de produto pelo EAN:
 *   1. Cache Netlify Blobs (7 dias) — resposta instantânea
 *   2. Cosmos Bluesoft (COSMOS_TOKEN env var) — melhor cobertura BR
 *   3. Open Food Facts — base mundial gratuita
 *
 * Retorna: { name, brand, quantity, category, imageUrl } | { error }
 */

import { getStore } from '@netlify/blobs'

const CACHE_TTL_MS  = 7 * 24 * 60 * 60 * 1000   // 7 dias
const COSMOS_URL    = 'https://api.cosmos.bluesoft.com.br/gtins'
const OFF_URL       = 'https://world.openfoodfacts.org/api/v2/product'

/* ── Cosmos Bluesoft ─────────────────────────────────────────── */
async function fromCosmos(ean) {
  const token = process.env.COSMOS_TOKEN
  if (!token) return null

  try {
    const res = await fetch(`${COSMOS_URL}/${ean}`, {
      headers: { 'X-Cosmos-Token': token, 'User-Agent': 'ZatendeStok/1.0' },
      signal: AbortSignal.timeout(6000),
    })
    if (res.status === 404 || res.status === 422) return null
    if (!res.ok) return null

    const d = await res.json()
    if (!d || !d.description) return null

    const name     = (d.description || '').trim()
    const brand    = (d.brand?.name || d.gtins?.[0]?.brand?.name || '').trim()
    const quantity = [(d.net_weight || ''), (d.commercial_unit || '')].filter(Boolean).join(' ').trim()
    const category = (d.ncm?.description || d.gtins?.[0]?.product_category?.description || '').trim()
    const imageUrl = d.thumbnail || d.image || null

    if (!name) return null
    return { source: 'cosmos', name, brand, quantity, category, imageUrl }
  } catch {
    return null
  }
}

/* ── Open Food Facts ─────────────────────────────────────────── */
async function fromOFF(ean) {
  const fields = [
    'product_name', 'product_name_pt', 'product_name_pt_BR',
    'generic_name', 'generic_name_pt',
    'abbreviated_product_name',
    'brands',
    'quantity', 'product_quantity', 'product_quantity_unit',
    'categories_tags',
    'image_front_small_url', 'image_small_url', 'image_front_url', 'image_url',
  ].join(',')

  try {
    const res = await fetch(`${OFF_URL}/${ean}.json?fields=${fields}`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null

    const data = await res.json()
    if (data.status !== 1 || !data.product) return null

    const p = data.product

    // Nome: prioridade PT-BR → PT → genérico PT → genérico → EN
    const rawName = (
      p.product_name_pt_BR ||
      p.product_name_pt    ||
      p.generic_name_pt    ||
      p.product_name       ||
      p.generic_name       ||
      p.product_name_en    ||
      ''
    ).trim()

    if (!rawName) return null

    // Marca: primeiro nome antes da vírgula
    const brand = (p.brands || '').split(',')[0].trim()

    // Quantidade/peso: limpa espaços extras
    const quantity = (p.quantity || '').trim()
      .replace(/\s+/g, ' ')
      .replace(/(\d)\s+(g|kg|ml|l|L|G|KG|ML)\b/i, '$1 $2')

    // Categoria: pegar a tag mais específica em PT primeiro
    const catTags  = p.categories_tags || []
    const catTag   = catTags.find(t => t.startsWith('pt:')) ||
                     catTags.find(t => t.startsWith('en:')) || ''
    const category = catTag.replace(/^(pt:|en:)/, '').replace(/-/g, ' ')

    const imageUrl = p.image_front_small_url || p.image_small_url ||
                     p.image_front_url        || p.image_url       || null

    return { source: 'off', name: rawName, brand, quantity, category, imageUrl }
  } catch {
    return null
  }
}

/* ── Monta nome final de exibição ───────────────────────────── */
function buildDisplayName(info) {
  let { name, brand, quantity } = info

  // Remove marca duplicada no nome (case-insensitive)
  if (brand) {
    const brandLow = brand.toLowerCase()
    if (!name.toLowerCase().includes(brandLow)) {
      name = `${name} ${brand}`
    }
  }

  // Appende tamanho/volume se não estiver no nome
  if (quantity) {
    const qLow = quantity.toLowerCase().replace(/\s/g, '')
    if (!name.toLowerCase().replace(/\s/g, '').includes(qLow)) {
      name = `${name} ${quantity}`
    }
  }

  return name.toUpperCase().trim()
}

/* ── Handler ─────────────────────────────────────────────────── */
export default async (req) => {
  const url = new URL(req.url)
  const ean = (url.searchParams.get('ean') || '').replace(/\D/g, '')

  if (ean.length < 8) {
    return new Response(JSON.stringify({ error: 'EAN inválido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }

  const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=86400' }

  // ── Cache ──────────────────────────────────────────────────────
  let store
  try {
    store = getStore('barcode-cache')
    const cached = await store.getWithMetadata(ean)
    if (cached?.metadata?.ts && Date.now() - cached.metadata.ts < CACHE_TTL_MS) {
      return new Response(cached.data, { headers: { ...CORS, 'X-Cache': 'HIT' } })
    }
  } catch { /* blob store indisponível — continua sem cache */ }

  // ── Busca nas fontes ───────────────────────────────────────────
  const info = (await fromCosmos(ean)) || (await fromOFF(ean))

  if (!info) {
    return new Response(JSON.stringify({ error: 'Produto não encontrado na base' }), {
      status: 404, headers: CORS,
    })
  }

  const displayName = buildDisplayName(info)

  const result = {
    name:      displayName,
    nameRaw:   info.name,
    brand:     info.brand,
    quantity:  info.quantity,
    category:  info.category,
    imageUrl:  info.imageUrl,
    source:    info.source,
  }

  const body = JSON.stringify(result)

  // ── Grava cache ────────────────────────────────────────────────
  try {
    if (store) await store.set(ean, body, { metadata: { ts: Date.now() } })
  } catch { /* cache write failure — não fatal */ }

  return new Response(body, { headers: { ...CORS, 'X-Cache': 'MISS' } })
}

export const config = { path: '/api/barcode-lookup' }
