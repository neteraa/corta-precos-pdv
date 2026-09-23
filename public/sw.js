// Corta Preços PDV — service worker
// CACHE_VERSION é injetado pelo Vite no build (único por deploy)
// Strategy:
//  • Install: pre-cache the app shell (index.html)
//  • Static assets (/assets/*): cache-first (hashed names never change)
//  • Navigation (HTML document): network-first → cache → shell fallback
//  • API / Netlify functions: network-only (fail silently; app uses localStorage)

const CACHE   = '__CACHE_VERSION__'
const SHELL   = '/'
const SKIP_RE = /\/(\.netlify|api)\//  // never cache API calls

// Permite que a página dispare skipWaiting manualmente (UpdateBanner)
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll([SHELL]))   // pre-cache the SPA shell
    // NÃO chama skipWaiting aqui — o UpdateBanner controla o momento do reload
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return

  const url = new URL(e.request.url)

  // Never intercept Netlify functions or /api — let them fail naturally
  if (SKIP_RE.test(url.pathname)) return

  // Hashed static assets: cache-first (safe because hash changes on rebuild)
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(e.request, clone))
        }
        return res
      }))
    )
    return
  }

  // Navigation requests (HTML): network-first → cached page → shell
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res && res.status === 200) {
            const clone = res.clone()
            caches.open(CACHE).then(c => c.put(e.request, clone))
          }
          return res
        })
        .catch(() =>
          caches.match(e.request).then(hit => hit || caches.match(SHELL))
        )
    )
    return
  }

  // Everything else: network-first → cache fallback
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.status === 200) {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(e.request, clone))
        }
        return res
      })
      .catch(() => caches.match(e.request))
  )
})
