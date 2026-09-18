/* ── Tenant-namespaced localStorage ───────────────────────────
 *
 * Two fully isolated namespaces that never mix:
 *   mkt:{storeId}:{key}    →  mercado (B2C)
 *   forn:{tenantId}:{key}  →  distribuidor (B2B)
 *
 * Session keys (always flat — they ARE the namespace identifiers):
 *   cp_session    →  mercado session   { loggedIn, user, storeId }
 *   cp_session_v1 →  forn session      { id, username }
 *
 * MULTI-TENANT SAFETY:
 *   zs_registered_stores  →  JSON array of storeIds that were ever
 *   active on THIS browser. Legacy flat-key migration only happens
 *   for these. New storeIds NEVER inherit another store's data.
 * ──────────────────────────────────────────────────────────── */

const MKT_SESSION_KEY   = 'cp_session'
const FORN_SESSION_KEY  = 'cp_session_v1'
const REGISTERED_KEY    = 'zs_registered_stores'  // tracks storeIds native to this browser

export function getMktStoreId() {
  try { return JSON.parse(localStorage.getItem(MKT_SESSION_KEY))?.storeId ?? 'default' }
  catch { return 'default' }
}

function getFornTenantId() {
  try { return JSON.parse(localStorage.getItem(FORN_SESSION_KEY))?.id ?? 'unknown' }
  catch { return 'unknown' }
}

/** Call once after successful login to register this storeId as native to this browser. */
export function registerStoreId(storeId) {
  if (!storeId || storeId === 'default') return
  try {
    const list = JSON.parse(localStorage.getItem(REGISTERED_KEY) || '[]')
    if (!list.includes(storeId)) {
      list.push(storeId)
      localStorage.setItem(REGISTERED_KEY, JSON.stringify(list))
    }
  } catch {}
}

/** True only if this storeId was originally set up on this browser. */
function isRegisteredStore(storeId) {
  if (!storeId || storeId === 'default') return true  // legacy single-tenant mode
  try {
    const list = JSON.parse(localStorage.getItem(REGISTERED_KEY) || '[]')
    return list.includes(storeId)
  } catch { return false }
}

/** Namespaced key for the mercado (B2C) side. */
export function mktKey(baseKey) {
  return `mkt:${getMktStoreId()}:${baseKey}`
}

/** Namespaced key for the distribuidor (B2B) side. */
export function fornKey(baseKey) {
  return `forn:${getFornTenantId()}:${baseKey}`
}

/**
 * Safe migration helper: reads the namespaced key.
 * Only copies from the legacy flat key if the current storeId is
 * REGISTERED on this browser (i.e., was the original single-tenant store).
 * New tenants/storeIds always start with a clean slate.
 */
export function migrateAndGet(baseKey, keyFn) {
  const newKey  = keyFn(baseKey)
  const current = localStorage.getItem(newKey)
  if (current) return current

  // Only allow legacy migration for storeIds native to this device
  if (isRegisteredStore(getMktStoreId())) {
    const legacy = localStorage.getItem(baseKey)
    if (legacy) { try { localStorage.setItem(newKey, legacy) } catch {} }
  }
  return localStorage.getItem(newKey)
}

/**
 * Bulk migration — same safety rules as migrateAndGet.
 */
export function migrateToNamespace(baseKeys, keyFn) {
  if (!isRegisteredStore(getMktStoreId())) return  // foreign storeId — do nothing
  for (const base of baseKeys) {
    const newKey = keyFn(base)
    if (!localStorage.getItem(newKey)) {
      const legacy = localStorage.getItem(base)
      if (legacy) { try { localStorage.setItem(newKey, legacy) } catch {} }
    }
  }
}

/**
 * Wipe ALL localStorage keys belonging to a given storeId.
 * Used by the reset/clean page and on explicit "trocar mercado" action.
 */
export function wipeStoreData(storeId) {
  const prefix = `mkt:${storeId}:`
  const toRemove = Object.keys(localStorage).filter(k => k.startsWith(prefix))
  toRemove.forEach(k => localStorage.removeItem(k))
  // Also remove from the registered list
  try {
    const list = JSON.parse(localStorage.getItem(REGISTERED_KEY) || '[]')
    localStorage.setItem(REGISTERED_KEY, JSON.stringify(list.filter(id => id !== storeId)))
  } catch {}
  return toRemove.length
}

/**
 * Wipe legacy flat keys (cp_products, cp_sales, etc.) — the source of
 * the cross-tenant contamination. Safe to call anytime.
 */
export function wipeLegacyFlatKeys() {
  const FLAT_KEYS = ['cp_products','cp_sales','cp_customers','cp_promos','cp_fiado',
    'cp_cash','cp_goal','cp_operators','cp_supplier_offers','cp_store_name',
    'cp_expiry_days','cp_categories','cp_sellout']
  FLAT_KEYS.forEach(k => localStorage.removeItem(k))
}
