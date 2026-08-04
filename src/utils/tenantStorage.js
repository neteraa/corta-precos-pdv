/* ── Tenant-namespaced localStorage ───────────────────────────
 *
 * Two fully isolated namespaces that never mix:
 *   mkt:{storeId}:{key}    →  Corta Preço / mercado (B2C)
 *   forn:{tenantId}:{key}  →  Mega Tudo Barato / distribuidor (B2B)
 *
 * Session keys (always flat — they ARE the namespace identifiers):
 *   cp_session    →  mercado session   { loggedIn, user, storeId }
 *   cp_session_v1 →  forn session      { id, username }
 * ──────────────────────────────────────────────────────────── */

const MKT_SESSION_KEY  = 'cp_session'
const FORN_SESSION_KEY = 'cp_session_v1'

function getMktStoreId() {
  try { return JSON.parse(localStorage.getItem(MKT_SESSION_KEY))?.storeId ?? 'default' }
  catch { return 'default' }
}

function getFornTenantId() {
  try { return JSON.parse(localStorage.getItem(FORN_SESSION_KEY))?.id ?? 'unknown' }
  catch { return 'unknown' }
}

/** Namespaced key for the mercado (Corta Preço / B2C) side. */
export function mktKey(baseKey) {
  return `mkt:${getMktStoreId()}:${baseKey}`
}

/** Namespaced key for the distribuidor (Mega Tudo Barato / B2B) side. */
export function fornKey(baseKey) {
  return `forn:${getFornTenantId()}:${baseKey}`
}

/**
 * Inline migration helper: reads the namespaced key; if empty, copies from the
 * legacy flat key first. Returns the value (string | null) ready for JSON.parse.
 *
 * Use inside useState lazy initializers so migration happens before first render.
 */
export function migrateAndGet(baseKey, keyFn) {
  const newKey = keyFn(baseKey)
  if (!localStorage.getItem(newKey)) {
    const legacy = localStorage.getItem(baseKey)
    if (legacy) { try { localStorage.setItem(newKey, legacy) } catch {} }
  }
  return localStorage.getItem(newKey)
}

/**
 * Bulk migration: copy a set of legacy flat keys to their namespaced equivalents.
 * Safe to call repeatedly — skips keys where the namespaced version already exists.
 *
 * @param {string[]} baseKeys
 * @param {(key: string) => string} keyFn  - mktKey or fornKey (or a custom one with known tenantId)
 */
export function migrateToNamespace(baseKeys, keyFn) {
  for (const base of baseKeys) {
    const newKey = keyFn(base)
    if (!localStorage.getItem(newKey)) {
      const legacy = localStorage.getItem(base)
      if (legacy) { try { localStorage.setItem(newKey, legacy) } catch {} }
    }
  }
}
