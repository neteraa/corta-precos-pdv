// Corta Preços PDV — service worker
// Strategy: network-first always so updates appear immediately.
// Cache is only a fallback for offline use.

const CACHE = 'corta-precos-v2'

self.addEventListener('install', e => {
  // Activate right away — don't wait for old tabs to close
  e.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', e => {
  // Delete every old cache version
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  // Always try the network first; fall back to cache only when offline
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
