/**
 * wa-welcome — Envia boas-vindas de ativação via WhatsApp (Zara → cliente)
 *
 * POST /api/wa-welcome
 * body: { mk, phone, storeName, username, password }
 *
 * Usa a instância principal (Zara) para enviar ao telefone do mercado.
 */

import { getStore } from '@netlify/blobs'
import { createHash } from 'crypto'

const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }

function hashMK(mk) { return createHash('sha256').update(mk + 'zs_master').digest('hex').slice(0, 16) }

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS })
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: CORS })

  const url = process.env.EVOLUTION_API_URL?.replace(/\/$/, '')
  const key = process.env.EVOLUTION_API_KEY
  const instance = process.env.EVOLUTION_INSTANCE

  if (!url || !key || !instance)
    return new Response(JSON.stringify({ ok: false, error: 'Evolution API não configurada' }), { status: 503, headers: CORS })

  let body
  try { body = await req.json() } catch { return new Response(JSON.stringify({ ok: false, error: 'Body inválido' }), { status: 400, headers: CORS }) }

  const { mk, phone, storeName, username, password } = body
  if (!mk || !phone || !storeName || !username || !password)
    return new Response(JSON.stringify({ ok: false, error: 'Campos obrigatórios: mk, phone, storeName, username, password' }), { status: 400, headers: CORS })

  // Valida master key
  try {
    const store   = getStore('corta-precos')
    const storedHash = await store.get('master-key-hash')
    if (storedHash && hashMK(mk) !== storedHash)
      return new Response(JSON.stringify({ ok: false, error: 'Chave inválida' }), { status: 403, headers: CORS })
  } catch { /* ignora se ainda não existe */ }

  // Formata número: remove não-dígitos, garante DDI 55
  const cleaned = '55' + phone.replace(/\D/g, '').replace(/^55/, '').replace(/^0/, '').slice(-11)
  if (cleaned.length < 12)
    return new Response(JSON.stringify({ ok: false, error: 'Telefone inválido' }), { status: 400, headers: CORS })

  const text = [
    `✅ *Bem-vindo ao ZatendeStok, ${storeName}!*`,
    '',
    `Seu acesso está ativo! Aqui estão suas credenciais:`,
    '',
    `🌐 *Link:* https://zatendestok.com.br`,
    `👤 *Usuário:* ${username}`,
    `🔑 *Senha:* ${password}`,
    '',
    `📱 Acesse pelo celular, tablet ou computador — sem instalar nada!`,
    '',
    `Qualquer dúvida é só chamar aqui mesmo. Boas vendas! 🚀`,
  ].join('\n')

  try {
    const res = await fetch(`${url}/message/sendText/${instance}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key },
      body: JSON.stringify({ number: cleaned, text }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return new Response(JSON.stringify({ ok: false, error: `Evolution: ${res.status}`, detail: data }), { status: 502, headers: CORS })
    return new Response(JSON.stringify({ ok: true, sent: true }), { headers: CORS })
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: CORS })
  }
}

export const config = { path: '/api/wa-welcome' }
