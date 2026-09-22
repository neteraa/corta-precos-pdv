/**
 * useScanRelay — cross-device barcode relay via WebSocket.
 *
 * Sender  (phone /scan page):   useScanSender()
 * Receiver (PDV / Terminal):    useScanReceiver(callback)
 *
 * Transport priority:
 *   1. WebSocket → VITE_WS_RELAY_URL (Railway relay) — works cross-device
 *   2. localStorage storage event → fallback for same-browser multi-tab
 *
 * Auth: storeId + storeToken passed as query params on connect.
 *       Relay verifies HMAC before admitting the connection.
 *       Loja A never receives events from Loja B.
 */
import { useEffect, useRef } from 'react'
import { getMktStoreId, getMktStoreToken } from '../utils/tenantStorage.js'

const LS_KEY = 'cp_mobile_scan'

// Build the WebSocket URL.
// Production: VITE_WS_RELAY_URL points to the Railway relay service.
// Local dev:  falls back to same-host /ws/scan (server.js relay).
function wsUrl(type = 'terminal') {
  const storeId = getMktStoreId()
  const token   = getMktStoreToken()
  const params  = `storeId=${encodeURIComponent(storeId)}&t=${encodeURIComponent(token)}&type=${type}`

  const relay = import.meta.env.VITE_WS_RELAY_URL
  if (relay) return `${relay}/ws/scan?${params}`

  // Local dev fallback (same host — server.js must be running)
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${window.location.host}/ws/scan?${params}`
}

// Reconnects indefinitely while the page is open.
// Backoff: 2s → 4s → 8s → 16s → 30s (capped) — resets on successful open.
function makeReconnector(factory) {
  let attempts = 0
  let stopped  = false
  let timer    = null

  function connect() {
    if (stopped) return
    try {
      factory(
        () => { attempts = 0 },                                        // onopen — reset counter
        () => {                                                         // onclose
          if (stopped) return
          attempts++
          const delay = Math.min(2000 * 2 ** Math.min(attempts - 1, 4), 30_000) // cap 30s
          timer = setTimeout(connect, delay)
        }
      )
    } catch {}
  }
  connect()
  return { stop() { stopped = true; clearTimeout(timer) } }
}

/* ── SENDER (used in ScanMobile) ──────────────────────────── */
export function useScanSender() {
  const wsRef = useRef(null)

  useEffect(() => {
    const r = makeReconnector((onopen, onclose) => {
      const ws = new WebSocket(wsUrl('scanner'))
      ws.onopen  = () => { wsRef.current = ws; onopen() }
      ws.onclose = () => { wsRef.current = null; onclose() }
      ws.onerror = () => ws.close()
    })
    return () => r.stop()
  }, [])

  return (code) => {
    const payload = JSON.stringify({ type: 'scan', code, ts: Date.now() })
    // 1. WebSocket relay (cross-device)
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(payload)
    }
    // 2. localStorage (same-browser fallback — always written)
    try {
      localStorage.removeItem(LS_KEY)
      localStorage.setItem(LS_KEY, payload)
    } catch {}
  }
}

/* ── RECEIVER (used in PDV / Terminal) ────────────────────── */
export function useScanReceiver(onCode) {
  const onCodeRef = useRef(onCode)
  useEffect(() => { onCodeRef.current = onCode }, [onCode])

  useEffect(() => {
    const handle = (raw) => {
      try {
        const { code } = JSON.parse(raw)
        if (code) onCodeRef.current(code)
      } catch {}
    }

    const r = makeReconnector((onopen, onclose) => {
      const ws = new WebSocket(wsUrl('terminal'))
      ws.onopen    = onopen
      ws.onmessage = (e) => handle(e.data)
      ws.onclose   = onclose
      ws.onerror   = () => ws.close()
    })

    // localStorage fallback (same-browser multi-tab — always active)
    const onStorage = (e) => {
      if (e.key !== LS_KEY || !e.newValue) return
      handle(e.newValue)
    }
    window.addEventListener('storage', onStorage)

    return () => {
      r.stop()
      window.removeEventListener('storage', onStorage)
    }
  }, []) // eslint-disable-line
}
