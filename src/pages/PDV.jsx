import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  ShoppingCart, Search, Barcode, Trash2, Plus, Minus,
  Check, X, CreditCard, Banknote, Smartphone, Printer, PlugZap, Monitor, SplitSquareHorizontal
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useStore, BRL } from '../store.jsx'
import { usePrinter } from '../hooks/usePrinter.js'
import { useBroadcastSend } from '../hooks/useBroadcast.js'
import { useScanReceiver }  from '../hooks/useScanRelay.js'
import PixQR from '../components/PixQR.jsx'

const WA_LINK = 'https://wa.me/5515996604075?text=Oi%20Corta%20Pre%C3%A7os!%20Quero%20receber%20as%20promo%C3%A7%C3%B5es%20da%20semana%20%F0%9F%9B%92'

const PAYMENTS = [
  { key: 'Dinheiro', icon: Banknote,    color: 'text-green-700 border-green-400 bg-green-50' },
  { key: 'Crédito',  icon: CreditCard,  color: 'text-blue-700 border-blue-400 bg-blue-50' },
  { key: 'Débito',   icon: CreditCard,  color: 'text-indigo-700 border-indigo-400 bg-indigo-50' },
  { key: 'PIX',      icon: Smartphone,  color: 'text-brand-700 border-brand-500 bg-brand-50' },
]

/* ─────────────────────────────────────────────────────────────
   Mix-and-Match Promo Engine
   For each active rule, groups cart items by promoGroup,
   calculates how many complete sets fit, and returns:
     - discount (savings to subtract from subtotal)
     - progress info (X / rule.qty) for incomplete sets
───────────────────────────────────────────────────────────── */
function calcPromoEngine(cart, products, promos) {
  const results = []
  const activeRules = promos.filter(r => r.active)

  for (const rule of activeRules) {
    const groupItems = cart.filter(item => {
      const p = products.find(x => x.id === item.productId)
      return p?.promoGroup === rule.group
    })
    if (groupItems.length === 0) continue

    const totalQty   = groupItems.reduce((s, i) => s + i.qty, 0)
    const complete   = Math.floor(totalQty / rule.qty)
    const remainder  = totalQty % rule.qty
    const normalSum  = groupItems.reduce((s, i) => s + i.qty * i.price, 0)

    if (complete === 0) {
      // In progress — not yet reached threshold
      results.push({ rule, status: 'progress', current: totalQty, needed: rule.qty - totalQty, discount: 0 })
      continue
    }

    // Average unit price for remainder (units that didn't fit in a complete set)
    const avgPrice  = normalSum / totalQty
    const promoSum  = complete * rule.totalPrice + remainder * avgPrice
    const discount  = Math.max(0, normalSum - promoSum)

    results.push({ rule, status: 'active', current: totalQty, complete, remainder, discount, normalSum, promoSum })
  }
  return results
}

/* ─────────────────────────────────────────────────────────────
   CartItem – cart row with big ± buttons; click qty to type it.
───────────────────────────────────────────────────────────── */
function CartItem({ item, idx, onQty, onRemove, BRL }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState('')
  const inputRef = useRef(null)

  const startEdit = () => { setDraft(String(item.qty)); setEditing(true); setTimeout(() => inputRef.current?.select(), 0) }
  const commitEdit = () => {
    const n = parseInt(draft, 10)
    if (!isNaN(n) && n > 0) onQty(item.productId, n - item.qty)
    else if (!isNaN(n) && n <= 0) onRemove(item.productId)
    setEditing(false)
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors group">
      <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-400 flex-shrink-0">
        {idx + 1}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-800 truncate leading-tight">{item.name}</div>
        <div className="text-xs text-gray-400 mt-0.5">{BRL.format(item.price)}/un.</div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button onClick={() => onQty(item.productId, -1)}
          className="w-9 h-9 rounded-xl border-2 border-gray-200 hover:border-red-400 hover:bg-red-50 flex items-center justify-center text-gray-500 hover:text-red-500 transition-all active:scale-95">
          <Minus className="w-4 h-4" />
        </button>
        {editing ? (
          <input ref={inputRef} type="number" min="0" value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false) }}
            className="w-12 text-center text-sm font-black border-2 border-orange-400 rounded-lg py-1 outline-none" />
        ) : (
          <button onClick={startEdit} title="Clique para editar qtd."
            className="w-10 text-center text-base font-black text-gray-900 hover:bg-orange-50 hover:text-orange-600 rounded-lg py-1 transition-colors">
            {item.qty}
          </button>
        )}
        <button onClick={() => onQty(item.productId, 1)}
          className="w-9 h-9 rounded-xl border-2 border-gray-200 hover:border-green-400 hover:bg-green-50 flex items-center justify-center text-gray-500 hover:text-green-500 transition-all active:scale-95">
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <div className="w-20 text-right text-sm font-bold text-gray-900 flex-shrink-0">
        {BRL.format(item.price * item.qty)}
      </div>
      <button onClick={() => onRemove(item.productId)}
        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all ml-1 flex-shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   HID Scanner hook
   Strategy: accumulate keystrokes globally; commit on Enter or
   after 80 ms silence. Min 4 chars to distinguish from accidental
   keypresses. Ignores keystrokes when an <input> / <textarea> is
   focused (let normal typing through), UNLESS it's our own
   scan-input ref.
───────────────────────────────────────────────────────────── */
function useHIDScanner(onScan) {
  const buf = useRef('')
  const timer = useRef(null)

  useEffect(() => {
    const commit = () => {
      const code = buf.current.trim()
      buf.current = ''
      if (code.length >= 4) onScan(code)
    }

    const handler = (e) => {
      // Let normal input elements handle their own events
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.key === 'Enter') {
        clearTimeout(timer.current)
        commit()
        return
      }
      // Only accumulate printable chars
      if (e.key.length === 1) {
        buf.current += e.key
        clearTimeout(timer.current)
        timer.current = setTimeout(commit, 80)
      }
    }

    window.addEventListener('keydown', handler)
    return () => { window.removeEventListener('keydown', handler); clearTimeout(timer.current) }
  }, [onScan])
}

export default function PDV() {
  const { products, promos, registerSale, photos } = useStore()
  const printer   = usePrinter()
  const broadcast = useBroadcastSend()

  const [cart, setCart]             = useState([])
  const [query, setQuery]           = useState('')
  const [discount, setDiscount]     = useState(0)
  const [payment, setPayment]       = useState('PIX')
  const [showFinish, setShowFinish] = useState(false)
  const [lastSale, setLastSale]     = useState(null)
  const [scanFeedback, setScanFeedback] = useState(null)

  // ── Split payment ──────────────────────────────────────────
  const [splitMode, setSplitMode]   = useState(false)
  const [splitPays, setSplitPays]   = useState([{ method: 'PIX', amount: '' }])

  // ── Troco ──────────────────────────────────────────────────
  const [received, setReceived]     = useState('')

  // ── Caixa banner flash ─────────────────────────────────────
  const [saleJustDone, setSaleJustDone] = useState(false)
  useEffect(() => {
    if (!lastSale) return
    setSaleJustDone(true)
    const t = setTimeout(() => setSaleJustDone(false), 3000)
    return () => clearTimeout(t)
  }, [lastSale])

  const [selIdx, setSelIdx]         = useState(-1)
  const searchRef  = useRef(null)
  const resultsRef = useRef(null)

  const results = query.trim().length >= 2
    ? products.filter(p =>
        p.sku?.includes(query.trim()) ||
        p.name?.toLowerCase().includes(query.trim().toLowerCase())
      ).slice(0, 10)
    : []

  // Reset arrow selection when query changes
  useEffect(() => { setSelIdx(-1) }, [query])

  // Scroll selected item into view
  useEffect(() => {
    if (selIdx >= 0 && resultsRef.current) {
      resultsRef.current.querySelectorAll('[data-result]')[selIdx]?.scrollIntoView({ block: 'nearest' })
    }
  }, [selIdx])

  // ── promo engine ──────────────────────────────────────────
  const promoResults       = calcPromoEngine(cart, products, promos)
  const totalPromoDiscount = promoResults.reduce((s, r) => s + r.discount, 0)

  const subtotal    = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const discountAmt = subtotal * (discount / 100)
  const total       = subtotal - totalPromoDiscount - discountAmt

  // ── broadcast to customer display ─────────────────────────
  useEffect(() => {
    broadcast({ type: 'cart', cart, promoResults, subtotal, total: Math.max(0, total) })
  }, [cart, promoResults, subtotal, total]) // eslint-disable-line

  // ── split payment helpers ──────────────────────────────────
  const splitTotal   = splitPays.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
  const splitRemain  = Math.max(0, total - splitTotal)
  const splitValid   = splitMode ? Math.abs(splitTotal - total) < 0.02 : true

  const addSplitPay  = () => setSplitPays(p => [...p, { method: 'Dinheiro', amount: '' }])
  const removeSplitPay = (i) => setSplitPays(p => p.filter((_, idx) => idx !== i))
  const updateSplitPay = (i, field, val) =>
    setSplitPays(p => p.map((x, idx) => idx === i ? { ...x, [field]: val } : x))
  const focusSplitLast = (i) => {
    setSplitPays(p => p.map((x, idx) => {
      if (idx !== i || x.amount !== '') return x
      const rem = total - p.slice(0, i).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)
      return { ...x, amount: rem > 0 ? rem.toFixed(2) : '' }
    }))
  }

  // ── Troco helpers ──────────────────────────────────────────
  const showTroco   = !splitMode && payment === 'Dinheiro'
  const receivedVal = parseFloat(received) || 0
  const troco       = showTroco ? Math.max(0, receivedVal - Math.max(0, total)) : 0
  const trocoValid  = !showTroco || receivedVal >= Math.max(0, total) - 0.01

  // Round total up to nearest R$5 for suggested received amount
  const suggestReceived = () => {
    const t = Math.max(0, total)
    const rounded = Math.ceil(t / 5) * 5
    setReceived(rounded.toFixed(2))
  }

  const [flashKey,     setFlashKey]    = useState(0)
  const [totalKey,     setTotalKey]    = useState(0)
  const [weightModal,  setWeightModal] = useState(null)   // { product } | null
  const [weightDraft,  setWeightDraft] = useState('')

  const addToCartRaw = useCallback((p, qty = 1) => {
    setCart(prev => {
      const ex = prev.find(i => i.productId === p.id)
      const unit = (p.unit || '').toUpperCase()
      const isWeight = unit === 'KG' || unit === 'G'
      // weight products: always add as new line (each scan = new weight)
      if (isWeight) return [...prev, { productId: p.id, name: p.name, price: p.price, qty, sku: p.sku, promo: p.promo || '', unit: p.unit }]
      if (ex) return prev.map(i => i.productId === p.id ? { ...i, qty: i.qty + qty } : i)
      return [...prev, { productId: p.id, name: p.name, price: p.price, qty, sku: p.sku, promo: p.promo || '', unit: p.unit }]
    })
    setFlashKey(k => k + 1)
    setTotalKey(k => k + 1)
    setQuery('')
  }, [])

  const addToCart = useCallback((p) => {
    const unit = (p.unit || '').toUpperCase()
    if (unit === 'KG' || unit === 'G') {
      setWeightDraft('')
      setWeightModal(p)
      return
    }
    addToCartRaw(p, 1)
  }, [addToCartRaw])

  // HID scanner callback — matches SKU or barcode, with normalization
  const findProduct = useCallback((raw) => {
    const code = String(raw).trim().replace(/\0/g, '')   // strip nulls from HID
    if (!code) return null
    // exact match first (most common)
    const exact = products.find(x => x.sku === code || x.barcode === code)
    if (exact) return exact
    // strip leading zeros variant (e.g. "0789" vs "789")
    const stripped = code.replace(/^0+/, '') || code
    return products.find(x =>
      (x.sku || '').replace(/^0+/, '') === stripped ||
      (x.barcode || '').replace(/^0+/, '') === stripped
    ) || null
  }, [products])

  const handleScan = useCallback((code) => {
    const p = findProduct(code)
    if (p) {
      addToCart(p)
      setScanFeedback({ ok: true, msg: `✅ ${p.name}` })
    } else {
      setScanFeedback({ ok: false, msg: `❌ Código não encontrado: ${code}` })
    }
    setTimeout(() => setScanFeedback(null), 2500)
  }, [findProduct, addToCart])

  useHIDScanner(handleScan)

  // ── Mobile scan relay (WebSocket + localStorage) — placed here after handleScan ──
  useScanReceiver(handleScan)

  // Arrow navigation + Enter for search results
  const handleSearchKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelIdx(i => Math.min(i + 1, results.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelIdx(i => Math.max(i - 1, -1))
      return
    }
    if (e.key === 'Escape') {
      setQuery(''); setSelIdx(-1); return
    }
    if (e.key === 'Enter') {
      const val = query.trim()
      // If arrow-selected, pick that item
      if (selIdx >= 0 && results[selIdx]) {
        addToCart(results[selIdx]); setSelIdx(-1); return
      }
      // Otherwise try barcode lookup first
      const byCode = findProduct(val)
      if (byCode) { addToCart(byCode); setQuery('') }
      else if (results.length >= 1) { addToCart(results[0]) }
    }
  }

  const changeQty = (productId, delta) => {
    setCart(prev => prev
      .map(i => i.productId === productId ? { ...i, qty: i.qty + delta } : i)
      .filter(i => i.qty > 0)
    )
  }

  const removeItem = (productId) => setCart(prev => prev.filter(i => i.productId !== productId))

  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    const BLOCKED = ['F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F12']
    const handler = (e) => {
      if (BLOCKED.includes(e.key)) e.preventDefault()

      if (e.key === 'F1')  { setShowHelp(h => !h); return }
      if (e.key === 'F2')  { searchRef.current?.focus(); return }
      if (e.key === 'F3')  { window.open('/scan', 'cp_scan', 'width=400,height=700'); return }
      if (e.key === 'F4')  { setDiscount(d => d === 0 ? 5 : d === 5 ? 10 : d === 10 ? 15 : d === 15 ? 20 : 0); return }
      if (e.key === 'F5')  { setPayment('PIX'); return }
      if (e.key === 'F6')  { setPayment('Débito'); return }
      if (e.key === 'F7')  { setPayment('Crédito'); return }
      if (e.key === 'F8')  { setPayment('Dinheiro'); return }
      if (e.key === 'F9')  { if (cart.length > 0 && window.confirm('Limpar carrinho?')) setCart([]); return }
      if (e.key === 'F10' && cart.length > 0) {
        const rounded = Math.ceil(Math.max(0, total) / 5) * 5
        setReceived(rounded.toFixed(2))
        setShowFinish(true)
      }
      if (e.key === 'F12') { window.open('/terminal', '_blank'); return }
      if (e.key === 'Enter' && showFinish && trocoValid) { e.preventDefault(); finish() }
      if (e.key === 'Escape') { setShowFinish(false); setQuery(''); setShowHelp(false) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [cart, total, showFinish, trocoValid]) // eslint-disable-line

  const finish = () => {
    const promoDiscount  = totalPromoDiscount
    const paymentLabel   = splitMode
      ? splitPays.map(p => `${p.method} R$${p.amount}`).join(' + ')
      : payment

    const sale = registerSale({
      items: cart,
      total: Math.max(0, total),
      payment: paymentLabel,
      payments: splitMode ? splitPays : [{ method: payment, amount: Math.max(0, total) }],
      discount: discountAmt,
      promoDiscount,
      promos: promoResults.filter(r => r.status === 'active').map(r => ({
        id: r.rule.id, name: r.rule.name, times: r.complete, saving: r.discount,
      })),
    })
    const fullSale = {
      ...sale,
      total: Math.max(0, total),
      payment: paymentLabel,
      promoDiscount,
      received: showTroco ? receivedVal : null,
      troco:    showTroco ? troco : null,
    }
    setLastSale(fullSale)
    setCart([]); setDiscount(0); setPayment('PIX')
    setSplitMode(false); setSplitPays([{ method: 'PIX', amount: '' }])
    setReceived(''); setShowFinish(false)
    // Broadcast cleared cart to display
    broadcast({ type: 'cart', cart: [], promoResults: [], subtotal: 0, total: 0 })

    // printReceipt: always prints receipt; adds promo coupon only when total >= R$100
    printer.printReceipt(fullSale)
  }

  // ── Caixa banner state ────────────────────────────────────
  const bannerState = saleJustDone && cart.length === 0 ? 'done'
                    : cart.length > 0                   ? 'ocupada'
                    : 'libre'

  const BANNER = {
    libre:   { bg: '#0a1208', border: '#16a34a', dot: '#22c55e', text: '#4ade80', label: 'CAIXA LIVRE',       sub: 'CAIXA 01  ·  CORTA PREÇOS',       cls: 'banner-libre'   },
    ocupada: { bg: '#140a00', border: '#c2410c', dot: '#f97316', text: '#fb923c', label: 'EM ATENDIMENTO',    sub: null,                               cls: 'banner-ocupada' },
    done:    { bg: '#00080f', border: '#1d4ed8', dot: '#60a5fa', text: '#93c5fd', label: 'VENDA CONCLUÍDA ✓', sub: 'Obrigado! Próximo por favor...',    cls: 'banner-done'    },
  }[bannerState]

  return (
    <div className="animate-pop">

      {/* ── Caixa Status Banner ─────────────────────────────── */}
      <div
        className={`relative rounded-2xl mb-4 overflow-hidden transition-all duration-700 ${BANNER.cls}`}
        style={{ background: BANNER.bg, border: `1.5px solid ${BANNER.border}33` }}
      >
        {/* shimmer pass */}
        <div className="banner-shimmer" />

        <div className="relative z-10 flex items-center justify-between px-5 py-3.5 gap-4">

          {/* LEFT: LED dot + status */}
          <div className="flex items-center gap-4 min-w-0">
            {/* LED */}
            <div className="relative flex-shrink-0">
              <div
                className={bannerState === 'libre' ? 'led-libre' : 'led-ocupada'}
                style={{
                  width: 14, height: 14, borderRadius: '50%',
                  background: BANNER.dot,
                  boxShadow: `0 0 10px 3px ${BANNER.dot}88`,
                }}
              />
            </div>

            {/* Status text */}
            <div className="min-w-0">
              <div
                className="font-black tracking-widest leading-none"
                style={{
                  fontFamily: "'Courier New', monospace",
                  fontSize: 'clamp(18px, 2.5vw, 28px)',
                  color: BANNER.text,
                  textShadow: `0 0 20px ${BANNER.text}99`,
                  letterSpacing: '0.12em',
                }}
              >
                {BANNER.label}
              </div>
              {bannerState === 'ocupada' && (
                <div className="text-xs font-bold mt-0.5 truncate" style={{ color: BANNER.dot, fontFamily: 'monospace', letterSpacing: '0.06em' }}>
                  {cart.reduce((s, i) => s + i.qty, 0)} ITENS  ·  {BRL.format(Math.max(0, total))}
                </div>
              )}
              {bannerState !== 'ocupada' && BANNER.sub && (
                <div className="text-xs font-semibold mt-0.5 opacity-60 tracking-widest" style={{ color: BANNER.text, fontFamily: 'monospace' }}>
                  {BANNER.sub}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: controls row */}
          <div className="flex items-center gap-2 flex-wrap justify-end flex-shrink-0">
            {/* scanner */}
            <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 text-green-400 text-xs font-semibold px-2.5 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
              Scanner
            </div>

            {/* F-key quick bar */}
            <div className="hidden lg:flex items-center gap-1 flex-wrap">
              {[['F1','?'], ['F2','Buscar'], ['F3','Scan'], ['F4','Desc.'], ['F5','PIX'], ['F6','Déb.'], ['F7','Cré.'], ['F8','Din.'], ['F9','Limpar'], ['F10','Finalizar']].map(([k, l]) => (
                <span key={k} className="flex items-center gap-1 bg-white/5 border border-white/10 text-[10px] px-2 py-1 rounded font-mono">
                  <span className="text-orange-400 font-black">{k}</span>
                  <span className="text-white/50">{l}</span>
                </span>
              ))}
            </div>

            {/* customer display */}
            <button
              onClick={() => window.open('/display', 'cp_display', 'width=1280,height=720')}
              className="flex items-center gap-1.5 bg-purple-900/40 border border-purple-500/30 text-purple-300 text-xs font-semibold px-2.5 py-1.5 rounded-full hover:bg-purple-800/50 transition-colors"
              title="Tela do cliente"
            >
              <Monitor className="w-3.5 h-3.5" /> Tela
            </button>

            {/* printer */}
            {printer.isSupported ? (
              printer.isConnected ? (
                <button onClick={printer.disconnect}
                  className="flex items-center gap-1.5 bg-blue-900/40 border border-blue-500/30 text-blue-300 text-xs font-semibold px-2.5 py-1.5 rounded-full hover:bg-blue-800/50 transition-colors"
                  title="Impressora conectada — clique para desconectar"
                >
                  <Printer className="w-3.5 h-3.5" />
                  {printer.status === 'printing' ? 'Imprimindo...' : 'Impressora ✓'}
                </button>
              ) : (
                <button onClick={printer.connect} disabled={printer.status === 'connecting'}
                  className="flex items-center gap-1.5 bg-white/5 border border-white/15 text-white/50 text-xs font-semibold px-2.5 py-1.5 rounded-full hover:bg-white/10 transition-colors disabled:opacity-40"
                  title="Conectar impressora térmica"
                >
                  <PlugZap className="w-3.5 h-3.5" />
                  {printer.status === 'connecting' ? 'Conectando...' : 'Impressora'}
                </button>
              )
            ) : null}
          </div>
        </div>
      </div>

      {/* scan feedback toast */}
      {scanFeedback && (
        <div className={`mb-3 px-4 py-2.5 rounded-xl text-sm font-semibold animate-pop border ${
          scanFeedback.ok
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {scanFeedback.msg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* left: search + cart */}
        <div className="lg:col-span-3 space-y-3">
          {/* search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={searchRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleSearchKey}
              placeholder="Buscar por nome ou digitar código (F2) — ou scaneie direto..."
              className="input pl-9 pr-4 text-sm"
              autoFocus
            />
            {results.length > 0 && (
              <div ref={resultsRef} className="absolute top-full left-0 right-0 z-20 bg-white border border-gray-200 rounded-xl shadow-xl mt-1 divide-y divide-gray-100 max-h-80 overflow-y-auto">
                {/* navigation hint */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-[10px] text-gray-400 font-medium border-b border-gray-100 rounded-t-xl">
                  <span>↑↓ navegar</span><span>·</span><span>Enter selecionar</span><span>·</span><span>ESC fechar</span>
                </div>
                {results.map((p, idx) => (
                  <button
                    key={p.id}
                    data-result
                    onClick={() => { addToCart(p); setSelIdx(-1) }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                      idx === selIdx
                        ? 'bg-orange-50 border-l-4 border-orange-500'
                        : 'hover:bg-brand-50'
                    }`}
                  >
                    {/* Product thumbnail */}
                    {photos[p.id]
                      ? <img src={photos[p.id]} alt="" className="w-11 h-11 rounded-lg object-cover flex-shrink-0" />
                      : <div className="w-11 h-11 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-300 text-lg">📦</div>
                    }
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {idx === selIdx && <span className="text-orange-500 font-black text-base leading-none">›</span>}
                        <span className="text-sm font-semibold text-gray-800 truncate">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400 font-mono">{p.sku}</span>
                        <span className="text-xs text-gray-400">{p.category}</span>
                        {p.promoGroup && (
                          <span className="text-[10px] font-bold bg-green-600 text-white px-1.5 py-0.5 rounded">PROMO</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-black text-brand-600">{BRL.format(p.price)}</div>
                      <div className={`text-xs ${p.stock === 0 ? 'text-red-500 font-bold' : p.stock <= 5 ? 'text-amber-500 font-semibold' : 'text-gray-400'}`}>
                        {p.stock === 0 ? '⚠ SEM ESTOQUE' : `${p.stock} un.`}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── promo progress pills ──────────────────────────────── */}
          {promoResults.length > 0 && (
            <div className="space-y-1.5">
              {promoResults.map(r => (
                <div
                  key={r.rule.id}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm font-semibold ${
                    r.status === 'active'
                      ? 'bg-green-50 border-green-300 text-green-800'
                      : 'bg-amber-50 border-amber-300 text-amber-800'
                  }`}
                >
                  {r.status === 'active' ? (
                    <>
                      <span className="text-base">✅</span>
                      <div className="flex-1">
                        <span className="font-black">{r.rule.name}</span>
                        {r.complete > 1 && <span className="ml-1 text-xs font-normal">({r.complete}×)</span>}
                        {r.remainder > 0 && <span className="ml-1 text-xs font-normal text-green-600">+{r.remainder} avulso</span>}
                      </div>
                      <span className="text-green-700 font-black">
                        − {BRL.format(r.discount)} ↓
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-base">🎯</span>
                      <div className="flex-1">
                        <span>{r.rule.name}</span>
                        <span className="ml-2 text-xs font-normal">({r.current}/{r.rule.qty})</span>
                      </div>
                      {/* mini progress bar */}
                      <div className="flex gap-0.5">
                        {Array.from({ length: r.rule.qty }).map((_, i) => (
                          <div key={i} className={`w-3 h-3 rounded-sm ${i < r.current ? 'bg-amber-500' : 'bg-amber-200'}`} />
                        ))}
                      </div>
                      <span className="text-xs text-amber-700">falta {r.needed}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── sugestão agressiva ao caixa ───────────────────── */}
          {promoResults.some(r => r.status === 'progress') && (
            <div className="space-y-1.5">
              {promoResults.filter(r => r.status === 'progress').map(r => {
                // Estimate saving: find avg price of items in this group
                const groupItems = cart.filter(i => {
                  const p = products.find(x => x.id === i.productId)
                  return p?.promoGroup === r.rule.group
                })
                const avgP = groupItems.length
                  ? groupItems.reduce((s, i) => s + i.price, 0) / groupItems.length
                  : r.rule.totalPrice / r.rule.qty
                const saving = Math.max(0, r.rule.qty * avgP - r.rule.totalPrice).toFixed(2)
                return (
                  <div key={r.rule.id} className="bg-brand-600 rounded-xl px-4 py-3 flex items-center gap-3">
                    <span className="text-2xl">🗣️</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-black font-black text-sm">Diga ao cliente:</div>
                      <div className="text-black/80 text-xs font-medium truncate">
                        "Adicione mais {r.needed} e pague {BRL.format(r.rule.totalPrice)} no total!"
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-black font-black text-base">−{BRL.format(saving)}</div>
                      <div className="text-black/70 text-xs">economia</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* cart */}
          <div key={`cart-${flashKey}`} className="card min-h-[340px] scan-flash">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-200 gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
                  <Barcode className="w-8 h-8 text-gray-300" />
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-400 font-medium">Carrinho vazio</p>
                  <p className="text-xs text-gray-300 mt-1">Escaneie um código de barras ou busque pelo nome</p>
                </div>
              </div>
            ) : (
              <div>
                {/* cart header */}
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {cart.reduce((s, i) => s + i.qty, 0)} itens
                  </span>
                  <button
                    onClick={() => { if (window.confirm('Limpar carrinho?')) setCart([]) }}
                    className="text-xs text-red-400 hover:text-red-600 font-medium"
                  >
                    Limpar tudo
                  </button>
                </div>
                <div className="divide-y divide-gray-100">
                  {cart.map((item, idx) => (
                    <CartItem
                      key={item.productId}
                      item={item}
                      idx={idx}
                      onQty={changeQty}
                      onRemove={removeItem}
                      BRL={BRL}
                    />
                  ))}
                  {/* invisible sentinel to always show the bottom of the list */}
                  <div id="cart-bottom" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* right: totals + payment */}
        <div className="lg:col-span-2 space-y-3">
          {/* totals */}
          <div className="card p-4 space-y-2.5">
            <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Resumo</h2>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal ({cart.reduce((s,i)=>s+i.qty,0)} un.)</span>
              <span className="font-semibold">{BRL.format(subtotal)}</span>
            </div>

            {/* promo discounts */}
            {promoResults.filter(r => r.status === 'active').map(r => (
              <div key={r.rule.id} className="flex justify-between text-sm text-green-600 font-semibold">
                <span className="flex items-center gap-1">
                  <span>🏷️</span> {r.rule.name}
                  {r.complete > 1 && <span className="text-xs font-normal text-green-500">×{r.complete}</span>}
                </span>
                <span>− {BRL.format(r.discount)}</span>
              </div>
            ))}

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 flex-1">Desconto extra (%)</span>
              <input
                type="number" min="0" max="100" step="0.5"
                value={discount}
                onChange={e => setDiscount(Math.max(0, Math.min(100, Number(e.target.value))))}
                className="input w-20 text-right text-sm"
              />
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm text-green-600 font-medium">
                <span>− Desconto ({discount}%)</span>
                <span>− {BRL.format(discountAmt)}</span>
              </div>
            )}

            <div className="border-t-2 border-gray-900 pt-2.5">
              {(totalPromoDiscount > 0 || discountAmt > 0) && (
                <div className="flex justify-between text-xs text-green-600 font-bold mb-1">
                  <span>💰 Total economizado</span>
                  <span>{BRL.format(totalPromoDiscount + discountAmt)}</span>
                </div>
              )}
              <div className="flex items-baseline justify-between">
                <span className="text-base font-black text-gray-900 uppercase tracking-wide">TOTAL</span>
                <span key={`total-${totalKey}`} className="text-3xl font-black text-brand-600 shimmer-once">
                  {BRL.format(Math.max(0, total))}
                </span>
              </div>
            </div>
          </div>

          {/* payment */}
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Pagamento</h2>
              <button
                onClick={() => { setSplitMode(s => !s); setSplitPays([{ method: 'PIX', amount: '' }]) }}
                className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg border transition-colors ${
                  splitMode
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                    : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                }`}
              >
                <SplitSquareHorizontal className="w-3.5 h-3.5" />
                {splitMode ? 'Split ativo' : 'Dividir pagamento'}
              </button>
            </div>

            {/* single payment mode */}
            {!splitMode && (
              <div className="grid grid-cols-2 gap-2">
                {PAYMENTS.map(({ key, icon: Icon, color }) => (
                  <button
                    key={key}
                    onClick={() => setPayment(key)}
                    className={`flex items-center gap-2 px-3 py-3 rounded-xl border-2 text-sm font-bold transition-all ${
                      payment === key ? color : 'border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" /> {key}
                  </button>
                ))}
              </div>
            )}

            {/* split payment mode */}
            {splitMode && (
              <div className="space-y-2">
                {/* remaining indicator */}
                <div className={`flex justify-between text-sm font-bold px-1 ${splitRemain > 0.01 ? 'text-amber-600' : 'text-green-600'}`}>
                  <span>{splitRemain > 0.01 ? `⚠️ Falta: ${BRL.format(splitRemain)}` : '✅ Valor correto'}</span>
                  <span>Total: {BRL.format(Math.max(0, total))}</span>
                </div>

                {splitPays.map((sp, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      value={sp.method}
                      onChange={e => updateSplitPay(i, 'method', e.target.value)}
                      className="input py-2 text-sm flex-shrink-0 w-28"
                    >
                      {PAYMENTS.map(p => <option key={p.key}>{p.key}</option>)}
                    </select>
                    <input
                      type="number" min="0" step="0.01" placeholder="R$ 0,00"
                      value={sp.amount}
                      onFocus={() => focusSplitLast(i)}
                      onChange={e => updateSplitPay(i, 'amount', e.target.value)}
                      className="input py-2 text-sm flex-1"
                    />
                    {splitPays.length > 1 && (
                      <button onClick={() => removeSplitPay(i)} className="text-gray-400 hover:text-red-500 flex-shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}

                <button
                  onClick={addSplitPay}
                  className="w-full py-2 border-2 border-dashed border-gray-200 text-gray-400 hover:border-indigo-300 hover:text-indigo-500 text-xs font-bold rounded-xl transition-colors"
                >
                  + Adicionar forma de pagamento
                </button>
              </div>
            )}
          </div>

          {/* finalizar */}
          <button
            disabled={cart.length === 0 || !splitValid}
            onClick={() => { suggestReceived(); setShowFinish(true) }}
            className="btn-primary w-full justify-center py-4 text-base font-black disabled:opacity-30 disabled:cursor-not-allowed rounded-xl shadow-md"
          >
            <Check className="w-5 h-5" />
            {splitMode && !splitValid ? `Falta ${BRL.format(splitRemain)}` : 'FINALIZAR VENDA · F10'}
          </button>
        </div>
      </div>

      {/* sale success — receipt + WhatsApp QR */}
      {lastSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-pop overflow-hidden">
            {/* green header */}
            <div className="bg-green-500 px-6 py-4 text-center">
              <div className="text-3xl mb-1">✅</div>
              <div className="font-black text-white text-xl">Venda Finalizada!</div>
              <div className="text-green-100 text-sm mt-0.5">{lastSale.payment} · {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>

            {/* coupon badge — only shown when total >= R$100 */}
            {lastSale.total >= 100 ? (
              <div className="mx-6 mt-4 bg-amber-50 border-2 border-amber-400 rounded-2xl px-4 py-3 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🎟️</span>
                  <div className="flex-1">
                    <div className="font-black text-amber-800 text-sm">
                      Cupom Premiado impresso! 🎉
                    </div>
                    <div className="text-amber-600 text-xs mt-0.5">
                      Entregar ao cliente — preencher e depositar na urna
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-black text-amber-700">Concorra a</div>
                    <div className="text-lg font-black text-amber-800">R$150</div>
                  </div>
                </div>
                <button
                  onClick={() => printer.printCoupon(lastSale)}
                  className="w-full py-2 bg-amber-400 hover:bg-amber-300 text-amber-900 font-black text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  🖨️ Reimprimir Cupom Premiado
                </button>
              </div>
            ) : (
              <div className="mx-6 mt-3 text-center text-xs text-gray-400">
                Compras acima de <strong className="text-amber-600">R$100</strong> ganham Cupom Premiado 🎟️
              </div>
            )}

            {/* total + troco */}
            <div className={`px-6 py-4 text-center ${lastSale.troco > 0 ? '' : 'border-b border-gray-100'}`}>
              <div className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Total pago</div>
              <div className="text-4xl font-black text-gray-900 mt-1">{BRL.format(lastSale.total)}</div>
            </div>
            {lastSale.troco > 0 && (
              <div className="px-6 py-4 bg-green-50 border-b border-gray-100 text-center">
                <div className="text-xs text-green-600 uppercase tracking-wide font-semibold">💵 Troco</div>
                <div className="text-5xl font-black text-green-600 mt-1">{BRL.format(lastSale.troco)}</div>
                <div className="text-xs text-green-500 mt-1">Recebido: {BRL.format(lastSale.received)}</div>
              </div>
            )}

            {/* WhatsApp QR */}
            <div className="px-6 py-4 text-center space-y-3">
              <div className="text-xs font-black text-gray-600 uppercase tracking-wide">
                📲 Escaneie e receba nossas promoções!
              </div>
              <div className="flex justify-center">
                <div className="p-3 bg-white border-2 border-green-500 rounded-xl inline-block">
                  <QRCodeSVG
                    value={WA_LINK}
                    size={140}
                    fgColor="#111827"
                    bgColor="#ffffff"
                    level="M"
                  />
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 text-green-600 text-xs font-bold">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Abra o WhatsApp e mande uma mensagem!
              </div>
            </div>

            {/* print + close */}
            <div className="px-6 pb-5 space-y-2">
              <button
                onClick={() => printer.printReceipt(lastSale)}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                {printer.isConnected ? 'Imprimir Cupom (USB)' : 'Imprimir Cupom (janela)'}
              </button>
              <button
                onClick={() => {
                  const items = lastSale.items?.map(i => `  • ${i.name} × ${i.qty} = R$${(i.qty * i.price).toFixed(2).replace('.', ',')}`).join('\n') || ''
                  const disc = lastSale.discount > 0 ? `\n🏷️ Desconto: -R$${lastSale.discount.toFixed(2).replace('.', ',')}` : ''
                  const troco = lastSale.troco > 0 ? `\n💵 Troco: R$${lastSale.troco.toFixed(2).replace('.', ',')}` : ''
                  const msg = [
                    `🛒 *Cupom Corta Preços*`,
                    `📅 ${new Date(lastSale.date).toLocaleDateString('pt-BR')} ${new Date(lastSale.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
                    ``,
                    items,
                    disc,
                    ``,
                    `💰 *Total: R$${lastSale.total.toFixed(2).replace('.', ',')}*`,
                    `💳 ${lastSale.payment}`,
                    troco,
                    ``,
                    `🙏 Obrigado! Volte sempre!`,
                    `_Corta Preços · @mercadocortaprecos_`,
                  ].filter(Boolean).join('\n')
                  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
                }}
                className="w-full py-2.5 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Enviar Recibo por WhatsApp
              </button>
              <button
                onClick={() => setLastSale(null)}
                className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white font-black rounded-xl transition-colors"
              >
                Nova Venda
              </button>
            </div>
          </div>
        </div>
      )}

      {/* confirm modal */}
      {/* ── F1 Help overlay ──────────────────────────────────── */}
      {showHelp && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={() => setShowHelp(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 w-[480px] max-w-[94vw]" onClick={e => e.stopPropagation()}>
            <div className="font-black text-orange-400 text-lg font-mono tracking-wide mb-5">⌨️ ATALHOS DO TECLADO</div>
            {[
              ['F1', 'Abrir / fechar este guia'],
              ['F2', 'Focar campo de busca / escaneamento'],
              ['F3', 'Abrir Scanner Mobile (celular como câmera)'],
              ['F4', 'Ciclar desconto: 0% → 5% → 10% → 15% → 20%'],
              ['F5', 'Forma de pagamento: PIX'],
              ['F6', 'Forma de pagamento: Débito'],
              ['F7', 'Forma de pagamento: Crédito'],
              ['F8', 'Forma de pagamento: Dinheiro'],
              ['F9', 'Limpar carrinho (confirma antes)'],
              ['F10', 'Finalizar venda (abre modal)'],
              ['F12', 'Abrir Terminal do Caixa'],
              ['Enter', 'Confirmar venda (quando modal aberto)'],
              ['ESC', 'Cancelar / fechar modal'],
            ].map(([key, desc]) => (
              <div key={key} className="flex items-center gap-4 py-1.5 border-b border-gray-800">
                <span className="min-w-[52px] text-center bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 font-mono font-black text-xs text-orange-400">{key}</span>
                <span className="text-gray-300 text-sm">{desc}</span>
              </div>
            ))}
            <div className="mt-5 text-center text-gray-500 text-xs">
              Pressione <strong className="text-orange-400">F1</strong> ou <strong className="text-orange-400">ESC</strong> para fechar
            </div>
          </div>
        </div>
      )}

      {showFinish && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="card p-6 w-full max-w-sm mx-4 space-y-4 animate-pop shadow-2xl">
            <div className="text-center">
              <div className="text-2xl font-black text-gray-900">Confirmar Venda</div>
              <div className="text-xs text-gray-400 mt-1">{cart.length} produto(s) · {cart.reduce((s,i)=>s+i.qty,0)} unidades</div>
            </div>
            <div className="space-y-2 text-sm bg-gray-50 rounded-xl p-4">
              {cart.map(i => (
                <div key={i.productId} className="flex justify-between text-gray-700">
                  <span className="truncate max-w-[160px]">{i.qty}x {i.name}</span>
                  <span className="font-semibold">{BRL.format(i.price * i.qty)}</span>
                </div>
              ))}
              <div className="border-t border-gray-200 pt-2 mt-2 space-y-1">
                {discount > 0 && (
                  <div className="flex justify-between text-green-600 text-xs">
                    <span>Desconto {discount}%</span>
                    <span>- {BRL.format(discountAmt)}</span>
                  </div>
                )}
                <div className="flex justify-between items-baseline">
                  <span className="font-black text-gray-900">TOTAL</span>
                  <span className="text-2xl font-black text-brand-600">{BRL.format(total)}</span>
                </div>
                <div className="text-xs text-gray-400 text-right">{splitMode ? 'Split' : payment}</div>
              </div>
            </div>

            {/* PIX QR — só quando pagamento = PIX e chave configurada */}
            {!splitMode && payment === 'PIX' && printer.settings?.pixKey && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center space-y-2">
                <div className="text-xs font-bold text-green-700 uppercase tracking-wide">📱 PIX — Escaneie para pagar</div>
                <div className="flex justify-center">
                  <PixQR
                    amount={Math.max(0, total)}
                    pixKey={printer.settings.pixKey}
                    name={printer.settings.storeName}
                    city={printer.settings.pixCity}
                    txid={String(Date.now()).slice(-8)}
                    size={160}
                  />
                </div>
                <div className="text-lg font-black text-green-700">{BRL.format(Math.max(0, total))}</div>
              </div>
            )}

            {/* troco — só para Dinheiro no modo simples */}
            {showTroco && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-bold text-gray-700 flex-shrink-0 w-24">Recebido:</label>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">R$</span>
                    <input
                      type="number" min="0" step="0.01"
                      value={received}
                      onChange={e => setReceived(e.target.value)}
                      className="input pl-9 py-2.5 text-base font-bold w-full"
                      autoFocus
                    />
                  </div>
                </div>
                {/* quick-fill buttons */}
                <div className="flex gap-1.5 flex-wrap">
                  {[0, 5, 10, 20, 50, 100].map(extra => {
                    const val = (Math.ceil(Math.max(0, total) / 5) * 5) + extra
                    return val >= Math.max(0, total) - 0.01 ? (
                      <button key={extra}
                        onClick={() => setReceived(val.toFixed(2))}
                        className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-colors ${
                          Math.abs(receivedVal - val) < 0.01
                            ? 'bg-green-100 border-green-400 text-green-700'
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}
                      >{BRL.format(val)}</button>
                    ) : null
                  })}
                </div>
                {/* troco display */}
                {receivedVal > 0 && (
                  <div className={`rounded-xl px-4 py-3 flex justify-between items-center ${
                    trocoValid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                  }`}>
                    <span className="font-black text-gray-700">
                      {trocoValid ? '💵 Troco' : '⚠️ Insuficiente'}
                    </span>
                    <span className={`text-2xl font-black ${trocoValid ? 'text-green-600' : 'text-red-500'}`}>
                      {trocoValid ? BRL.format(troco) : `-${BRL.format(Math.max(0, total) - receivedVal)}`}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => setShowFinish(false)} className="btn-ghost flex-1 justify-center py-3">Cancelar</button>
              <button
                onClick={finish}
                disabled={!trocoValid}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter' && trocoValid) finish() }}
                className="btn-primary flex-1 justify-center py-3 font-black text-base disabled:opacity-40 disabled:cursor-not-allowed"
              >Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Weight modal — for kg/g products ───────────────── */}
      {weightModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs animate-pop p-6 space-y-4">
            <div>
              <div className="font-black text-gray-900 text-lg">Produto por Peso</div>
              <div className="text-sm text-gray-500 mt-0.5 truncate">{weightModal.name}</div>
              <div className="text-xs text-gray-400">{BRL.format(weightModal.price)} / {weightModal.unit || 'kg'}</div>
            </div>
            <div>
              <label className="label">Peso ({weightModal.unit || 'kg'})</label>
              <input
                type="number" min="0" step="0.001" autoFocus
                value={weightDraft}
                onChange={e => setWeightDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const w = parseFloat(weightDraft)
                    if (w > 0) { addToCartRaw(weightModal, w); setWeightModal(null) }
                  }
                  if (e.key === 'Escape') setWeightModal(null)
                }}
                className="input text-2xl font-black text-center"
                placeholder="0.000"
              />
            </div>
            {weightDraft && parseFloat(weightDraft) > 0 && (
              <div className="text-center text-sm text-gray-500">
                Subtotal: <span className="font-black text-gray-900">{BRL.format(parseFloat(weightDraft) * weightModal.price)}</span>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setWeightModal(null)} className="btn-ghost flex-1 justify-center">Cancelar</button>
              <button
                onClick={() => {
                  const w = parseFloat(weightDraft)
                  if (w > 0) { addToCartRaw(weightModal, w); setWeightModal(null) }
                }}
                disabled={!weightDraft || parseFloat(weightDraft) <= 0}
                className="btn-primary flex-1 justify-center disabled:opacity-40"
              >Adicionar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
