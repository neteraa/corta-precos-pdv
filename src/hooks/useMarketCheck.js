import { useState, useEffect } from 'react'
import { getConfiguredStoreId } from '../utils/auth.js'

/**
 * Polls /api/market-check on mount (and every 4h) to enforce
 * the kill switch when a market's subscription is inactive or expired.
 *
 * Returns: { blocked: bool, daysLeft: number|null, reason: string }
 * On network error: never blocks (fail-open).
 */
export function useMarketCheck() {
  const [state, setState] = useState({ blocked: false, daysLeft: null, reason: '' })

  useEffect(() => {
    let cancelled = false

    async function check() {
      const storeId = getConfiguredStoreId()
      if (!storeId || storeId === 'default') return  // local/dev mode — skip

      try {
        const res  = await fetch(`/api/market-check?storeId=${encodeURIComponent(storeId)}`)
        const data = await res.json()
        if (cancelled) return

        if (!data.ok || data.active === undefined) return  // infra error — fail open

        if (!data.active) {
          setState({ blocked: true, daysLeft: null, reason: 'suspended' })
          return
        }
        if (data.expired) {
          setState({ blocked: true, daysLeft: data.daysLeft, reason: 'expired' })
          return
        }
        // Warn 5 days before expiry (not block)
        setState({ blocked: false, daysLeft: data.daysLeft, reason: '' })
      } catch {
        // Network failure — never block
      }
    }

    check()
    const id = setInterval(check, 4 * 60 * 60 * 1000)  // every 4 hours
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  return state
}
