import { useEffect, useRef, useCallback } from 'react'

const LS_KEY = 'cp_display_state'

/** Send side — used in PDV.
 *  Writes to localStorage; the `storage` event fires automatically
 *  in every other window/tab on the same origin.
 */
export function useBroadcastSend() {
  return useCallback((msg) => {
    try {
      const json = JSON.stringify(msg)
      // Delete then set forces the storage event even if the value didn't change
      localStorage.removeItem(LS_KEY)
      localStorage.setItem(LS_KEY, json)
    } catch {}

    // BroadcastChannel as bonus for same-window fast path
    try {
      const ch = new BroadcastChannel('cp_display')
      ch.postMessage(msg)
      ch.close()
    } catch {}
  }, [])
}

/** Receive side — used in CustomerDisplay.
 *
 *  Three independent layers (any one is enough):
 *  1. `storage` event  — fires instantly in OTHER windows when LS changes
 *  2. BroadcastChannel — fires instantly for SAME-window tabs
 *  3. Polling 500 ms   — absolute fallback if both above are blocked
 */
export function useBroadcastReceive(onMessage) {
  const cb = useRef(onMessage)
  useEffect(() => { cb.current = onMessage }, [onMessage])

  useEffect(() => {
    const read = () => {
      try {
        const snap = localStorage.getItem(LS_KEY)
        if (snap) cb.current(JSON.parse(snap))
      } catch {}
    }

    // 1 — Hydrate immediately on mount
    read()

    // 2 — storage event (cross-window, fires in every OTHER window)
    const onStorage = (e) => {
      if (e.key === LS_KEY || e.key === null) read()
    }
    window.addEventListener('storage', onStorage)

    // 3 — BroadcastChannel (same-window fast path)
    let ch
    try {
      ch = new BroadcastChannel('cp_display')
      ch.onmessage = read
    } catch {}

    // 4 — Polling fallback every 500 ms
    let last = localStorage.getItem(LS_KEY)
    const timer = setInterval(() => {
      try {
        const cur = localStorage.getItem(LS_KEY)
        if (cur !== last) { last = cur; read() }
      } catch {}
    }, 500)

    return () => {
      window.removeEventListener('storage', onStorage)
      clearInterval(timer)
      try { ch?.close() } catch {}
    }
  }, [])
}
