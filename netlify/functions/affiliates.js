/**
 * affiliates — Sistema de vendedores externos ZatendeStok
 *
 * GET  ?mk=...                  → lista todos (admin)
 * GET  ?code=xxx                → stats públicas do afiliado (por código)
 * POST ?mk=... { action, ... }  → criar / toggle / delete / credit (admin)
 */

import { getStore } from '@netlify/blobs'
import { randomBytes } from 'crypto'

const MASTER_KEY = process.env.ZS_MASTER_KEY || 'zatende2026master'
const STORE_KEY  = 'affiliates'
const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function authOk(req) {
  const url = new URL(req.url)
  return url.searchParams.get('mk') === MASTER_KEY ||
         req.headers.get('x-master-key') === MASTER_KEY
}

function store() {
  return getStore({ name: 'zs-affiliates', consistency: 'strong' })
}

async function load() {
  try { const r = await store().get(STORE_KEY); return r ? JSON.parse(r) : [] }
  catch { return [] }
}

async function save(list) {
  await store().set(STORE_KEY, JSON.stringify(list))
}

function uid() { return randomBytes(4).toString('hex') }

function slugCode(str = '') {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 16) || uid()
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS })

  const url  = new URL(req.url)
  const code = url.searchParams.get('code')

  /* ── PUBLIC: stats por código (para o dashboard do afiliado) ── */
  if (req.method === 'GET' && code) {
    const list = await load()
    const aff  = list.find(a => a.codigo === code.toLowerCase())
    if (!aff) return new Response(JSON.stringify({ ok: false, error: 'Código inválido' }), { status: 404, headers: CORS })

    const { passwordHash, ...pub } = aff   // nunca expõe hash
    return new Response(JSON.stringify({ ok: true, affiliate: pub }), { headers: CORS })
  }

  /* ── Tudo abaixo requer autenticação ── */
  if (!authOk(req)) return new Response(JSON.stringify({ ok: false, error: 'Não autorizado' }), { status: 401, headers: CORS })

  /* ── GET admin: lista todos ── */
  if (req.method === 'GET') {
    const list = await load()
    return new Response(JSON.stringify({ ok: true, affiliates: list.map(({ passwordHash, ...a }) => a) }), { headers: CORS })
  }

  if (req.method !== 'POST')
    return new Response(JSON.stringify({ ok: false, error: 'Método inválido' }), { status: 405, headers: CORS })

  let body
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ ok: false, error: 'JSON inválido' }), { status: 400, headers: CORS })
  }

  const { action } = body
  const list = await load()

  /* ── CREATE ── */
  if (action === 'create') {
    const { nome, telefone, comissaoPct = 0.20 } = body
    if (!nome || !telefone) return new Response(JSON.stringify({ ok: false, error: 'nome e telefone obrigatórios' }), { status: 400, headers: CORS })

    const codigo = slugCode(body.codigo || nome)
    if (list.find(a => a.codigo === codigo))
      return new Response(JSON.stringify({ ok: false, error: `Código "${codigo}" já existe` }), { status: 409, headers: CORS })

    const aff = {
      id:          `aff_${uid()}`,
      nome:        nome.trim(),
      telefone:    telefone.trim(),
      codigo,
      comissaoPct: Math.min(Math.max(Number(comissaoPct) || 0.20, 0.01), 0.50),
      ativo:       true,
      vendas:      [],
      createdAt:   new Date().toISOString(),
    }
    list.push(aff)
    await save(list)

    const { passwordHash, ...pub } = aff
    return new Response(JSON.stringify({ ok: true, affiliate: pub }), { headers: CORS })
  }

  /* ── TOGGLE ativo/inativo ── */
  if (action === 'toggle') {
    const a = list.find(a => a.id === body.id)
    if (!a) return new Response(JSON.stringify({ ok: false, error: 'Não encontrado' }), { status: 404, headers: CORS })
    a.ativo = !a.ativo
    await save(list)
    return new Response(JSON.stringify({ ok: true, ativo: a.ativo }), { headers: CORS })
  }

  /* ── DELETE ── */
  if (action === 'delete') {
    const before = list.length
    const next   = list.filter(a => a.id !== body.id)
    if (next.length === before) return new Response(JSON.stringify({ ok: false, error: 'Não encontrado' }), { status: 404, headers: CORS })
    await save(next)
    return new Response(JSON.stringify({ ok: true }), { headers: CORS })
  }

  /* ── CREDIT: registra uma venda para o afiliado (chamado internamente ao aprovar) ── */
  if (action === 'credit') {
    const { codigo, requestId, mercado, niche, plano, valorPlano } = body
    const a = list.find(a => a.codigo === (codigo || '').toLowerCase())
    if (!a) return new Response(JSON.stringify({ ok: false, error: 'Afiliado não encontrado' }), { status: 404, headers: CORS })

    const comissao = Math.round((Number(valorPlano) || 0) * a.comissaoPct * 100) / 100
    a.vendas.push({
      requestId,
      mercado:    mercado || '—',
      niche:      niche   || 'mercado',
      plano:      plano   || 'basic',
      valorPlano: Number(valorPlano) || 0,
      comissao,
      creditedAt: new Date().toISOString(),
    })
    await save(list)
    return new Response(JSON.stringify({ ok: true, comissao }), { headers: CORS })
  }

  return new Response(JSON.stringify({ ok: false, error: 'action inválida' }), { status: 400, headers: CORS })
}

export const config = { path: '/api/affiliates' }
