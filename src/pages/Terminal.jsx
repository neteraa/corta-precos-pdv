/**
 * /terminal — Full-screen cashier-only POS terminal.
 * No sidebar, no admin nav. Pure dark-themed, keyboard-driven cashier UI.
 * Same product DB (localStorage) as the main app, own cart state.
 */
import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react'
import {
  ShoppingCart, Trash2, Plus, Minus, Search, X, Check, Download,
  Barcode, Smartphone, CreditCard, Wallet, Banknote,
  LogOut, Settings, Monitor, QrCode, Users, HandCoins, ChevronDown, Printer
} from 'lucide-react'
import { useStore, BRL } from '../store.jsx'
import { usePrinter } from '../hooks/usePrinter.js'
import { useInstallPWA } from '../hooks/useInstallPWA.js'
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
    const normalSum = groupItems.reduce((s, i) => s + i.qty * i.price, 0)
    const type      = rule.type || 'combo'

    if (type === 'combo') {
      const complete  = Math.floor(totalQty / rule.qty)
      const remainder = totalQty % rule.qty
      if (!complete) { results.push({ rule, status: 'progress', current: totalQty, needed: rule.qty - totalQty, discount: 0 }); continue }
      const avgPrice = normalSum / totalQty
      const promoSum = complete * rule.totalPrice + remainder * avgPrice
      results.push({ rule, status: 'active', current: totalQty, complete, remainder, discount: Math.max(0, normalSum - promoSum) })
    } else if (type === 'percent') {
      if (totalQty < rule.qty) { results.push({ rule, status: 'progress', current: totalQty, needed: rule.qty - totalQty, discount: 0 }); continue }
      const discount = normalSum * (rule.discountPct / 100)
      results.push({ rule, status: 'active', current: totalQty, complete: 1, remainder: 0, discount })
    } else if (type === 'fixed') {
      if (totalQty < rule.qty) { results.push({ rule, status: 'progress', current: totalQty, needed: rule.qty - totalQty, discount: 0 }); continue }
      results.push({ rule, status: 'active', current: totalQty, complete: 1, remainder: 0, discount: Math.min(rule.discountAmt, normalSum) })
    }
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
  const { products, registerSale, promos, sales, customers, addFiado, operators, syncNow,
          cancelRequests, requestCancel, cancelSale } = useStore()
  const todaySales = useMemo(() => {
    const today = new Date().toDateString()
    return sales.filter(s => new Date(s.date).toDateString() === today).length
  }, [sales])
  const printer   = usePrinter()
  const broadcast = useBroadcastSend()
  const clock     = useClock()
  const { canInstall, install } = useInstallPWA()
  const isStandalone = useMemo(() =>
    window.matchMedia('(display-mode: standalone)').matches || !!window.navigator.standalone
  , [])

  // ── Cart ────────────────────────────────────────────────────
  const [cart,    setCart]    = useState([])
  const [payment, setPayment] = useState('PIX')
  const [installments, setInstallments] = useState(1)
  const [discount, setDiscount] = useState(0)

  // ── UI state ────────────────────────────────────────────────
  const [query,      setQuery]      = useState('')
  const [results,    setResults]    = useState([])
  const [scanFeed,      setScanFeed]      = useState(null)
  const [pendingScanCode, setPendingScanCode] = useState(null)   // retry after sync
  const [qtyMult,       setQtyMult]       = useState(1)   // ex: "7*" antes do scan
  const qtyMultRef = useRef(1)
  useEffect(() => { qtyMultRef.current = qtyMult }, [qtyMult])
  const [showPay,    setShowPay]    = useState(false)
  const [lastSale,   setLastSale]   = useState(null)
  const [received,   setReceived]   = useState('')
  const [showCamera, setShowCamera] = useState(false)
  const inputRef = useRef(null)

  // ── Split payment ────────────────────────────────────────────
  const [splitMode, setSplitMode] = useState(false)
  const [splits,    setSplits]    = useState([]) // [{id,method,amount}]

  // ── Cancel request ───────────────────────────────────────────
  const [pendingCancelId, setPendingCancelId] = useState(null)

  const timeStr = clock.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const secStr  = clock.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateStr = clock.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })

  // ── Totals (with promo engine) ──────────────────────────────
  const promoResults       = useMemo(() => calcPromoEngine(cart, products, promos), [cart, products, promos])
  const totalPromoDiscount = promoResults.reduce((s, r) => s + r.discount, 0)
  const subtotal   = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const discAmt    = subtotal * (discount / 100)
  const total      = Math.max(0, subtotal - discAmt - totalPromoDiscount)
  const receivedVal = parseFloat(received) || 0
  const troco = receivedVal - total

  // Split payment totals
  const splitTotal     = splits.reduce((s, sp) => s + (parseFloat(sp.amount) || 0), 0)
  const splitRemaining = Math.max(0, total - splitTotal)
  const splitComplete  = splitMode ? splitTotal >= total - 0.005 : true
  const splitTroco     = splitMode ? Math.max(0, splitTotal - total) : 0

  const trocoOk = splitMode
    ? splitComplete
    : payment !== 'Dinheiro' || received === '' || receivedVal >= total

  // Split helpers
  const addSplit = () =>
    setSplits(prev => [...prev, { id: Date.now(), method: 'PIX', amount: splitRemaining > 0.005 ? splitRemaining.toFixed(2) : '' }])
  const updateSplit = (id, field, val) =>
    setSplits(prev => prev.map(sp => sp.id === id ? { ...sp, [field]: val } : sp))
  const removeSplit = (id) =>
    setSplits(prev => { const next = prev.filter(sp => sp.id !== id); if (!next.length) setSplitMode(false); return next })
  const enterSplitMode = () => {
    setSplits([{ id: Date.now(), method: payment !== 'Fiado' ? payment : 'PIX', amount: total.toFixed(2) }])
    setSplitMode(true)
  }

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
    if (!p) {
      const code = typeof codeOrProduct === 'string' ? codeOrProduct.trim() : null
      setQuery(''); setResults([])
      if (code) {
        // Sincroniza com servidor — produto pode ter sido cadastrado em outro device
        setPendingScanCode(code)
        setScanFeed({ msg: `🔄 Sincronizando — aguarde...`, ok: false })
        syncNow()
      } else {
        setScanFeed({ msg: `❌ Produto não encontrado`, ok: false })
        setTimeout(() => setScanFeed(null), 2000)
      }
      setTimeout(() => inputRef.current?.focus(), 50)
      return
    }

    const mult = qtyMultRef.current > 1 ? qtyMultRef.current : 1
    if (mult > 1) setQtyMult(1)   // reset após uso

    let promoMsg = null
    setCart(prev => {
      const idx  = prev.findIndex(i => i.productId === p.id)
      const next = idx >= 0
        ? prev.map((i, j) => j === idx ? { ...i, qty: i.qty + mult } : i)
        : [...prev, { productId: p.id, name: p.name, price: p.price, qty: mult }]

      // Calcula progresso de promo para o grupo deste produto (se houver)
      if (p.promoGroup) {
        const rule = promos.find(r => r.active && r.group === p.promoGroup && r.type === 'combo')
        if (rule) {
          const totalQty = next
            .filter(i => products.find(x => x.id === i.productId)?.promoGroup === rule.group)
            .reduce((s, i) => s + i.qty, 0)
          const complete = Math.floor(totalQty / rule.qty)
          if (complete >= 1 && totalQty % rule.qty === 0) {
            promoMsg = `🏷 PROMO ATIVA! ${rule.name}`
          } else {
            const needed = rule.qty - (totalQty % rule.qty)
            promoMsg = `⚡ ${rule.name} — falta${needed > 1 ? 'm' : ''} ${needed} un.`
          }
        }
      }

      return next
    })

    setQuery(''); setResults([])
    setPendingScanCode(null)
    setScanFeed({ msg: promoMsg ? `✅ ${p.name}  ·  ${promoMsg}` : `✅ ${p.name}`, ok: true, promo: !!promoMsg })
    setTimeout(() => setScanFeed(null), promoMsg ? 2800 : 1800)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [products, promos])

  // Retry automático: produto sincronizado → tenta adicionar ao carrinho
  useEffect(() => {
    if (!pendingScanCode) return
    const p = findProduct(pendingScanCode)
    if (p) {
      addToCart(p)   // já limpa pendingScanCode internamente via setPendingScanCode(null)
    } else {
      setScanFeed({ msg: `❌ Código não encontrado: ${pendingScanCode}`, ok: false })
      setTimeout(() => { setScanFeed(null); setPendingScanCode(null) }, 3500)
    }
  }, [products]) // eslint-disable-line react-hooks/exhaustive-deps

  const [showHelp, setShowHelp] = useState(false)

  // ── Operator login ──────────────────────────────────────────
  const [activeOperator, setActiveOperator] = useState(null) // {id,name,pin,role}
  const [pinTarget,      setPinTarget]      = useState(null) // operator being PIN'd
  const [pinInput,       setPinInput]       = useState('')
  const [pinError,       setPinError]       = useState(false)
  const [showClose,      setShowClose]      = useState(false) // fechar caixa confirm

  // Mostra todos os operadores ativos (não só caixa) — gerente/admin tb podem operar o terminal
  const caixaOps = useMemo(() => operators.filter(o => o.active !== false), [operators])

  // Foca o campo de busca assim que o operador fizer login — sem isso o caixa
  // precisa clicar no campo toda vez que o lock screen fecha.
  useEffect(() => {
    if (activeOperator) setTimeout(() => inputRef.current?.focus(), 120)
  }, [activeOperator])

  const selectOperator = (op) => {
    if (!op.pin) { setActiveOperator(op); setPinTarget(null); setPinInput(''); return }
    setPinTarget(op); setPinInput(''); setPinError(false)
  }

  const confirmPin = () => {
    if (!pinTarget) return
    if (pinInput === pinTarget.pin) {
      setActiveOperator(pinTarget); setPinTarget(null); setPinInput('')
    } else {
      setPinError(true); setPinInput('')
      setTimeout(() => setPinError(false), 1200)
    }
  }

  const doLock = () => {
    setActiveOperator(null); setPinTarget(null); setPinInput(''); setShowClose(false)
  }

  const closeCaixa = () => {
    setShowClose(false); doLock()
  }

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
      if (e.key === 'F11') { doLock(); return }
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
    const isFiado = !splitMode && payment === 'Fiado'

    let t = 0
    let payLabel
    if (splitMode && splits.length > 0) {
      t = splitTroco
      payLabel = splits
        .map(sp => `${sp.method} ${BRL.format(parseFloat(sp.amount) || 0)}`)
        .join(' + ')
    } else {
      t = receivedVal > 0 && payment === 'Dinheiro' ? receivedVal - total : 0
      payLabel = isFiado
        ? `Fiado — ${selectedCustomer?.name}`
        : payment === 'Crédito' && installments > 1 ? `Crédito ${installments}×` : payment
    }

    const sale = {
      items: cart, subtotal, discount: discAmt, promoDiscount: totalPromoDiscount, total,
      payment: payLabel, troco: t,
      date: new Date().toISOString(), id: Date.now(),
      customerId: selectedCustomer?.id || null,
      operatorName: activeOperator?.name || '',
    }
    registerSale(sale)
    if (isFiado && selectedCustomer) {
      const desc = `Compra ${new Date().toLocaleDateString('pt-BR')} · ${cart.length} iten(s)`
      addFiado(selectedCustomer.id, total, desc)
    }
    setLastSale({ ...sale, troco: t, isFiado, customerName: selectedCustomer?.name })
    setCart([]); setDiscount(0); setReceived(''); setShowPay(false); setInstallments(1)
    setSplitMode(false); setSplits([])
    if (!isFiado) setSelectedCustomerId(null)
    broadcast({ type: 'cart', cart: [], promoResults: [], subtotal: 0, total: 0 })
    printer.printReceipt(sale)
  }

  // ── Número deste terminal (único por aba/janela via sessionStorage) ──
  const terminalNum = useMemo(() => {
    const key = 'zs_terminal_num'
    const existing = sessionStorage.getItem(key)
    if (existing) return parseInt(existing, 10)
    // Conta terminais abertos consultando localStorage (incrementa globalmente)
    const counterKey = 'zs_terminal_counter'
    const next = (parseInt(localStorage.getItem(counterKey) || '0', 10) + 1)
    localStorage.setItem(counterKey, String(next))
    sessionStorage.setItem(key, String(next))
    return next
  }, [])


  // ── Watch cancel request resolution ─────────────────────────
  useEffect(() => {
    if (!pendingCancelId) return
    const req = cancelRequests.find(r => r.id === pendingCancelId)
    if (!req) return
    if (req.status === 'approved') {
      setPendingCancelId(null)
      setLastSale(null)
      setScanFeed({ msg: `✅ Cancelamento autorizado por ${req.resolvedBy}`, ok: true })
      setTimeout(() => setScanFeed(null), 4000)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
    // denied: keep showing denied status — user closes manually
  }, [cancelRequests, pendingCancelId])

  // Sync every 5s while there's a pending cancel request
  useEffect(() => {
    if (!pendingCancelId) return
    const id = setInterval(syncNow, 5000)
    return () => clearInterval(id)
  }, [pendingCancelId, syncNow])

  // ── Palette (ultra dark, one accent) ──────────────────────
  const _storeName = printer.settings?.storeName || 'MEU MERCADO'
  const logoImage  = printer.settings?.logoImage || null
  const acc  = printer.settings?.themeColor || '#ea580c'
  const bg   = '#030303'
  const bg2  = '#0a0a0a'
  const bg3  = '#111111'
  const bg4  = '#181818'
  const brd  = '#1c1c1c'
  const txt  = '#efefef'
  const txt2 = '#444'
  const txt3 = '#222'

  useEffect(() => { document.documentElement.style.setProperty('--zs-theme', acc) }, [acc])

  // Shared button ghost style helper
  const pill = (active, col = acc) => ({
    fontSize: 11, fontWeight: 700,
    color: active ? col : txt2,
    background: active ? col + '18' : bg3,
    border: `1px solid ${active ? col + '55' : brd}`,
    padding: '3px 10px', borderRadius: 6, cursor: 'pointer',
  })

  return (
    <div style={{ height: '100vh', background: bg, color: txt, fontFamily: 'system-ui,-apple-system,sans-serif', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ════════════════════════════════════════════════════════
          TOP BAR
      ════════════════════════════════════════════════════════ */}
      <div style={{ flexShrink: 0, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px', background: bg2, borderBottom: `1px solid ${brd}` }}>

        {/* left */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {logoImage
            ? <img src={logoImage} alt="logo" style={{ height: 26, maxWidth: 88, objectFit: 'contain' }} />
            : null}
          <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: logoImage ? 14 : 16, color: logoImage ? txt : acc, letterSpacing: 0.5 }}>{_storeName}</span>
          <span style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 700, color: txt2, background: bg3, border: `1px solid ${brd}`, padding: '2px 7px', borderRadius: 5 }}>PDV {terminalNum}</span>
          {activeOperator && (
            <span style={{ fontSize: 11, fontWeight: 700, color: '#a5b4fc', background: '#13124a', border: '1px solid #312e8128', padding: '2px 9px', borderRadius: 5 }}>
              {activeOperator.name}
            </span>
          )}
        </div>

        {/* right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: cart.length > 0 ? acc : '#4ade80', background: cart.length > 0 ? acc + '14' : '#021a0c', border: `1px solid ${cart.length > 0 ? acc + '33' : '#16a34a20'}`, padding: '3px 10px', borderRadius: 6 }}>
            {cart.length > 0 ? `${cart.reduce((s, i) => s + i.qty, 0)} itens` : '● LIVRE'}
          </span>

          {printer.isSupported && (
            printer.isConnected
              ? <span style={pill(true, '#4ade80')}><Printer style={{ width: 10, height: 10, display: 'inline', marginRight: 3 }} />USB</span>
              : <button onClick={printer.connect} style={{ ...pill(false), cursor: 'pointer', color: '#fb923c', background: '#1a0800', border: '1px solid #7c2d1222' }}>
                  <Printer style={{ width: 10, height: 10, display: 'inline', marginRight: 3 }} />Impressora
                </button>
          )}

          <span style={{ fontFamily: 'monospace', fontSize: 11, color: txt2 }}>{todaySales} vendas</span>

          <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 900, color: txt, background: bg3, border: `1px solid ${brd}`, padding: '3px 10px', borderRadius: 6 }}>{timeStr}</span>

          <button onClick={() => window.open('/display', 'cp_display', 'width=1280,height=720')} style={{ ...pill(false), cursor: 'pointer' }}>
            <Monitor style={{ width: 10, height: 10, display: 'inline', marginRight: 3 }} />Display
          </button>
          <button onClick={() => window.open('/terminal', '_blank', 'noopener')} style={{ ...pill(false, '#4ade80'), cursor: 'pointer', color: '#4ade80', background: '#021a0c', border: '1px solid #16a34a20' }}>+2°</button>

          {activeOperator && <>
            <button onClick={doLock} style={{ ...pill(false), cursor: 'pointer' }}>F11 🔒</button>
            <button onClick={() => setShowClose(true)} style={{ ...pill(false), cursor: 'pointer', color: '#fca5a5', background: '#2d0808', border: '1px solid #7f1d1d22' }}>Fechar Caixa</button>
          </>}
          {canInstall && !isStandalone && (
            <button onClick={install} style={{ ...pill(true, '#4ade80'), cursor: 'pointer', color: '#000', background: '#4ade80', border: 'none', fontWeight: 900 }}>
              <Download style={{ width: 10, height: 10, display: 'inline', marginRight: 3 }} />Instalar
            </button>
          )}
          {!isStandalone && (
            <a href="/pdv" style={{ ...pill(false), textDecoration: 'none' }}>← Admin</a>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          MAIN AREA
      ════════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ══ LEFT — scanner + cart ══════════════════════════ */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: `1px solid ${brd}` }}>

          {/* scanner */}
          <div style={{ flexShrink: 0, padding: '10px 14px', background: bg2, borderBottom: `1px solid ${brd}` }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                {qtyMult > 1
                  ? <button onClick={() => setQtyMult(1)} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', zIndex: 2, background: acc, color: '#000', border: 'none', borderRadius: 5, padding: '3px 7px', fontSize: 11, fontWeight: 900, cursor: 'pointer' }}>
                      ×{qtyMult} <X style={{ width: 10, height: 10, display: 'inline' }} />
                    </button>
                  : <Barcode style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: txt2 }} />
                }
                <input
                  ref={inputRef} autoFocus value={query}
                  onChange={e => {
                    const v = e.target.value
                    const m = v.match(/^(\d{1,3})[*×](.*)$/)
                    if (m) { const n = Math.min(parseInt(m[1], 10), 999); if (n > 1) { setQtyMult(n); setQuery(m[2]); return } }
                    setQuery(v)
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Escape') { setQuery(''); setQtyMult(1); return }
                    if (e.key !== 'Enter') return
                    const exact = findProduct(query.trim())
                    if (exact) addToCart(exact)
                    else if (results.length > 0) addToCart(results[0])
                    else if (query.trim()) addToCart(query.trim())
                  }}
                  placeholder={qtyMult > 1 ? `×${qtyMult} — escaneie…` : 'Código de barras ou nome do produto  [F2]'}
                  style={{
                    width: '100%', background: bg3,
                    border: `1.5px solid ${qtyMult > 1 ? acc : brd}`,
                    borderRadius: 8, padding: `12px 12px 12px ${qtyMult > 1 ? '66px' : '36px'}`,
                    color: txt, fontSize: 14, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
              <button onClick={() => setShowCamera(c => !c)} style={{ padding: '0 13px', borderRadius: 8, background: showCamera ? acc : bg3, border: `1px solid ${showCamera ? acc : brd}`, color: showCamera ? '#000' : txt2, cursor: 'pointer' }}>
                <QrCode style={{ width: 15, height: 15 }} />
              </button>
              <button onClick={() => setShowHelp(h => !h)} style={{ padding: '0 11px', borderRadius: 8, background: bg3, border: `1px solid ${brd}`, color: txt2, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>F1</button>
            </div>

            {showCamera && (
              <div style={{ marginTop: 8, borderRadius: 10, overflow: 'hidden', height: 230 }}>
                <CameraScanner compact onScan={addToCart} onClose={() => setShowCamera(false)} />
              </div>
            )}

            {results.length > 0 && (
              <div style={{ marginTop: 5, background: bg2, border: `1px solid ${brd}`, borderRadius: 8, overflow: 'hidden' }}>
                {results.map((p, i) => (
                  <button key={p.id} onClick={() => addToCart(p)}
                    style={{ width: '100%', display: 'flex', justifyContent: 'space-between', padding: '8px 13px', background: i === 0 ? bg3 : 'transparent', border: 'none', borderBottom: `1px solid ${brd}`, color: txt, cursor: 'pointer', textAlign: 'left', fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}>{p.name}</span>
                    <span style={{ color: acc, fontWeight: 900, fontFamily: 'monospace' }}>{BRL.format(p.price)}</span>
                  </button>
                ))}
              </div>
            )}

            {scanFeed && (
              <div style={{ marginTop: 5, padding: '7px 11px', borderRadius: 6, fontSize: 12, fontWeight: 700, borderLeft: `3px solid ${!scanFeed.ok ? '#ef4444' : scanFeed.promo ? acc : '#22c55e'}`, background: !scanFeed.ok ? '#160404' : scanFeed.promo ? '#160a00' : '#01160a', color: !scanFeed.ok ? '#f87171' : scanFeed.promo ? acc : '#4ade80' }}>
                {scanFeed.msg}
              </div>
            )}
          </div>

          {/* cart / idle */}
          <div style={{ flex: 1, overflowY: 'auto', background: bg }}>
            {cart.length === 0 ? (

              /* ── IDLE (clean, premium, no animations) ── */
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 14, padding: 24 }}>
                {logoImage
                  ? <img src={logoImage} alt="logo" style={{ height: 80, maxWidth: 240, objectFit: 'contain', opacity: 0.9 }} />
                  : <span style={{ fontSize: 52, opacity: 0.5 }}>🏪</span>
                }
                <div style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: 2 }}>{_storeName}</div>
                <div style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: 54, fontWeight: 900, color: acc, letterSpacing: 4, lineHeight: 1 }}>{secStr}</div>
                <div style={{ fontSize: 11, color: txt2, letterSpacing: 3, fontWeight: 600, textTransform: 'capitalize', marginTop: 2 }}>{dateStr}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 22px', background: '#011a0a', border: '1px solid #16a34a18', borderRadius: 100, marginTop: 10 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
                  <span style={{ color: '#4ade80', fontWeight: 800, fontSize: 12, letterSpacing: 2 }}>AGUARDANDO</span>
                </div>
                <div style={{ color: txt2, fontSize: 12, marginTop: 2 }}>Escaneie um produto para iniciar</div>
                {!isStandalone && (
                  <a href="/instalar-caixa" target="_blank" rel="noopener"
                    style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: txt2, textDecoration: 'none', background: bg2, border: `1px solid ${brd}`, padding: '5px 12px', borderRadius: 6 }}>
                    <Download style={{ width: 10, height: 10 }} />
                    Instalar terminal como app
                  </a>
                )}
              </div>

            ) : (

              /* ── CART ITEMS ── */
              <div style={{ padding: '6px 10px' }}>
                {/* header */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px 80px 84px 36px', gap: 6, padding: '4px 8px 2px', color: txt2, fontSize: 9, fontWeight: 700, letterSpacing: 1.5 }}>
                  <span>PRODUTO</span>
                  <span style={{ textAlign: 'center' }}>QTD</span>
                  <span style={{ textAlign: 'right' }}>UNIT</span>
                  <span style={{ textAlign: 'right' }}>TOTAL</span>
                  <span />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {cart.map((item, idx) => (
                    <div key={item.productId} style={{ display: 'grid', gridTemplateColumns: '1fr 72px 80px 84px 36px', gap: 6, padding: '10px 8px', alignItems: 'center', background: idx % 2 === 0 ? bg2 : bg3, borderRadius: 5 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'center' }}>
                        <button onClick={() => setCart(c => c.map(i => i.productId === item.productId ? { ...i, qty: Math.max(1, i.qty - 1) } : i))}
                          style={{ width: 22, height: 22, borderRadius: 5, background: bg4, border: `1px solid ${brd}`, color: txt2, cursor: 'pointer', fontWeight: 900, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                        <span style={{ width: 20, textAlign: 'center', fontWeight: 900, fontSize: 14, fontFamily: 'monospace' }}>{item.qty}</span>
                        <button onClick={() => setCart(c => c.map(i => i.productId === item.productId ? { ...i, qty: i.qty + 1 } : i))}
                          style={{ width: 22, height: 22, borderRadius: 5, background: acc, border: 'none', color: '#000', cursor: 'pointer', fontWeight: 900, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                      </div>
                      <div style={{ textAlign: 'right', color: txt2, fontSize: 12, fontFamily: 'monospace' }}>{BRL.format(item.price)}</div>
                      <div style={{ textAlign: 'right', fontWeight: 900, fontSize: 14, fontFamily: 'monospace' }}>{BRL.format(item.price * item.qty)}</div>
                      <button onClick={() => setCart(c => c.filter(i => i.productId !== item.productId))}
                        style={{ width: 26, height: 26, borderRadius: 5, background: 'transparent', border: 'none', color: txt3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color .1s' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                        onMouseLeave={e => e.currentTarget.style.color = txt3}>
                        <Trash2 style={{ width: 12, height: 12 }} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ══ RIGHT — totals + payment ══════════════════════ */}
        <div style={{ width: 354, flexShrink: 0, display: 'flex', flexDirection: 'column', background: bg2 }}>

          {/* scrollable section */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* ── CLIENTE ── */}
            <div style={{ position: 'relative' }} ref={customerPickerRef}>
              <div style={{ fontSize: 9, fontWeight: 700, color: txt2, letterSpacing: 2.5, marginBottom: 5 }}>CLIENTE</div>
              {selectedCustomer ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: bg3, border: `1px solid ${acc}22`, borderRadius: 8, padding: '8px 11px' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: acc + '20', color: acc, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 13, flexShrink: 0 }}>{selectedCustomer.name.charAt(0)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedCustomer.name}</div>
                      {(selectedCustomer.fiadoBalance || 0) > 0
                        ? <div style={{ color: '#ef4444', fontSize: 10, fontWeight: 700 }}>Fiado: {BRL.format(selectedCustomer.fiadoBalance)}</div>
                        : <div style={{ color: '#4ade80', fontSize: 10 }}>Sem fiado</div>}
                    </div>
                    <button onClick={() => { setSelectedCustomerId(null); if (payment === 'Fiado') setPayment('PIX') }} style={{ background: 'transparent', border: 'none', color: txt2, cursor: 'pointer', padding: 3 }}>
                      <X style={{ width: 12, height: 12 }} />
                    </button>
                  </div>
                  {((selectedCustomer.fiadoLogs || []).length > 0) && (
                    <div style={{ marginTop: 4, padding: '6px 9px', background: bg3, borderRadius: 6, border: `1px solid ${brd}` }}>
                      {[...(selectedCustomer.fiadoLogs || [])].reverse().slice(0, 3).map(log => (
                        <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, marginBottom: 2 }}>
                          <span style={{ color: txt2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{log.type === 'pagamento' ? '↑' : '↓'} {log.desc || (log.type === 'pagamento' ? 'Pgto' : 'Fiado')}</span>
                          <span style={{ color: log.type === 'pagamento' ? '#4ade80' : '#f87171', fontWeight: 800 }}>{log.type === 'pagamento' ? '-' : '+'}{BRL.format(Math.abs(log.amount))}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <button onClick={() => setShowCustomerPicker(p => !p)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 11px', borderRadius: 8, background: bg3, border: `1px solid ${brd}`, color: txt2, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Users style={{ width: 12, height: 12 }} />Selecionar cliente</span>
                  <ChevronDown style={{ width: 12, height: 12 }} />
                </button>
              )}
              {showCustomerPicker && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: bg2, border: `1px solid ${brd}`, borderRadius: 10, marginTop: 3, maxHeight: 250, overflowY: 'auto', boxShadow: '0 8px 30px rgba(0,0,0,.6)' }}>
                  <div style={{ padding: '7px 9px', borderBottom: `1px solid ${brd}` }}>
                    <div style={{ position: 'relative' }}>
                      <Search style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', width: 11, height: 11, color: txt2 }} />
                      <input autoFocus value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} placeholder="Buscar..." style={{ width: '100%', background: bg3, border: `1px solid ${brd}`, borderRadius: 6, padding: '5px 8px 5px 24px', color: txt, fontSize: 11, outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                  {customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || (c.phone || '').includes(customerSearch)).map(c => (
                    <button key={c.id} onClick={() => { setSelectedCustomerId(c.id); setShowCustomerPicker(false); setCustomerSearch(''); if (pickerFromFiado) { setPayment('Fiado'); setPickerFromFiado(false) } }}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 7, padding: '8px 11px', background: 'transparent', border: 'none', borderBottom: `1px solid ${brd}`, color: txt, cursor: 'pointer', textAlign: 'left' }}>
                      <div style={{ width: 26, height: 26, borderRadius: 5, background: (c.fiadoBalance || 0) > 0 ? '#300' : '#013', color: (c.fiadoBalance || 0) > 0 ? acc : '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 11 }}>{c.name.charAt(0)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                        <div style={{ fontSize: 9, color: (c.fiadoBalance || 0) > 0 ? '#fb923c' : txt2 }}>{(c.fiadoBalance || 0) > 0 ? `Fiado: ${BRL.format(c.fiadoBalance)}` : c.phone || ''}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── DESCONTO ── */}
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: txt2, letterSpacing: 2.5, marginBottom: 5 }}>DESCONTO  [F4]</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {[0, 5, 10, 15, 20].map(v => (
                  <button key={v} onClick={() => setDiscount(v)}
                    style={{ flex: 1, padding: '7px 0', borderRadius: 7, background: discount === v ? acc + '20' : bg3, border: `1.5px solid ${discount === v ? acc : brd}`, color: discount === v ? acc : txt2, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
                    {v}%
                  </button>
                ))}
              </div>
            </div>

            <div style={{ height: 1, background: brd }} />

            {/* ── PAGAMENTO ── */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: txt2, letterSpacing: 2.5 }}>PAGAMENTO</div>
                {!splitMode
                  ? <button onClick={enterSplitMode} style={{ fontSize: 9, fontWeight: 700, color: acc, background: acc + '12', border: `1px solid ${acc}33`, padding: '2px 8px', borderRadius: 5, cursor: 'pointer' }}>÷ Dividir</button>
                  : <button onClick={() => { setSplitMode(false); setSplits([]) }} style={{ fontSize: 9, fontWeight: 700, color: txt2, background: bg3, border: `1px solid ${brd}`, padding: '2px 8px', borderRadius: 5, cursor: 'pointer' }}>← Único</button>
                }
              </div>

              {!splitMode ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {PAYMENTS.map((p, i) => {
                      const Icon = PAY_ICON[p]
                      const fKeys = ['F5','F6','F7','F8']
                      const active = payment === p
                      return (
                        <button key={p} onClick={() => setPayment(p)}
                          style={{ padding: '13px 6px 9px', borderRadius: 10, background: active ? acc + '16' : bg3, border: `2px solid ${active ? acc : brd}`, color: active ? acc : txt2, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, transition: 'all .1s' }}>
                          <Icon style={{ width: 19, height: 19 }} />
                          <span style={{ fontWeight: 900, fontSize: 12, letterSpacing: 0.5 }}>{p.toUpperCase()}</span>
                          <span style={{ fontFamily: 'monospace', fontSize: 8, color: active ? acc + 'aa' : txt3, background: bg4, padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>{fKeys[i]}</span>
                        </button>
                      )
                    })}
                  </div>
                  <button
                    onClick={() => { if (!selectedCustomer) { setPickerFromFiado(true); setShowCustomerPicker(true) } else setPayment('Fiado') }}
                    style={{ marginTop: 5, width: '100%', padding: '10px 12px', borderRadius: 10, background: payment === 'Fiado' ? '#200' : bg3, border: `2px solid ${payment === 'Fiado' ? '#ef4444' : brd}`, color: payment === 'Fiado' ? '#f87171' : txt2, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
                    <HandCoins style={{ width: 15, height: 15 }} />
                    {selectedCustomer ? `Fiado — ${selectedCustomer.name}` : 'Fiado (selecionar cliente)'}
                    {selectedCustomer && (selectedCustomer.fiadoBalance || 0) > 0 && (
                      <span style={{ marginLeft: 'auto', fontSize: 10, color: '#f87171', fontWeight: 800 }}>deve {BRL.format(selectedCustomer.fiadoBalance)}</span>
                    )}
                  </button>
                </>
              ) : (
                /* ── SPLIT MODE ── */
                <div style={{ background: bg3, border: `1px solid ${acc}22`, borderRadius: 10, padding: '10px 10px 6px' }}>
                  {splits.map((sp, idx) => {
                    const Icon = PAY_ICON[sp.method] || Wallet
                    return (
                      <div key={sp.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        {/* method select */}
                        <select
                          value={sp.method}
                          onChange={e => updateSplit(sp.id, 'method', e.target.value)}
                          style={{ flex: '0 0 100px', background: bg4, border: `1px solid ${brd}`, borderRadius: 7, padding: '7px 8px', color: txt, fontSize: 12, fontWeight: 700, cursor: 'pointer', outline: 'none' }}>
                          {PAYMENTS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        {/* amount input */}
                        <div style={{ flex: 1, position: 'relative' }}>
                          <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: txt2, fontWeight: 700 }}>R$</span>
                          <input
                            type="number" min="0" step="0.01"
                            value={sp.amount}
                            onChange={e => updateSplit(sp.id, 'amount', e.target.value)}
                            placeholder="0,00"
                            style={{ width: '100%', background: bg4, border: `1.5px solid ${idx === splits.length - 1 ? acc + '66' : brd}`, borderRadius: 7, padding: '7px 8px 7px 28px', color: txt, fontSize: 14, fontWeight: 900, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }}
                          />
                        </div>
                        <button onClick={() => removeSplit(sp.id)}
                          style={{ width: 28, height: 28, borderRadius: 6, background: 'transparent', border: 'none', color: txt2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                          onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                          onMouseLeave={e => e.currentTarget.style.color = txt2}>
                          <X style={{ width: 13, height: 13 }} />
                        </button>
                      </div>
                    )
                  })}

                  {/* add split button */}
                  <button onClick={addSplit} disabled={splitRemaining < 0.005}
                    style={{ width: '100%', padding: '7px', borderRadius: 7, background: 'transparent', border: `1px dashed ${brd}`, color: splitRemaining > 0.005 ? acc : txt3, fontSize: 11, fontWeight: 700, cursor: 'pointer', marginBottom: 8 }}>
                    ＋ Adicionar forma {splitRemaining > 0.005 ? `— R$ ${splitRemaining.toFixed(2)} restante` : ''}
                  </button>

                  {/* coverage indicator */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 2px', borderTop: `1px solid ${brd}` }}>
                    <span style={{ fontSize: 10, color: txt2, fontWeight: 700 }}>
                      {splitComplete ? 'Coberto ✓' : 'Restante'}
                    </span>
                    <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 900, color: splitComplete ? '#4ade80' : '#f59e0b' }}>
                      {splitComplete
                        ? (splitTroco > 0.005 ? `Troco: ${BRL.format(splitTroco)}` : '✓ OK')
                        : BRL.format(splitRemaining)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* parcelamento crédito (apenas modo único) */}
            {!splitMode && payment === 'Crédito' && (
              <div style={{ background: '#080e1a', border: '1px solid #1a2d4a', borderRadius: 9, padding: '9px 11px' }}>
                <div style={{ color: '#93c5fd', fontSize: 9, fontWeight: 700, letterSpacing: 2, marginBottom: 6 }}>PARCELAMENTO</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {[1, 2, 3, 6, 12].map(n => (
                    <button key={n} onClick={() => setInstallments(n)}
                      style={{ padding: '5px 9px', borderRadius: 6, border: `1.5px solid ${installments === n ? '#3b82f6' : '#1e3a5f'}`, background: installments === n ? '#1d4ed8' : bg3, color: installments === n ? '#fff' : '#93c5fd', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>
                      {n === 1 ? '1× vista' : `${n}× ${BRL.format(total / n)}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* PIX QR */}
            {payment === 'PIX' && printer.settings?.pixKey && total > 0 && (
              <div style={{ background: '#011408', border: '1px solid #16a34a18', borderRadius: 9, padding: 11, textAlign: 'center' }}>
                <div style={{ color: '#4ade80', fontSize: 9, fontWeight: 700, letterSpacing: 2, marginBottom: 7 }}>PIX — ESCANEIE</div>
                <PixQR amount={total} pixKey={printer.settings.pixKey} name={printer.settings.storeName} city={printer.settings.pixCity} txid={String(Date.now()).slice(-8)} size={128} />
              </div>
            )}

            {/* troco */}
            {payment === 'Dinheiro' && (
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: txt2, letterSpacing: 2.5, marginBottom: 5 }}>RECEBIDO</div>
                <input type="number" min="0" step="0.01" value={received} onChange={e => setReceived(e.target.value)} placeholder="R$ 0,00"
                  style={{ width: '100%', background: bg3, border: `1.5px solid ${brd}`, borderRadius: 8, padding: '10px 11px', color: txt, fontSize: 20, fontWeight: 900, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }} />
                {receivedVal > 0 && (
                  <div style={{ marginTop: 5, padding: '8px 11px', borderRadius: 7, background: troco >= 0 ? '#010f07' : '#0f0101', border: `1px solid ${troco >= 0 ? '#16a34a18' : '#dc262618'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: troco >= 0 ? '#4ade80' : '#f87171', fontWeight: 700, fontSize: 11 }}>{troco >= 0 ? 'TROCO' : 'FALTA'}</span>
                    <span style={{ color: troco >= 0 ? '#4ade80' : '#f87171', fontWeight: 900, fontSize: 22, fontFamily: 'monospace' }}>{BRL.format(Math.abs(troco))}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── TOTALS + FINALIZAR (pinned bottom) ── */}
          <div style={{ flexShrink: 0, borderTop: `1px solid ${brd}`, background: bg, padding: '12px 14px' }}>
            {/* breakdown rows */}
            <div style={{ marginBottom: 8 }}>
              {(discAmt > 0 || totalPromoDiscount > 0) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: txt2, fontSize: 11, marginBottom: 3 }}>
                  <span>Subtotal</span><span style={{ fontFamily: 'monospace' }}>{BRL.format(subtotal)}</span>
                </div>
              )}
              {promoResults.filter(r => r.status === 'active').map(r => (
                <div key={r.rule.id} style={{ display: 'flex', justifyContent: 'space-between', color: '#4ade80', fontSize: 10, marginBottom: 2 }}>
                  <span>🏷 {r.rule.name}</span><span style={{ fontFamily: 'monospace' }}>−{BRL.format(r.discount)}</span>
                </div>
              ))}
              {promoResults.filter(r => r.status === 'progress').map(r => (
                <div key={r.rule.id} style={{ color: '#f59e0b', fontSize: 10, marginBottom: 2 }}>
                  ⚡ {r.rule.name} — faltam {r.needed}
                </div>
              ))}
              {discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4ade80', fontSize: 11, marginBottom: 3 }}>
                  <span>Desconto {discount}%</span><span style={{ fontFamily: 'monospace' }}>−{BRL.format(discAmt)}</span>
                </div>
              )}
            </div>

            {/* BIG TOTAL */}
            <div style={{ background: bg2, border: `1px solid ${brd}`, borderRadius: 10, padding: '10px 14px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: txt2, letterSpacing: 2 }}>TOTAL</span>
              <span style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: cart.length > 0 ? 46 : 30, fontWeight: 900, color: total > 0 ? acc : txt2, letterSpacing: -1, transition: 'font-size .2s' }}>
                {BRL.format(total)}
              </span>
            </div>

            {/* FINALIZAR */}
            <button onClick={() => cart.length > 0 && setShowPay(true)} disabled={!cart.length}
              style={{ width: '100%', padding: '14px', borderRadius: 9, border: 'none', background: cart.length ? acc : bg3, color: cart.length ? '#000' : txt2, fontWeight: 900, fontSize: 15, cursor: cart.length ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, letterSpacing: 1 }}>
              {cart.length ? <><Check style={{ width: 17, height: 17 }} /> FINALIZAR &nbsp; F10</> : 'Carrinho vazio'}
            </button>

            {cart.length > 0 && (
              <button onClick={() => { if (window.confirm('Limpar carrinho?')) setCart([]) }}
                style={{ marginTop: 5, width: '100%', padding: '7px', borderRadius: 7, border: `1px solid ${brd}`, background: 'transparent', color: txt2, fontWeight: 700, fontSize: 10, cursor: 'pointer', letterSpacing: 1 }}>
                LIMPAR CARRINHO &nbsp; F9
              </button>
            )}

            {/* F-key reference bar */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 8 }}>
              {[['F2','Buscar'],['F3','Câmera'],['F5','PIX'],['F6','Déb'],['F7','Cré'],['F8','Din'],['F10','Pagar'],['F11','Travar'],['F12','Display']].map(([k, l]) => (
                <span key={k} style={{ fontSize: 8, color: txt2, background: bg3, border: `1px solid ${brd}`, padding: '2px 5px', borderRadius: 3, fontFamily: 'monospace', fontWeight: 700 }}>
                  <span style={{ color: acc }}>{k}</span> {l}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          MODALS
      ════════════════════════════════════════════════════════ */}

      {/* F1 Help */}
      {showHelp && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.94)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
             onClick={() => setShowHelp(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: bg2, border: `1px solid ${brd}`, borderRadius: 14, padding: 24, width: 440, maxWidth: '94vw' }}>
            <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 15, color: acc, marginBottom: 16, letterSpacing: 1 }}>⌨  ATALHOS DE TECLADO</div>
            {[['F1','Abrir/fechar este guia'],['F2','Campo de busca/escaneamento'],['F3','Câmera QR/barcode'],['F4','Ciclar desconto 0→5→10→15→20%'],['F5','Pagamento: PIX'],['F6','Pagamento: Débito'],['F7','Pagamento: Crédito'],['F8','Pagamento: Dinheiro'],['F9','Limpar carrinho'],['F10','Finalizar venda'],['F11','Travar caixa'],['F12','Abrir Tela do Cliente'],['Enter','Confirmar venda (modal aberto)'],['ESC','Fechar modal']].map(([key, desc]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '5px 0', borderBottom: `1px solid ${brd}` }}>
                <div style={{ minWidth: 46, textAlign: 'center', padding: '2px 5px', background: bg3, border: `1px solid ${brd}`, borderRadius: 5, fontFamily: 'monospace', fontWeight: 900, fontSize: 10, color: acc }}>{key}</div>
                <div style={{ color: txt, fontSize: 12 }}>{desc}</div>
              </div>
            ))}
            <div style={{ marginTop: 14, textAlign: 'center', color: txt2, fontSize: 10 }}>ESC para fechar</div>
          </div>
        </div>
      )}

      {/* Confirm payment */}
      {showPay && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.88)' }}>
          <div style={{ background: bg2, border: `1px solid ${brd}`, borderRadius: 14, padding: 26, width: '100%', maxWidth: 390, boxShadow: '0 24px 80px rgba(0,0,0,.9)' }} className="animate-pop">
            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <div style={{ fontWeight: 900, fontSize: 17, color: txt }}>Confirmar Venda</div>
              <div style={{ color: txt2, fontSize: 11, marginTop: 3 }}>{payment} · {cart.length} produto(s)</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '12px 16px', background: bg3, borderRadius: 9, marginBottom: 16, border: `1px solid ${brd}` }}>
              <span style={{ color: txt2, fontWeight: 700, fontSize: 11 }}>TOTAL</span>
              <span style={{ fontFamily: "'Courier New', monospace", fontSize: 42, fontWeight: 900, color: acc }}>{BRL.format(total)}</span>
            </div>
            <div style={{ display: 'flex', gap: 7 }}>
              <button onClick={() => setShowPay(false)} style={{ flex: 1, padding: '12px', borderRadius: 9, background: bg3, border: `1px solid ${brd}`, color: txt2, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                ESC — Cancelar
              </button>
              <button onClick={finish} autoFocus style={{ flex: 2, padding: '12px', borderRadius: 9, background: '#16a34a', border: 'none', color: '#fff', fontWeight: 900, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                <Check style={{ width: 17, height: 17 }} /> ENTER — Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success */}
      {lastSale && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.88)' }}>
          <div style={{ background: bg2, border: `1px solid ${brd}`, borderRadius: 14, padding: 30, width: '100%', maxWidth: 350, textAlign: 'center', boxShadow: '0 24px 80px rgba(0,0,0,.9)' }} className="animate-pop">
            <div style={{ fontSize: 44, marginBottom: 6 }}>✅</div>
            <div style={{ fontWeight: 900, fontSize: 20, color: '#4ade80', marginBottom: 3 }}>VENDA CONCLUÍDA</div>
            <div style={{ color: txt2, fontSize: 11, marginBottom: 16 }}>{lastSale.payment} · {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 46, fontWeight: 900, color: txt, marginBottom: 10 }}>{BRL.format(lastSale.total)}</div>
            {lastSale.troco > 0 && (
              <div style={{ background: '#011308', border: '1px solid #16a34a18', borderRadius: 9, padding: '9px 16px', marginBottom: 12 }}>
                <div style={{ color: '#4ade80', fontWeight: 900, fontSize: 22 }}>TROCO: {BRL.format(lastSale.troco)}</div>
              </div>
            )}
            {lastSale.total >= 100 ? (
              <div style={{ background: '#140600', border: '1px solid #c2410c18', borderRadius: 9, padding: '9px 16px', marginBottom: 16 }}>
                <div style={{ color: acc, fontWeight: 900, fontSize: 13 }}>🎟️ Cupom Premiado — R$150</div>
                <div style={{ color: txt2, fontSize: 10, marginTop: 2 }}>Entregar ao cliente para preencher</div>
                <button onClick={() => printer.printCoupon(lastSale)} style={{ marginTop: 6, padding: '4px 12px', borderRadius: 6, background: acc, border: 'none', color: '#000', fontWeight: 900, fontSize: 10, cursor: 'pointer' }}>Reimprimir</button>
              </div>
            ) : (
              <div style={{ color: txt2, fontSize: 10, marginBottom: 14 }}>Acima de <strong style={{ color: acc }}>R$100</strong> ganha Cupom Premiado 🎟️</div>
            )}
            <button onClick={() => { setLastSale(null); setPendingCancelId(null); setTimeout(() => inputRef.current?.focus(), 50) }}
              style={{ width: '100%', padding: '13px', borderRadius: 9, background: acc, border: 'none', color: '#000', fontWeight: 900, fontSize: 15, cursor: 'pointer', letterSpacing: 1, marginBottom: 8 }}>
              PRÓXIMO CLIENTE →
            </button>

            {/* ── Cancel request ── */}
            {!pendingCancelId ? (
              <button
                onClick={() => {
                  const id = requestCancel(lastSale, activeOperator?.name, terminalNum)
                  setPendingCancelId(id)
                  syncNow()
                }}
                style={{ width: '100%', padding: '8px', borderRadius: 8, background: 'transparent', border: `1px solid ${brd}`, color: txt2, fontSize: 10, fontWeight: 700, cursor: 'pointer', letterSpacing: 0.5 }}>
                Solicitar cancelamento desta venda
              </button>
            ) : (
              <div style={{ padding: '10px 12px', borderRadius: 8, background: bg3, border: `1px solid ${brd}`, textAlign: 'center' }}>
                {(() => {
                  const req = cancelRequests.find(r => r.id === pendingCancelId)
                  if (!req || req.status === 'pending') return (
                    <div>
                      <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, marginBottom: 3 }}>⏳ Aguardando autorização do supervisor…</div>
                      <div style={{ fontSize: 9, color: txt2 }}>sincronizando a cada 5s</div>
                    </div>
                  )
                  if (req.status === 'denied') return (
                    <div>
                      <div style={{ fontSize: 11, color: '#f87171', fontWeight: 700 }}>❌ Cancelamento negado por {req.resolvedBy}</div>
                      <button onClick={() => setPendingCancelId(null)} style={{ marginTop: 4, fontSize: 9, background: 'none', border: 'none', color: txt2, cursor: 'pointer', textDecoration: 'underline' }}>Fechar</button>
                    </div>
                  )
                  return <div style={{ fontSize: 11, color: '#4ade80', fontWeight: 700 }}>✅ Aprovado — cancelando…</div>
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fechar caixa */}
      {showClose && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.92)' }}>
          <div style={{ background: bg2, border: `1px solid ${brd}`, borderRadius: 14, padding: 26, width: '100%', maxWidth: 340, textAlign: 'center', boxShadow: '0 24px 80px rgba(0,0,0,.9)' }} className="animate-pop">
            <div style={{ fontWeight: 900, fontSize: 18, color: txt, marginBottom: 5 }}>Fechar Caixa?</div>
            <div style={{ color: txt2, fontSize: 12, marginBottom: 14 }}>Operador: <strong style={{ color: '#a5b4fc' }}>{activeOperator?.name}</strong></div>
            <div style={{ background: bg3, borderRadius: 9, padding: '11px 14px', marginBottom: 18, border: `1px solid ${brd}`, textAlign: 'left' }}>
              <div style={{ color: txt2, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, marginBottom: 5 }}>RESUMO DO TURNO</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: txt2, fontSize: 11 }}>Vendas hoje</span>
                <span style={{ color: txt, fontWeight: 800, fontFamily: 'monospace' }}>{todaySales}</span>
              </div>
              {cart.length > 0 && <div style={{ color: '#fbbf24', fontSize: 10, marginTop: 5 }}>⚠ {cart.length} item(s) no carrinho serão descartados</div>}
            </div>
            <div style={{ display: 'flex', gap: 7 }}>
              <button onClick={() => setShowClose(false)} style={{ flex: 1, padding: '11px', borderRadius: 9, background: bg3, border: `1px solid ${brd}`, color: txt2, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={() => { setCart([]); closeCaixa() }} style={{ flex: 1, padding: '11px', borderRadius: 9, background: '#7f1d1d', border: 'none', color: '#fff', fontWeight: 900, fontSize: 13, cursor: 'pointer' }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── OPERATOR LOCK SCREEN ───────────────────────────── */}
      {!activeOperator && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <style>{`@keyframes pinShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}`}</style>

          {/* header bar */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22px', background: bg2, borderBottom: `1px solid ${brd}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              {logoImage && <img src={logoImage} alt="logo" style={{ height: 22, maxWidth: 66, objectFit: 'contain' }} />}
              <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 15, color: acc }}>{_storeName}</span>
            </div>
            <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 900, color: txt }}>{timeStr}<span style={{ color: txt2, fontWeight: 400 }}> · {dateStr}</span></span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🔒</div>
              <div style={{ fontWeight: 900, fontSize: 18, color: txt, letterSpacing: 1 }}>
                {pinTarget ? `PIN — ${pinTarget.name}` : 'SELECIONAR OPERADOR'}
              </div>
              <div style={{ color: txt2, fontSize: 11, marginTop: 3 }}>
                {pinTarget ? 'Digite o PIN de acesso' : 'Clique no seu nome para entrar'}
              </div>
            </div>

            {!pinTarget ? (
              caixaOps.length === 0 ? (
                <div style={{ textAlign: 'center', color: txt2, fontSize: 13 }}>
                  Nenhum operador cadastrado.<br />
                  <a href="/configuracoes" style={{ color: acc, fontWeight: 700 }}>Cadastrar em Configurações</a>
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', maxWidth: 480 }}>
                  {caixaOps.map(op => (
                    <button key={op.id} onClick={() => selectOperator(op)}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: '16px 22px', borderRadius: 12, background: bg2, border: `1.5px solid ${brd}`, cursor: 'pointer', minWidth: 100 }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = acc; e.currentTarget.style.background = bg3 }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = brd; e.currentTarget.style.background = bg2 }}>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: acc + '20', border: `2px solid ${acc}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, color: acc }}>
                        {op.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 12, color: txt, textAlign: 'center' }}>{op.name}</div>
                      <div style={{ fontSize: 8, color: op.pin ? txt2 : '#4ade80', fontWeight: 700 }}>{op.pin ? '🔐 PIN' : '✓ LIVRE'}</div>
                    </button>
                  ))}
                </div>
              )
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }} key={pinTarget.id}>
                <div style={{ display: 'flex', gap: 9, animation: pinError ? 'pinShake .4s ease' : 'none' }}>
                  {Array.from({ length: Math.max(pinTarget.pin.length, 4) }).map((_, i) => (
                    <div key={i} style={{ width: 13, height: 13, borderRadius: '50%', background: i < pinInput.length ? acc : bg3, border: `2px solid ${i < pinInput.length ? acc : brd}`, transition: 'background .1s' }} />
                  ))}
                </div>
                {pinError && <div style={{ color: '#f87171', fontSize: 11, fontWeight: 700 }}>PIN incorreto</div>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7, width: 222 }}>
                  {[1,2,3,4,5,6,7,8,9,'✓',0,'⌫'].map((k, i) => {
                    const isEnter = k === '✓'; const isDel = k === '⌫'
                    return (
                      <button key={i}
                        onClick={() => {
                          if (isDel) { setPinInput(p => p.slice(0,-1)); return }
                          if (isEnter) {
                            if (!pinInput) return
                            if (pinInput === pinTarget.pin) { setActiveOperator(pinTarget); setPinTarget(null); setPinInput('') }
                            else { setPinError(true); setPinInput(''); setTimeout(() => setPinError(false), 1200) }
                            return
                          }
                          const next = pinInput + k; setPinInput(next)
                          if (next.length >= pinTarget.pin.length) setTimeout(() => {
                            if (next === pinTarget.pin) { setActiveOperator(pinTarget); setPinTarget(null); setPinInput('') }
                            else { setPinError(true); setPinInput(''); setTimeout(() => setPinError(false), 1200) }
                          }, 120)
                        }}
                        style={{ height: 56, borderRadius: 11, border: `1.5px solid ${isEnter ? acc : brd}`, background: isEnter ? acc + '20' : bg2, color: isEnter ? acc : txt, fontSize: isDel ? 17 : isEnter ? 20 : 19, fontWeight: 900, cursor: 'pointer' }}
                        onMouseEnter={e => { e.currentTarget.style.background = bg3; e.currentTarget.style.borderColor = acc }}
                        onMouseLeave={e => { e.currentTarget.style.background = isEnter ? acc + '20' : bg2; e.currentTarget.style.borderColor = isEnter ? acc : brd }}>
                        {k}
                      </button>
                    )
                  })}
                </div>
                <button onClick={() => { setPinTarget(null); setPinInput('') }} style={{ background: 'none', border: 'none', color: txt2, fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}>← Voltar</button>
              </div>
            )}

            {!isStandalone && (
              <a href="/pdv" style={{ color: txt2, fontSize: 10, textDecoration: 'none', opacity: 0.35 }}>← Painel Admin</a>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
