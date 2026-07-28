/* ── IndexedDB wrapper for product photos ─────────────────────
   Photos stored separately from localStorage so they don't hit
   the ~5 MB quota. Each photo is compressed to ≤320px JPEG (~20KB).
────────────────────────────────────────────────────────────── */

const DB_NAME  = 'cp_photo_store'
const STORE    = 'photos'

function open() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1)
    r.onupgradeneeded = e => e.target.result.createObjectStore(STORE)
    r.onsuccess  = e => res(e.target.result)
    r.onerror    = e => rej(e.target.error)
  })
}

export async function savePhoto(id, dataUrl) {
  const db = await open()
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(dataUrl, id)
    tx.oncomplete = res
    tx.onerror    = e => rej(e.target.error)
  })
}

export async function deletePhoto(id) {
  const db = await open()
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = res
    tx.onerror    = e => rej(e.target.error)
  })
}

export async function getAllPhotos() {
  const db = await open()
  return new Promise((res, rej) => {
    const tx  = db.transaction(STORE, 'readonly')
    const out = {}
    const req = tx.objectStore(STORE).openCursor()
    req.onsuccess = e => {
      const cur = e.target.result
      if (cur) { out[cur.key] = cur.value; cur.continue() }
      else res(out)
    }
    req.onerror = e => rej(e.target.error)
  })
}

/* Resize + compress a File/Blob to a JPEG data URL ≤ maxPx on each side */
export function compressImage(file, maxPx = 320, quality = 0.80) {
  return new Promise(res => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const s = Math.min(maxPx / img.width, maxPx / img.height, 1)
      const w = Math.round(img.width  * s)
      const h = Math.round(img.height * s)
      const c = Object.assign(document.createElement('canvas'), { width: w, height: h })
      c.getContext('2d').drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      res(c.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => { URL.revokeObjectURL(url); res(null) }
    img.src = url
  })
}
