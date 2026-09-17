// SPA static server + WebSocket scanner relay + local persistence + auth
import { createServer }                    from 'http'
import { readFile, stat, writeFile, mkdir } from 'fs/promises'
import { join, extname }                   from 'path'
import { fileURLToPath }                   from 'url'
import { dirname }                         from 'path'
import { WebSocketServer }                 from 'ws'
import { createHash, randomBytes }         from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIST      = join(__dirname, 'dist')
const DATA_DIR  = join(__dirname, 'data')
const PORT      = process.env.PORT || 8011
const APP_SALT  = 'zs_2026_corta'

await mkdir(DATA_DIR, { recursive: true })

// ── Auth helpers ─────────────────────────────────────────────
function hashPwd(pwd, salt) {
  return createHash('sha256').update(`${APP_SALT}:${salt}:${pwd}`).digest('hex')
}

async function loadAuth() {
  try { return JSON.parse(await readFile(join(DATA_DIR, '_auth.json'), 'utf8')) } catch { return null }
}

async function ensureDefaultAuth() {
  if (await loadAuth()) return
  const salt = randomBytes(16).toString('hex')
  const cfg  = {
    username:     'admin',
    passwordHash: hashPwd('1234', salt),
    salt,
    storeId:      'local',
    storeName:    'Meu Mercado',
    storePhone:   '',
    active:       true,
  }
  await writeFile(join(DATA_DIR, '_auth.json'), JSON.stringify(cfg, null, 2))
  console.log('\n🔐 Credenciais padrão criadas em data/_auth.json')
  console.log('   Usuário : admin')
  console.log('   Senha   : 1234')
  console.log('   ⚠️  Altere em Configurações → Acesso ao Sistema\n')
}

// ── Persistence helpers ──────────────────────────────────────
// Full key list — kept in sync with netlify/functions/restore.js
const ALL_KEYS = [
  'cp_products', 'cp_sales', 'cp_customers', 'cp_promos', 'cp_fiado',
  'cp_cash', 'cp_goal', 'cp_operators', 'cp_store_name',
  'cp_supplier_offers', 'cp_fornecedor_estoque', 'cp_supplier_orders',
  'cp_distribuidor_markets', 'cp_forn_profile_v1', 'cp_sellout_events',
  'cp_printer_settings',
]

async function saveKey(key, value) {
  await writeFile(join(DATA_DIR, `${key}.json`), value, 'utf8')
}

async function loadAllKeys() {
  const result = {}
  for (const key of ALL_KEYS) {
    try { result[key] = await readFile(join(DATA_DIR, `${key}.json`), 'utf8') } catch {}
  }
  return result
}

// ── HTTP helpers ─────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript',
  '.css':  'text/css',                 '.json': 'application/json',
  '.svg':  'image/svg+xml',            '.ico':  'image/x-icon',
  '.png':  'image/png',                '.woff2':'font/woff2',
}

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
  res.end(JSON.stringify(data))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', c => chunks.push(c))
    req.on('end',  () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString())) } catch { resolve({}) } })
    req.on('error', reject)
  })
}

// ── Bootstrap ────────────────────────────────────────────────
await ensureDefaultAuth()

// ── HTTP server ──────────────────────────────────────────────
const server = createServer(async (req, res) => {
  const urlPath = req.url.split('?')[0]

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST', 'Access-Control-Allow-Headers': 'Content-Type' })
    res.end(); return
  }

  // POST /api/auth — local credential check
  if (req.method === 'POST' && urlPath === '/api/auth') {
    try {
      const { username, password } = await readBody(req)
      const cfg = await loadAuth()
      if (!cfg || !cfg.active || cfg.username !== (username || '').trim().toLowerCase()) {
        json(res, { ok: false, error: 'Usuário ou senha incorretos' }, 401); return
      }
      if (hashPwd(password, cfg.salt) !== cfg.passwordHash) {
        json(res, { ok: false, error: 'Usuário ou senha incorretos' }, 401); return
      }
      json(res, { ok: true, storeId: cfg.storeId, storeName: cfg.storeName, storePhone: cfg.storePhone || '' })
    } catch (e) { json(res, { ok: false, error: String(e) }, 500) }
    return
  }

  // POST /api/update-auth — change local credentials (local mode only)
  if (req.method === 'POST' && urlPath === '/api/update-auth') {
    try {
      const { username, password, storeName, storePhone } = await readBody(req)
      const cfg = (await loadAuth()) || {}
      if (username)   cfg.username   = username.trim().toLowerCase()
      if (storeName)  cfg.storeName  = storeName
      if (storePhone !== undefined) cfg.storePhone = storePhone
      if (password) {
        cfg.salt         = randomBytes(16).toString('hex')
        cfg.passwordHash = hashPwd(password, cfg.salt)
      }
      cfg.active = true
      await writeFile(join(DATA_DIR, '_auth.json'), JSON.stringify(cfg, null, 2))
      json(res, { ok: true })
    } catch (e) { json(res, { ok: false, error: String(e) }, 500) }
    return
  }

  // POST /api/persist — save one key to data/{key}.json
  if (req.method === 'POST' && urlPath === '/api/persist') {
    try {
      const { key, value } = await readBody(req)
      // Allow any cp_* key — forward-compatible with future store keys
      if (!key || (!key.startsWith('cp_') && !ALL_KEYS.includes(key))) {
        json(res, { ok: false, error: 'unknown key' }, 400); return
      }
      // Accept empty string (e.g. cp_store_name reset)
      if (value === undefined || value === null) {
        json(res, { ok: false, error: 'Missing value' }, 400); return
      }
      await saveKey(key, value)
      json(res, { ok: true })
    } catch (e) { json(res, { ok: false, error: String(e) }, 500) }
    return
  }

  // GET /api/restore — load all keys (storeId ignored in local mode)
  if (req.method === 'GET' && urlPath === '/api/restore') {
    try {
      json(res, { ok: true, data: await loadAllKeys() })
    } catch (e) { json(res, { ok: false, data: {}, error: String(e) }, 500) }
    return
  }

  // Static files / SPA fallback
  let file = join(DIST, urlPath)
  try {
    const s = await stat(file)
    if (s.isDirectory()) file = join(file, 'index.html')
    const ext  = extname(file).toLowerCase()
    const data = await readFile(file)
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-cache' : 'max-age=31536000' })
    res.end(data)
  } catch {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' })
    res.end(await readFile(join(DIST, 'index.html')))
  }
})

// ── WebSocket relay (/ws/scan) — phone scanner → PDV ─────────
const wss     = new WebSocketServer({ server, path: '/ws/scan' })
const clients = new Set()

wss.on('connection', ws => {
  clients.add(ws)
  ws.on('message', raw => {
    for (const c of clients)
      if (c !== ws && c.readyState === 1) c.send(raw.toString())
  })
  ws.on('close', () => clients.delete(ws))
  ws.on('error', () => clients.delete(ws))
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅  PDV            →  http://localhost:${PORT}`)
  console.log(`📷  Scanner celular →  abra no celular: http://[IP-DA-MAQUINA]:${PORT}/scan`)
  console.log(`📁  Dados locais    →  ${DATA_DIR}\n`)
})
