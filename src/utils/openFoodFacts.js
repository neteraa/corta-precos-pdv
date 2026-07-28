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
    // Bust cache so img tag doesn't use a cached response without CORS header
    img.src = url.includes('?') ? url : url + '.jpg'
  })
}

/* ── busca e comprime foto de um produto ─────────────────── */
export async function fetchProductPhoto(barcode) {
  const url = await fetchImageUrl(barcode)
  if (!url) return null
  return urlToDataUrl(url)
}

/* ══════════════════════════════════════════════════════════
   AUTO-FETCH EM LOTE

   products  — array de { id, sku } dos produtos SEM foto
   onProgress(done, total, found) — callback de progresso
   signal    — AbortSignal para cancelar

   Retorna Map<productId, dataUrl>
══════════════════════════════════════════════════════════ */
export async function autoFetchPhotos(products, onProgress, signal) {
  const results = new Map()
  let done = 0
  let found = 0
  const total = products.length

  // Process in chunks of CONCURRENCY
  for (let i = 0; i < products.length; i += CONCURRENCY) {
    if (signal?.aborted) break

    const chunk = products.slice(i, i + CONCURRENCY)
    const settled = await Promise.allSettled(
      chunk.map(async p => {
        const dataUrl = await fetchProductPhoto(p.sku)
        return { id: p.id, dataUrl }
      })
    )

    settled.forEach(r => {
      done++
      if (r.status === 'fulfilled' && r.value.dataUrl) {
        results.set(r.value.id, r.value.dataUrl)
        found++
      }
    })

    onProgress?.(done, total, found)

    // Small pause between batches to be polite to the API
    if (i + CONCURRENCY < products.length && !signal?.aborted) {
      await new Promise(r => setTimeout(r, 150))
    }
  }

  return results
}
