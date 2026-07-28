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

/* ── busca a URL da foto frontal de um produto pelo EAN ──── */
async function fetchImageUrl(barcode) {
  const clean = String(barcode || '').replace(/\D/g, '')
  if (clean.length < 8) return null

  try {
    const res = await fetch(`${OFF_API}/${clean}.json`, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const data = await res.json()
    if (data.status !== 1 || !data.product) return null

    const p = data.product
    // Prefer small (200px) → less download, still good quality after recompress
    return p.image_front_small_url || p.image_small_url ||
           p.image_front_url       || p.image_url       || null
  } catch {
    return null
  }
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

/* ── busca imagens por nome (ex: "biscoito vitarella") ───── */
export async function searchProductPhotos(query, limit = 8) {
  if (!query || query.trim().length < 3) return []
  try {
    const q = encodeURIComponent(query.trim())
    const res = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&page_size=${limit}&fields=product_name,image_front_small_url,image_front_url`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data.products || [])
      .filter(p => p.image_front_small_url || p.image_front_url)
      .map(p => ({
        name: p.product_name || '',
        url:  p.image_front_small_url || p.image_front_url,
      }))
  } catch { return [] }
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
