import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { Search, Plus, Minus, AlertTriangle, ArrowUpDown, PackageOpen, TrendingDown, Truck, X, Check, Barcode, Camera } from 'lucide-react'
import { useStore, BRL } from '../store.jsx'
import CameraScanner from '../components/CameraScanner.jsx'

export default function Estoque() {
  const { products, upsertProduct } = useStore()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [adjustModal, setAdjustModal] = useState(null)  // { product, qty }

  // ── Entrada de Estoque (recebimento de mercadoria) ──────────
  const [showEntrada, setShowEntrada] = useState(false)
  const [entradaList, setEntradaList] = useState([])      // [{ product, qty }]
  const [entradaQuery, setEntradaQuery] = useState('')
  const [entradaFeedback, setEntradaFeedback] = useState(null)
  const [showCamera, setShowCamera] = useState(false)
  const entradaRef = useRef(null)

  const flashFeedback = (msg, ok = true) => {
    setEntradaFeedback({ msg, ok })
    setTimeout(() => setEntradaFeedback(null), 2000)
  }

  const scanEntrada = useCallback((raw) => {
    const q = raw.trim()
    if (!q) return
    setEntradaQuery('')
    // Match by barcode or SKU
    const found = products.find(p =>
      p.barcode === q || p.sku === q ||
      p.name?.toLowerCase() === q.toLowerCase()
    )
    if (!found) { flashFeedback(`❌ Produto não encontrado: ${q}`, false); return }
    setEntradaList(prev => {
      const idx = prev.findIndex(e => e.product.id === found.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 }
        return next
      }
      return [{ product: found, qty: 1 }, ...prev]
    })
    flashFeedback(`✅ ${found.name}`)
  }, [products])

  const confirmEntrada = () => {
    entradaList.forEach(({ product, qty }) => {
      upsertProduct({ ...product, stock: product.stock + qty, receivedAt: new Date().toISOString() })
    })
    setEntradaList([])
    setShowEntrada(false)
    flashFeedback(`✅ Estoque atualizado!`)
  }

  // Auto-focus scanner input when modal opens
  useEffect(() => {
    if (showEntrada) setTimeout(() => entradaRef.current?.focus(), 100)
  }, [showEntrada])

  const filtered = useMemo(() => {
    let list = [...products]

    if (filter === 'critical') list = list.filter(p => p.stock > 0 && p.stock <= 10)
    else if (filter === 'zero')     list = list.filter(p => p.stock === 0)
    else if (filter === 'fifo')     list = list.filter(p => p.stock > 0 && p.stock <= 15)

    if (query.trim()) list = list.filter(p =>
      p.name?.toLowerCase().includes(query.toLowerCase()) ||
      p.sku?.includes(query) ||
      p.category?.toLowerCase().includes(query.toLowerCase())
    )

    // FIFO sort: zero stock first → critical (≤10) → normal; within same tier sort by stock ASC
    list.sort((a, b) => {
      const tierA = a.stock === 0 ? 0 : a.stock <= 10 ? 1 : 2
      const tierB = b.stock === 0 ? 0 : b.stock <= 10 ? 1 : 2
      if (tierA !== tierB) return tierA - tierB
      return a.stock - b.stock
    })

    return list
  }, [products, filter, query])

  const applyAdjust = () => {
    if (!adjustModal) return
    const { product, qty } = adjustModal
    upsertProduct({ ...product, stock: Math.max(0, product.stock + Number(qty)), receivedAt: qty > 0 ? new Date().toISOString() : product.receivedAt })
    setAdjustModal(null)
  }

  const { totalCost, totalSale, zeroCount, criticalCount } = useMemo(() => ({
    totalCost:     products.reduce((s, p) => s + p.stock * p.cost, 0),
    totalSale:     products.reduce((s, p) => s + p.stock * p.price, 0),
    zeroCount:     products.filter(p => p.stock === 0).length,
    criticalCount: products.filter(p => p.stock > 0 && p.stock <= 10).length,
  }), [products])

  const FILTERS = [
    { k: 'all',      l: `Todos (${products.length})` },
    { k: 'critical', l: `⚠️ Crítico (${criticalCount})` },
    { k: 'zero',     l: `🔴 Zerado (${zeroCount})` },
    { k: 'fifo',     l: '📦 FIFO' },
  ]

  return (
    <div className="space-y-4 animate-pop">
      {/* header */}
      <div>
        <h1 className="text-2xl font-black text-gray-900">Estoque</h1>
        <p className="text-gray-500 text-sm mt-0.5">{products.length} produtos · Custo total: <span className="font-semibold text-gray-700">{BRL.format(totalCost)}</span> · Valor de venda: <span className="font-semibold text-gray-700">{BRL.format(totalSale)}</span></p>
      </div>

      {/* FIFO explanation banner */}
      <div className="bg-brand-50 border border-brand-200 rounded-xl p-3 flex items-start gap-3">
        <ArrowUpDown className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-brand-800">
          <span className="font-black">FIFO ativo</span> — Produtos com menor estoque aparecem primeiro. Venda sempre o estoque mais antigo antes de abrir novo lote. Ao receber mercadoria, use o botão <strong>+Qtd</strong> para atualizar e registrar a data de entrada.
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total produtos',  value: products.length,  color: 'text-gray-900', bg: 'bg-gray-50',   icon: PackageOpen },
          { label: 'Com estoque',     value: products.filter(p=>p.stock>0).length, color: 'text-green-700', bg: 'bg-green-50', icon: PackageOpen },
          { label: 'Crítico ≤10 un.', value: criticalCount,    color: 'text-amber-700', bg: 'bg-amber-50', icon: TrendingDown },
          { label: 'Sem estoque',     value: zeroCount,        color: 'text-red-700',   bg: 'bg-red-50',   icon: AlertTriangle },
        ].map(c => (
          <div key={c.label} className={`card p-4 ${c.bg}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{c.label}</span>
              <c.icon className={`w-4 h-4 ${c.color}`} />
            </div>
            <div className={`text-3xl font-black ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* search + filter + receber */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar produto, código ou categoria..." className="input pl-9" />
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map(({ k, l }) => (
            <button key={k} onClick={() => setFilter(k)} className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap ${filter === k ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
              {l}
            </button>
          ))}
        </div>
        <button onClick={() => setShowEntrada(true)}
          className="btn-primary whitespace-nowrap">
          <Truck className="w-4 h-4" /> Receber Mercadoria
        </button>
      </div>

      {/* table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Status', 'Produto', 'Categoria', 'Custo', 'Venda', 'Estoque', 'Val. Custo', 'Entrada'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(p => {
                const tier = p.stock === 0 ? 'zero' : p.stock <= 5 ? 'danger' : p.stock <= 10 ? 'warn' : 'ok'
                const rowBg = tier === 'zero' ? 'bg-red-50/60' : tier === 'danger' ? 'bg-amber-50/60' : tier === 'warn' ? 'bg-yellow-50/30' : ''
                return (
                  <tr key={p.id} className={`transition-colors hover:bg-gray-50 ${rowBg}`}>
                    <td className="px-4 py-3">
                      {tier === 'zero'   && <span className="text-[10px] font-black bg-red-600 text-white px-1.5 py-0.5 rounded">SEM ESTQ.</span>}
                      {tier === 'danger' && <span className="text-[10px] font-black bg-amber-500 text-white px-1.5 py-0.5 rounded">CRÍTICO</span>}
                      {tier === 'warn'   && <span className="text-[10px] font-black bg-yellow-400 text-gray-800 px-1.5 py-0.5 rounded">BAIXO</span>}
                      {tier === 'ok'     && <span className="text-[10px] font-semibold bg-green-100 text-green-700 px-1.5 py-0.5 rounded">OK</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-800 text-xs leading-tight">{p.name}</div>
                      <div className="font-mono text-[10px] text-gray-400 mt-0.5">{p.sku}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{p.category}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{BRL.format(p.cost)}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-gray-800">{BRL.format(p.price)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-lg font-black ${tier === 'zero' ? 'text-red-600' : tier === 'danger' ? 'text-amber-600' : tier === 'warn' ? 'text-yellow-600' : 'text-gray-900'}`}>
                        {p.stock}
                      </span>
                      <span className="text-[10px] text-gray-400 ml-0.5">{p.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{BRL.format(p.stock * p.cost)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setAdjustModal({ product: p, qty: '' })}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-brand-50 hover:border-brand-300 text-xs font-semibold text-gray-600 hover:text-brand-700 transition-colors"
                      >
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
              ) : entradaList.map(({ product, qty }) => (
                <div key={product.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-gray-900 truncate">{product.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      Estoque atual: {product.stock} {product.unit || 'un.'} → ficará: <span className="font-bold text-green-600">{product.stock + qty}</span>
                    </div>
                  </div>
                  {/* qty controls */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => setEntradaList(l => l.map(e => e.product.id === product.id ? { ...e, qty: Math.max(1, e.qty - 1) } : e))}
                      className="w-7 h-7 rounded-lg bg-gray-200 hover:bg-gray-300 flex items-center justify-center font-black text-gray-700">−</button>
                    <input
                      type="number" min="1" value={qty}
                      onChange={e => { const v = Math.max(1, parseInt(e.target.value) || 1); setEntradaList(l => l.map(x => x.product.id === product.id ? { ...x, qty: v } : x)) }}
                      className="w-14 text-center font-black text-sm border border-gray-300 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <button onClick={() => setEntradaList(l => l.map(e => e.product.id === product.id ? { ...e, qty: e.qty + 1 } : e))}
                      className="w-7 h-7 rounded-lg bg-brand-600 hover:bg-brand-700 flex items-center justify-center font-black text-white">+</button>
                    <button onClick={() => setEntradaList(l => l.filter(e => e.product.id !== product.id))}
                      className="w-7 h-7 rounded-lg hover:bg-red-100 flex items-center justify-center text-red-400 hover:text-red-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
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
