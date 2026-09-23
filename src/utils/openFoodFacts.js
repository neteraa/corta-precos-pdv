/* ── Open Food Facts auto-photo fetch ────────────────────────
   CORS: images.openfoodfacts.org retorna Access-Control-Allow-Origin: *
   → podemos carregar em canvas, comprimir e salvar no IndexedDB.

   Rate limit sugerido pelo OFF: sem limite explícito, mas respeitamos
   com CONCURRENCY = 4 requests paralelos.
──────────────────────────────────────────────────────────── */

const OFF_API     = 'https://world.openfoodfacts.org/api/v2/product'
const CONCURRENCY = 4     // requests paralelos simultâneos
const SIZE_PX     = 280   // tamanho máximo do lado maior após compressão
const QUALITY     = 0.80  // JPEG quality

/* ── busca informações completas de um produto pelo EAN ──────
   Tenta o proxy server-side (/api/barcode-lookup) que agrega
   Cosmos Bluesoft + Open Food Facts com cache em Blobs.
   Fallback direto ao OFF se o proxy falhar (dev local sem netlify dev).
───────────────────────────────────────────────────────────── */
export async function fetchProductInfo(barcode) {
  const clean = String(barcode || '').replace(/\D/g, '')
  if (clean.length < 8) return null

  // ── 1. Base legada Corta Preços (produto idêntico com preço real) ────
  try {
    const res = await fetch(`/api/legacy-lookup?code=${clean}`, {
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) {
      const d = await res.json()
      if (d?.ok && d.products?.length > 0) {
        const p = d.products[0]
        if (p.name) {
          return {
            name:      p.name,
            brand:     '',
            quantity:  '',
            category:  p.category || '',
            imageUrl:  null,
            price:     p.price   || 0,   // preço real da base legada
            cost:      p.cost    || 0,
            unit:      p.unit    || 'UN',
            fromLegacy: true,
          }
        }
      }
    }
  } catch { /* base legada indisponível */ }

  // ── 2. Proxy Netlify (Cosmos + OFF + cache) ───────────────
  try {
    const res = await fetch(`/api/barcode-lookup?ean=${clean}`, {
      signal: AbortSignal.timeout(9000),
    })
    if (res.ok) {
      const d = await res.json()
      if (d?.name) return { name: d.name, brand: d.brand || '', quantity: d.quantity || '', category: d.category || '', imageUrl: d.imageUrl || null, price: 0, cost: 0, unit: 'UN' }
    }
  } catch { /* proxy indisponível em dev local — usa OFF direto */ }

  // ── 3. Fallback: Open Food Facts direto (sem proxy) ───────
  return fetchProductInfoDirect(clean)
}

/* ── acesso direto ao OFF (dev local / fallback) ─────────── */
async function fetchProductInfoDirect(clean) {
  const fields = [
    'product_name','product_name_pt','product_name_pt_BR',
    'generic_name','generic_name_pt',
    'brands','quantity',
    'categories_tags',
    'image_front_small_url','image_small_url','image_front_url','image_url',
  ].join(',')

  try {
    const res = await fetch(`${OFF_API}/${clean}.json?fields=${fields}`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (data.status !== 1 || !data.product) return null

    const p = data.product

    const rawName = (
      p.product_name_pt_BR || p.product_name_pt ||
      p.generic_name_pt    || p.product_name    ||
      p.generic_name       || ''
    ).trim()
    if (!rawName) return null

    const brand    = (p.brands || '').split(',')[0].trim()
    const quantity = (p.quantity || '').trim()

    // Monta nome completo com marca e tamanho
    let name = rawName
    if (brand && !name.toLowerCase().includes(brand.toLowerCase())) name = `${name} ${brand}`
    if (quantity && !name.toLowerCase().replace(/\s/g, '').includes(quantity.toLowerCase().replace(/\s/g, ''))) name = `${name} ${quantity}`
    name = name.toUpperCase().trim()

    const catTags  = p.categories_tags || []
    const catTag   = catTags.find(t => t.startsWith('pt:')) || catTags.find(t => t.startsWith('en:')) || ''
    const category = catTag.replace(/^(pt:|en:)/, '').replace(/-/g, ' ')

    const imageUrl = p.image_front_small_url || p.image_small_url || p.image_front_url || p.image_url || null

    return { name, brand, quantity, category, imageUrl }
  } catch {
    return null
  }
}

/* ── busca a URL da foto frontal de um produto pelo EAN ──── */
async function fetchImageUrl(barcode) {
  const info = await fetchProductInfo(barcode)
  return info?.imageUrl || null
}

/* ── baixa URL → canvas → data URL comprimido ─────────────── */
function urlToDataUrl(url) {
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'  // OFF images allow CORS *
    img.onload = () => {
      const s = Math.min(SIZE_PX / img.width, SIZE_PX / img.height, 1)
      const w = Math.round(img.width  * s)
      const h = Math.round(img.height * s)
      const c = Object.assign(document.createElement('canvas'), { width: w, height: h })
      c.getContext('2d').drawImage(img, 0, 0, w, h)
      try { resolve(c.toDataURL('image/jpeg', QUALITY)) }
      catch { resolve(null) } // canvas taint (shouldn't happen with CORS *)
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

/* ── busca e comprime foto de um produto ─────────────────── */
export async function fetchProductPhoto(barcode) {
  const url = await fetchImageUrl(barcode)
  if (!url) return null
  return urlToDataUrl(url)
}

/* ── busca imagens por nome (ex: "biscoito vitarella") ───────
   Retorna { results: [{name, url}], error?: string }
────────────────────────────────────────────────────────────── */
export async function searchProductPhotos(query, limit = 8) {
  if (!query || query.trim().length < 3) return { results: [] }
  try {
    const q = encodeURIComponent(query.trim())
    const res = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&page_size=${limit}&fields=product_name,image_front_small_url,image_front_url`,
      { signal: AbortSignal.timeout(10000) }
    )
    if (!res.ok) return { results: [], error: `OFF ${res.status}` }
    const data = await res.json()
    const results = (data.products || [])
      .filter(p => p.image_front_small_url || p.image_front_url)
      .map(p => ({
        name: p.product_name || '',
        url:  p.image_front_small_url || p.image_front_url,
      }))
    return { results }
  } catch (e) {
    return { results: [], error: e.message }
  }
}

/* ── baixa uma URL de imagem → data URL comprimida ─────── */
export { urlToDataUrl }

/* ══════════════════════════════════════════════════════════
   AUTO-FETCH EM LOTE

   products   — array de { id, sku } dos produtos SEM foto
   onProgress — (done, total, found) callback de progresso
   signal     — AbortSignal para cancelar
   onFound    — (id, dataUrl) chamado imediatamente ao achar cada foto
══════════════════════════════════════════════════════════ */
export async function autoFetchPhotos(products, onProgress, signal, onFound) {
  let done = 0, found = 0
  const total = products.length

  for (let i = 0; i < products.length; i += CONCURRENCY) {
    if (signal?.aborted) break

    const chunk = products.slice(i, i + CONCURRENCY)
    const settled = await Promise.allSettled(
      chunk.map(async p => ({ id: p.id, dataUrl: await fetchProductPhoto(p.sku) }))
    )

    for (const r of settled) {
      done++
      if (r.status === 'fulfilled' && r.value.dataUrl) {
        found++
        await onFound?.(r.value.id, r.value.dataUrl) // persist immediately
      }
    }

    onProgress?.(done, total, found)

    if (i + CONCURRENCY < products.length && !signal?.aborted)
      await new Promise(r => setTimeout(r, 150))
  }
}
