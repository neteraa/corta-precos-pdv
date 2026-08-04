import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import PRODUCTS_SEED from './utils/products_seed.json'
import { getAllPhotos, savePhoto as dbSavePhoto, deletePhoto as dbDeletePhoto } from './utils/photoDb.js'

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
const SEED_PROMOS = [
  { id: 'pr1',             name: '4 Bono / Negresco 90g por R$10,99', group: 'BONO_NEGRESCO_4x999', qty: 4, totalPrice: 10.99, active: true, createdAt: '2025-01-01' },
  { id: 'pr2',             name: '7 DonDon Garrafinha 140g por R$10,01', group: 'DONDON_7x999',      qty: 7, totalPrice: 10.01, active: true, createdAt: '2025-01-01' },
  { id: 'pr_mix_2x1099',   name: '2 unidades por R$10,99',           group: 'MIX_2x1099',          qty: 2,  totalPrice: 10.99, active: true, createdAt: '2025-01-01' },
  { id: 'pr_mix_2x699',    name: '2 unidades por R$6,99',            group: 'MIX_2x699',           qty: 2,  totalPrice: 6.99,  active: true, createdAt: '2025-01-01' },
  { id: 'pr_mix_2x999',    name: '2 unidades por R$9,99',            group: 'MIX_2x999',           qty: 2,  totalPrice: 9.99,  active: true, createdAt: '2025-01-01' },
  { id: 'pr_mix_3x999',    name: '3 unidades por R$9,99',            group: 'MIX_3x999',           qty: 3,  totalPrice: 9.99,  active: true, createdAt: '2025-01-01' },
  { id: 'pr_mix_8x999',    name: '8 unidades por R$9,99',            group: 'MIX_8x999',           qty: 8,  totalPrice: 9.99,  active: true, createdAt: '2025-01-01' },
  { id: 'pr_mix_2x799',    name: '2 unidades por R$7,99',            group: 'MIX_2x799',           qty: 2,  totalPrice: 7.99,  active: true, createdAt: '2025-01-01' },
  { id: 'pr_mix_4x999',    name: '4 unidades por R$9,99',            group: 'MIX_4x999',           qty: 4,  totalPrice: 9.99,  active: true, createdAt: '2025-01-01' },
  { id: 'pr_mix_7x999',    name: '7 unidades por R$9,99',            group: 'MIX_7x999',           qty: 7,  totalPrice: 9.99,  active: true, createdAt: '2025-01-01' },
  { id: 'pr_mix_3x899',    name: '3 unidades por R$8,99',            group: 'MIX_3x899',           qty: 3,  totalPrice: 8.99,  active: true, createdAt: '2025-01-01' },
  { id: 'pr_mix_4x899',    name: '4 unidades por R$8,99',            group: 'MIX_4x899',           qty: 4,  totalPrice: 8.99,  active: true, createdAt: '2025-01-01' },
  { id: 'pr_mix_6x1099',   name: '6 unidades por R$10,99',           group: 'MIX_6x1099',          qty: 6,  totalPrice: 10.99, active: true, createdAt: '2025-01-01' },
  { id: 'pr_mix_4x1099',   name: '4 unidades por R$10,99',           group: 'MIX_4x1099',          qty: 4,  totalPrice: 10.99, active: true, createdAt: '2025-01-01' },
  { id: 'pr_mix_5x799',    name: '5 unidades por R$7,99',            group: 'MIX_5x799',           qty: 5,  totalPrice: 7.99,  active: true, createdAt: '2025-01-01' },
  { id: 'pr_mix_3x1199',   name: '3 unidades por R$11,99',           group: 'MIX_3x1199',          qty: 3,  totalPrice: 11.99, active: true, createdAt: '2025-01-01' },
  { id: 'pr_mix_5x999',    name: '5 unidades por R$9,99',            group: 'MIX_5x999',           qty: 5,  totalPrice: 9.99,  active: true, createdAt: '2025-01-01' },
  { id: 'pr_mix_2x899',    name: '2 unidades por R$8,99',            group: 'MIX_2x899',           qty: 2,  totalPrice: 8.99,  active: true, createdAt: '2025-01-01' },
  { id: 'pr_mix_2x1199',   name: '2 unidades por R$11,99',           group: 'MIX_2x1199',          qty: 2,  totalPrice: 11.99, active: true, createdAt: '2025-01-01' },
  { id: 'pr_mix_3x1200',   name: '3 unidades por R$12,00',           group: 'MIX_3x1200',          qty: 3,  totalPrice: 12.00, active: true, createdAt: '2025-01-01' },
  { id: 'pr_mix_10x999',   name: '10 unidades por R$9,99',           group: 'MIX_10x999',          qty: 10, totalPrice: 9.99,  active: true, createdAt: '2025-01-01' },
  { id: 'pr_mix_2x1500',   name: '2 unidades por R$15,00',           group: 'MIX_2x1500',          qty: 2,  totalPrice: 15.00, active: true, createdAt: '2025-01-01' },
  { id: 'pr_mix_3x499',    name: '3 unidades por R$4,99',            group: 'MIX_3x499',           qty: 3,  totalPrice: 4.99,  active: true, createdAt: '2025-01-01' },
  { id: 'pr_mix_2x1399',   name: '2 unidades por R$13,99',           group: 'MIX_2x1399',          qty: 2,  totalPrice: 13.99, active: true, createdAt: '2025-01-01' },
  { id: 'pr_mix_3x599',    name: '3 unidades por R$5,99',            group: 'MIX_3x599',           qty: 3,  totalPrice: 5.99,  active: true, createdAt: '2025-01-01' },
  { id: 'pr_mix_4x699',    name: '4 unidades por R$6,99',            group: 'MIX_4x699',           qty: 4,  totalPrice: 6.99,  active: true, createdAt: '2025-01-01' },
  { id: 'pr_mix_2x1499',   name: '2 unidades por R$14,99',           group: 'MIX_2x1499',          qty: 2,  totalPrice: 14.99, active: true, createdAt: '2025-01-01' },
  { id: 'pr_mix_2x1899',   name: '2 unidades por R$18,99',           group: 'MIX_2x1899',          qty: 2,  totalPrice: 18.99, active: true, createdAt: '2025-01-01' },
  { id: 'pr_mix_4x1199',   name: '4 unidades por R$11,99',           group: 'MIX_4x1199',          qty: 4,  totalPrice: 11.99, active: true, createdAt: '2025-01-01' },
  { id: 'pr_mix_5x899',    name: '5 unidades por R$8,99',            group: 'MIX_5x899',           qty: 5,  totalPrice: 8.99,  active: true, createdAt: '2025-01-01' },
  { id: 'pr_mix_4x1200',   name: '4 unidades por R$12,00',           group: 'MIX_4x1200',          qty: 4,  totalPrice: 12.00, active: true, createdAt: '2025-01-01' },
]

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

export function StoreProvider({ children }) {
  const [products, setProducts] = useState(() => {
    try {
      const s = localStorage.getItem('cp_products')
      return s ? mergeWithSeed(JSON.parse(s)) : SEED_PRODUCTS
    } catch { return SEED_PRODUCTS }
  })
  const [sales, setSales] = useState(() => {
    try { const s = localStorage.getItem('cp_sales'); return s ? JSON.parse(s) : SEED_SALES } catch { return SEED_SALES }
  })
  const [customers, setCustomers] = useState(() => {
    try { const s = localStorage.getItem('cp_customers'); return s ? JSON.parse(s) : SEED_CUSTOMERS } catch { return SEED_CUSTOMERS }
  })
  // ── Cash movements (sangria / suprimento) ─────────────────
  const [cashMovements, setCashMovements] = useState(() => {
    try { const s = localStorage.getItem('cp_cash'); return s ? JSON.parse(s) : [] } catch { return [] }
  })

  // ── Sales goal (meta diária) ───────────────────────────────
  const [salesGoal, setSalesGoalState] = useState(() => {
    try { const s = localStorage.getItem('cp_goal'); return s ? JSON.parse(s) : { daily: 0 } } catch { return { daily: 0 } }
  })

  // ── Operators ─────────────────────────────────────────────
  const [operators, setOperators] = useState(() => {
    try { const s = localStorage.getItem('cp_operators'); return s ? JSON.parse(s) : [] } catch { return [] }
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
      const s = localStorage.getItem('cp_promos')
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
    try { return parseInt(localStorage.getItem('cp_expiry_days') || '30', 10) } catch { return 30 }
  })
  const setExpiryAlertDays = useCallback((days) => {
    const n = Math.max(1, Math.min(365, parseInt(days, 10) || 30))
    setExpiryAlertDaysState(n)
    try { localStorage.setItem('cp_expiry_days', String(n)) } catch {}
  }, [])

  // ── Persist: localStorage + server disk (fire-and-forget) ──
  const persist = useCallback((key, val) => {
    const str = JSON.stringify(val)
    try { localStorage.setItem(key, str) } catch {}
    fetch('/api/persist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value: str }),
    }).catch(() => {})
  }, [])

  // ── Last-sync timestamp (shown in UI) ────────────────────────
  const [lastSync, setLastSync] = useState(null)
  const [syncing,  setSyncing]  = useState(false)

  // ── Core restore function — called on mount and on interval ──
  const applyServerData = useCallback((data) => {
    if (!data) return
    const syncToServer = (key, value) =>
      fetch('/api/persist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      }).catch(() => {})

    if (data.cp_products) {
      const parsed = JSON.parse(data.cp_products)
      setProducts(mergeWithSeed(parsed))
      try { localStorage.setItem('cp_products', data.cp_products) } catch {}
    }
    if (data.cp_sales) {
      setSales(JSON.parse(data.cp_sales))
      try { localStorage.setItem('cp_sales', data.cp_sales) } catch {}
    }
    if (data.cp_customers) {
      setCustomers(JSON.parse(data.cp_customers))
      try { localStorage.setItem('cp_customers', data.cp_customers) } catch {}
    }
    if (data.cp_promos) {
      try { localStorage.setItem('cp_promos', data.cp_promos) } catch {}
      const stored = JSON.parse(data.cp_promos)
      const seedById = Object.fromEntries(SEED_PROMOS.map(p => [p.id, p]))
      const merged = stored.map(p => seedById[p.id] ?? p)
      const storedIds = new Set(stored.map(p => p.id))
      setPromos([...merged, ...SEED_PROMOS.filter(p => !storedIds.has(p.id))])
    }
    if (data.cp_fiado)    { try { localStorage.setItem('cp_fiado', data.cp_fiado) } catch {} }
    if (data.cp_cash)     { setCashMovements(JSON.parse(data.cp_cash));   try { localStorage.setItem('cp_cash',      data.cp_cash)      } catch {} }
    if (data.cp_goal)     { setSalesGoalState(JSON.parse(data.cp_goal));  try { localStorage.setItem('cp_goal',      data.cp_goal)      } catch {} }
    if (data.cp_operators){ setOperators(JSON.parse(data.cp_operators)); try { localStorage.setItem('cp_operators', data.cp_operators) } catch {} }

    // Push local keys not yet on server
    if (!data.cp_customers) setCustomers(c  => { syncToServer('cp_customers', JSON.stringify(c));  return c })
    if (!data.cp_promos)    setPromos(pr    => { syncToServer('cp_promos',    JSON.stringify(pr)); return pr })
    if (!data.cp_products)  setProducts(p   => { syncToServer('cp_products',  JSON.stringify(p));  return p })
    if (!data.cp_sales)     setSales(s      => { syncToServer('cp_sales',     JSON.stringify(s));  return s })

    setLastSync(new Date())
  }, []) // eslint-disable-line

  // ── Manual sync (exposed to UI) ──────────────────────────────
  const syncNow = useCallback(() => {
    setSyncing(true)
    fetch('/api/restore')
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
        if (e.key === 'cp_products' && e.newValue) setProducts(JSON.parse(e.newValue))
        if (e.key === 'cp_sales'    && e.newValue) setSales(JSON.parse(e.newValue))
        if (e.key === 'cp_promos'   && e.newValue) setPromos(JSON.parse(e.newValue))
        if (e.key === 'cp_customers'&& e.newValue) setCustomers(JSON.parse(e.newValue))
      } catch {}
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const upsertProduct = useCallback((p) => {
    setProducts(prev => {
      const next = p.id
        ? prev.map(x => x.id === p.id ? { ...x, ...p } : x)
        : [...prev, { ...p, id: `p${Date.now()}` }]
      persist('cp_products', next); return next
    })
  }, [persist])

  const deleteProduct = useCallback((id) => {
    setProducts(prev => { const next = prev.filter(x => x.id !== id); persist('cp_products', next); return next })
  }, [persist])

  const registerSale = useCallback((sale) => {
    const s = { ...sale, id: `s${Date.now()}`, date: sale.date || new Date().toISOString() }
    setSales(prev => { const next = [s, ...prev]; persist('cp_sales', next); return next })
    // decrement stock
    setProducts(prev => {
      const next = prev.map(p => {
        const item = sale.items.find(i => i.productId === p.id)
        return item ? { ...p, stock: Math.max(0, p.stock - item.qty) } : p
      })
      persist('cp_products', next); return next
    })
    return s
  }, [persist])

  const upsertPromo = useCallback((p) => {
    setPromos(prev => {
      const next = p.id
        ? prev.map(x => x.id === p.id ? { ...x, ...p } : x)
        : [...prev, { ...p, id: `pr${Date.now()}`, createdAt: new Date().toISOString().slice(0,10) }]
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

  const resetAll = useCallback(() => {
    setProducts(SEED_PRODUCTS); setSales(SEED_SALES); setCustomers(SEED_CUSTOMERS); setPromos(SEED_PROMOS)
    ;['cp_products','cp_sales','cp_customers','cp_promos'].forEach(k => localStorage.removeItem(k))
  }, [])

  return (
    <Ctx.Provider value={{
      products, sales, customers, promos,
      cashMovements, salesGoal, operators,
      photos, saveProductPhoto,
      upsertProduct, deleteProduct, registerSale,
      upsertCustomer, deleteCustomer, importProducts,
      upsertPromo, deletePromo, assignPromoGroup,
      addFiado, payFiado,
      addCashMovement, setSalesGoal,
      upsertOperator, deleteOperator,
      resetAll,
      syncNow, lastSync, syncing,
      expiryAlertDays, setExpiryAlertDays,
    }}>
      {children}
    </Ctx.Provider>
  )
}
