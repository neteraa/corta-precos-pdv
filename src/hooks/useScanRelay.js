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

/* ── SENDER (used in ScanMobile) ──────────────────────────── */
export function useScanSender() {
  const wsRef = useRef(null)

  useEffect(() => {
    let ws
    const connect = () => {
      try {
        ws = new WebSocket(wsUrl())
        ws.onopen  = () => { wsRef.current = ws }
        ws.onclose = () => { wsRef.current = null; setTimeout(connect, 3000) }
        ws.onerror = () => ws.close()
      } catch {}
    }
    connect()
    return () => ws?.close()
  }, [])

  return (code) => {
    const payload = JSON.stringify({ code, ts: Date.now() })
    // 1. WebSocket (cross-device)
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(payload)
    }
    // 2. localStorage (same-browser fallback)
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
    let ws
    const handle = (raw) => {
      try {
        const { code } = JSON.parse(raw)
        if (code) onCodeRef.current(code)
      } catch {}
    }

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl())
        ws.onmessage = (e) => handle(e.data)
        ws.onclose   = () => setTimeout(connect, 3000)
        ws.onerror   = () => ws.close()
      } catch {}
    }
    connect()

    // localStorage fallback (same-browser multi-tab)
    const onStorage = (e) => {
      if (e.key !== LS_KEY || !e.newValue) return
      handle(e.newValue)
    }
    window.addEventListener('storage', onStorage)

    return () => {
      ws?.close()
      window.removeEventListener('storage', onStorage)
    }
  }, []) // eslint-disable-line
}
