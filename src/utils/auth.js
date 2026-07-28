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

export function isLoggedIn() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return false
    return JSON.parse(raw)?.loggedIn === true
  } catch { return false }
}

export function logout() {
  localStorage.removeItem(SESSION_KEY)
}
