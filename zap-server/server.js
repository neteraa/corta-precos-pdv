/**
 * ZatendeStock — Servidor ZAP Local (Baileys)
 *
 * Expõe uma API REST para o ZatendeStock disparar mensagens
 * diretamente pelo WhatsApp sem abrir o browser um por um.
 *
 * Uso: node server.js
 *  1. Escaneia QR code no terminal com o WA do distribuidor
 *  2. ZatendeStock detecta o servidor e usa /send-all
 */

const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} = require('@whiskeysockets/baileys')

const express   = require('express')
const cors      = require('cors')
const qrcode    = require('qrcode-terminal')
const pino      = require('pino')
const path      = require('path')
const fs        = require('fs')

/* ── Config ── */
const PORT      = process.env.PORT || 3001
const AUTH_DIR  = path.join(__dirname, 'auth')
const DELAY_MS  = 1500   // delay entre mensagens pra não levar ban

/* ── Estado global ── */
let sock        = null
let isConnected = false
let qrString    = null
let connectedPhone = null

/* ── Express app ── */
const app = express()
app.use(cors({ origin: '*' }))
app.use(express.json())

/* ─────────────────────────────────────────────
   BAILEYS — conecta e mantém conexão
───────────────────────────────────────────── */
async function connectWA() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
  const { version }           = await fetchLatestBaileysVersion()
  const logger                = pino({ level: 'silent' })   // silencia logs verbosos

  sock = makeWASocket({
    version,
    logger,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    printQRInTerminal: false,   // fazemos nosso próprio display
    browser: ['ZatendeStock', 'Chrome', '1.0.0'],
    syncFullHistory: false,
  })

  /* QR code */
  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      qrString = qr
      console.clear()
      console.log('\n🟢 ZatendeStock ZAP Server — Escaneie o QR Code:\n')
      qrcode.generate(qr, { small: true })
      console.log('\n⏳ Aguardando leitura...')
    }

    if (connection === 'open') {
      isConnected = true
      qrString    = null
      connectedPhone = sock.user?.id?.split(':')[0] || null
      console.log(`\n✅ WhatsApp conectado! Número: ${connectedPhone}`)
      console.log(`📡 API rodando em http://localhost:${PORT}\n`)
    }

    if (connection === 'close') {
      isConnected = false
      connectedPhone = null
      const code = lastDisconnect?.error?.output?.statusCode
      const shouldReconnect = code !== DisconnectReason.loggedOut
      console.log(`⚠️  Conexão fechada (código ${code}). Reconectar: ${shouldReconnect}`)
      if (shouldReconnect) {
        setTimeout(connectWA, 3000)
      } else {
        console.log('🔴 Sessão encerrada (logout). Delete a pasta auth/ e reinicie.')
      }
    }
  })

  sock.ev.on('creds.update', saveCreds)
}

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
function toJID(phone) {
  // Remove tudo que não é dígito, garante código do país
  const digits = phone.replace(/\D/g, '')
  // Se não começa com 55 (Brasil), adiciona
  const withCC = digits.startsWith('55') ? digits : `55${digits}`
  return `${withCC}@s.whatsapp.net`
}

async function sendMsg(phone, message) {
  if (!isConnected || !sock) throw new Error('WhatsApp não conectado')
  const jid = toJID(phone)
  await sock.sendMessage(jid, { text: message })
  return { phone, jid, ok: true }
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms))
}

/* ─────────────────────────────────────────────
   ROTAS
───────────────────────────────────────────── */

/* Status — ZatendeStock pinga aqui pra saber se o servidor está ativo */
app.get('/status', (req, res) => {
  res.json({
    connected: isConnected,
    phone: connectedPhone,
    hasQR: !!qrString,
    version: '1.0.0',
  })
})

/* Envia para UM número */
app.post('/send', async (req, res) => {
  const { phone, message } = req.body
  if (!phone || !message) return res.status(400).json({ error: 'phone e message são obrigatórios' })

  try {
    const result = await sendMsg(phone, message)
    res.json(result)
  } catch (err) {
    res.status(503).json({ error: err.message })
  }
})

/* Envia para TODOS — lista de transmissão real! */
app.post('/send-all', async (req, res) => {
  const { phones, message } = req.body
  if (!phones?.length || !message) {
    return res.status(400).json({ error: 'phones[] e message são obrigatórios' })
  }
  if (!isConnected || !sock) {
    return res.status(503).json({ error: 'WhatsApp não conectado' })
  }

  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Transfer-Encoding', 'chunked')

  const results = []
  for (let i = 0; i < phones.length; i++) {
    const phone = phones[i]
    try {
      const r = await sendMsg(phone, message)
      results.push(r)
      console.log(`📤 [${i+1}/${phones.length}] Enviado para ${phone}`)
    } catch (err) {
      results.push({ phone, ok: false, error: err.message })
      console.log(`❌ [${i+1}/${phones.length}] Falhou ${phone}: ${err.message}`)
    }
    // Delay entre mensagens para não levar ban
    if (i < phones.length - 1) await delay(DELAY_MS)
  }

  const sent = results.filter(r => r.ok).length
  console.log(`\n✅ Blast concluído: ${sent}/${phones.length} mensagens enviadas\n`)
  res.end(JSON.stringify({ results, sent, total: phones.length }))
})

/* Logout e apaga sessão */
app.post('/logout', async (req, res) => {
  try {
    await sock?.logout()
  } catch {}
  isConnected = false
  fs.rmSync(AUTH_DIR, { recursive: true, force: true })
  res.json({ ok: true, message: 'Sessão encerrada. Reinicie o servidor para conectar de novo.' })
})

/* ─────────────────────────────────────────────
   START
───────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`\n🚚 ZatendeStock ZAP Server`)
  console.log(`📡 Porta: ${PORT}`)
  console.log(`📁 Auth: ${AUTH_DIR}\n`)
  connectWA()
})
