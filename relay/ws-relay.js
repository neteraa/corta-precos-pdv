/**
 * ZatendeStok — WebSocket Scan Relay
 *
 * Routes scan events from phone scanners to PDV/Terminal receivers.
 * Strictly isolated by storeId: Loja A never receives events from Loja B.
 *
 * Auth: storeToken = HMAC-SHA256(storeId, ZS_PERSIST_SECRET).slice(0,32)
 *       Same secret and formula already used by persist.js / restore.js on Netlify.
 *
 * Connect:  wss://<host>/ws/scan?storeId=STORE_ID&t=STORE_TOKEN[&type=scanner|terminal]
 * Send:     { "type": "scan", "code": "7891234567890", "ts": 1700000000000 }
 * Receive:  { "type": "scan", "code": "7891234567890", "ts": 1700000000000 }
 *
 * ENV:
 *   PORT              — listening port (Railway injects automatically)
 *   ZS_PERSIST_SECRET — HMAC secret (same value configured on Netlify)
 */

import { createServer }    from 'http'
import { WebSocketServer } from 'ws'
import { createHmac }      from 'crypto'

const PORT   = process.env.PORT || 8080
const SECRET = process.env.ZS_PERSIST_SECRET || ''

if (!SECRET) {
  console.warn('[relay] WARNING: ZS_PERSIST_SECRET not set — all connections will be rejected.')
}

// ── Auth ─────────────────────────────────────────────────────
function verifyToken(storeId, token) {
  if (!SECRET || !storeId || !token) return false
  const expected = createHmac('sha256', SECRET).update(storeId).digest('hex').slice(0, 32)
  return token === expected
}

// ── Rooms: Map<storeId, Set<WebSocket>> ──────────────────────
const rooms = new Map()

function joinRoom(storeId, ws) {
  if (!rooms.has(storeId)) rooms.set(storeId, new Set())
  rooms.get(storeId).add(ws)
}

function leaveRoom(storeId, ws) {
  const room = rooms.get(storeId)
  if (!room) return
  room.delete(ws)
  if (room.size === 0) rooms.delete(storeId)
}

// ── HTTP (health check for Railway) ──────────────────────────
const http = createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, secret: !!SECRET }))
    return
  }
  res.writeHead(404)
  res.end()
})

// ── WebSocket ─────────────────────────────────────────────────
// verifyClient runs BEFORE the handshake — rejected connections never open.
const wss = new WebSocketServer({
  server: http,
  path: '/ws/scan',
  verifyClient({ req }, cb) {
    try {
      const url     = new URL(req.url, `http://${req.headers.host || 'relay'}`)
      const storeId = (url.searchParams.get('storeId') || '').slice(0, 128)
      const tok     = (url.searchParams.get('t')       || '').slice(0, 64)

      if (!verifyToken(storeId, tok)) {
        cb(false, 401, 'Unauthorized')
        return
      }
      // Attach to req so the connection handler doesn't re-parse
      req._storeId = storeId
      cb(true)
    } catch {
      cb(false, 400, 'Bad Request')
    }
  },
})

wss.on('connection', (ws, req) => {
  const storeId = req._storeId

  joinRoom(storeId, ws)

  ws.on('message', (raw, isBinary) => {
    // Reject binary, oversized payloads
    if (isBinary || raw.length > 1024) return

    let msg
    try { msg = JSON.parse(raw) } catch { return }

    // Only relay validated scan events
    if (msg.type !== 'scan') return
    if (typeof msg.code !== 'string' || !msg.code || msg.code.length > 256) return

    const payload = JSON.stringify({ type: 'scan', code: msg.code, ts: msg.ts || Date.now() })
    const room    = rooms.get(storeId)
    if (!room) return

    // Broadcast to all OTHER members of the same room (not back to sender)
    for (const c of room) {
      if (c !== ws && c.readyState === 1) c.send(payload)
    }
  })

  const cleanup = () => leaveRoom(storeId, ws)
  ws.on('close', cleanup)
  ws.on('error', () => { try { ws.close() } catch {} cleanup() })
})

http.listen(PORT, '0.0.0.0', () => {
  console.log(`[relay] :${PORT}  secret=${SECRET ? 'configured' : 'MISSING'}`)
})
