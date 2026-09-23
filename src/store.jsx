import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import PRODUCTS_SEED from './utils/products_seed.json'
import { getAllPhotos, savePhoto as dbSavePhoto, deletePhoto as dbDeletePhoto } from './utils/photoDb.js'
import { mktKey, migrateAndGet, getMktStoreId, getMktStoreToken } from './utils/tenantStorage.js'
import { getOperatorName } from './utils/auth.js'

/* ── formatting helpers ─────────────────────────────────────── */
export const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export const fmtDate = (d) => new Date(d).toLocaleDateString('pt-BR')

/* ── seed data ──────────────────────────────────────────────── */
const SEED_PRODUCTS = PRODUCTS_SEED

const SEED_CUSTOMERS = [
  { id: 'c1', name: 'Maria Silva',  phone: '(15) 99111-1111', email: 'maria@email.com',  doc: '123.456.789-00', since: '2024-01-10' },
  { id: 'c2', name: 'João Santos',  phone: '(15) 98222-2222', email: 'joao@email.com',   doc: '987.654.321-00', since: '2024-03-22' },
  { id: 'c3', name: 'Ana Costa',   phone: '(15) 97333-3333', email: 'ana@email.com',    doc: '555.444.333-00', since: '2024-06-05' },
  { id: 'c4', name: 'Aline',        phone: '(15) 99660-4075', email: '',                  doc: '',               since: '2025-07-27', note: 'Esposa do Neteta 👑' },
]

// All promotion rules auto-generated from Gdoor CSV + manual
const SEED_PROMOS = []

// Build seed sales from real products in the database
const _seedProds = PRODUCTS_SEED.filter(p => p.price > 0 && p.stock > 0).slice(0, 50)
const _pick = (n) => _seedProds.slice(0, n).map(p => ({ productId: p.id, name: p.name, qty: Math.ceil(Math.random() * 3 + 1), price: p.price }))

const SEED_SALES = Array.from({ length: 28 }, (_, i) => {
  const d = new Date(); d.setDate(d.getDate() - (27 - i))
  const items = _pick(Math.ceil(Math.random() * 4 + 1))
  const subtotal = items.reduce((s, it) => s + it.qty * it.price, 0)
  const discount = i % 5 === 0 ? subtotal * 0.05 : 0
  return {
    id: `s${i + 1}`,
    date: d.toISOString(),
    items,
    total: subtotal - discount,
    payment: ['Dinheiro', 'Crédito', 'Débito', 'PIX'][i % 4],
    customerId: i % 7 === 0 ? 'c1' : null,
    discount,
  }
})

/* ── context ────────────────────────────────────────────────── */
const Ctx = createContext(null)
export const useStore = () => useContext(Ctx)

/* ── merge helper: pick up new seed fields (like promoGroup) for
   products already stored in localStorage without them ──────── */
const SEED_MAP = Object.fromEntries(SEED_PRODUCTS.map(p => [p.id, p]))
function mergeWithSeed(stored) {
  return stored.map(p => {
    const seed = SEED_MAP[p.id]
    if (!seed) return p
    // promoGroup: keep stored value if it was explicitly set (string or null),
    // fall back to seed value when the key is absent entirely (undefined)
    return {
      ...p,
      promoGroup: p.promoGroup !== undefined ? p.promoGroup : (seed.promoGroup ?? null),
    }
  })
}

/* ── Sell-Out Tracking — fire-and-forget, never blocks PDV ── */
const SELLOUT_KEY = 'cp_sellout_events'

function captureSellOut(saleItems, currentProducts) {
  try {
    const offers = JSON.parse(localStorage.getItem(mktKey('cp_supplier_offers')) || localStorage.getItem('cp_supplier_offers') || '[]')
    if (!offers.length) return

    const offerNames = new Set(offers.map(o => (o.productName || '').toLowerCase()))
    const identity = (() => { try { return JSON.parse(localStorage.getItem('cp_market_session_v1')) } catch { return null } })()
    const session  = (() => { try { return JSON.parse(localStorage.getItem('cp_session'))         } catch { return null } })()
    const storeName  = identity?.name  || session?.user || 'Corta Preço'
    const storePhone = identity?.phone || ''
    const storeId    = session?.storeId || 'default'

    const newEvents = saleItems
      .map(item => currentProducts.find(p => p.id === item.productId) && { item, prod: currentProducts.find(p => p.id === item.productId) })
      .filter(x => x && offerNames.has((x.prod.name || '').toLowerCase()))
      .map(({ item, prod }) => ({
        id:           `so${Date.now()}${Math.random().toString(36).slice(2, 5)}`,
        storeName, storePhone, storeId,
        productName:  prod.name,
        sku:          prod.sku || prod.barcode || '',
        qtySold:      item.qty,
        unitPrice:    prod.price,
        totalRevenue: +(item.qty * prod.price).toFixed(2),
        soldAt:       new Date().toISOString(),
      }))

    if (!newEvents.length) return

    const existing = JSON.parse(localStorage.getItem(SELLOUT_KEY) || '[]')
    const merged   = [...newEvents, ...existing].slice(0, 300)
    localStorage.setItem(SELLOUT_KEY, JSON.stringify(merged))

    const token = session?.storeToken || ''
    fetch('/api/persist', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-zs-token': token },
      body: JSON.stringify({ key: SELLOUT_KEY, value: JSON.stringify(merged), storeId }),
    }).catch(() => {})
  } catch {}
}

export function StoreProvider({ children }) {
  const [products, setProducts] = useState(() => {
    try {
      const s = migrateAndGet('cp_products', mktKey)
      return s ? mergeWithSeed(JSON.parse(s)) : SEED_PRODUCTS
    } catch { return SEED_PRODUCTS }
  })
  const [sales, setSales] = useState(() => {
    try { const s = migrateAndGet('cp_sales', mktKey); return s ? JSON.parse(s) : SEED_SALES } catch { return SEED_SALES }
  })
  const [customers, setCustomers] = useState(() => {
    try { const s = migrateAndGet('cp_customers', mktKey); return s ? JSON.parse(s) : SEED_CUSTOMERS } catch { return SEED_CUSTOMERS }
  })
  // ── Cash movements (sangria / suprimento) ─────────────────
  const [cashMovements, setCashMovements] = useState(() => {
    try { const s = migrateAndGet('cp_cash', mktKey); return s ? JSON.parse(s) : [] } catch { return [] }
  })

  // ── Sales goal (meta diária) ───────────────────────────────
  const [salesGoal, setSalesGoalState] = useState(() => {
    try { const s = migrateAndGet('cp_goal', mktKey); return s ? JSON.parse(s) : { daily: 0 } } catch { return { daily: 0 } }
  })

  // ── Operators ─────────────────────────────────────────────
  const [operators, setOperators] = useState(() => {
    try { const s = migrateAndGet('cp_operators', mktKey); return s ? JSON.parse(s) : [] } catch { return [] }
  })

  // ── Supplier Offers ────────────────────────────────────────
  const [supplierOffers, setSupplierOffers] = useState(() => {
    try { const s = migrateAndGet('cp_supplier_offers', mktKey); return s ? JSON.parse(s) : [] } catch { return [] }
  })

  // ── Product photos (IndexedDB — loaded async on mount) ─────
  const [photos, setPhotos] = useState({})
  useEffect(() => { getAllPhotos().then(setPhotos).catch(() => {}) }, [])

  const saveProductPhoto = useCallback(async (id, dataUrl) => {
    if (dataUrl) {
      await dbSavePhoto(id, dataUrl)
      setPhotos(prev => ({ ...prev, [id]: dataUrl }))
    } else {
      await dbDeletePhoto(id)
      setPhotos(prev => { const n = { ...prev }; delete n[id]; return n })
    }
  }, [])

  const [promos, setPromos] = useState(() => {
    try {
      const s = migrateAndGet('cp_promos', mktKey)
      if (!s) return SEED_PROMOS
      const stored = JSON.parse(s)
      const seedById = Object.fromEntries(SEED_PROMOS.map(p => [p.id, p]))
      // Seed rules always win (keeps price/qty updates); user-created rules are preserved
      const merged = stored.map(p => seedById[p.id] ?? p)
      const storedIds = new Set(stored.map(p => p.id))
      const added = SEED_PROMOS.filter(p => !storedIds.has(p.id))
      return [...merged, ...added]
    } catch { return SEED_PROMOS }
  })

  // ── Expiry alert threshold ────────────────────────────────
  const [expiryAlertDays, setExpiryAlertDaysState] = useState(() => {
    try { return parseInt(migrateAndGet('cp_expiry_days', mktKey) || '30', 10) } catch { return 30 }
  })
  const setExpiryAlertDays = useCallback((days) => {
    const n = Math.max(1, Math.min(365, parseInt(days, 10) || 30))
    setExpiryAlertDaysState(n)
    try { localStorage.setItem(mktKey('cp_expiry_days'), String(n)) } catch {}
  }, [])

  // ── Pending-persists counter (per key) ──────────────────────────
  // Tracks in-flight POSTs so that applyServerData never overwrites
  // local state while a write is still in transit (Bug-2 fix).
  // Also keeps the counter > 0 during a single retry on failure (Bug-3 fix).
  const pendingPersists = React.useRef({})

  // ── Persist: namespaced localStorage + storeId-prefixed server key ──
  const persist = useCallback((baseKey, val) => {
    const str      = JSON.stringify(val)
    const storeId  = getMktStoreId()
    const token    = getMktStoreToken()
    try { localStorage.setItem(mktKey(baseKey), str) } catch {}

    pendingPersists.current[baseKey] = (pendingPersists.current[baseKey] || 0) + 1

    const body = JSON.stringify({ key: baseKey, value: str, storeId })
    const hdrs = { 'Content-Type': 'application/json', 'x-zs-token': token }

    fetch('/api/persist', { method: 'POST', headers: hdrs, body })
      .then(r => {
        if (r.status === 401 || r.status === 403) {
          // Token inválido — não tenta retry; avisa o usuário para refazer login
          try { localStorage.setItem('zs_session_expired', '1') } catch {}
          window.dispatchEvent(new CustomEvent('zs:auth-error'))
          return
        }
        if (!r.ok) throw new Error('server')
      })
      .catch(() =>
        // One silent retry after 8 s — keeps pending > 0 during the window
        new Promise(res => setTimeout(res, 8000))
          .then(() => fetch('/api/persist', { method: 'POST', headers: hdrs, body }))
          .catch(() => {})
      )
      .finally(() => {
        pendingPersists.current[baseKey] = Math.max(0, (pendingPersists.current[baseKey] || 1) - 1)
      })
  }, [])

  // ── Last-sync timestamp (shown in UI) ────────────────────────
  const [lastSync, setLastSync] = useState(null)
  const [syncing,  setSyncing]  = useState(false)

  // ── Core restore function — called on mount and on interval ──
  const applyServerData = useCallback((data) => {
    if (!data) return
    const storeId = getMktStoreId()
    const token   = getMktStoreToken()
    const syncToServer = (key, value) =>
      fetch('/api/persist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-zs-token': token },
        body: JSON.stringify({ key, value, storeId }),
      }).catch(() => {})

    if (data.cp_products) try {
      const parsed = JSON.parse(data.cp_products)
      // Protege sync somente quando há POST real em trânsito (pendingPersists > 0).
      // Substitui a lógica anterior por contagem que ressuscitava registros excluídos.
      setProducts(prev => {
        if (pendingPersists.current['cp_products'] > 0) {
          syncToServer('cp_products', JSON.stringify(prev))
          return prev
        }
        try { localStorage.setItem(mktKey('cp_products'), data.cp_products) } catch {}
        return mergeWithSeed(parsed)
      })
    } catch {}
    if (data.cp_sales) try {
      setSales(JSON.parse(data.cp_sales))
      try { localStorage.setItem(mktKey('cp_sales'), data.cp_sales) } catch {}
    } catch {}
    if (data.cp_customers) try {
      setCustomers(JSON.parse(data.cp_customers))
      try { localStorage.setItem(mktKey('cp_customers'), data.cp_customers) } catch {}
    } catch {}
    if (data.cp_promos) try {
      try { localStorage.setItem(mktKey('cp_promos'), data.cp_promos) } catch {}
      const stored = JSON.parse(data.cp_promos)
      const seedById = Object.fromEntries(SEED_PROMOS.map(p => [p.id, p]))
      const merged = stored.map(p => seedById[p.id] ?? p)
      const storedIds = new Set(stored.map(p => p.id))
      setPromos([...merged, ...SEED_PROMOS.filter(p => !storedIds.has(p.id))])
    } catch {}
    if (data.cp_fiado)    { try { localStorage.setItem(mktKey('cp_fiado'), data.cp_fiado) } catch {} }
    if (data.cp_cash)     try { setCashMovements(JSON.parse(data.cp_cash));   try { localStorage.setItem(mktKey('cp_cash'),      data.cp_cash)      } catch {} } catch {}
    if (data.cp_goal)     try { setSalesGoalState(JSON.parse(data.cp_goal));  try { localStorage.setItem(mktKey('cp_goal'),      data.cp_goal)      } catch {} } catch {}
    if (data.cp_operators) try {
      const serverOps = JSON.parse(data.cp_operators)
      setOperators(prev => {
        if (pendingPersists.current['cp_operators'] > 0) {
          syncToServer('cp_operators', JSON.stringify(prev))
          return prev
        }
        // Operadores que existem só no local (persist falhou antes) são preservados
        // e enviados ao servidor para não se perderem no próximo sync.
        const serverIds = new Set(serverOps.map(o => o.id))
        const localOnly = prev.filter(o => !serverIds.has(o.id))
        const merged = localOnly.length > 0 ? [...serverOps, ...localOnly] : serverOps
        if (localOnly.length > 0) syncToServer('cp_operators', JSON.stringify(merged))
        try { localStorage.setItem(mktKey('cp_operators'), JSON.stringify(merged)) } catch {}
        return merged
      })
    } catch {}
    if (data.cp_supplier_offers) try { setSupplierOffers(JSON.parse(data.cp_supplier_offers)); try { localStorage.setItem(mktKey('cp_supplier_offers'), data.cp_supplier_offers); localStorage.setItem('cp_supplier_offers', data.cp_supplier_offers) } catch {} } catch {}

    // Push local keys not yet on server
    if (!data.cp_customers)  setCustomers(c  => { syncToServer('cp_customers',  JSON.stringify(c));  return c })
    if (!data.cp_promos)     setPromos(pr    => { syncToServer('cp_promos',     JSON.stringify(pr)); return pr })
    if (!data.cp_products)   setProducts(p   => { syncToServer('cp_products',   JSON.stringify(p));  return p })
    if (!data.cp_sales)      setSales(s      => { syncToServer('cp_sales',      JSON.stringify(s));  return s })
    if (!data.cp_operators)  setOperators(o  => { syncToServer('cp_operators',  JSON.stringify(o));  return o })

    setLastSync(new Date())
  }, []) // eslint-disable-line

  // ── Manual sync (exposed to UI) ──────────────────────────────
  const syncNow = useCallback(() => {
    setSyncing(true)
    const storeId = getMktStoreId()
    const token   = getMktStoreToken()
    fetch(`/api/restore?storeId=${storeId}`, { headers: { 'x-zs-token': token } })
      .then(r => r.json())
      .then(({ ok, data }) => { if (ok) applyServerData(data) })
      .catch(() => {})
      .finally(() => setSyncing(false))
  }, [applyServerData])

  // ── Boot + auto-poll every 30 s ──────────────────────────────
  useEffect(() => {
    syncNow()
    const id = setInterval(syncNow, 30_000)
    return () => clearInterval(id)
  }, [syncNow])

  // ── Cross-tab sync: reload state when another tab writes ─────
  useEffect(() => {
    const onStorage = (e) => {
      try {
        if (e.key === mktKey('cp_products') && e.newValue) setProducts(JSON.parse(e.newValue))
        if (e.key === mktKey('cp_sales')    && e.newValue) setSales(JSON.parse(e.newValue))
        if (e.key === mktKey('cp_promos')   && e.newValue) setPromos(JSON.parse(e.newValue))
        if (e.key === mktKey('cp_customers')&& e.newValue) setCustomers(JSON.parse(e.newValue))
        // Cross-system: Fornecedor writes flat key → Dashboard badge updates immediately
        if (e.key === 'cp_supplier_offers'  && e.newValue) setSupplierOffers(JSON.parse(e.newValue))
      } catch {}
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const upsertProduct = useCallback((p) => {
    setProducts(prev => {
      const exists = p.id && prev.some(x => x.id === p.id)
      const next = exists
        ? prev.map(x => x.id === p.id ? { ...x, ...p } : x)
        : [...prev, { ...p, id: p.id ?? `p${Date.now()}_${Math.random().toString(36).slice(2)}` }]
      persist('cp_products', next); return next
    })
  }, [persist])

  const deleteProduct = useCallback((id) => {
    setProducts(prev => { const next = prev.filter(x => x.id !== id); persist('cp_products', next); return next })
  }, [persist])

  // Atualiza vários produtos de uma vez num único persist — sem race condition
  // entre os POSTs. Usa o estoque ATUAL de `prev` (não o valor no momento do scan).
  // Usado pelo ScanMobile confirmAll para aplicar o lote de entrada de estoque.
  const bulkUpsertProducts = useCallback((batch) => {
    // batch: [{ product, qty, vencimento, custo }]
    setProducts(prev => {
      let next = [...prev]
      for (const { product, qty, vencimento, custo } of batch) {
        const idx = next.findIndex(p => p.id === product.id)
        if (idx < 0) {
          // Produto não está no state atual (sync apagou enquanto POST estava em voo).
          // Insere com o qty como estoque inicial em vez de ignorar silenciosamente.
          const upd = { ...product, stock: qty, receivedAt: new Date().toISOString() }
          if (custo)      upd.cost       = parseFloat(custo)
          if (vencimento) upd.expiryDate = vencimento
          next = [...next, upd]
          continue
        }
        const cur = next[idx]
        const upd = {
          ...cur,
          stock:       (cur.stock || 0) + qty,
          receivedAt:  new Date().toISOString(),
        }
        if (custo)      upd.cost       = parseFloat(custo)
        if (vencimento) upd.expiryDate = vencimento
        next = next.map((p, i) => i === idx ? upd : p)
      }
      persist('cp_products', next)
      return next
    })
  }, [persist])

  const registerSale = useCallback((sale) => {
    const s = { ...sale, id: `s${Date.now()}`, date: sale.date || new Date().toISOString(), operatorName: sale.operatorName || getOperatorName() }
    setSales(prev => { const next = [s, ...prev]; persist('cp_sales', next); return next })
    setProducts(prev => {
      const next = prev.map(p => {
        const item = sale.items.find(i => i.productId === p.id)
        return item ? { ...p, stock: Math.max(0, p.stock - item.qty) } : p
      })
      persist('cp_products', next); return next
    })
    // Sell-out tracking: fire-and-forget, never blocks the sale
    captureSellOut(sale.items, products)
    return s
  }, [persist, products])

  const cancelSale = useCallback((saleId) => {
    setSales(prev => {
      const sale = prev.find(s => s.id === saleId)
      if (!sale) return prev
      // revert stock for each item that has a productId
      if (sale.items?.length) {
        setProducts(pp => {
          const next = pp.map(p => {
            const item = sale.items.find(i => i.productId === p.id)
            return item ? { ...p, stock: (p.stock || 0) + item.qty } : p
          })
          persist('cp_products', next)
          return next
        })
      }
      const next = prev.filter(s => s.id !== saleId)
      persist('cp_sales', next)
      return next
    })
  }, [persist])

  const upsertPromo = useCallback((p) => {
    setPromos(prev => {
      const id   = p.id || `pr${Date.now()}`
      const idx  = prev.findIndex(x => x.id === id)
      const item = { createdAt: new Date().toISOString().slice(0,10), ...p, id }
      const next = idx >= 0
        ? prev.map(x => x.id === id ? { ...x, ...item } : x)   // update
        : [item, ...prev]                                         // insert at top
      persist('cp_promos', next); return next
    })
  }, [persist])

  const deletePromo = useCallback((id) => {
    setPromos(prev => { const next = prev.filter(x => x.id !== id); persist('cp_promos', next); return next })
  }, [persist])

  /* assign / unassign promoGroup on a product */
  const assignPromoGroup = useCallback((productId, group) => {
    setProducts(prev => {
      const next = prev.map(p => p.id === productId ? { ...p, promoGroup: group || null } : p)
      persist('cp_products', next); return next
    })
  }, [persist])

  const upsertCustomer = useCallback((c) => {
    setCustomers(prev => {
      const next = c.id
        ? prev.map(x => x.id === c.id ? { ...x, ...c } : x)
        : [...prev, { ...c, id: `c${Date.now()}`, since: new Date().toISOString().slice(0, 10) }]
      persist('cp_customers', next); return next
    })
  }, [persist])

  const deleteCustomer = useCallback((id) => {
    setCustomers(prev => { const next = prev.filter(x => x.id !== id); persist('cp_customers', next); return next })
  }, [persist])

  /* ── Fiado (credit/tab) ──────────────────────────────────── */
  const addFiado = useCallback((customerId, amount, desc = '') => {
    setCustomers(prev => {
      const next = prev.map(c => {
        if (c.id !== customerId) return c
        const log = { id: `f${Date.now()}`, ts: new Date().toISOString(), amount: +amount, desc, type: 'debito' }
        return { ...c, fiadoBalance: ((c.fiadoBalance || 0) + +amount), fiadoLogs: [...(c.fiadoLogs || []), log] }
      })
      persist('cp_customers', next); return next
    })
  }, [persist])

  const payFiado = useCallback((customerId, amount, desc = 'Pagamento') => {
    setCustomers(prev => {
      const next = prev.map(c => {
        if (c.id !== customerId) return c
        const log = { id: `f${Date.now()}`, ts: new Date().toISOString(), amount: -Math.abs(+amount), desc, type: 'pagamento' }
        return { ...c, fiadoBalance: Math.max(0, (c.fiadoBalance || 0) - Math.abs(+amount)), fiadoLogs: [...(c.fiadoLogs || []), log] }
      })
      persist('cp_customers', next); return next
    })
  }, [persist])

  const importProducts = useCallback((list, opts = {}) => {
    // opts.addStock: true → add qty to existing stock instead of replacing
    // opts.merge:    true → match by barcode if SKU not found
    setProducts(prev => {
      const bySku     = Object.fromEntries(prev.map(p => [p.sku,     p]))
      const byBarcode = Object.fromEntries(prev.filter(p => p.barcode).map(p => [p.barcode, p]))

      list.forEach(p => {
        const existing = bySku[p.sku] || (opts.merge && p.barcode ? byBarcode[p.barcode] : null)
        const key = existing ? existing.sku : (p.sku || `nfe_${p.barcode || Date.now()}_${Math.random()}`)
        const merged = {
          ...existing,
          ...p,
          sku: key,
          id:  existing?.id || `p${Date.now()}_${Math.random()}`,
        }
        if (opts.addStock && existing) {
          merged.stock = (Number(existing.stock) || 0) + (Number(p.stock) || 0)
          // preserve existing price if not provided
          if (!p.price) merged.price = existing.price
        }
        bySku[key] = merged
        if (merged.barcode) byBarcode[merged.barcode] = merged
      })

      const next = Object.values(bySku)
      persist('cp_products', next); return next
    })
  }, [persist])

  // ── Cash movements (sangria / suprimento) ─────────────────
  const addCashMovement = useCallback((mov) => {
    const entry = { ...mov, id: `cm${Date.now()}`, date: new Date().toISOString() }
    setCashMovements(prev => {
      const next = [entry, ...prev]
      persist('cp_cash', next); return next
    })
  }, [persist])

  // ── Sales goal ────────────────────────────────────────────
  const setSalesGoal = useCallback((goal) => {
    setSalesGoalState(goal)
    persist('cp_goal', goal)
  }, [persist])

  // ── Operators ─────────────────────────────────────────────
  const upsertOperator = useCallback((op) => {
    setOperators(prev => {
      const next = op.id
        ? prev.map(x => x.id === op.id ? { ...x, ...op } : x)
        : [...prev, { ...op, id: `op${Date.now()}` }]
      persist('cp_operators', next); return next
    })
  }, [persist])

  const deleteOperator = useCallback((id) => {
    setOperators(prev => { const next = prev.filter(x => x.id !== id); persist('cp_operators', next); return next })
  }, [persist])

  const syncOperators = useCallback(() => {
    setOperators(prev => { persist('cp_operators', prev); return prev })
  }, [persist])

  const resetAll = useCallback(() => {
    setProducts(SEED_PRODUCTS); setSales(SEED_SALES); setCustomers(SEED_CUSTOMERS); setPromos(SEED_PROMOS)
    ;['cp_products','cp_sales','cp_customers','cp_promos'].forEach(k => localStorage.removeItem(mktKey(k)))
  }, [])

  // Limpa chaves específicas: local + servidor. Mantém operadores e configurações.
  const clearBusinessData = useCallback(async (keys = ['cp_products','cp_sales','cp_fiado','cp_customers','cp_cash']) => {
    const storeId = getMktStoreId()
    const token   = getMktStoreToken()
    const MAP = {
      cp_products:  () => { setProducts([]);        },
      cp_sales:     () => { setSales([]);            },
      cp_customers: () => { setCustomers([]);        },
      cp_promos:    () => { setPromos(SEED_PROMOS);  },
      cp_fiado:     () => {                          },
      cp_cash:      () => { setCashMovements([]);    },
    }
    for (const key of keys) {
      MAP[key]?.()
      // Setar '[]' em vez de removeItem — evita que na próxima carga de página
      // o useState leia null e inicie com SEED_PRODUCTS (flash de produtos falsos)
      try { localStorage.setItem(mktKey(key), '[]') } catch {}
      await fetch('/api/persist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-zs-token': token },
        body: JSON.stringify({ key, value: JSON.stringify([]), storeId }),
      }).catch(() => {})
    }
  }, [])

  return (
    <Ctx.Provider value={{
      products, sales, customers, promos,
      cashMovements, salesGoal, operators,
      photos, saveProductPhoto,
      upsertProduct, deleteProduct, bulkUpsertProducts, registerSale, cancelSale,
      upsertCustomer, deleteCustomer, importProducts,
      upsertPromo, deletePromo, assignPromoGroup,
      addFiado, payFiado,
      addCashMovement, setSalesGoal,
      upsertOperator, deleteOperator, syncOperators,
      resetAll, clearBusinessData,
      syncNow, lastSync, syncing,
      expiryAlertDays, setExpiryAlertDays,
      supplierOffers,
    }}>
      {children}
    </Ctx.Provider>
  )
}
