const CREDS_KEY     = 'cp_creds'
const SESSION_KEY   = 'cp_session'
const STORE_ID_KEY  = 'cp_store_id'   // flat — set once per installation

/** Slug a store name into a safe storeId. e.g. "Corta Preços" → "cortaprecos" */
export function slugify(name = '') {
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // strip accents
    .replace(/[^a-z0-9_]+/g, '')                        // keep alphanumeric + underscore
    .slice(0, 32) || 'default'
}

/** Returns the storeId configured for THIS browser installation.
 *  Prefere cp_session.storeId (set pelo login, preserva underscores)
 *  para evitar que o cp_store_id legado (gerado com slugify antigo,
 *  sem underscore) gere URLs de celular com namespace errado. */
export function getConfiguredStoreId() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY))
    if (s?.storeId && s.storeId !== 'default') return s.storeId
  } catch {}
  return localStorage.getItem(STORE_ID_KEY) || 'default'
}

/** Persist a new storeId for this installation and patch the active session. */
export function saveStoreId(id) {
  const safe = slugify(id) || 'default'
  localStorage.setItem(STORE_ID_KEY, safe)
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY)) ?? {}
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...s, storeId: safe }))
  } catch {}
  return safe
}

/**
 * Local credentials are an explicit development/offline feature only.
 * There is no built-in production password fallback.
 */
export function getCredentials() {
  try {
    const raw = localStorage.getItem(CREDS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed?.username && parsed?.password) return parsed
    }
  } catch {}
  return { username: '', password: '' }
}

export function saveCredentials(username, password) {
  if (!username || !password) return
  localStorage.setItem(CREDS_KEY, JSON.stringify({ username, password }))
}

export function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)) ?? {} } catch { return {} }
}

export function isLoggedIn() {
  return getSession()?.loggedIn === true
}

/** 'admin' | 'gerente' | 'caixa' — defaults to 'admin' for legacy sessions */
export function getRole() {
  return getSession()?.role ?? 'admin'
}

export function getOperatorName() {
  const s = getSession()
  return s?.operatorName ?? s?.user ?? 'Admin'
}

export function getTerminalId() {
  return getSession()?.terminalId ?? 1
}

/** Login as a named operator (cashier/manager) while keeping storeId from the base session. */
export function loginAsOperator(op) {
  const base = getSession()
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    ...base,
    loggedIn:     true,
    operatorId:   op.id,
    operatorName: op.name,
    role:         op.role ?? 'caixa',
    terminalId:   op.terminalId ?? 1,
  }))
}

export function logout() {
  localStorage.removeItem(SESSION_KEY)
}
