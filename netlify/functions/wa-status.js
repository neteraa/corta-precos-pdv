/**
 * wa-status — Proxy seguro para Evolution API
 *
 * GET  /api/wa-status?instance=zatendestok          → { status, qrcode, phone, profileName }
 * POST /api/wa-status?instance=X&action=disconnect  → desconecta instância
 * POST /api/wa-status?instance=X&action=refresh-qr  → novo QR code
 * POST /api/wa-status?instance=X&action=create       → cria instância nova
 *
 * Env vars: EVOLUTION_API_URL, EVOLUTION_API_KEY
 */

const EVO_URL  = () => (process.env.EVOLUTION_API_URL || '').replace(/\/$/, '')
const EVO_KEY  = () => process.env.EVOLUTION_API_KEY || ''
const WEBHOOK  = 'https://zatendestok.com.br/wa-bot'

async function evoFetch(path, opts = {}) {
  const res = await fetch(`${EVO_URL()}${path}`, {
    ...opts,
    headers: { 'apikey': EVO_KEY(), 'Content-Type': 'application/json', ...(opts.headers || {}) },
  })
  const text = await res.text()
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) } }
  catch { return { ok: res.ok, status: res.status, data: { raw: text } } }
}

async function getStatus(instance) {
  const { data } = await evoFetch(`/instance/fetchInstances?instanceName=${instance}`)
  const inst = Array.isArray(data) ? data[0] : null
  if (!inst) return { exists: false }
  return {
    exists:      true,
    status:      inst.connectionStatus || 'unknown',
    phone:       inst.ownerJid?.replace('@s.whatsapp.net', '') || null,
    profileName: inst.profileName || null,
  }
}

async function getQR(instance) {
  const { data } = await evoFetch(`/instance/connect/${instance}`)
  return {
    qrcode:      data?.base64 || null,
    pairingCode: data?.pairingCode || null,
  }
}

async function createInstance(instance) {
  const { ok, data } = await evoFetch(`/instance/create`, {
    method: 'POST',
    body: JSON.stringify({
      instanceName: instance,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
    }),
  })
  if (!ok) return { ok: false, error: data }

  // Configure webhook automatically
  await evoFetch(`/webhook/set/${instance}`, {
    method: 'POST',
    body: JSON.stringify({
      webhook: {
        enabled: true,
        url: WEBHOOK,
        webhookByEvents: true,
        webhookBase64: false,
        events: ['MESSAGES_UPSERT'],
      },
    }),
  })

  return {
    ok: true,
    qrcode:      data?.qrcode?.base64 || null,
    pairingCode: data?.qrcode?.pairingCode || null,
  }
}

async function disconnectInstance(instance) {
  await evoFetch(`/instance/logout/${instance}`, { method: 'DELETE' })
  return { ok: true }
}

export default async (req) => {
  const url = new URL(req.url)
  const instance = url.searchParams.get('instance') || 'zatendestok'
  const action   = url.searchParams.get('action')

  if (!EVO_URL() || !EVO_KEY()) {
    return new Response(JSON.stringify({ error: 'Evolution API não configurada' }), {
      status: 503, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }

  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }

  try {
    // ── GET: status + QR se não conectado ──────────────────────────────────
    if (req.method === 'GET') {
      const st = await getStatus(instance)
      if (!st.exists) return new Response(JSON.stringify({ exists: false }), { status: 200, headers })

      const connected = st.status === 'open'
      let qrcode = null
      if (!connected) {
        const q = await getQR(instance)
        qrcode = q.qrcode
      }
      return new Response(JSON.stringify({ ...st, qrcode }), { status: 200, headers })
    }

    // ── POST: actions ───────────────────────────────────────────────────────
    if (req.method === 'POST') {
      if (action === 'create') {
        const result = await createInstance(instance)
        return new Response(JSON.stringify(result), { status: 200, headers })
      }
      if (action === 'disconnect') {
        const result = await disconnectInstance(instance)
        return new Response(JSON.stringify(result), { status: 200, headers })
      }
      if (action === 'refresh-qr') {
        const q = await getQR(instance)
        return new Response(JSON.stringify(q), { status: 200, headers })
      }
    }

    return new Response(JSON.stringify({ error: 'Método não suportado' }), { status: 405, headers })
  } catch (err) {
    console.error('wa-status error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers })
  }
}

export const config = { path: '/wa-status' }
