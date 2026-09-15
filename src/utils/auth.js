const DEFAULT_USER = 'admin'
const DEFAULT_PASS = '1234'
const CREDS_KEY    = 'cp_creds'
const SESSION_KEY  = 'cp_session'

export function getCredentials() {
  try {
    const raw = localStorage.getItem(CREDS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { username: DEFAULT_USER, password: DEFAULT_PASS }
}

export function saveCredentials(username, password) {
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
