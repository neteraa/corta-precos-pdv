/**
 * POST /api/update-auth
 * Atualiza usuário e/ou senha de um mercado autenticado.
 *
 * Body: { storeId, currentPassword, newPassword?, newUsername? }
 * Headers: x-zs-token  (HMAC do storeId gerado no login)
 *
 * Fluxo de validação:
 *   1. Verifica HMAC token (sessão válida)
 *   2. Localiza market pelo storeId
 *   3. Verifica senha atual
 *   4. Atualiza username e/ou passwordHash no blob
 */

import { getStore } from '@netlify/blobs'
import { createHash, createHmac, randomBytes } from 'crypto'

const APP_SALT       = 'zs_2026_corta'
const PERSIST_SECRET = process.env.ZS_PERSIST_SECRET || ''

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
}

function hashPwd(pwd, salt) {
  return createHash('sha256').update(`${APP_SALT}:${salt}:${pwd}`).digest('hex')
}

function makeStoreToken(storeId) {
  if (!PERSIST_SECRET) return null
  return createHmac('sha256', PERSIST_SECRET).update(storeId).digest('hex').slice(0, 32)
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const token = req.headers.get('x-zs-token') || ''

  try {
    const { storeId, currentPassword, newPassword, newUsername } = await req.json()

    if (!storeId || !currentPassword) {
      return new Response(
        JSON.stringify({ ok: false, error: 'storeId e senha atual são obrigatórios' }),
        { status: 400, headers: CORS }
      )
    }

    // ── Valida token HMAC (sessão autenticada) ──────────────
    const expectedToken = makeStoreToken(storeId)
    if (PERSIST_SECRET && expectedToken && token !== expectedToken) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Token inválido — faça login novamente' }),
        { status: 401, headers: CORS }
      )
    }

    // ── Busca market ─────────────────────────────────────────
    const store  = getStore('zs-auth')
    const raw    = await store.get('markets')
    const markets = raw ? JSON.parse(raw) : []
    const idx    = markets.findIndex(m => m.storeId === storeId)

    if (idx === -1) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Mercado não encontrado' }),
        { status: 404, headers: CORS }
      )
    }

    const market = markets[idx]

    // ── Verifica senha atual ─────────────────────────────────
    if (hashPwd(currentPassword, market.salt) !== market.passwordHash) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Senha atual incorreta' }),
        { status: 401, headers: CORS }
      )
    }

    // ── Aplica alterações ────────────────────────────────────
    if (newUsername && newUsername.trim()) {
      const uname = newUsername.trim().toLowerCase()
      // Verifica se username já existe em outro mercado
      const conflict = markets.find((m, i) => i !== idx && m.username === uname)
      if (conflict) {
        return new Response(
          JSON.stringify({ ok: false, error: 'Este usuário já está em uso' }),
          { status: 409, headers: CORS }
        )
      }
      markets[idx].username = uname
    }

    if (newPassword && newPassword.trim()) {
      const newSalt = randomBytes(16).toString('hex')
      markets[idx].salt         = newSalt
      markets[idx].passwordHash = hashPwd(newPassword.trim(), newSalt)
    }

    markets[idx].updatedAt = new Date().toISOString()
    await store.set('markets', JSON.stringify(markets))

    return new Response(
      JSON.stringify({ ok: true, message: 'Credenciais atualizadas com sucesso' }),
      { headers: CORS }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: CORS }
    )
  }
}

export const config = { path: '/api/update-auth' }
