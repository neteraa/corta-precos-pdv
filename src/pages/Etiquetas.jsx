import React, { useState, useMemo, useCallback } from 'react'
import { Search, Tag, Printer, Plus, Minus, Trash2, X } from 'lucide-react'
import { useStore, BRL } from '../store.jsx'

/* Label sizes in mm */
const SIZES = [
  { id: '40x20', label: '40 × 20 mm (pequena)',  w: 40, h: 20 },
  { id: '50x25', label: '50 × 25 mm (média)',     w: 50, h: 25 },
  { id: '60x30', label: '60 × 30 mm (grande)',    w: 60, h: 30 },
  { id: '100x50', label: '100 × 50 mm (gondola)', w: 100, h: 50 },
]

/* mm → points (1mm = 2.8346pt) */
const mm = (v) => v * 2.8346

function drawLabel(doc, p, x, y, wMm, hMm) {
  const W = mm(wMm), H = mm(hMm)
  const px = mm(x), py = mm(y)

  // Border
  doc.setDrawColor(0)
  doc.setLineWidth(0.3)
  doc.rect(px, py, W, H)

  const isSmall = hMm <= 20
  const priceSize = isSmall ? 10 : hMm <= 30 ? 13 : 18
  const nameSize  = isSmall ? 6  : hMm <= 30 ? 7  : 9

  const price = p.price != null ? `R$ ${p.price.toFixed(2).replace('.', ',')}` : ''
  const promo = p.promoLabel || ''

  // Product name — truncate to fit
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(nameSize)
  doc.setTextColor(60, 60, 60)
  const maxW = W - mm(3)
  let name = p.name || ''
  while (name.length > 5 && doc.getTextWidth(name) > maxW) name = name.slice(0, -1)
  doc.text(name, px + mm(1.5), py + mm(isSmall ? 5 : 7))

  // Price
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(priceSize)
  doc.setTextColor(220, 68, 0)
  doc.text(price, px + mm(1.5), py + H - mm(isSmall ? 4 : 6))

  // Promo label
  if (promo && !isSmall) {
    doc.setFontSize(6)
    doc.setTextColor(34, 197, 94)
    doc.text(promo, px + W - mm(1), py + H - mm(1.5), { align: 'right' })
  }

  // Barcode text (SKU)
  if (!isSmall && p.barcode) {
    doc.setFontSize(5)
    doc.setTextColor(150, 150, 150)
    doc.text(p.barcode, px + W - mm(1), py + mm(2), { align: 'right' })
  }
}

export default function Etiquetas() {
  const { products } = useStore()
  const [query,   setQuery]   = useState('')
  const [basket,  setBasket]  = useState([])   // [{ product, copies }]
  const [size,    setSize]    = useState('40x20')
  const [perRow,  setPerRow]  = useState(3)
  const [generating, setGenerating] = useState(false)

  const selectedSize = SIZES.find(s => s.id === size)

  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return products
      .filter(p => p.name?.toLowerCase().includes(q) || p.barcode?.includes(q) || p.sku?.includes(q))
      .slice(0, 12)
  }, [products, query])

  const addToBasket = useCallback((product) => {
    setBasket(prev => {
      const idx = prev.findIndex(b => b.product.id === product.id)
      if (idx >= 0) {
        const next = [...prev]; next[idx] = { ...next[idx], copies: next[idx].copies + 1 }; return next
      }
      return [...prev, { product, copies: 1 }]
    })
    setQuery('')
  }, [])

  const setCopies = (id, delta) => {
    setBasket(prev => prev.map(b => b.product.id === id ? { ...b, copies: Math.max(1, b.copies + delta) } : b))
  }
  const removeItem = (id) => setBasket(prev => prev.filter(b => b.product.id !== id))

  const totalLabels = basket.reduce((s, b) => s + b.copies, 0)

  const generatePDF = async () => {
    if (basket.length === 0) return
    setGenerating(true)
    try {
      const { jsPDF } = await import('jspdf')
      const { w: wMm, h: hMm } = selectedSize

      // Page: A4
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = 210, pageH = 297
      const marginX = 5, marginY = 5
      const gapX = 2, gapY = 2

      let col = 0, row = 0
      const startX = marginX
      const startY = marginY

      const allLabels = basket.flatMap(b => Array(b.copies).fill(b.product))

      allLabels.forEach((p, i) => {
        const x = startX + col * (wMm + gapX)
        const y = startY + row * (hMm + gapY)

        if (y + hMm > pageH - marginY) {
          doc.addPage(); col = 0; row = 0
          drawLabel(doc, p, startX, startY, wMm, hMm)
          col++
        } else {
          drawLabel(doc, p, x, y, wMm, hMm)
          col++
        }

        if (col >= perRow) { col = 0; row++ }
      })

      doc.save(`etiquetas-${new Date().toISOString().slice(0,10)}.pdf`)
    } catch (err) {
      alert('Erro ao gerar PDF: ' + err.message)
    }
    setGenerating(false)
  }

  return (
    <div className="space-y-5 animate-pop max-w-3xl">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Etiquetas de Preço</h1>
        <p className="text-gray-500 text-sm mt-0.5">Busque produtos e gere etiquetas em PDF para imprimir</p>
      </div>

      {/* Config row */}
      <div className="card p-4 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="label">Tamanho da etiqueta</label>
          <select value={size} onChange={e => setSize(e.target.value)} className="input">
            {SIZES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div className="w-28">
          <label className="label">Colunas por linha</label>
          <input type="number" min="1" max="8" value={perRow}
            onChange={e => setPerRow(Math.max(1, Math.min(8, +e.target.value)))}
            className="input" />
        </div>
        <div className="text-sm text-gray-500 self-end pb-2">
          {totalLabels} etiqueta{totalLabels !== 1 ? 's' : ''} selecionada{totalLabels !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Search */}
      <div className="card p-4 space-y-3">
        <label className="font-bold text-gray-800 text-sm block">Adicionar produto</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por nome, código de barras ou SKU…"
            className="input pl-9"
          />
          {query && <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>}
        </div>
        {results.length > 0 && (
          <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
            {results.map(p => (
              <button key={p.id} onClick={() => addToBasket(p)}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors text-left">
                <div>
                  <div className="text-sm font-semibold text-gray-800">{p.name}</div>
                  <div className="text-xs text-gray-400">{p.barcode || p.sku} · {p.category}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-black text-orange-600">{BRL.format(p.price || 0)}</span>
                  <Plus className="w-4 h-4 text-gray-400" />
                </div>
              </button>
            ))}
          </div>
        )}
        {query && results.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-2">Nenhum produto encontrado</p>
        )}
      </div>

      {/* Basket */}
      {basket.length > 0 && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-800 text-sm">Etiquetas selecionadas</h2>
            <button onClick={() => setBasket([])} className="text-xs text-red-500 hover:underline">Limpar tudo</button>
          </div>
          <div className="divide-y divide-gray-100">
            {basket.map(({ product: p, copies }) => (
              <div key={p.id} className="flex items-center gap-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-800 truncate">{p.name}</div>
                  <div className="text-xs text-gray-400">{BRL.format(p.price || 0)}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setCopies(p.id, -1)} className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                  <span className="w-8 text-center text-sm font-bold">{copies}</span>
                  <button onClick={() => setCopies(p.id, 1)}  className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><Plus  className="w-3 h-3" /></button>
                </div>
                <button onClick={() => removeItem(p.id)} className="text-red-400 hover:text-red-600 ml-1"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
          <button onClick={generatePDF} disabled={generating}
            className="btn-primary w-full justify-center disabled:opacity-60">
            <Printer className="w-4 h-4" />
            {generating ? 'Gerando PDF…' : `Gerar PDF — ${totalLabels} etiqueta${totalLabels !== 1 ? 's' : ''} (${size})`}
          </button>
        </div>
      )}

      {basket.length === 0 && (
        <div className="card p-8 text-center text-gray-400 space-y-2">
          <Tag className="w-12 h-12 mx-auto opacity-30" />
          <p className="text-sm">Busque produtos acima para adicionar etiquetas</p>
        </div>
      )}
    </div>
  )
}
