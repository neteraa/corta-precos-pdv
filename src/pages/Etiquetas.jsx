import React, { useState, useMemo, useCallback } from 'react'
import { Search, Tag, Printer, Plus, Minus, Trash2, X, Check, Eye } from 'lucide-react'
import { useStore, BRL } from '../store.jsx'

const STORE = 'CORTA PREÇOS'

/* ── Sizes ─────────────────────────────────────────────── */
const SIZES = [
  { id: '40x20',  label: '40 × 20 mm',           w: 40,  h: 20 },
  { id: '60x40',  label: '60 × 40 mm',           w: 60,  h: 40 },
  { id: '80x50',  label: '80 × 50 mm',           w: 80,  h: 50 },
  { id: '100x60', label: '100 × 60 mm (gôndola)', w: 100, h: 60 },
]

/* ── Templates ──────────────────────────────────────────── */
const TMPL = [
  {
    id: 'mercado',
    label: 'Mercado',
    desc: 'Faixa laranja — padrão da loja',
    strip: '#EA580C', stripTxt: '#fff',
    body: '#fff',     bodyBorder: '#EA580C',
    nameTxt: '#111', priceTxt: '#EA580C',
  },
  {
    id: 'gondola',
    label: 'Gôndola',
    desc: 'Fundo escuro, preço branco gigante',
    strip: '#991B1B', stripTxt: '#FED7AA',
    body: '#7F1D1D',  bodyBorder: '#FCA5A5',
    nameTxt: '#fff', priceTxt: '#fff',
  },
  {
    id: 'oferta',
    label: '⚡ Oferta',
    desc: 'Amarelo + vermelho — promoção bomba',
    strip: '#F59E0B', stripTxt: '#7C2D12',
    body: '#FFFBEB',  bodyBorder: '#DC2626',
    nameTxt: '#1C1917', priceTxt: '#DC2626',
  },
  {
    id: 'clean',
    label: 'Clean',
    desc: 'Moderno minimalista preto e branco',
    strip: '#111827', stripTxt: '#fff',
    body: '#fff',     bodyBorder: '#111827',
    nameTxt: '#111827', priceTxt: '#111827',
  },
]

/* ── price split: { int, dec } ──────────────────────────── */
const splitPrice = (price) => {
  const v = (price || 0).toFixed(2)
  const [a, b] = v.split('.')
  return { int: a, dec: ',' + b }
}

/* ── font size: mm height → pt ──────────────────────────── */
const fpt = (hMm, pct) => Math.max(4.5, hMm * 2.8346 * pct)

const PAD = 2.5 // mm horizontal padding inside label

/* ── Strip diacritics so jsPDF helvetica renders correctly ──
   Browser previews fine (UTF-8 font), PDF needs ASCII-safe text */
const pdfSafe = s =>
  (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()

/* ── hex #rrggbb → [r,g,b] ─────────────────────────────── */
const hex2rgb = hex => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
]

/* ══════════════════════════════════════════════════════════
   PDF DRAWING — all coords in mm (jsPDF unit:'mm')
   setFontSize() always takes pt regardless of unit
══════════════════════════════════════════════════════════ */
function pdfLabel(doc, p, x, y, w, h, tmplId) {
  const t = TMPL.find(t => t.id === tmplId) || TMPL[0]
  const { int, dec } = splitPrice(p.price)

  // FIX 1: strip accents — jsPDF built-in helvetica is ASCII-only
  const name = pdfSafe(p.name)

  const hs = h * 0.27  // header strip height

  const [br, bg, bb]   = hex2rgb(t.body)
  const [sr, sg, sb]   = hex2rgb(t.strip)
  const [nr, ng, nb]   = hex2rgb(t.nameTxt)
  const [pr, pg, pb]   = hex2rgb(t.priceTxt)
  const [str, stg, stb] = hex2rgb(t.stripTxt)
  const [bdr, bdg, bdb] = hex2rgb(t.bodyBorder)

  // ── body background
  doc.setFillColor(br, bg, bb)
  doc.rect(x, y, w, h, 'F')

  // ── header strip
  doc.setFillColor(sr, sg, sb)
  doc.rect(x, y, w, hs, 'F')

  // ── border
  doc.setDrawColor(bdr, bdg, bdb)
  doc.setLineWidth(0.35)
  doc.rect(x, y, w, h, 'S')

  // FIX 2: draw only ONE text in strip — oferta shows "* SUPER OFERTA *" instead of store name
  doc.setFont('helvetica', 'bold')
  const stripLabel = tmplId === 'oferta' ? '* SUPER OFERTA *' : pdfSafe(STORE)
  doc.setFontSize(fpt(h, tmplId === 'oferta' ? 0.10 : 0.115))
  doc.setTextColor(str, stg, stb)
  doc.text(stripLabel, x + w / 2, y + hs * 0.73, { align: 'center' })

  // FIX 3: auto-shrink font until name fits in nameLinesMax lines
  const maxNameW    = w - PAD * 2
  const nameLinesMax = h <= 25 ? 1 : 2
  let   nameFs      = fpt(h, h <= 25 ? 0.150 : 0.122)

  doc.setFont('helvetica', 'bold')
  for (let i = 0; i < 8; i++) {
    doc.setFontSize(nameFs)
    if (doc.splitTextToSize(name, maxNameW).length <= nameLinesMax || nameFs <= 4.5) break
    nameFs = Math.max(4.5, nameFs * 0.82)
  }
  const nameLines = doc.splitTextToSize(name, maxNameW).slice(0, nameLinesMax)

  // FIX 4: compute nameY so text never overlaps price block
  const lineHmm  = (nameFs / 2.8346) * 1.35          // line height in mm
  const nameBlockH = nameLines.length * lineHmm
  const nameAreaTop = y + hs + 1.2
  const priceBlockTop = y + h * (h <= 25 ? 0.54 : 0.60)  // price block starts here
  const nameCenter = nameAreaTop + (priceBlockTop - nameAreaTop - nameBlockH) / 2
  const nameY = Math.max(nameAreaTop + lineHmm * 0.82, nameCenter + lineHmm * 0.82)

  doc.setTextColor(nr, ng, nb)
  doc.text(nameLines, x + PAD, nameY, { lineHeightFactor: 1.35 })

  // ── promo pill
  if (p.promo && h >= 45) {
    const promoText = pdfSafe(p.promo)
    const pillY = y + h * 0.63
    doc.setFillColor(sr, sg, sb)
    doc.roundedRect(x + PAD, pillY - 2.5, w - PAD * 2, 5, 1, 1, 'F')
    doc.setFontSize(fpt(h, 0.08))
    doc.setTextColor(str, stg, stb)
    doc.text(promoText, x + w / 2, pillY + 0.8, { align: 'center' })
  }

  // ── price layout: R$ [INT] ,DEC
  const bigFs = fpt(h, 0.38)
  const smFs  = fpt(h, 0.145)
  const priceBaseline = y + h - h * 0.09

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(pr, pg, pb)

  doc.setFontSize(smFs)
  const rsW = doc.getTextWidth('R$') + 0.8
  doc.text('R$', x + PAD, priceBaseline - (bigFs / 2.8346) * 0.22)

  doc.setFontSize(bigFs)
  const intX = x + PAD + rsW
  doc.text(int, intX, priceBaseline)
  const intW = doc.getTextWidth(int)

  doc.setFontSize(smFs)
  doc.text(dec, intX + intW + 0.5, priceBaseline - (bigFs / 2.8346) * 0.22)

  // ── unit (KG / LT etc.)
  const unit = (p.unit || '').toUpperCase()
  if (!['UN', 'UND', ''].includes(unit)) {
    doc.setFontSize(fpt(h, 0.10))
    doc.setTextColor(nr, ng, nb)
    doc.text('/' + unit, x + w - PAD, priceBaseline, { align: 'right' })
  }

  // ── barcode / SKU footer
  if (h >= 35 && (p.sku || p.barcode)) {
    doc.setFontSize(fpt(h, 0.075))
    doc.setTextColor(150, 150, 150)
    doc.text(p.barcode || p.sku, x + w - PAD, y + h - 1.2, { align: 'right' })
  }
}

/* ══════════════════════════════════════════════════════════
   BROWSER LIVE PREVIEW — CSS mirror of the PDF template
══════════════════════════════════════════════════════════ */
function LabelPreview({ p, tmplId, sizeId }) {
  const sz = SIZES.find(s => s.id === sizeId) || SIZES[0]
  const t  = TMPL.find(t => t.id === tmplId)  || TMPL[0]

  // Scale to fit ~220px wide, keep aspect ratio
  const PREVIEW_W = 220
  const scale = PREVIEW_W / sz.w
  const W = sz.w * scale
  const H = sz.h * scale

  const { int, dec } = splitPrice(p.price)
  const priceFs = Math.max(14, H * 0.38)
  const smPriceFs = Math.max(8, H * 0.14)
  const nameFs   = Math.max(7, H * (sz.h <= 25 ? 0.145 : 0.12))
  const storeFs  = Math.max(6, H * 0.105)
  const hs = H * 0.26

  const unit = (p.unit || '').toUpperCase()

  return (
    <div style={{
      width: W, height: H,
      background: t.body,
      border: `2px solid ${t.bodyBorder}`,
      borderRadius: 4,
      overflow: 'hidden',
      position: 'relative',
      flexShrink: 0,
      fontFamily: 'Arial, Helvetica, sans-serif',
    }}>
      {/* Header strip */}
      <div style={{
        background: t.strip,
        height: hs,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 900,
        fontSize: storeFs,
        color: t.stripTxt,
        letterSpacing: '0.04em',
        padding: '0 4%',
        textAlign: 'center',
      }}>
        {tmplId === 'oferta' ? '★ SUPER OFERTA ★' : STORE}
      </div>

      {/* Body */}
      <div style={{
        padding: `${H * 0.045}px ${W * 0.05}px`,
        height: H - hs,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}>
        {/* Product name */}
        <div style={{
          fontWeight: 800,
          fontSize: nameFs,
          color: t.nameTxt,
          lineHeight: 1.2,
          overflow: 'hidden',
          maxHeight: '40%',
          wordBreak: 'break-word',
        }}>
          {(p.name || '').toUpperCase()}
        </div>

        {/* Promo pill */}
        {p.promo && sz.h >= 45 && (
          <div style={{
            background: t.strip,
            color: t.stripTxt,
            fontSize: Math.max(6, H * 0.075),
            fontWeight: 700,
            padding: '1px 6px',
            borderRadius: 3,
            textAlign: 'center',
            alignSelf: 'flex-start',
            maxWidth: '100%',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}>
            {p.promo.toUpperCase()}
          </div>
        )}

        {/* Price row */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
          <span style={{ fontSize: smPriceFs, fontWeight: 900, color: t.priceTxt, lineHeight: 1, marginBottom: smPriceFs * 0.22 }}>R$</span>
          <span style={{ fontSize: priceFs, fontWeight: 900, color: t.priceTxt, lineHeight: 1 }}>{int}</span>
          <span style={{ fontSize: smPriceFs, fontWeight: 900, color: t.priceTxt, lineHeight: 1, marginBottom: smPriceFs * 0.22 }}>{dec}</span>
          {!['UN', 'UND', ''].includes(unit) && (
            <span style={{ fontSize: Math.max(6, H * 0.09), color: t.nameTxt, opacity: 0.7, marginLeft: 2, marginBottom: 2 }}>/{unit}</span>
          )}
        </div>
      </div>

      {/* SKU watermark at bottom right */}
      {sz.h >= 35 && (p.sku || p.barcode) && (
        <div style={{
          position: 'absolute', bottom: 2, right: 4,
          fontSize: Math.max(5, H * 0.07),
          color: '#9CA3AF',
          fontFamily: 'monospace',
        }}>
          {p.barcode || p.sku}
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   TEMPLATE THUMBNAIL — small visual chip for template select
══════════════════════════════════════════════════════════ */
function TmplChip({ t, selected, onClick }) {
  return (
    <button onClick={onClick}
      className={`relative flex flex-col overflow-hidden rounded-xl border-2 transition-all text-left
        ${selected ? 'border-orange-500 shadow-md shadow-orange-100' : 'border-gray-200 hover:border-gray-300'}`}
      style={{ width: 100, height: 64 }}>

      {/* Mini header strip */}
      <div style={{ background: t.strip, height: '35%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: t.stripTxt, fontSize: 7, fontWeight: 900, fontFamily: 'Arial', letterSpacing: '0.03em' }}>
          {t.id === 'oferta' ? '★ OFERTA' : STORE.split(' ')[0]}
        </span>
      </div>

      {/* Mini body */}
      <div style={{ background: t.body, flex: 1, padding: '2px 4px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ height: 4, background: t.nameTxt + '33', borderRadius: 1 }} />
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <span style={{ fontSize: 7, color: t.priceTxt, fontWeight: 900, fontFamily: 'Arial' }}>R$</span>
          <span style={{ fontSize: 14, color: t.priceTxt, fontWeight: 900, lineHeight: 1, fontFamily: 'Arial' }}>9</span>
          <span style={{ fontSize: 7, color: t.priceTxt, fontWeight: 900, fontFamily: 'Arial' }}>,99</span>
        </div>
      </div>

      {/* Selected check */}
      {selected && (
        <div className="absolute top-1 right-1 bg-orange-500 rounded-full w-4 h-4 flex items-center justify-center">
          <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
        </div>
      )}
    </button>
  )
}

/* ══════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════ */
export default function Etiquetas() {
  const { products } = useStore()
  const [query,    setQuery]    = useState('')
  const [basket,   setBasket]   = useState([])   // [{ product, copies }]
  const [sizeId,   setSizeId]   = useState('60x40')
  const [tmplId,   setTmplId]   = useState('mercado')
  const [perRow,   setPerRow]   = useState(0)     // 0 = auto
  const [preview,  setPreview]  = useState(false)
  const [generating, setGenerating] = useState(false)

  const selSize = SIZES.find(s => s.id === sizeId) || SIZES[1]

  // Auto perRow based on size: usable A4 width = 200mm
  const autoPerRow = useMemo(() => {
    const gap = 2
    return Math.max(1, Math.floor((200 + gap) / (selSize.w + gap)))
  }, [selSize.w])

  const effectivePerRow = perRow || autoPerRow

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
        const next = [...prev]
        next[idx] = { ...next[idx], copies: next[idx].copies + 1 }
        return next
      }
      return [...prev, { product, copies: 1 }]
    })
    setQuery('')
  }, [])

  const setCopies = (id, delta) =>
    setBasket(prev => prev.map(b => b.product.id === id ? { ...b, copies: Math.max(1, b.copies + delta) } : b))

  const removeItem = (id) => setBasket(prev => prev.filter(b => b.product.id !== id))

  const totalLabels = basket.reduce((s, b) => s + b.copies, 0)

  const generatePDF = async () => {
    if (basket.length === 0) return
    setGenerating(true)
    try {
      const { jsPDF } = await import('jspdf')
      const { w: wMm, h: hMm } = selSize

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = 210, pageH = 297
      const mX = 5, mY = 5
      const gapX = 2, gapY = 2
      const cols = effectivePerRow

      let col = 0, row = 0

      const allLabels = basket.flatMap(b => Array(b.copies).fill(b.product))

      allLabels.forEach(p => {
        const x = mX + col * (wMm + gapX)
        const y = mY + row * (hMm + gapY)

        if (y + hMm > pageH - mY) {
          doc.addPage()
          col = 0; row = 0
          pdfLabel(doc, p, mX, mY, wMm, hMm, tmplId)
        } else {
          pdfLabel(doc, p, x, y, wMm, hMm, tmplId)
        }

        col++
        if (col >= cols) { col = 0; row++ }
      })

      doc.save(`etiquetas-${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (err) {
      alert('Erro ao gerar PDF: ' + err.message)
    }
    setGenerating(false)
  }

  return (
    <div className="space-y-5 animate-pop max-w-4xl">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Etiquetas de Preço</h1>
        <p className="text-gray-500 text-sm mt-0.5">Escolha o template, tamanho e gere PDF para imprimir</p>
      </div>

      {/* ── Template selector ── */}
      <div className="card p-4 space-y-3">
        <label className="label">Modelo de etiqueta</label>
        <div className="flex flex-wrap gap-3">
          {TMPL.map(t => (
            <div key={t.id}>
              <TmplChip t={t} selected={tmplId === t.id} onClick={() => setTmplId(t.id)} />
              <div className="mt-1 text-center">
                <div className="text-xs font-bold text-gray-700">{t.label}</div>
                <div className="text-[10px] text-gray-400 leading-tight">{t.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Size + perRow ── */}
      <div className="card p-4 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="label">Tamanho</label>
          <select value={sizeId} onChange={e => setSizeId(e.target.value)} className="input">
            {SIZES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div className="w-36">
          <label className="label">Colunas por linha</label>
          <div className="flex items-center gap-2">
            <input type="number" min="1" max="8" value={perRow || autoPerRow}
              onChange={e => setPerRow(Math.max(1, Math.min(8, +e.target.value)))}
              className="input w-20" />
            {perRow > 0 && (
              <button onClick={() => setPerRow(0)} className="text-xs text-orange-500 hover:underline whitespace-nowrap">Auto</button>
            )}
          </div>
        </div>
        <div className="text-sm text-gray-500 self-end pb-2.5">
          {totalLabels > 0
            ? <span className="font-bold text-orange-600">{totalLabels} etiqueta{totalLabels !== 1 ? 's' : ''}</span>
            : <span>0 selecionadas</span>
          }
        </div>
      </div>

      {/* ── Search ── */}
      <div className="card p-4 space-y-3">
        <label className="font-bold text-gray-800 text-sm block">Adicionar produto</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por nome, código de barras ou SKU…"
            className="input pl-9" />
          {query && (
            <button onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
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

      {/* ── Basket + preview ── */}
      {basket.length > 0 ? (
        <div className="card p-4 space-y-4">
          {/* Basket header */}
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-800 text-sm">
              Etiquetas selecionadas
              <span className="ml-2 text-orange-600 font-black">{totalLabels}</span>
            </h2>
            <div className="flex items-center gap-3">
              <button onClick={() => setPreview(p => !p)}
                className={`btn-ghost text-xs py-1 px-2 ${preview ? 'bg-orange-50 text-orange-600' : ''}`}>
                <Eye className="w-3.5 h-3.5" />
                {preview ? 'Ocultar' : 'Pré-visualizar'}
              </button>
              <button onClick={() => setBasket([])} className="text-xs text-red-500 hover:underline">Limpar</button>
            </div>
          </div>

          {/* Product list */}
          <div className="divide-y divide-gray-100">
            {basket.map(({ product: p, copies }) => (
              <div key={p.id} className="flex items-center gap-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-800 truncate">{p.name}</div>
                  <div className="text-xs text-gray-400">{BRL.format(p.price || 0)}
                    {p.promo && <span className="ml-2 text-orange-500">🏷 {p.promo}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setCopies(p.id, -1)}
                    className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-8 text-center text-sm font-bold">{copies}</span>
                  <button onClick={() => setCopies(p.id, 1)}
                    className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <button onClick={() => removeItem(p.id)} className="text-red-400 hover:text-red-600 ml-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Live label preview */}
          {preview && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Pré-visualização — template <span className="text-orange-600">{TMPL.find(t => t.id === tmplId)?.label}</span> · {selSize.label}
              </div>
              <div className="flex flex-wrap gap-4 p-4 bg-gray-100 rounded-xl">
                {basket.flatMap(({ product: p, copies }) =>
                  Array.from({ length: Math.min(copies, 3) }, (_, i) => (
                    <LabelPreview key={`${p.id}-${i}`} p={p} tmplId={tmplId} sizeId={sizeId} />
                  ))
                )}
                {totalLabels > basket.length * 3 && (
                  <div className="flex items-center justify-center w-14 h-14 rounded-lg bg-gray-200 text-xs text-gray-400">+mais</div>
                )}
              </div>
            </div>
          )}

          {/* Generate button */}
          <button onClick={generatePDF} disabled={generating}
            className="btn-primary w-full justify-center disabled:opacity-60 text-base py-3">
            <Printer className="w-5 h-5" />
            {generating
              ? 'Gerando PDF…'
              : `Imprimir PDF — ${totalLabels} etiqueta${totalLabels !== 1 ? 's' : ''} · ${selSize.label}`
            }
          </button>
        </div>
      ) : (
        <div className="card p-10 text-center text-gray-400 space-y-2">
          <Tag className="w-12 h-12 mx-auto opacity-25" />
          <p className="text-sm">Busque produtos acima para montar a folha de etiquetas</p>
        </div>
      )}
    </div>
  )
}
