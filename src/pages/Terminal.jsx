/**
 * /terminal — Full-screen cashier-only POS terminal.
 * No sidebar, no admin nav. Pure dark-themed, keyboard-driven cashier UI.
 * Same product DB (localStorage) as the main app, own cart state.
 */
import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react'
import {
  ShoppingCart, Trash2, Plus, Minus, Search, X, Check,
  Barcode, Smartphone, CreditCard, Wallet, Banknote,
  LogOut, Settings, Monitor, QrCode, Users, HandCoins, ChevronDown, Printer
} from 'lucide-react'
import { useStore, BRL } from '../store.jsx'
import { usePrinter } from '../hooks/usePrinter.js'
import { useBroadcastSend } from '../hooks/useBroadcast.js'
import { useScanReceiver }  from '../hooks/useScanRelay.js'
import PixQR from '../components/PixQR.jsx'
import CameraScanner from '../components/CameraScanner.jsx'

function calcPromoEngine(cart, products, promos) {
  const results = []
  for (const rule of promos.filter(r => r.active)) {
    const groupItems = cart.filter(item => {
      const p = products.find(x => x.id === item.productId)
      return p?.promoGroup === rule.group
    })
    if (!groupItems.length) continue
    const totalQty  = groupItems.reduce((s, i) => s + i.qty, 0)
    const complete  = Math.floor(totalQty / rule.qty)
    const remainder = totalQty % rule.qty
    const normalSum = groupItems.reduce((s, i) => s + i.qty * i.price, 0)
    if (!complete) { results.push({ rule, status: 'progress', current: totalQty, needed: rule.qty - totalQty, discount: 0 }); continue }
    const avgPrice = normalSum / totalQty
    const promoSum = complete * rule.totalPrice + remainder * avgPrice
    results.push({ rule, status: 'active', current: totalQty, complete, remainder, discount: Math.max(0, normalSum - promoSum) })
  }
  return results
}

function useClock() {
  const [t, setT] = useState(new Date())
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id) }, [])
  return t
}

const PAYMENTS = ['PIX', 'Débito', 'Crédito', 'Dinheiro']
const PAY_ICON = { PIX: Smartphone, Débito: CreditCard, Crédito: CreditCard, Dinheiro: Banknote }

export default function Terminal() {
  const { products, registerSale, promos, sales, customers, addFiado } = useStore()
  const todaySales = useMemo(() => {
    const today = new Date().toDateString()
    return sales.filter(s => new Date(s.date).toDateString() === today).length
  }, [sales])
  const printer   = usePrinter()
  const broadcast = useBroadcastSend()
  const clock     = useClock()

  // ── Cart ────────────────────────────────────────────────────
  const [cart,    setCart]    = useState([])
  const [payment, setPayment] = useState('PIX')
  const [discount, setDiscount] = useState(0)

  // ── UI state ────────────────────────────────────────────────
  const [query,      setQuery]      = useState('')
  const [results,    setResults]    = useState([])
  const [scanFeed,   setScanFeed]   = useState(null)
  const [showPay,    setShowPay]    = useState(false)
  const [lastSale,   setLastSale]   = useState(null)
  const [received,   setReceived]   = useState('')
  const [showCamera, setShowCamera] = useState(false)
  const inputRef = useRef(null)

  const timeStr = clock.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const dateStr = clock.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })

  // ── Totals (with promo engine) ──────────────────────────────
  const promoResults       = useMemo(() => calcPromoEngine(cart, products, promos), [cart, products, promos])
  const totalPromoDiscount = promoResults.reduce((s, r) => s + r.discount, 0)
  const subtotal   = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const discAmt    = subtotal * (discount / 100)
  const total      = Math.max(0, subtotal - discAmt - totalPromoDiscount)
  const receivedVal = parseFloat(received) || 0
  const troco = receivedVal - total
  const trocoOk = payment !== 'Dinheiro' || received === '' || receivedVal >= total

  // ── Search ──────────────────────────────────────────────────
  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    const q = query.toLowerCase()
    setResults(products.filter(p =>
      p.name?.toLowerCase().includes(q) ||
      p.barcode?.includes(query) ||
      p.sku?.includes(query)
    ).slice(0, 8))
  }, [query, products])

  const findProduct = useCallback((raw) => {
    const code = String(raw).trim().replace(/\0/g, '')
    if (!code) return null
    const exact = products.find(x => x.sku === code || x.barcode === code)
    if (exact) return exact
    const stripped = code.replace(/^0+/, '') || code
    return products.find(x =>
      (x.sku || '').replace(/^0+/, '') === stripped ||
      (x.barcode || '').replace(/^0+/, '') === stripped
    ) || null
  }, [products])

  const addToCart = useCallback((codeOrProduct) => {
    const p = typeof codeOrProduct === 'string' ? findProduct(codeOrProduct) : codeOrProduct
    if (!p) { setScanFeed({ msg: `❌ Produto não encontrado`, ok: false }); setTimeout(() => setScanFeed(null), 2000); return }
    setCart(prev => {
      const idx = prev.findIndex(i => i.productId === p.id)
      if (idx >= 0) {
        const next = [...prev]; next[idx] = { ...next[idx], qty: next[idx].qty + 1 }; return next
      }
      return [...prev, { productId: p.id, name: p.name, price: p.price, qty: 1 }]
    })
    setQuery(''); setResults([])
    setScanFeed({ msg: `✅ ${p.name}`, ok: true })
    setTimeout(() => setScanFeed(null), 1800)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [products])

  const [showHelp, setShowHelp] = useState(false)

  // ── Customer / Fiado ────────────────────────────────────────
  const [selectedCustomerId,  setSelectedCustomerId]  = useState(null)
  const [showCustomerPicker,  setShowCustomerPicker]  = useState(false)
  const [pickerFromFiado,     setPickerFromFiado]     = useState(false)
  const [customerSearch,      setCustomerSearch]      = useState('')
  const customerPickerRef = useRef(null)
  // derive from store so balance always reflects latest fiado ops
  const selectedCustomer = useMemo(
    () => customers.find(c => c.id === selectedCustomerId) || null,
    [customers, selectedCustomerId]
  )

  // ── Keyboard shortcuts ──────────────────────────────────────
  useEffect(() => {
    const BLOCKED = ['F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F12']
    const handler = (e) => {
      if (BLOCKED.includes(e.key)) e.preventDefault()

      if (e.key === 'F1')  { setShowHelp(h => !h); return }
      if (e.key === 'F2')  { inputRef.current?.focus(); return }
      if (e.key === 'F3')  { setShowCamera(c => !c); return }
      if (e.key === 'F4')  { setDiscount(d => d === 0 ? 5 : d === 5 ? 10 : d === 10 ? 15 : d === 15 ? 20 : 0); return }
      if (e.key === 'F5')  { setPayment('PIX'); return }
      if (e.key === 'F6')  { setPayment('Débito'); return }
      if (e.key === 'F7')  { setPayment('Crédito'); return }
      if (e.key === 'F8')  { setPayment('Dinheiro'); return }
      if (e.key === 'F9')  { if (cart.length > 0 && window.confirm('Limpar carrinho?')) setCart([]); return }
      if (e.key === 'F10' && cart.length > 0) setShowPay(true)
      if (e.key === 'F12') { window.open('/display', 'cp_display', 'width=1280,height=720'); return }
      if (e.key === 'Enter' && showPay && trocoOk && cart.length > 0) { e.preventDefault(); finish() }
      if (e.key === 'Escape') { setShowPay(false); setShowCamera(false); setShowHelp(false) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [cart, showPay, trocoOk]) // eslint-disable-line

  // ── Mobile scan relay (WebSocket cross-device + localStorage fallback) ──
  useScanReceiver(useCallback((code) => addToCart(code), [addToCart]))

  // ── Broadcast cart to display ───────────────────────────────
  useEffect(() => {
    broadcast({ type: 'cart', cart, promoResults: [], subtotal, total })
  }, [cart, subtotal, total]) // eslint-disable-line

  // ── Finish sale ─────────────────────────────────────────────
  const finish = () => {
    if (!cart.length) return
    const isFiado = payment === 'Fiado'
    const t = receivedVal > 0 && payment === 'Dinheiro' ? receivedVal - total : 0
    const sale = {
      items: cart, subtotal, discount: discAmt, promoDiscount: totalPromoDiscount, total,
      payment: isFiado ? `Fiado — ${selectedCustomer?.name}` : payment,
      troco: t, date: new Date().toISOString(), id: Date.now(),
      customerId: selectedCustomer?.id || null,
    }
    registerSale(sale)
    if (isFiado && selectedCustomer) {
      const desc = `Compra ${new Date().toLocaleDateString('pt-BR')} · ${cart.length} iten(s)`
      addFiado(selectedCustomer.id, total, desc)
    }
    setLastSale({ ...sale, troco: t, isFiado, customerName: selectedCustomer?.name })
    setCart([]); setDiscount(0); setReceived(''); setShowPay(false)
    if (!isFiado) setSelectedCustomerId(null)  // keep customer for next fiado if desired
    broadcast({ type: 'cart', cart: [], promoResults: [], subtotal: 0, total: 0 })
    printer.printReceipt(sale)
  }

  // ── Styles (dark terminal palette) ─────────────────────────
  const bg   = '#0a0c0f'
  const bg2  = '#111318'
  const bg3  = '#181b22'
  const brd  = '#1f2433'
  const acc  = '#ea580c'  // orange
  const txt  = '#f1f5f9'
  const txt2 = '#64748b'

  return (
    <div style={{ height: '100vh', background: bg, color: txt, fontFamily: "'Segoe UI', system-ui, sans-serif", display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Top bar ──────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 24px', background: bg2, borderBottom: `1px solid ${brd}` }}>
        {/* logo */}
        <div style={{ fontFamily: "'Courier New', monospace", fontWeight: 900, fontSize: 20, color: acc, letterSpacing: '-0.5px' }}>
          ✕ CORTA PREÇO$
        </div>
        {/* status pills */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ padding: '4px 12px', borderRadius: 20, background: cart.length > 0 ? '#431407' : '#052e16', border: `1px solid ${cart.length > 0 ? '#c2410c44' : '#16a34a44'}`, color: cart.length > 0 ? '#fb923c' : '#4ade80', fontSize: 12, fontWeight: 700 }}>
            {cart.length > 0 ? `🟠 EM ATENDIMENTO · ${cart.reduce((s,i)=>s+i.qty,0)} itens` : '🟢 CAIXA LIVRE'}
          </div>

          {/* ── Printer status pill ───────────────────────────── */}
          {printer.isSupported && (
            printer.isConnected ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, background: '#052e16', border: '1px solid #16a34a44', color: '#4ade80', fontSize: 12, fontWeight: 700 }}>
                <Printer style={{ width: 12, height: 12 }} />
                USB SEM DIÁLOGO
              </div>
            ) : (
              <button
                onClick={printer.connect}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, background: '#1c0a00', border: '1px solid #c2410c44', color: '#fb923c', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                <Printer style={{ width: 12, height: 12 }} />
                {printer.status === 'connecting' ? 'Conectando...' : 'Conectar Impressora'}
              </button>
            )
          )}
          <div style={{ padding: '4px 12px', borderRadius: 20, background: bg3, border: `1px solid ${brd}`, color: txt2, fontSize: 12, fontFamily: 'monospace', fontWeight: 700 }}>
            {timeStr} · {dateStr}
          </div>
          <div style={{ padding: '4px 12px', borderRadius: 20, background: '#1e1b4b', border: '1px solid #4338ca33', color: '#818cf8', fontSize: 12, fontWeight: 700 }}>
            {todaySales} vendas hoje
          </div>
          <button onClick={() => window.open('/display', 'cp_display', 'width=1280,height=720')}
            style={{ padding: '4px 12px', borderRadius: 20, background: '#1e1b4b', border: '1px solid #4338ca44', color: '#818cf8', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            <Monitor style={{ width: 13, height: 13, display: 'inline', marginRight: 4 }} />Tela Cliente
          </button>
          <a href="/pdv" style={{ padding: '4px 12px', borderRadius: 20, background: bg3, border: `1px solid ${brd}`, color: txt2, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
            ← Admin
          </a>
        </div>
      </div>

      {/* ── Main ────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* LEFT: scanner + cart */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${brd}`, overflow: 'hidden' }}>

          {/* scanner input */}
          <div style={{ flexShrink: 0, padding: '16px 20px', borderBottom: `1px solid ${brd}`, background: bg2 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Barcode style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: txt2 }} />
                <input
                  ref={inputRef}
                  autoFocus
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && results.length > 0) addToCart(results[0])
                    else if (e.key === 'Enter' && query.trim()) addToCart(query.trim())
                  }}
                  placeholder="Código de barras ou nome do produto  (F2)"
                  style={{ width: '100%', background: bg3, border: `1px solid ${brd}`, borderRadius: 10, padding: '12px 12px 12px 42px', color: txt, fontSize: 15, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <button
                onClick={() => setShowCamera(c => !c)}
                style={{ padding: '0 16px', borderRadius: 10, background: showCamera ? acc : bg3, border: `1px solid ${showCamera ? acc : brd}`, color: showCamera ? '#000' : txt2, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <QrCode style={{ width: 16, height: 16 }} /> Câmera
              </button>
            </div>

            {/* camera inline */}
            {showCamera && (
              <div style={{ marginTop: 12, borderRadius: 16, overflow: 'hidden', height: 280 }}>
                <CameraScanner compact onScan={addToCart} onClose={() => setShowCamera(false)} />
              </div>
            )}

            {/* search results dropdown */}
            {results.length > 0 && (
              <div style={{ marginTop: 8, background: bg2, border: `1px solid ${brd}`, borderRadius: 12, overflow: 'hidden' }}>
                {results.map(p => (
                  <button key={p.id} onClick={() => addToCart(p)}
                    style={{ width: '100%', display: 'flex', justifyContent: 'space-between', padding: '10px 16px', background: 'transparent', border: 'none', borderBottom: `1px solid ${brd}`, color: txt, cursor: 'pointer', textAlign: 'left', fontSize: 14 }}>
                    <span style={{ fontWeight: 600 }}>{p.name}</span>
                    <span style={{ color: acc, fontWeight: 900 }}>{BRL.format(p.price)}</span>
                  </button>
                ))}
              </div>
            )}

            {scanFeed && (
              <div style={{ marginTop: 8, padding: '8px 14px', borderRadius: 10, background: scanFeed.ok ? '#052e16' : '#450a0a', color: scanFeed.ok ? '#4ade80' : '#f87171', fontSize: 13, fontWeight: 700 }}>
                {scanFeed.msg}
              </div>
            )}
          </div>

          {/* cart items */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px', position: 'relative' }}>
            {cart.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', overflow: 'hidden', padding: '20px 0' }}>
                <style>{`
                  @keyframes idleFloat {
                    0%, 100% { transform: translateY(0px) rotate(-1deg); }
                    50%       { transform: translateY(-14px) rotate(1deg); }
                  }
                  @keyframes idleFadeIn {
                    from { opacity: 0; transform: scale(0.85) translateY(24px); }
                    to   { opacity: 1; transform: scale(1) translateY(0); }
                  }
                  @keyframes idleGlow {
                    0%,100% { box-shadow: 0 0 40px 8px rgba(234,88,12,0.25), 0 8px 32px rgba(0,0,0,0.5); }
                    50%     { box-shadow: 0 0 80px 20px rgba(234,88,12,0.45), 0 8px 32px rgba(0,0,0,0.5); }
                  }
                  @keyframes idleTextIn {
                    0%   { opacity: 0; transform: translateY(12px); }
                    100% { opacity: 1; transform: none; }
                  }
                  @keyframes idleScissors {
                    0%,100% { transform: rotate(-8deg) scale(1); }
                    50%     { transform: rotate(8deg) scale(1.08); }
                  }
                  @keyframes pricePop {
                    0%   { transform: scale(0.6) rotate(-15deg); opacity: 0; }
                    60%  { transform: scale(1.15) rotate(6deg); opacity: 1; }
                    100% { transform: scale(1) rotate(0deg); opacity: 1; }
                  }
                  @keyframes scanPulse {
                    0%,100% { opacity: 0.4; transform: scaleX(0.7); }
                    50%     { opacity: 1;   transform: scaleX(1); }
                  }
                `}</style>

                {/* ── Big brand card ── */}
                <div style={{
                  animation: 'idleFadeIn .7s cubic-bezier(.22,1,.36,1) forwards, idleFloat 4s ease-in-out 0.7s infinite',
                  width: 'min(280px, 70%)',
                  background: 'linear-gradient(145deg, #1a1a1a, #0a0a0a)',
                  borderRadius: 28,
                  padding: '28px 24px 24px',
                  textAlign: 'center',
                  position: 'relative',
                  animation: 'idleFadeIn .7s cubic-bezier(.22,1,.36,1) forwards, idleFloat 4s ease-in-out 0.7s infinite, idleGlow 3s ease-in-out 1s infinite',
                  border: '1px solid rgba(234,88,12,0.25)',
                }}>

                  {/* decorative corner accents */}
                  <div style={{ position: 'absolute', top: 12, left: 12, width: 20, height: 20, borderTop: '2px solid #ea580c', borderLeft: '2px solid #ea580c', borderRadius: '4px 0 0 0', opacity: 0.6 }} />
                  <div style={{ position: 'absolute', top: 12, right: 12, width: 20, height: 20, borderTop: '2px solid #ea580c', borderRight: '2px solid #ea580c', borderRadius: '0 4px 0 0', opacity: 0.6 }} />
                  <div style={{ position: 'absolute', bottom: 12, left: 12, width: 20, height: 20, borderBottom: '2px solid #ea580c', borderLeft: '2px solid #ea580c', borderRadius: '0 0 0 4px', opacity: 0.6 }} />
                  <div style={{ position: 'absolute', bottom: 12, right: 12, width: 20, height: 20, borderBottom: '2px solid #ea580c', borderRight: '2px solid #ea580c', borderRadius: '0 0 4px 0', opacity: 0.6 }} />

                  {/* animated scissors SVG */}
                  <div style={{ animation: 'idleScissors 3s ease-in-out 1.2s infinite', display: 'inline-block', marginBottom: 16 }}>
                    <svg width="72" height="72" viewBox="0 0 200 200" style={{ filter: 'drop-shadow(0 0 12px rgba(234,88,12,0.6))' }}>
                      <rect width="200" height="200" rx="36" fill="#111"/>
                      <path d="M 30 58 Q 100 82 148 70" stroke="#ea580c" strokeWidth="9" fill="none" strokeLinecap="round"/>
                      <path d="M 30 98 Q 100 82 148 94" stroke="#ea580c" strokeWidth="9" fill="none" strokeLinecap="round"/>
                      <circle cx="97" cy="82" r="10" fill="#ea580c"/>
                      <circle cx="97" cy="82" r="5.5" fill="#0a0a0a"/>
                      <circle cx="97" cy="82" r="2.5" fill="#ff7a1f"/>
                      <circle cx="22" cy="54" r="14" fill="none" stroke="#ea580c" strokeWidth="7"/>
                      <circle cx="22" cy="102" r="14" fill="none" stroke="#ea580c" strokeWidth="7"/>
                      <rect x="138" y="50" width="48" height="44" rx="7" fill="#ea580c"/>
                      <circle cx="147" cy="59" r="4.5" fill="#0a0a0a"/>
                      <rect x="148" y="67" width="28" height="5" rx="2.5" fill="#fff" opacity="0.9"/>
                      <rect x="148" y="76" width="20" height="4" rx="2" fill="#fff" opacity="0.55"/>
                    </svg>
                  </div>

                  {/* CORTA wordmark */}
                  <div style={{
                    fontFamily: "'Arial Black', Impact, sans-serif",
                    fontWeight: 900,
                    fontSize: 'clamp(26px, 4vw, 36px)',
                    color: '#ffffff',
                    letterSpacing: '-1px',
                    lineHeight: 1,
                    textShadow: '0 2px 12px rgba(0,0,0,0.5)',
                  }}>CORTA</div>

                  {/* PREÇOS in orange gradient */}
                  <div style={{
                    fontFamily: "'Arial Black', Impact, sans-serif",
                    fontWeight: 900,
                    fontSize: 'clamp(24px, 3.5vw, 32px)',
                    background: 'linear-gradient(90deg, #ff7a1f, #ea580c)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    letterSpacing: '1px',
                    lineHeight: 1,
                    marginTop: 2,
                  }}>PREÇOS</div>

                  {/* tagline */}
                  <div style={{
                    color: 'rgba(255,255,255,0.35)',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    marginTop: 10,
                    animation: 'idleTextIn .5s ease-out 1.2s both',
                  }}>Economia de verdade</div>

                  {/* floating price badge */}
                  <div style={{
                    position: 'absolute', top: -12, right: -12,
                    background: '#ea580c',
                    borderRadius: '50%',
                    width: 44, height: 44,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 900, fontSize: 18, color: '#000',
                    animation: 'pricePop .6s cubic-bezier(.22,1,.36,1) 0.9s both',
                    boxShadow: '0 4px 16px rgba(234,88,12,0.5)',
                  }}>$</div>
                </div>

                {/* greeting text */}
                <div style={{
                  marginTop: 24,
                  textAlign: 'center',
                  animation: 'idleTextIn .5s ease-out 1s both',
                }}>
                  <div style={{
                    fontWeight: 900,
                    fontSize: 'clamp(18px, 2.5vw, 26px)',
                    background: `linear-gradient(135deg, ${acc}, #f97316, #fbbf24)`,
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}>
                    BOAS COMPRAS! 🛒
                  </div>
                  <div style={{ color: txt2, fontSize: 13, marginTop: 6, fontWeight: 500 }}>
                    Escaneie o primeiro produto para começar
                  </div>
                </div>

                {/* scan bar */}
                <div style={{
                  marginTop: 20,
                  width: 180, height: 3,
                  background: `linear-gradient(90deg, transparent, ${acc}, transparent)`,
                  borderRadius: 2,
                  animation: 'scanPulse 1.8s ease-in-out infinite',
                }} />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {cart.map(item => (
                  <div key={item.productId} style={{ display: 'flex', alignItems: 'center', gap: 12, background: bg2, borderRadius: 12, padding: '10px 14px', border: `1px solid ${brd}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                      <div style={{ color: txt2, fontSize: 12, marginTop: 2 }}>{BRL.format(item.price)} × {item.qty}</div>
                    </div>
                    <div style={{ fontWeight: 900, fontSize: 16, color: txt, marginRight: 8, flexShrink: 0 }}>{BRL.format(item.price * item.qty)}</div>
                    {/* qty */}
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <button onClick={() => setCart(c => c.map(i => i.productId === item.productId ? { ...i, qty: Math.max(1, i.qty - 1) } : i))}
                        style={{ width: 28, height: 28, borderRadius: 7, background: bg3, border: `1px solid ${brd}`, color: txt2, cursor: 'pointer', fontWeight: 900, fontSize: 16 }}>−</button>
                      <span style={{ width: 28, textAlign: 'center', fontWeight: 900, fontSize: 14 }}>{item.qty}</span>
                      <button onClick={() => setCart(c => c.map(i => i.productId === item.productId ? { ...i, qty: i.qty + 1 } : i))}
                        style={{ width: 28, height: 28, borderRadius: 7, background: acc, border: 'none', color: '#000', cursor: 'pointer', fontWeight: 900, fontSize: 16 }}>+</button>
                      <button onClick={() => setCart(c => c.filter(i => i.productId !== item.productId))}
                        style={{ width: 28, height: 28, borderRadius: 7, background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Trash2 style={{ width: 14, height: 14 }} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: totals + payment */}
        <div style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', background: bg2 }}>

          {/* totals */}
          <div style={{ flex: 1, padding: '20px 20px 0', overflowY: 'auto' }}>

            {/* ── Cliente / Fiado ── */}
            <div style={{ marginBottom: 16, position: 'relative' }} ref={customerPickerRef}>
              <div style={{ color: txt2, fontSize: 11, fontWeight: 700, letterSpacing: 2, marginBottom: 6 }}>CLIENTE</div>

              {selectedCustomer ? (
                <div>
                  {/* selected customer card */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: '#1a0a00', border: `1.5px solid ${acc}33`,
                    borderRadius: 12, padding: '10px 14px',
                  }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 8,
                      background: '#431407', color: acc,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 900, fontSize: 16, flexShrink: 0,
                    }}>{selectedCustomer.name.charAt(0)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 14, color: txt, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {selectedCustomer.name}
                        {selectedCustomer.note && <span style={{ fontSize: 11, color: acc, marginLeft: 6 }}>{selectedCustomer.note}</span>}
                      </div>
                      {(selectedCustomer.fiadoBalance || 0) > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <HandCoins style={{ width: 11, height: 11, color: '#ef4444' }} />
                          <span style={{ color: '#ef4444', fontSize: 11, fontWeight: 700 }}>
                            Fiado: {BRL.format(selectedCustomer.fiadoBalance)}
                          </span>
                        </div>
                      ) : (
                        <div style={{ color: '#4ade80', fontSize: 11, fontWeight: 600, marginTop: 2 }}>✓ Sem fiado</div>
                      )}
                    </div>
                    <button onClick={() => { setSelectedCustomerId(null); if (payment === 'Fiado') setPayment('PIX') }}
                      style={{ background: 'transparent', border: 'none', color: txt2, cursor: 'pointer', padding: 4, display: 'flex' }}>
                      <X style={{ width: 14, height: 14 }} />
                    </button>
                  </div>

                  {/* fiado balance history mini-strip */}
                  {((selectedCustomer.fiadoLogs || []).length > 0) && (
                    <div style={{ marginTop: 6, padding: '8px 12px', background: bg3, borderRadius: 10, border: `1px solid ${brd}` }}>
                      <div style={{ color: txt2, fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 5 }}>ÚLTIMAS MOVIMENTAÇÕES</div>
                      {[...(selectedCustomer.fiadoLogs || [])].reverse().slice(0, 3).map(log => (
                        <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, marginBottom: 3 }}>
                          <span style={{ color: txt2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
                            {log.type === 'pagamento' ? '↑' : '↓'} {log.desc || (log.type === 'pagamento' ? 'Pagamento' : 'Fiado')}
                          </span>
                          <span style={{ color: log.type === 'pagamento' ? '#4ade80' : '#f87171', fontWeight: 800, flexShrink: 0 }}>
                            {log.type === 'pagamento' ? '-' : '+'}{BRL.format(Math.abs(log.amount))}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setShowCustomerPicker(p => !p)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', borderRadius: 12,
                    background: bg3, border: `1px solid ${brd}`,
                    color: txt2, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Users style={{ width: 15, height: 15 }} />
                    Selecionar cliente
                  </div>
                  <ChevronDown style={{ width: 14, height: 14 }} />
                </button>
              )}

              {/* customer dropdown */}
              {showCustomerPicker && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                  background: bg2, border: `1px solid ${brd}`, borderRadius: 14,
                  marginTop: 4, maxHeight: 280, overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                }}>
                  <div style={{ padding: '10px 12px', borderBottom: `1px solid ${brd}` }}>
                    <div style={{ position: 'relative' }}>
                      <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: txt2 }} />
                      <input
                        autoFocus
                        value={customerSearch}
                        onChange={e => setCustomerSearch(e.target.value)}
                        placeholder="Buscar cliente..."
                        style={{
                          width: '100%', background: bg3, border: `1px solid ${brd}`, borderRadius: 8,
                          padding: '7px 10px 7px 30px', color: txt, fontSize: 13, outline: 'none', boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </div>
                  {customers
                    .filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || (c.phone || '').includes(customerSearch))
                    .map(c => (
                      <button key={c.id}
                        onClick={() => {
                          setSelectedCustomerId(c.id)
                          setShowCustomerPicker(false)
                          setCustomerSearch('')
                          if (pickerFromFiado) { setPayment('Fiado'); setPickerFromFiado(false) }
                        }}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 14px', background: 'transparent', border: 'none',
                          borderBottom: `1px solid ${brd}`, color: txt, cursor: 'pointer', textAlign: 'left',
                        }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: 7,
                          background: (c.fiadoBalance || 0) > 0 ? '#431407' : '#052e16',
                          color: (c.fiadoBalance || 0) > 0 ? acc : '#4ade80',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 900, fontSize: 13, flexShrink: 0,
                        }}>{c.name.charAt(0)}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.name}{c.note ? ` 👑` : ''}
                          </div>
                          <div style={{ fontSize: 11, color: (c.fiadoBalance || 0) > 0 ? '#fb923c' : txt2, fontWeight: 600 }}>
                            {(c.fiadoBalance || 0) > 0 ? `⚠ Fiado: ${BRL.format(c.fiadoBalance)}` : c.phone || 'sem telefone'}
                          </div>
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* discount */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ color: txt2, fontSize: 11, fontWeight: 700, letterSpacing: 2, marginBottom: 6 }}>DESCONTO %</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {[0, 5, 10, 15, 20].map(v => (
                  <button key={v} onClick={() => setDiscount(v)}
                    style={{ flex: 1, padding: '6px 0', borderRadius: 8, background: discount === v ? acc : bg3, border: `1px solid ${discount === v ? acc : brd}`, color: discount === v ? '#000' : txt2, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    {v}%
                  </button>
                ))}
              </div>
            </div>

            {/* payment method */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ color: txt2, fontSize: 11, fontWeight: 700, letterSpacing: 2, marginBottom: 6 }}>PAGAMENTO</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {PAYMENTS.map(p => {
                  const Icon = PAY_ICON[p]
                  const active = payment === p
                  return (
                    <button key={p} onClick={() => setPayment(p)}
                      style={{ padding: '10px 8px', borderRadius: 10, background: active ? '#431407' : bg3, border: `1.5px solid ${active ? acc : brd}`, color: active ? '#fb923c' : txt2, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Icon style={{ width: 15, height: 15 }} />{p}
                    </button>
                  )
                })}
                {/* Fiado — always visible; clicking without customer opens picker */}
                <button
                  onClick={() => {
                    if (!selectedCustomer) { setPickerFromFiado(true); setShowCustomerPicker(true); return }
                    setPayment('Fiado')
                  }}
                  style={{
                    gridColumn: '1 / -1',
                    padding: '11px 12px', borderRadius: 10,
                    background: payment === 'Fiado' ? '#450a0a' : !selectedCustomer ? bg3 : '#1c0505',
                    border: `1.5px solid ${payment === 'Fiado' ? '#ef4444' : !selectedCustomer ? brd : '#7f1d1d55'}`,
                    color: payment === 'Fiado' ? '#f87171' : !selectedCustomer ? txt2 : '#fca5a5',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 8, transition: 'all .15s',
                  }}>
                  <HandCoins style={{ width: 15, height: 15 }} />
                  {selectedCustomer
                    ? `Fiado — ${selectedCustomer.name}`
                    : 'Fiado (selecionar cliente →)'}
                  {selectedCustomer && (selectedCustomer.fiadoBalance || 0) > 0 && (
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: '#f87171', fontWeight: 800 }}>
                      deve {BRL.format(selectedCustomer.fiadoBalance)}
                    </span>
                  )}
                  {!selectedCustomer && (
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: txt2, opacity: 0.6 }}>
                      clique para vincular
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* PIX QR */}
            {payment === 'PIX' && printer.settings?.pixKey && total > 0 && (
              <div style={{ background: '#052e16', border: '1px solid #16a34a33', borderRadius: 14, padding: '14px', textAlign: 'center', marginBottom: 16 }}>
                <div style={{ color: '#4ade80', fontSize: 11, fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>PIX — ESCANEIE</div>
                <PixQR amount={total} pixKey={printer.settings.pixKey} name={printer.settings.storeName} city={printer.settings.pixCity} txid={String(Date.now()).slice(-8)} size={140} />
              </div>
            )}

            {/* troco */}
            {payment === 'Dinheiro' && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: txt2, fontSize: 11, fontWeight: 700, letterSpacing: 2, marginBottom: 6 }}>RECEBIDO</div>
                <input type="number" min="0" step="0.01" value={received} onChange={e => setReceived(e.target.value)}
                  placeholder="R$"
                  style={{ width: '100%', background: bg3, border: `1px solid ${brd}`, borderRadius: 10, padding: '10px 14px', color: txt, fontSize: 18, fontWeight: 900, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }}
                />
                {receivedVal > 0 && (
                  <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 10, background: troco >= 0 ? '#052e16' : '#450a0a', border: `1px solid ${troco >= 0 ? '#16a34a33' : '#dc262633'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: troco >= 0 ? '#4ade80' : '#f87171', fontWeight: 700 }}>{troco >= 0 ? '💵 Troco' : '⚠️ Falta'}</span>
                      <span style={{ color: troco >= 0 ? '#4ade80' : '#f87171', fontWeight: 900, fontSize: 20, fontFamily: 'monospace' }}>{BRL.format(Math.abs(troco))}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* total + finalize */}
          <div style={{ flexShrink: 0, padding: 20, borderTop: `1px solid ${brd}` }}>
            {(discAmt > 0 || totalPromoDiscount > 0) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: txt2, fontSize: 13, marginBottom: 4 }}>
                <span>Subtotal</span><span>{BRL.format(subtotal)}</span>
              </div>
            )}
            {/* active promo chips */}
            {promoResults.filter(r => r.status === 'active').map(r => (
              <div key={r.rule.id} style={{ display: 'flex', justifyContent: 'space-between', color: '#4ade80', fontSize: 12, marginBottom: 3 }}>
                <span>🏷 {r.rule.name}</span><span>−{BRL.format(r.discount)}</span>
              </div>
            ))}
            {/* progress promo chips */}
            {promoResults.filter(r => r.status === 'progress').map(r => (
              <div key={r.rule.id} style={{ display: 'flex', justifyContent: 'space-between', color: '#f59e0b', fontSize: 12, marginBottom: 3 }}>
                <span>⚡ {r.rule.name} — faltam {r.needed}</span>
              </div>
            ))}
            {discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4ade80', fontSize: 13, marginBottom: 4 }}>
                <span>Desconto {discount}%</span><span>−{BRL.format(discAmt)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
              <span style={{ color: txt2, fontSize: 12, fontWeight: 700, letterSpacing: 2 }}>TOTAL</span>
              <span style={{ fontFamily: "'Courier New', monospace", fontSize: 'clamp(28px, 3vw, 42px)', fontWeight: 900, color: total > 0 ? acc : txt2 }}>{BRL.format(total)}</span>
            </div>

            <button
              onClick={() => cart.length > 0 && setShowPay(true)}
              disabled={!cart.length}
              style={{
                width: '100%', padding: '16px', borderRadius: 14, border: 'none',
                background: cart.length ? acc : bg3,
                color: cart.length ? '#000' : txt2,
                fontWeight: 900, fontSize: 18, cursor: cart.length ? 'pointer' : 'default',
                fontFamily: "'Courier New', monospace", letterSpacing: 1,
                transition: 'background .2s',
              }}
            >
              {cart.length ? `FINALIZAR · F10` : 'Carrinho vazio'}
            </button>

            {/* F-key quick bar */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 12 }}>
              {[
                ['F2','Buscar'], ['F3','Câmera'], ['F4','Desconto'],
                ['F5','PIX'], ['F6','Débito'], ['F7','Crédito'], ['F8','Dinheiro'],
                ['F9','Limpar'], ['F10','Finalizar'], ['F12','Display'],
              ].map(([key, label]) => (
                <div key={key} style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '3px 7px',
                  background: bg3, border: `1px solid ${brd}`, borderRadius: 6,
                  fontSize: 10, color: txt2, cursor: 'default', flexShrink: 0,
                }}>
                  <span style={{ fontWeight: 900, color: acc, fontFamily: 'monospace', fontSize: 10 }}>{key}</span>
                  <span>{label}</span>
                </div>
              ))}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '3px 7px',
                background: '#1e293b', border: `1px solid #334155`, borderRadius: 6,
                fontSize: 10, color: '#64748b', cursor: 'default', flexShrink: 0,
              }}>
                <span style={{ fontWeight: 900, color: '#94a3b8', fontFamily: 'monospace', fontSize: 10 }}>F1</span>
                <span>Ajuda</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Confirm modal ──────────────────────────────────── */}
      {/* ── F1 Help overlay ────────────────────────────────────── */}
      {showHelp && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
             onClick={() => setShowHelp(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#0f172a', border: `1px solid ${brd}`, borderRadius: 20,
            padding: 32, width: 480, maxWidth: '94vw',
          }}>
            <div style={{ fontFamily: "'Courier New', monospace", fontWeight: 900, fontSize: 18, color: acc, marginBottom: 20, letterSpacing: 1 }}>
              ⌨️ ATALHOS DO TECLADO
            </div>
            {[
              ['F1', 'Abrir / fechar este guia'],
              ['F2', 'Focar campo de busca / escaneamento'],
              ['F3', 'Abrir câmera QR/barcode'],
              ['F4', 'Ciclar desconto: 0% → 5% → 10% → 15% → 20%'],
              ['F5', 'Forma de pagamento: PIX'],
              ['F6', 'Forma de pagamento: Débito'],
              ['F7', 'Forma de pagamento: Crédito'],
              ['F8', 'Forma de pagamento: Dinheiro'],
              ['F9', 'Limpar carrinho (confirma)'],
              ['F10', 'Finalizar venda (abre modal)'],
              ['F12', 'Abrir Tela do Cliente (display)'],
              ['Enter', 'Confirmar venda (quando modal aberto)'],
              ['ESC', 'Cancelar / fechar modal'],
            ].map(([key, desc]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '7px 0', borderBottom: `1px solid ${brd}` }}>
                <div style={{
                  minWidth: 52, textAlign: 'center', padding: '3px 8px',
                  background: bg3, border: `1px solid ${brd}55`, borderRadius: 8,
                  fontFamily: 'monospace', fontWeight: 900, fontSize: 12, color: acc,
                }}>{key}</div>
                <div style={{ color: txt1, fontSize: 14 }}>{desc}</div>
              </div>
            ))}
            <div style={{ marginTop: 20, textAlign: 'center', color: txt2, fontSize: 12 }}>
              Pressione <strong style={{ color: acc }}>F1</strong> ou <strong style={{ color: acc }}>ESC</strong> para fechar
            </div>
          </div>
        </div>
      )}

      {showPay && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.75)' }}>
          <div style={{ background: bg2, border: `1px solid ${brd}`, borderRadius: 20, padding: 28, width: '100%', maxWidth: 420, boxShadow: '0 25px 80px rgba(0,0,0,.8)' }} className="animate-pop">
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontWeight: 900, fontSize: 20, color: txt }}>Confirmar Venda</div>
              <div style={{ color: txt2, fontSize: 13, marginTop: 4 }}>{payment} · {cart.length} produto(s)</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '16px 20px', background: bg3, borderRadius: 14, marginBottom: 20 }}>
              <span style={{ color: txt2, fontWeight: 700 }}>TOTAL</span>
              <span style={{ fontFamily: "'Courier New', monospace", fontSize: 36, fontWeight: 900, color: acc }}>{BRL.format(total)}</span>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowPay(false)}
                style={{ flex: 1, padding: '14px', borderRadius: 12, background: bg3, border: `1px solid ${brd}`, color: txt2, fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={finish} autoFocus
                style={{ flex: 2, padding: '14px', borderRadius: 12, background: '#16a34a', border: 'none', color: '#fff', fontWeight: 900, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Check style={{ width: 20, height: 20 }} /> Confirmar · Enter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Success modal ──────────────────────────────────── */}
      {lastSale && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.75)' }}>
          <div style={{ background: bg2, border: `1px solid ${brd}`, borderRadius: 20, padding: 32, width: '100%', maxWidth: 380, textAlign: 'center', boxShadow: '0 25px 80px rgba(0,0,0,.8)' }} className="animate-pop">
            <div style={{ fontSize: 56, marginBottom: 8 }}>✅</div>
            <div style={{ fontWeight: 900, fontSize: 24, color: '#4ade80', marginBottom: 4 }}>VENDA CONCLUÍDA</div>
            <div style={{ color: txt2, fontSize: 14, marginBottom: 20 }}>{lastSale.payment} · {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 44, fontWeight: 900, color: txt, marginBottom: 8 }}>{BRL.format(lastSale.total)}</div>
            {lastSale.troco > 0 && (
              <div style={{ background: '#052e16', border: '1px solid #16a34a33', borderRadius: 14, padding: '12px 20px', marginBottom: 16 }}>
                <div style={{ color: '#4ade80', fontWeight: 900, fontSize: 22 }}>💵 Troco: {BRL.format(lastSale.troco)}</div>
              </div>
            )}
            {lastSale.total >= 100 ? (
              <div style={{ background: '#431407', border: '1px solid #c2410c44', borderRadius: 14, padding: '12px 20px', marginBottom: 20 }}>
                <div style={{ color: '#fb923c', fontWeight: 900, fontSize: 15 }}>🎟️ Cupom Premiado impresso! — R$150</div>
                <div style={{ color: '#9a3412', fontSize: 12, marginTop: 4 }}>Entregar ao cliente — preencher e depositar na urna</div>
                <button onClick={() => printer.printCoupon(lastSale)} style={{ marginTop: 8, padding: '6px 16px', borderRadius: 8, background: '#ea580c', border: 'none', color: '#000', fontWeight: 900, fontSize: 12, cursor: 'pointer' }}>
                  🖨️ Reimprimir Cupom
                </button>
              </div>
            ) : (
              <div style={{ color: '#9a3412', fontSize: 12, marginBottom: 16, textAlign: 'center' }}>
                Compras acima de <strong style={{ color: '#fb923c' }}>R$100</strong> ganham Cupom Premiado 🎟️
              </div>
            )}
            <button onClick={() => { setLastSale(null); setTimeout(() => inputRef.current?.focus(), 50) }}
              style={{ width: '100%', padding: '14px', borderRadius: 14, background: acc, border: 'none', color: '#000', fontWeight: 900, fontSize: 18, cursor: 'pointer' }}>
              Próximo Cliente →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
