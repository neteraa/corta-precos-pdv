/**
 * useScanRelay — cross-device barcode relay via WebSocket.
 *
 * Sender  (phone /scan page):   useScanRelay.send(code)
 * Receiver (PDV / Terminal):    useScanRelay.useReceive(callback)
 *
 * Transport priority:
 *   1. WebSocket  /ws/scan  → works cross-device (phone → PC)
 *   2. localStorage storage event → fallback for same-browser multi-tab
 */
import { useEffect, useRef } from 'react'

const LS_KEY = 'cp_mobile_scan'

// Derive WebSocket URL from current page location.
// Works with Cloudflare tunnel (wss://) and local dev (ws://)
function wsUrl() {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${window.location.host}/ws/scan`
}

// Exponential backoff: 3s → 6s → 12s → 30s → stops after 5 failures.
// On Netlify there is no /ws/scan endpoint; localStorage is the live fallback.
function makeReconnector(factory, maxAttempts = 5) {
  let attempts = 0
  let dead = false
  let ws = null
  let timer = null

  function connect() {
    if (dead) return
    try {
      ws = factory(
        () => { attempts = 0 },                                       // onopen — reset counter
        () => {                                                        // onclose
          if (dead) return
          attempts++
          if (attempts >= maxAttempts) { dead = true; return }        // give up silently
          const delay = Math.min(3000 * 2 ** (attempts - 1), 30_000) // 3s 6s 12s 24s 30s
          timer = setTimeout(connect, delay)
        }
      )
    } catch {}
  }
  connect()
  return { get ws() { return ws }, stop() { dead = true; clearTimeout(timer); ws?.close() } }
}

/* ── SENDER (used in ScanMobile) ──────────────────────────── */
export function useScanSender() {
  const wsRef = useRef(null)

  useEffect(() => {
    const r = makeReconnector((onopen, onclose) => {
      const ws = new WebSocket(wsUrl())
      ws.onopen  = () => { wsRef.current = ws; onopen() }
      ws.onclose = () => { wsRef.current = null; onclose() }
      ws.onerror = () => ws.close()
      return ws
    })
    return () => r.stop()
  }, [])

  return (code) => {
    const payload = JSON.stringify({ code, ts: Date.now() })
    // 1. WebSocket (cross-device — only when server supports /ws/scan)
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
      const ws = new WebSocket(wsUrl())
      ws.onopen    = onopen
      ws.onmessage = (e) => handle(e.data)
      ws.onclose   = onclose
      ws.onerror   = () => ws.close()
      return ws
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
