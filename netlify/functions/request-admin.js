/**
 * /api/request-admin
 *
 * POST (público, sem mk) — cliente envia solicitação de cadastro
 * body: { nome, mercado, cidade, telefone, email? }
 *
 * GET  ?mk=...           — admin lista solicitações pendentes/todas
 * POST ?mk=... + action  — admin aprova/rejeita/arquiva
 *   actions: 'approve' | 'reject' | 'delete'
 *   approve cria a conta automaticamente via markets-admin logic
 */
import { getStore } from '@netlify/blobs'
import { createHash, randomBytes } from 'crypto'

const MASTER_KEY    = process.env.ZS_MASTER_KEY || 'zatende2026master'
const APP_SALT      = 'zs_2026_corta'
const APP_SALT_FORN = 'zs_2026_forn'

/* ── Seed de produtos iniciais por nicho ─────────────────────────────────── */
function seedProducts(niche) {
  const ts = Date.now()
  const p  = (i, name, cat, unit, price, cost, stock, minStock) => ({
    id: `p${ts}${i}`, sku: '', name, category: cat, unit,
    price, cost, stock, minStock, expiryDate: null, priceAtacado: 0, qtdAtacado: 0,
  })
  const n = (niche || '').toLowerCase()
  if (n === 'padaria' || n === 'confeitaria' || n === 'sorveteria') return [
    p(1,  'Farinha de Trigo 5kg',   'Insumos',    'sc', 22.90, 16.00, 10, 3),
    p(2,  'Açúcar Refinado 1kg',    'Insumos',    'un',  5.90,  3.80, 10, 3),
    p(3,  'Fermento Biológico 15g', 'Insumos',    'un',  3.50,  2.00, 20, 5),
    p(4,  'Manteiga 200g',          'Insumos',    'un',  9.90,  7.00,  8, 2),
    p(5,  'Pão Francês (kg)',        'Produtos',   'kg', 18.00,  8.00,  5, 1),
    p(6,  'Pão de Forma',            'Produtos',   'un',  8.90,  5.00,  8, 2),
    p(7,  'Croissant',               'Confeitaria','un',  6.50,  2.80, 10, 3),
    p(8,  'Bolo de Fubá 500g',       'Confeitaria','un', 22.00, 10.00,  4, 1),
    p(9,  'Coxinha',                 'Salgados',   'un',  4.50,  1.80, 15, 5),
    p(10, 'Café Preto 50ml',         'Bebidas',    'un',  3.00,  0.80,  0, 0),
  ]
  if (n === 'açougue' || n === 'frigorifico' || n === 'frigorífico') return [
    p(1,  'Picanha (kg)',          'Bovino',    'kg', 75.00, 55.00, 3, 1),
    p(2,  'Fraldinha (kg)',        'Bovino',    'kg', 55.00, 40.00, 3, 1),
    p(3,  'Maminha (kg)',          'Bovino',    'kg', 48.00, 35.00, 3, 1),
    p(4,  'Patinho Moído (kg)',    'Bovino',    'kg', 38.00, 28.00, 5, 2),
    p(5,  'Costela Bovina (kg)',   'Bovino',    'kg', 35.00, 25.00, 4, 1),
    p(6,  'Frango Inteiro (kg)',   'Frango',    'kg', 14.90, 10.00, 8, 2),
    p(7,  'Coxa e Sobrecoxa (kg)','Frango',    'kg', 12.90,  8.50, 6, 2),
    p(8,  'Costela Suína (kg)',    'Suíno',     'kg', 32.00, 22.00, 3, 1),
    p(9,  'Linguiça Toscana (kg)','Embutidos', 'kg', 28.00, 19.00, 4, 1),
    p(10, 'Carne Seca (kg)',       'Especiais', 'kg', 65.00, 48.00, 2, 1),
  ]
  if (['restaurante','lanchonete','espetinho','pizzaria','bar','choperia'].includes(n)) return [
    p(1,  'Arroz Agulhinha 5kg',  'Insumos',  'sc', 29.90, 22.00,  5, 1),
    p(2,  'Feijão Carioca 1kg',   'Insumos',  'un',  8.90,  6.50,  5, 2),
    p(3,  'Óleo de Soja 900ml',   'Insumos',  'un',  8.49,  6.50,  6, 2),
    p(4,  'Frango Inteiro (kg)',   'Proteína', 'kg', 14.90, 10.00, 10, 3),
    p(5,  'Patinho Moído (kg)',    'Proteína', 'kg', 38.00, 28.00,  3, 1),
    p(6,  'Refrigerante Lata',    'Bebidas',  'un',  6.00,  3.50, 24, 6),
    p(7,  'Água Mineral 500ml',   'Bebidas',  'un',  3.00,  1.50, 24,12),
    p(8,  'Prato Executivo',      'Pratos',   'un', 20.00,  8.00,  0, 0),
    p(9,  'Marmita P',            'Pratos',   'un', 12.00,  5.00,  0, 0),
    p(10, 'Refrigerante 2L',      'Bebidas',  'un',  9.00,  6.50, 12, 3),
  ]
  // default: mercado/supermercado/mercearia/conveniência
  return [
    p(1,  'Arroz Agulhinha 5kg',     'Mercearia',       'un', 29.90, 22.00, 20, 5),
    p(2,  'Feijão Carioca 1kg',      'Mercearia',       'un',  8.90,  6.50, 20, 8),
    p(3,  'Açúcar Cristal 1kg',      'Mercearia',       'un',  5.90,  4.20, 25, 8),
    p(4,  'Óleo de Soja 900ml',      'Mercearia',       'un',  8.49,  6.80, 20, 5),
    p(5,  'Macarrão Espaguete 500g', 'Mercearia',       'un',  4.49,  3.20, 30,10),
    p(6,  'Leite Integral 1L',       'Frios/Laticínios','un',  5.99,  4.80, 24,12),
    p(7,  'Refrigerante 2L',         'Bebidas',         'un',  8.99,  6.50, 24, 6),
    p(8,  'Sabão em Pó 1kg',         'Limpeza',         'un', 12.90,  9.50, 15, 5),
    p(9,  'Detergente 500ml',        'Limpeza',         'un',  3.49,  2.30, 20, 8),
    p(10, 'Farinha de Trigo 1kg',    'Mercearia',       'un',  4.90,  3.50, 15, 5),
  ]
}

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function auth(req) {
  return new URL(req.url).searchParams.get('mk') === MASTER_KEY
}

function slugify(str = '') {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 24) || 'mercado'
}

function hashPwd(pwd, salt) {
  return createHash('sha256').update(`${APP_SALT}:${salt}:${pwd}`).digest('hex')
}

function hashFornPwd(pwd, salt) {
  return createHash('sha256').update(`${APP_SALT_FORN}:${salt}:${pwd}`).digest('hex')
}

function genPass() {
  return randomBytes(4).toString('hex') // 8-char hex password
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS })

  const isAdmin = auth(req)
  const store   = getStore('zs-auth')

  /* ── PUBLIC: submit request ─────────────────────────────── */
  if (req.method === 'POST' && !isAdmin) {
    let body
    try { body = await req.json() } catch {
      return new Response(JSON.stringify({ ok: false, error: 'JSON inválido' }), { status: 400, headers: CORS })
    }

    const { nome, mercado, cidade, telefone, email, tipo, niche, ref } = body
    if (!nome || !mercado || !cidade || !telefone) {
      return new Response(JSON.stringify({ ok: false, error: 'Campos obrigatórios: nome, mercado, cidade, telefone' }), { status: 400, headers: CORS })
    }

    const raw = await store.get('pending-requests')
    const list = raw ? JSON.parse(raw) : []

    const request = {
      id:        `req_${Date.now()}`,
      nome:      nome.trim(),
      mercado:   mercado.trim(),
      cidade:    cidade.trim(),
      telefone:  telefone.trim(),
      email:     (email || '').trim(),
      tipo:      tipo   || 'mercado',   // 'mercado' | 'distribuidor'
      niche:     niche  || tipo || 'mercado', // nicho específico (padaria, açougue, etc.)
      ref:       (ref   || '').trim().toLowerCase(), // código do afiliado
      status:    'pending',
      createdAt: new Date().toISOString(),
    }

    list.push(request)
    await store.set('pending-requests', JSON.stringify(list))

    return new Response(JSON.stringify({ ok: true, id: request.id }), { headers: CORS })
  }

  /* ── ADMIN required from here ───────────────────────────── */
  if (!isAdmin) {
    return new Response(JSON.stringify({ ok: false, error: 'Não autorizado' }), { status: 401, headers: CORS })
  }

  /* ── GET: list requests ─────────────────────────────────── */
  if (req.method === 'GET') {
    const raw   = await store.get('pending-requests')
    const list  = raw ? JSON.parse(raw) : []
    const url   = new URL(req.url)
    const filter = url.searchParams.get('status') || 'pending' // 'pending' | 'all'
    const result = filter === 'all' ? list : list.filter(r => r.status === 'pending')
    return new Response(JSON.stringify({ ok: true, requests: result }), { headers: CORS })
  }

  /* ── POST admin actions ─────────────────────────────────── */
  if (req.method === 'POST') {
    let body
    try { body = await req.json() } catch {
      return new Response(JSON.stringify({ ok: false, error: 'JSON inválido' }), { status: 400, headers: CORS })
    }

    const { action, id } = body
    const raw  = await store.get('pending-requests')
    const list = raw ? JSON.parse(raw) : []
    const idx  = list.findIndex(r => r.id === id)

    if (idx === -1) {
      return new Response(JSON.stringify({ ok: false, error: 'Solicitação não encontrada' }), { status: 404, headers: CORS })
    }

    /* ── reject ── */
    if (action === 'reject') {
      list[idx].status     = 'rejected'
      list[idx].rejectedAt = new Date().toISOString()
      await store.set('pending-requests', JSON.stringify(list))
      return new Response(JSON.stringify({ ok: true }), { headers: CORS })
    }

    /* ── delete ── */
    if (action === 'delete') {
      list.splice(idx, 1)
      await store.set('pending-requests', JSON.stringify(list))
      return new Response(JSON.stringify({ ok: true }), { headers: CORS })
    }

    /* ── approve: create account (mercado OR distribuidor) ── */
    if (action === 'approve') {
      const req2     = list[idx]
      const isDistrib = (req2.tipo === 'distribuidor')

      // Generate credentials
      const password = genPass()
      const salt     = randomBytes(16).toString('hex')
      const username = slugify(req2.mercado || req2.empresa || 'mercado')

      if (isDistrib) {
        // Create distribuidor account in zs-forn-auth store
        const fornStore = getStore('zs-forn-auth')
        const fornRaw   = await fornStore.get('distributors')
        const fornList  = fornRaw ? JSON.parse(fornRaw) : []

        const existsUser  = fornList.some(d => d.username === username)
        const finalUser   = existsUser ? `${username}${fornList.length}` : username
        const tenantId    = finalUser
        const id          = `forn_${finalUser}`

        fornList.push({
          id, tenantId,
          username:     finalUser,
          passwordHash: hashFornPwd(password, salt),   // must match forn-auth.js salt
          salt,
          storeName:    req2.mercado,
          storePhone:   req2.telefone,
          email:        req2.email || '',
          themeColor:   '#22c55e',
          active:       true,
          plan:         'basic',
          createdAt:    new Date().toISOString(),
          requestId:    req2.id,
        })
        await fornStore.set('distributors', JSON.stringify(fornList))

        list[idx].status     = 'approved'
        list[idx].approvedAt = new Date().toISOString()
        list[idx].username   = finalUser
        list[idx].tenantId   = tenantId
        await store.set('pending-requests', JSON.stringify(list))

        return new Response(JSON.stringify({ ok:true, username:finalUser, password, tipo:'distribuidor', loginUrl:'/fornecedor' }), { headers: CORS })
      }

      // Create MERCADO account in zs-auth store
      const storeId = `${username}_${Date.now()}`
      const mRaw    = await store.get('markets')
      const markets = mRaw ? JSON.parse(mRaw) : []

      const existsUser = markets.some(m => m.username === username)
      const finalUser  = existsUser ? `${username}${markets.length}` : username

      const newMarket = {
        id:           storeId,
        storeId,
        storeName:    req2.mercado,
        username:     finalUser,
        passwordHash: hashPwd(password, salt),
        salt,
        email:        req2.email || '',
        storePhone:   req2.telefone,
        active:       true,
        plan:         'basic',
        createdAt:    new Date().toISOString(),
        requestId:    req2.id,
      }

      markets.push(newMarket)
      await store.set('markets', JSON.stringify(markets))

      // Mark request as approved
      list[idx].status     = 'approved'
      list[idx].approvedAt = new Date().toISOString()
      list[idx].username   = finalUser
      list[idx].storeId    = storeId
      await store.set('pending-requests', JSON.stringify(list))

      const base = new URL(req.url).origin

      // 1) Seed produtos iniciais por nicho (não-bloqueante)
      const products = seedProducts(req2.niche || req2.tipo)
      fetch(`${base}/api/persist`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ key: 'cp_products', value: JSON.stringify(products), storeId }),
      }).catch(() => {})

      // 2) Creditar afiliado se veio com ?ref (não-bloqueante)
      if (req2.ref) {
        const planValues = { basic: 0, essencial: 297, profissional: 497 }
        const valorPlano = planValues[newMarket.plan] || 0
        fetch(`${base}/api/affiliates?mk=${MASTER_KEY}`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            action:    'credit',
            codigo:    req2.ref,
            requestId: req2.id,
            mercado:   req2.mercado,
            niche:     req2.niche || 'mercado',
            plano:     newMarket.plan || 'basic',
            valorPlano,
          }),
        }).catch(() => {})
      }

      // 3) Enviar email de boas-vindas se endereço fornecido
      let emailResult = null
      if (req2.email) {
        try {
          const emailRes = await fetch(`${base}/api/send-email?mk=${MASTER_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to:        req2.email,
              type:      'market',
              storeName: req2.mercado,
              username:  finalUser,
              password,
            }),
          })
          emailResult = await emailRes.json()
        } catch {}
      }

      return new Response(JSON.stringify({
        ok:       true,
        username: finalUser,
        password,
        storeId,
        emailResult,
      }), { headers: CORS })
    }

    return new Response(JSON.stringify({ ok: false, error: 'Ação inválida' }), { status: 400, headers: CORS })
  }

  return new Response('Method not allowed', { status: 405 })
}

export const config = { path: '/api/request-admin' }
