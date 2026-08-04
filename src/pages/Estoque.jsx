import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import {
  Search, Plus, AlertTriangle, ArrowUpDown, PackageOpen,
  TrendingDown, Truck, X, Check, Barcode, Camera,
  ChevronUp, ChevronDown, ChevronsLeft, ChevronsRight,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useStore, BRL } from '../store.jsx'
import CameraScanner from '../components/CameraScanner.jsx'

const PAGE_SIZE = 100

/* ── sortable column header ─────────────────────────────────── */
function Th({ col, label, sort, onSort, className = '' }) {
  const active = sort.col === col
  return (
    <th
      onClick={() => onSort(col)}
      className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap cursor-pointer select-none hover:text-gray-800 hover:bg-gray-100 transition-colors ${active ? 'text-orange-600 bg-orange-50' : ''} ${className}`}
    >
      <span className="flex items-center gap-1">
        {label}
        <span className="flex flex-col">
          <ChevronUp  className={`w-2.5 h-2.5 -mb-0.5 ${active && sort.dir === 'asc'  ? 'text-orange-500' : 'text-gray-300'}`} />
          <ChevronDown className={`w-2.5 h-2.5 ${active && sort.dir === 'desc' ? 'text-orange-500' : 'text-gray-300'}`} />
        </span>
      </span>
    </th>
  )
}

/* ── pagination bar ─────────────────────────────────────────── */
function Pagination({ page, total, pageSize, onChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null

  const start = (page - 1) * pageSize + 1
  const end   = Math.min(page * pageSize, total)

  // Generate page window: first, last, and ±2 around current
  const nums = new Set([1, pages, page - 2, page - 1, page, page + 1, page + 2]
    .filter(n => n >= 1 && n <= pages))
  const sorted = [...nums].sort((a, b) => a - b)
  // Insert null for gaps
  const items = []
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) items.push(null)
    items.push(n)
  })

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl">
      <span className="text-xs text-gray-500">
        <span className="font-semibold text-gray-700">{start}–{end}</span> de <span className="font-semibold text-gray-700">{total}</span> produtos
      </span>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(1)}       disabled={page === 1}     className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 transition-colors"><ChevronsLeft  className="w-3.5 h-3.5" /></button>
        <button onClick={() => onChange(page - 1)} disabled={page === 1}    className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 transition-colors"><ChevronLeft   className="w-3.5 h-3.5" /></button>
        {items.map((n, i) =>
          n === null
            ? <span key={`gap-${i}`} className="px-1 text-gray-400 text-xs">…</span>
            : <button key={n} onClick={() => onChange(n)}
                className={`min-w-[28px] h-7 text-xs font-bold rounded transition-colors ${n === page ? 'bg-orange-500 text-white' : 'hover:bg-gray-200 text-gray-600'}`}>
                {n}
              </button>
        )}
        <button onClick={() => onChange(page + 1)} disabled={page === pages} className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 transition-colors"><ChevronRight  className="w-3.5 h-3.5" /></button>
        <button onClick={() => onChange(pages)}    disabled={page === pages} className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 transition-colors"><ChevronsRight className="w-3.5 h-3.5" /></button>
      </div>
      {/* go-to page */}
      <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500">
        Ir p/ pág.
        <input
          type="number" min={1} max={pages} defaultValue={page}
          key={page}
          onKeyDown={e => { if (e.key === 'Enter') { const v = parseInt(e.target.value); if (v >= 1 && v <= pages) onChange(v) } }}
          className="w-14 px-2 py-1 border border-gray-300 rounded text-center text-xs focus:outline-none focus:ring-1 focus:ring-orange-400"
        />
        <span>/ {pages}</span>
      </div>
    </div>
  )
}

export default function Estoque() {
  const { products, upsertProduct } = useStore()
  const [query,   setQuery]   = useState('')
  const [filter,  setFilter]  = useState('all')
  const [page,    setPage]    = useState(1)
  const [sort,    setSort]    = useState({ col: 'stock', dir: 'asc' })
  const [adjustModal, setAdjustModal] = useState(null)

  // Reset page when filter/search/sort changes
  useEffect(() => { setPage(1) }, [query, filter, sort])

  const handleSort = useCallback((col) => {
    setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })
  }, [])

  // ── Entrada de Estoque ──────────────────────────────────────
  const [showEntrada,    setShowEntrada]    = useState(false)
  const [entradaList,    setEntradaList]    = useState([])
  const [entradaQuery,   setEntradaQuery]   = useState('')
  const [entradaFeedback,setEntradaFeedback]= useState(null)
  const [showCamera,     setShowCamera]     = useState(false)
  const entradaRef = useRef(null)

  const flashFeedback = (msg, ok = true) => {
    setEntradaFeedback({ msg, ok })
    setTimeout(() => setEntradaFeedback(null), 2000)
  }

  const scanEntrada = useCallback((raw) => {
    const q = raw.trim()
    if (!q) return
    setEntradaQuery('')
    const found = products.find(p =>
      p.barcode === q || p.sku === q ||
      p.name?.toLowerCase() === q.toLowerCase()
    )
    if (!found) { flashFeedback(`❌ Produto não encontrado: ${q}`, false); return }
    setEntradaList(prev => {
      const idx = prev.findIndex(e => e.product.id === found.id)
      if (idx >= 0) {
        const next = [...prev]; next[idx] = { ...next[idx], qty: next[idx].qty + 1 }; return next
      }
      return [{ product: found, qty: 1, expiryDate: found.expiryDate || '' }, ...prev]
    })
    flashFeedback(`✅ ${found.name}`)
  }, [products])

  const confirmEntrada = () => {
    entradaList.forEach(({ product, qty, expiryDate }) => {
      const updates = { stock: product.stock + qty, receivedAt: new Date().toISOString() }
      if (expiryDate) updates.expiryDate = expiryDate
      upsertProduct({ ...product, ...updates })
    })
    setEntradaList([]); setShowEntrada(false); flashFeedback('✅ Estoque atualizado!')
  }

  useEffect(() => {
    if (showEntrada) setTimeout(() => entradaRef.current?.focus(), 100)
  }, [showEntrada])

  // ── KPIs ────────────────────────────────────────────────────
  const { totalCost, totalSale, zeroCount, criticalCount, shoppingCount } = useMemo(() => ({
    totalCost:     products.reduce((s, p) => s + p.stock * p.cost, 0),
    totalSale:     products.reduce((s, p) => s + p.stock * p.price, 0),
    zeroCount:     products.filter(p => !p.stock || p.stock === 0).length,
    criticalCount: products.filter(p => p.stock > 0 && p.stock <= 10).length,
    shoppingCount: products.filter(p => p.minStock > 0 && p.stock <= p.minStock).length,
  }), [products])

  // ── Filter + Sort + Paginate ─────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...products]
    if      (filter === 'critical')  list = list.filter(p => p.stock > 0 && p.stock <= 10)
    else if (filter === 'zero')      list = list.filter(p => !p.stock || p.stock === 0)
    else if (filter === 'fifo')      list = list.filter(p => p.stock > 0 && p.stock <= 15)
    else if (filter === 'shopping')  list = list.filter(p => p.minStock > 0 && p.stock <= p.minStock)

    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.sku?.includes(q) ||
        p.barcode?.includes(q) ||
        p.category?.toLowerCase().includes(q)
      )
    }

    // Sort
    const { col, dir } = sort
    const m = dir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      if (col === 'name')       return m * (a.name || '').localeCompare(b.name || '', 'pt-BR')
      if (col === 'category')   return m * (a.category || '').localeCompare(b.category || '', 'pt-BR')
      if (col === 'cost')       return m * ((a.cost || 0) - (b.cost || 0))
      if (col === 'price')      return m * ((a.price || 0) - (b.price || 0))
      if (col === 'stock')      return m * ((a.stock || 0) - (b.stock || 0))
      if (col === 'stockValue') return m * ((a.stock * a.cost) - (b.stock * b.cost))
      if (col === 'receivedAt') return m * ((a.receivedAt || '').localeCompare(b.receivedAt || ''))
      if (col === 'fifo') {
        const tA = !a.stock ? 0 : a.stock <= 10 ? 1 : 2
        const tB = !b.stock ? 0 : b.stock <= 10 ? 1 : 2
        return tA !== tB ? tA - tB : (a.stock || 0) - (b.stock || 0)
      }
      return 0
    })
    return list
  }, [products, filter, query, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage  = Math.min(page, pageCount)
  const pageSlice = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const applyAdjust = () => {
    if (!adjustModal) return
    const { product, qty } = adjustModal
    upsertProduct({ ...product, stock: Math.max(0, product.stock + Number(qty)), receivedAt: qty > 0 ? new Date().toISOString() : product.receivedAt })
    setAdjustModal(null)
  }

  const FILTERS = [
    { k: 'all',      l: `Todos (${products.length})` },
    { k: 'critical', l: `⚠️ Crítico (${criticalCount})` },
    { k: 'zero',     l: `🔴 Zerado (${zeroCount})` },
    { k: 'shopping', l: `🛒 Repor (${shoppingCount})` },
    { k: 'fifo',     l: '📦 FIFO' },
  ]

  return (
    <div className="space-y-4 animate-pop">
      {/* header */}
      <div>
        <h1 className="text-2xl font-black text-gray-900">Estoque</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          {products.length} produtos ·
          Custo total: <span className="font-semibold text-gray-700">{BRL.format(totalCost)}</span> ·
          Valor de venda: <span className="font-semibold text-gray-700">{BRL.format(totalSale)}</span>
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total produtos',  value: products.length,                        color: 'text-gray-900',   bg: 'bg-gray-50',   icon: PackageOpen,   onClick: () => setFilter('all') },
          { label: 'Com estoque',     value: products.filter(p=>p.stock>0).length,   color: 'text-green-700',  bg: 'bg-green-50',  icon: PackageOpen,   onClick: () => setFilter('all') },
          { label: 'Crítico ≤10 un.', value: criticalCount,                          color: 'text-amber-700',  bg: 'bg-amber-50',  icon: TrendingDown,  onClick: () => setFilter('critical') },
          { label: 'Sem estoque',     value: zeroCount,                              color: 'text-red-700',    bg: 'bg-red-50',    icon: AlertTriangle, onClick: () => setFilter('zero') },
        ].map(c => (
          <button key={c.label} onClick={c.onClick} className={`card p-4 ${c.bg} text-left hover:shadow-md transition-shadow cursor-pointer`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{c.label}</span>
              <c.icon className={`w-4 h-4 ${c.color}`} />
            </div>
            <div className={`text-3xl font-black ${c.color}`}>{c.value}</div>
          </button>
        ))}
      </div>

      {/* search + filter + actions */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por nome, código, categoria..."
            className="input pl-9" />
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map(({ k, l }) => (
            <button key={k} onClick={() => { setFilter(k); if (k === 'fifo') setSort({ col: 'fifo', dir: 'asc' }) }}
              className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap
                ${filter === k ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
              {l}
            </button>
          ))}
        </div>
        <button onClick={() => setShowEntrada(true)} className="btn-primary whitespace-nowrap">
          <Truck className="w-4 h-4" /> Receber Mercadoria
        </button>
      </div>

      {/* FIFO tip — only when FIFO sort active */}
      {sort.col === 'fifo' && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-start gap-3">
          <ArrowUpDown className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-orange-800">
            <span className="font-black">FIFO ativo</span> — Sem estoque primeiro, depois crítico, depois normal.
            Venda sempre o lote mais antigo antes de abrir novo.
          </p>
        </div>
      )}

      {/* table */}
      <div className="card overflow-hidden">
        {/* result count */}
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between gap-2">
          <span className="text-xs text-gray-500">
            <span className="font-bold text-gray-700">{filtered.length}</span> resultado(s)
            {query && <> para "<span className="italic">{query}</span>"</>}
          </span>
          {filtered.length > 0 && (
            <span className="text-xs text-gray-400">
              Pág. {safePage}/{pageCount} · {PAGE_SIZE}/pág.
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap w-24">Status</th>
                <Th col="name"       label="Produto"    sort={sort} onSort={handleSort} />
                <Th col="category"   label="Categoria"  sort={sort} onSort={handleSort} />
                <Th col="cost"       label="Custo"      sort={sort} onSort={handleSort} />
                <Th col="price"      label="Venda"      sort={sort} onSort={handleSort} />
                <Th col="stock"      label="Estoque"    sort={sort} onSort={handleSort} />
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Mín.</th>
                <Th col="stockValue" label="Val. Custo" sort={sort} onSort={handleSort} />
                <Th col="receivedAt" label="Última Entrada" sort={sort} onSort={handleSort} />
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pageSlice.map(p => {
                const tier = !p.stock || p.stock === 0 ? 'zero' : p.stock <= 5 ? 'danger' : p.stock <= 10 ? 'warn' : 'ok'
                const rowBg = tier === 'zero' ? 'bg-red-50/50' : tier === 'danger' ? 'bg-amber-50/50' : tier === 'warn' ? 'bg-yellow-50/30' : ''
                return (
                  <tr key={p.id} className={`transition-colors hover:bg-gray-50 ${rowBg}`}>
                    <td className="px-4 py-2.5">
                      {tier === 'zero'   && <span className="text-[10px] font-black bg-red-600   text-white    px-1.5 py-0.5 rounded-full">SEM ESTQ</span>}
                      {tier === 'danger' && <span className="text-[10px] font-black bg-amber-500 text-white    px-1.5 py-0.5 rounded-full">CRÍTICO</span>}
                      {tier === 'warn'   && <span className="text-[10px] font-black bg-yellow-400 text-gray-800 px-1.5 py-0.5 rounded-full">BAIXO</span>}
                      {tier === 'ok'     && <span className="text-[10px] font-semibold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">OK</span>}
                    </td>
                    <td className="px-4 py-2.5 max-w-[240px]">
                      <div className="font-semibold text-gray-800 text-xs leading-tight truncate">{p.name}</div>
                      <div className="font-mono text-[10px] text-gray-400 mt-0.5">{p.sku || p.barcode}</div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{p.category}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap">{BRL.format(p.cost)}</td>
                    <td className="px-4 py-2.5 text-xs font-semibold text-gray-800 whitespace-nowrap">{BRL.format(p.price)}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className={`text-base font-black ${tier === 'zero' ? 'text-red-600' : tier === 'danger' ? 'text-amber-600' : tier === 'warn' ? 'text-yellow-600' : 'text-gray-900'}`}>
                        {p.stock ?? 0}
                      </span>
                      <span className="text-[10px] text-gray-400 ml-0.5">{p.unit || 'un'}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      {p.minStock > 0
                        ? <span className={`text-xs font-bold ${p.stock <= p.minStock ? 'text-red-500' : 'text-gray-400'}`}>{p.minStock}</span>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap">{BRL.format((p.stock || 0) * (p.cost || 0))}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">
                      {p.receivedAt ? new Date(p.receivedAt).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <button onClick={() => setAdjustModal({ product: p, qty: '' })}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-orange-50 hover:border-orange-300 text-xs font-semibold text-gray-600 hover:text-orange-700 transition-colors whitespace-nowrap">
                        <Plus className="w-3 h-3" /> Qtd
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-400 text-sm">Nenhum produto encontrado</div>
          )}
        </div>

        <Pagination page={safePage} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
      </div>

      {/* ── Entrada de Estoque modal ──────────────────────────── */}
      {showEntrada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="card w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl animate-pop">

            {/* header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
              <div>
                <div className="font-black text-gray-900 text-lg flex items-center gap-2">
                  <Truck className="w-5 h-5 text-brand-600" /> Receber Mercadoria
                </div>
                <div className="text-xs text-gray-400 mt-0.5">Escaneie ou digite o código de barras dos produtos recebidos</div>
              </div>
              <button onClick={() => setShowEntrada(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* scanner input */}
            <div className="p-4 border-b border-gray-100 flex-shrink-0 space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    ref={entradaRef}
                    value={entradaQuery}
                    onChange={e => setEntradaQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') scanEntrada(entradaQuery) }}
                    placeholder="Código de barras ou nome (Enter)"
                    className="input pl-9 font-mono"
                  />
                </div>
                <button
                  onClick={() => setShowCamera(c => !c)}
                  className={`px-3 rounded-lg border font-semibold text-sm flex items-center gap-1.5 transition-colors ${showCamera ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                  title="Escanear via câmera (celular)"
                >
                  <Camera className="w-4 h-4" /> Câmera
                </button>
              </div>
              {/* inline camera panel */}
              {showCamera && (
                <div className="rounded-2xl overflow-hidden" style={{ height: 320 }}>
                  <CameraScanner
                    compact
                    onScan={(code) => { scanEntrada(code); }}
                    onClose={() => setShowCamera(false)}
                  />
                </div>
              )}
              {entradaFeedback && (
                <div className={`text-sm font-semibold px-3 py-2 rounded-lg ${entradaFeedback.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {entradaFeedback.msg}
                </div>
              )}
            </div>

            {/* items list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[160px]">
              {entradaList.length === 0 ? (
                <div className="text-center text-gray-400 py-10 text-sm">
                  Nenhum produto escaneado ainda.<br/>Passe o leitor nos produtos recebidos.
                </div>
              ) : entradaList.map(({ product, qty, expiryDate }) => {
                const daysLeft = expiryDate ? Math.ceil((new Date(expiryDate+'T00:00') - new Date()) / 86400000) : null
                const daysBadge = daysLeft === null ? null : daysLeft < 0 ? 'Vencido!' : daysLeft === 0 ? 'Hoje!' : `${daysLeft}d`
                const daysBg    = daysLeft === null ? '' : daysLeft < 0 ? 'bg-red-100 text-red-600' : daysLeft <= 7 ? 'bg-orange-100 text-orange-600' : daysLeft <= 30 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                return (
                  <div key={product.id} className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-2.5">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-gray-900 truncate">{product.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          Atual: <strong>{product.stock}</strong> {product.unit||'un'} → ficará: <span className="font-bold text-green-600">{product.stock + qty}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button onClick={() => setEntradaList(l => l.map(e => e.product.id === product.id ? { ...e, qty: Math.max(1, e.qty-1) } : e))}
                          className="w-7 h-7 rounded-lg bg-gray-200 hover:bg-gray-300 flex items-center justify-center font-black text-gray-700">−</button>
                        <input type="number" min="1" value={qty}
                          onChange={e => { const v = Math.max(1, parseInt(e.target.value)||1); setEntradaList(l => l.map(x => x.product.id === product.id ? {...x, qty:v} : x)) }}
                          className="w-14 text-center font-black text-sm border border-gray-300 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-orange-400" />
                        <button onClick={() => setEntradaList(l => l.map(e => e.product.id === product.id ? {...e, qty: e.qty+1} : e))}
                          className="w-7 h-7 rounded-lg bg-orange-500 hover:bg-orange-600 flex items-center justify-center font-black text-white">+</button>
                        <button onClick={() => setEntradaList(l => l.filter(e => e.product.id !== product.id))}
                          className="w-7 h-7 rounded-lg hover:bg-red-100 flex items-center justify-center text-red-400 hover:text-red-600">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {/* expiry date row */}
                    <div className="flex items-center gap-2 px-4 pb-2.5">
                      <label className="text-xs font-bold text-orange-600 whitespace-nowrap">📅 Vencimento</label>
                      <input type="date" value={expiryDate||''}
                        onChange={e => setEntradaList(l => l.map(x => x.product.id === product.id ? {...x, expiryDate: e.target.value} : x))}
                        className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white" />
                      {daysBadge && <span className={`text-[11px] font-black px-2 py-0.5 rounded-full whitespace-nowrap ${daysBg}`}>{daysBadge}</span>}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* footer */}
            <div className="p-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
              <div className="flex-1 bg-gray-50 rounded-xl px-4 py-2 text-center">
                <div className="text-xs text-gray-400">Itens</div>
                <div className="font-black text-gray-900">{entradaList.length} produtos · {entradaList.reduce((s,e)=>s+e.qty,0)} un.</div>
              </div>
              <button onClick={() => setShowEntrada(false)} className="btn-ghost px-5">Cancelar</button>
              <button onClick={confirmEntrada} disabled={entradaList.length === 0}
                className="btn-primary px-6 disabled:opacity-40 disabled:cursor-not-allowed">
                <Check className="w-4 h-4" /> Confirmar Entrada
              </button>
            </div>
          </div>
        </div>
      )}

      {adjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="card p-6 w-full max-w-sm mx-4 animate-pop space-y-4">
            <h2 className="font-black text-gray-900 text-lg">Ajustar Estoque</h2>
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-sm font-semibold text-gray-800">{adjustModal.product.name}</div>
              <div className="text-xs text-gray-500 mt-0.5">Estoque atual: <span className="font-black text-gray-800">{adjustModal.product.stock} {adjustModal.product.unit}</span></div>
            </div>
            <div>
              <label className="label">Quantidade a ajustar (use − para saída manual)</label>
              <input
                autoFocus
                type="number"
                value={adjustModal.qty}
                onChange={e => setAdjustModal(m => ({ ...m, qty: e.target.value }))}
                placeholder="ex: 50 ou -5"
                className="input text-lg font-bold"
              />
              {adjustModal.qty !== '' && (
                <div className="text-xs text-gray-500 mt-1">
                  Novo estoque: <span className="font-black text-gray-800">{Math.max(0, adjustModal.product.stock + Number(adjustModal.qty))} {adjustModal.product.unit}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setAdjustModal(null)} className="btn-ghost flex-1 justify-center">Cancelar</button>
              <button onClick={applyAdjust} disabled={adjustModal.qty === ''} className="btn-primary flex-1 justify-center disabled:opacity-40">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
