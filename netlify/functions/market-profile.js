/**
 * market-profile — perfil público do mercado para o bot WhatsApp
 *
 * GET  /api/market-profile?storeId=X          → retorna perfil público (sem dados sensíveis)
 * POST /api/market-profile?storeId=X          → salva perfil (requer header x-zs-storeid igual ao storeId)
 */

import { getStore } from '@netlify/blobs'

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
}

function profileStore() {
  return getStore({ name: 'market-profiles', consistency: 'strong' })
}

/** Campos permitidos — NUNCA inclui dados financeiros/sensíveis */
const ALLOWED_FIELDS = [
  'storeName', 'address', 'neighborhood', 'city', 'phone',
  'hours',        // { seg: '08:00-20:00', ... } ou string livre
  'payments',     // ['Dinheiro', 'PIX', 'Débito', 'Crédito']
  'promotions',   // texto livre com promoções atuais
  'greeting',     // saudação personalizada
  'policies',     // entrega, troca, fiado
  'about',        // descrição da loja
  'instagram',    // @handle
  'updatedAt',
]

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS })

  const url     = new URL(req.url)
  const storeId = url.searchParams.get('storeId')?.toLowerCase().trim()

  if (!storeId) {
    return new Response(JSON.stringify({ ok: false, error: 'storeId obrigatório' }), { status: 400, headers: CORS })
  }

  const store = profileStore()

  // ── GET: retorna perfil público ──────────────────────────────────────────
  if (req.method === 'GET') {
    const raw = await store.get(storeId, { type: 'json' }).catch(() => null)
    return new Response(JSON.stringify(raw || {}), { headers: CORS })
  }

  // ── POST: salva perfil ───────────────────────────────────────────────────
  if (req.method === 'POST') {
    // Validação simples: o header x-zs-storeid deve bater com o storeId
    const sessionStoreId = req.headers.get('x-zs-storeid')?.toLowerCase().trim()
    if (sessionStoreId !== storeId) {
      return new Response(JSON.stringify({ ok: false, error: 'Não autorizado' }), { status: 401, headers: CORS })
    }

    let body
    try { body = await req.json() } catch {
      return new Response(JSON.stringify({ ok: false, error: 'JSON inválido' }), { status: 400, headers: CORS })
    }

    // Filtra: só salva campos permitidos
    const safe = {}
    for (const key of ALLOWED_FIELDS) {
      if (body[key] !== undefined) safe[key] = body[key]
    }
    safe.updatedAt = new Date().toISOString()

    await store.set(storeId, JSON.stringify(safe))
    return new Response(JSON.stringify({ ok: true }), { headers: CORS })
  }

  return new Response('Method Not Allowed', { status: 405, headers: CORS })
}

export const config = { path: '/api/market-profile' }
