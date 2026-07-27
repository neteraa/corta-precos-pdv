// SPA-aware static file server + WebSocket relay for mobile barcode scanner
import { createServer }              from 'http'
import { readFile, stat, writeFile,
         mkdir, readdir }            from 'fs/promises'
import { join, extname }             from 'path'
import { fileURLToPath }             from 'url'
import { dirname }                   from 'path'
import { WebSocketServer }           from 'ws'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIST      = join(__dirname, 'dist')
const DATA_DIR  = join(__dirname, 'data')
const PORT      = process.env.PORT || 8011

// Ensure data directory exists on startup
await mkdir(DATA_DIR, { recursive: true })

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.png':  'image/png',
  '.woff2':'font/woff2',
}

// ── Persistence helpers ──────────────────────────────────────
const DATA_KEYS = ['cp_products', 'cp_sales', 'cp_customers', 'cp_promos', 'cp_fiado', 'cp_printer_settings']

async function saveKey(key, value) {
  await writeFile(join(DATA_DIR, `${key}.json`), value, 'utf8')
}

async function loadAllKeys() {
  const result = {}
  for (const key of DATA_KEYS) {
    try {
      result[key] = await readFile(join(DATA_DIR, `${key}.json`), 'utf8')
    } catch {
      // file not yet created — that's fine
    }
  }
  return result
}

function json(res, data, status = 200) {
  const body = JSON.stringify(data)
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
  res.end(body)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', c => chunks.push(c))
    req.on('end',  () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}

// ── HTTP server ──────────────────────────────────────────────
const server = createServer(async (req, res) => {
  const url = req.url.split('?')[0]

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST', 'Access-Control-Allow-Headers': 'Content-Type' })
    res.end(); return
  }

  // ── API: save one key ───────────────────────────────────────
  if (req.method === 'POST' && url === '/api/persist') {
    try {
      const body = await readBody(req)
      const { key, value } = JSON.parse(body)
      if (!DATA_KEYS.includes(key)) { json(res, { ok: false, error: 'unknown key' }, 400); return }
      await saveKey(key, value)
      json(res, { ok: true })
    } catch (e) {
      json(res, { ok: false, error: String(e) }, 500)
    }
    return
  }

  // ── API: restore all keys ───────────────────────────────────
  if (req.method === 'GET' && url === '/api/restore') {
    try {
      const data = await loadAllKeys()
      json(res, { ok: true, data })
    } catch (e) {
      json(res, { ok: false, error: String(e) }, 500)
    }
    return
  }

  // ── Static files / SPA fallback ─────────────────────────────
  let file = join(DIST, url)
  try {
    const s = await stat(file)
    if (s.isDirectory()) file = join(file, 'index.html')
    const ext = extname(file).toLowerCase()
    const ct = MIME[ext] || 'application/octet-stream'
    const data = await readFile(file)
    res.writeHead(200, { 'Content-Type': ct, 'Cache-Control': ext === '.html' ? 'no-cache' : 'max-age=31536000' })
    res.end(data)
  } catch {
    const html = await readFile(join(DIST, 'index.html'))
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' })
    res.end(html)
  }
})

// ── WebSocket relay (/ws/scan) ────────────────────────────────
// Phone scanner → server → PDV/Terminal
// Any client can send { code, ts } and all other clients receive it.
const wss = new WebSocketServer({ server, path: '/ws/scan' })
const clients = new Set()

wss.on('connection', (ws) => {
  clients.add(ws)
  ws.on('message', (raw) => {
    // Relay raw message to every OTHER connected client
    for (const c of clients) {
      if (c !== ws && c.readyState === 1 /* OPEN */) {
        c.send(raw.toString())
      }
    }
  })
  ws.on('close',   () => clients.delete(ws))
  ws.on('error',   () => clients.delete(ws))
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Corta Preços PDV   http://0.0.0.0:${PORT}`)
  console.log(`✅ WS scan relay      ws://0.0.0.0:${PORT}/ws/scan`)
})
