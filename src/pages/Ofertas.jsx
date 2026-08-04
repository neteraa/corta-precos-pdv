/**
 * /ofertas — Mercado recebe e aceita ofertas do fornecedor
 */
import React, { useState, useEffect, useMemo } from 'react'
import { Truck, Package, Check, X, Clock, ChevronDown, ChevronUp,
         Filter, RefreshCw, ShoppingCart, AlertTriangle, CheckCircle,
         Phone, MessageCircle, Star, ClipboardList, CircleDollarSign,
         MapPin, CalendarClock } from 'lucide-react'
import { useStore, BRL, fmtDate } from '../store.jsx'

const OFFERS_KEY   = 'cp_supplier_offers'
const ESTOQUE_KEY  = 'cp_fornecedor_estoque'
const ORDERS_KEY   = 'cp_supplier_orders'
const API_PERSIST  = '/api/persist'
const API_RESTORE  = '/api/restore'

const PAYMENT_OPTS = [
  { id: 'pix',      label: 'PIX',         emoji: '⚡', color: '#10b981' },
  { id: 'dinheiro', label: 'Dinheiro',     emoji: '💵', color: '#3b82f6' },
  { id: 'boleto',   label: 'Boleto',       emoji: '📄', color: '#f59e0b' },
  { id: 'prazo30',  label: 'Prazo 30d',    emoji: '📅', color: '#8b5cf6' },
  { id: 'prazo60',  label: 'Prazo 60d',    emoji: '📅', color: '#ec4899' },
  { id: 'cartao',   label: 'Cartão',       emoji: '💳', color: '#06b6d4' },
]

const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
const cleanPhone = p => '55' + (p || '').replace(/\D/g, '').replace(/^0/, '').slice(-11)

async function saveOrders(orders) {
  await fetch(API_PERSIST, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: ORDERS_KEY, value: JSON.stringify(orders) }),
  }).catch(() => {})
}

async function reduceSupplierStock(offer) {
  try {
    const r = await fetch(API_RESTORE)
    const j = await r.json()
    const raw = j?.data?.[ESTOQUE_KEY]
    if (!raw) return
    const estoque = JSON.parse(raw)
    const idx = estoque.findIndex(e =>
      (offer.stockItemId && e.id === offer.stockItemId) ||
      (offer.sku && e.sku === offer.sku) ||
      e.productName?.toLowerCase() === offer.productName?.toLowerCase()
    )
    if (idx < 0) return
    const next = estoque.map((e, i) => i === idx
      ? { ...e, qty: Math.max(0, e.qty - offer.qty), updatedAt: new Date().toISOString() }
      : e
    )
    await fetch(API_PERSIST, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: ESTOQUE_KEY, value: JSON.stringify(next) }),
    })
  } catch {}
}

/* ── helpers ────────────────────────────────────────────────── */
const daysUntil = iso => iso ? Math.ceil((new Date(iso + 'T00:00') - Date.now()) / 86400000) : null

function expiryInfo(iso) {
  const d = daysUntil(iso)
  if (d === null) return null
  if (d < 0)   return { label: 'VENCIDO',         cls: 'text-red-400',    bg: 'bg-red-900/40',   border: 'border-red-800' }
  if (d <= 7)  return { label: `Vence em ${d}d`,   cls: 'text-orange-400', bg: 'bg-orange-900/40',border: 'border-orange-800' }
  if (d <= 30) return { label: `Vence em ${d} dias`,cls: 'text-yellow-400',bg: 'bg-yellow-900/30',border: 'border-yellow-800' }
  return            { label: `Vence em ${d} dias`, cls: 'text-green-400',  bg: 'bg-green-900/20', border: 'border-green-900' }
}

async function loadOffers() {
  try {
    const r = await fetch(API_RESTORE)
    const j = await r.json()
    const raw = j?.data?.[OFFERS_KEY]
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

async function saveOffers(offers) {
  await fetch(API_PERSIST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: OFFERS_KEY, value: JSON.stringify(offers) }),
  })
}

/* ── OfferCard ──────────────────────────────────────────────── */
function OfferCard({ offer, onAccept, onReject, onReceive, onPedido, accepting }) {
  const [expanded, setExpanded] = useState(false)
  const expiry   = expiryInfo(offer.expiryDate)
  const accepted = offer.status === 'accepted'
  const rejected = offer.status === 'rejected'
  const received = offer.status === 'received'
  const isPending = offer.status === 'pending'
  const isOpp = offer.isOpportunity

  return (
    <div className={`rounded-2xl border mb-4 overflow-hidden transition-all ${
      isOpp ? 'border-amber-700/60' : 'border-gray-800'
    } ${rejected ? 'opacity-50' : ''}`}
      style={{ background: isOpp ? '#1a1200' : '#111827' }}>

      {isOpp && (
        <div className="flex items-center gap-2 px-4 py-2 text-xs font-black text-amber-300"
          style={{ background: 'linear-gradient(90deg,#78350f,#92400e)' }}>
          🔥 OPORTUNIDADE — Produto com oferta especial!
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center ${
            isOpp ? 'bg-amber-900/50' : 'bg-gray-800'
          }`}>
            <Package size={22} className={isOpp ? 'text-amber-400' : 'text-emerald-400'} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="text-white font-bold text-[15px] leading-tight truncate">
              {offer.productName}
            </div>
            {offer.sku && (
              <div className="text-gray-500 text-[11px] font-mono mt-0.5">{offer.sku}</div>
            )}
            <div className="flex flex-wrap gap-2 mt-2 items-center">
              <span className="text-emerald-400 font-black text-lg">{BRL.format(offer.offerPrice)}</span>
              <span className="text-xs font-bold text-gray-500">/un</span>
              <span className="bg-gray-800 text-blue-300 text-[11px] font-bold px-2 py-0.5 rounded-lg">
                {offer.qty} {offer.unit}
              </span>
              {expiry && (
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${expiry.bg} ${expiry.cls} border ${expiry.border}`}>
                  📅 {expiry.label}
                </span>
              )}
            </div>
          </div>

          {/* Status badge */}
          <div className="flex-shrink-0">
            {accepted && <span className="text-[11px] font-black text-emerald-400 bg-emerald-900/40 px-2 py-1 rounded-lg">✓ Aceita</span>}
            {received && <span className="text-[11px] font-black text-blue-400 bg-blue-900/40 px-2 py-1 rounded-lg">✓ Recebida</span>}
            {rejected && <span className="text-[11px] font-black text-red-400 bg-red-900/40 px-2 py-1 rounded-lg">✗ Recusada</span>}
          </div>
        </div>

        {/* Supplier + date */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-800">
          <div className="flex items-center gap-2">
            <Truck size={13} className="text-gray-500" />
            <span className="text-gray-400 text-xs font-semibold">{offer.supplierName}</span>
          </div>
          <button onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1 text-gray-500 text-[11px]">
            {new Date(offer.publishedAt).toLocaleString('pt-BR', { day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit' })}
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>

        {/* Expanded note */}
        {expanded && offer.note && (
          <div className="mt-3 bg-gray-800/50 rounded-xl p-3">
            <div className="text-gray-400 text-xs font-bold mb-1">💬 OBSERVAÇÃO</div>
            <div className="text-gray-300 text-sm italic">{offer.note}</div>
          </div>
        )}

        {/* Value calc */}
        {expanded && (
          <div className="mt-3 bg-gray-800/30 rounded-xl p-3 grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-emerald-400 font-black text-base">{BRL.format(offer.offerPrice)}</div>
              <div className="text-gray-500 text-[10px]">por unidade</div>
            </div>
            <div>
              <div className="text-blue-400 font-black text-base">{offer.qty} {offer.unit}</div>
              <div className="text-gray-500 text-[10px]">disponível</div>
            </div>
            <div>
              <div className="text-amber-400 font-black text-base">
                {BRL.format(offer.offerPrice * offer.qty)}
              </div>
              <div className="text-gray-500 text-[10px]">total lote</div>
            </div>
          </div>
        )}

        {/* Actions */}
        {isPending && (
          <div className="flex flex-col gap-2 mt-4">
            {/* Fazer Pedido — primary CTA */}
            <button
              onClick={() => onPedido && onPedido(offer)}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-black text-sm text-white transition-all"
              style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
              <ClipboardList size={16} />
              Fazer Pedido (qty + pagamento)
            </button>
            {/* Aceitar lote inteiro */}
            <div className="flex gap-2">
              <button
                onClick={() => onAccept(offer)}
                disabled={accepting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs text-emerald-300 border border-emerald-800 bg-emerald-900/30 transition-all"
                style={{ opacity: accepting ? 0.6 : 1 }}>
                <Check size={13} />
                Aceitar Lote Inteiro ({offer.qty} {offer.unit})
              </button>
              <button
                onClick={() => onReject(offer.id)}
                className="px-3 py-2.5 rounded-xl font-bold text-xs text-gray-400 bg-gray-800 hover:bg-gray-700 transition-all">
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {accepted && (
          <div className="mt-3 flex items-center justify-between bg-emerald-900/30 border border-emerald-800 rounded-xl px-3 py-2.5">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
              <CheckCircle size={14} />
              Estoque atualizado automaticamente
            </div>
            <a href="/estoque" className="text-[11px] text-blue-400 underline">Ver estoque →</a>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── PedidoModal ────────────────────────────────────────────── */
function PedidoModal({ offer, onClose, onConfirm }) {
  const [qty,          setQty]          = useState('')
  const [payment,      setPayment]      = useState('pix')
  const [deliveryType, setDeliveryType] = useState('entrega')  // 'entrega' | 'retirada'
  const [address,      setAddress]      = useState('')
  const [schedDate,    setSchedDate]    = useState('')
  const [schedTime,    setSchedTime]    = useState('')
  const [note,         setNote]         = useState('')
  const [loading,      setLoading]      = useState(false)

  const maxQty   = offer.qty
  const qtyNum   = parseFloat(qty) || 0
  const total    = qtyNum * offer.offerPrice
  const canPlace = qtyNum > 0 && qtyNum <= maxQty

  async function handleConfirm() {
    if (!canPlace) return
    setLoading(true)
    await onConfirm({
      offerId: offer.id,
      productName: offer.productName,
      sku: offer.sku,
      unit: offer.unit,
      supplierName: offer.supplierName,
      supplierPhone: offer.supplierPhone || '',
      qtyRequested: qtyNum,
      offerPrice: offer.offerPrice,
      totalPrice: total,
      paymentMethod: payment,
      deliveryType,
      address: deliveryType === 'entrega' ? address.trim() : '',
      schedDate,
      schedTime,
      note: note.trim(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    })
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center p-0">
      <div className="w-full max-w-lg bg-gray-900 rounded-t-3xl border-t border-gray-700 p-6 pb-10"
        style={{ maxHeight: '92dvh', overflowY: 'auto' }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-white font-black text-xl">Fazer Pedido</div>
            <div className="text-emerald-400 font-bold text-sm mt-0.5 truncate">{offer.productName}</div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-gray-800 flex items-center justify-center">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Price info */}
        <div className="bg-gray-800/60 rounded-2xl p-4 mb-5 grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-emerald-400 font-black text-lg">{BRL.format(offer.offerPrice)}</div>
            <div className="text-gray-500 text-[11px]">por {offer.unit}</div>
          </div>
          <div>
            <div className="text-blue-400 font-black text-lg">{offer.qty} {offer.unit}</div>
            <div className="text-gray-500 text-[11px]">disponível</div>
          </div>
          <div>
            <div className="text-amber-400 font-black text-lg">
              {qtyNum > 0 ? BRL.format(total) : '—'}
            </div>
            <div className="text-gray-500 text-[11px]">seu total</div>
          </div>
        </div>

        {/* Qty */}
        <label className="block text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">
          Quantidade que você quer ({offer.unit})
        </label>
        <input
          type="number" value={qty} onChange={e => setQty(e.target.value)}
          min="1" max={maxQty} placeholder={`Máx: ${maxQty} ${offer.unit}`}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-4 text-white text-2xl font-black text-center mb-1 outline-none focus:border-emerald-500"
        />
        {qtyNum > maxQty && (
          <div className="text-red-400 text-xs font-bold mb-3">⚠ Máximo disponível: {maxQty} {offer.unit}</div>
        )}
        {/* Quick qty buttons */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {[1, 5, 10, 25, 50].filter(n => n <= maxQty).map(n => (
            <button key={n} onClick={() => setQty(String(n))}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-all ${
                qtyNum === n ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
              }`}>
              {n}
            </button>
          ))}
          <button onClick={() => setQty(String(maxQty))}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-all ${
              qtyNum === maxQty ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
            }`}>
            Tudo ({maxQty})
          </button>
        </div>

        {/* Payment */}
        <label className="block text-gray-400 text-xs font-bold uppercase tracking-widest mb-3">
          Forma de Pagamento
        </label>
        <div className="grid grid-cols-3 gap-2 mb-5">
          {PAYMENT_OPTS.map(p => (
            <button key={p.id} onClick={() => setPayment(p.id)}
              className={`rounded-xl py-3 font-bold text-sm flex flex-col items-center gap-1 border transition-all ${
                payment === p.id
                  ? 'border-emerald-500 bg-emerald-900/40 text-white'
                  : 'border-gray-700 bg-gray-800 text-gray-400'
              }`}>
              <span className="text-xl">{p.emoji}</span>
              <span className="text-xs font-black">{p.label}</span>
            </button>
          ))}
        </div>

        {/* Delivery / Pickup */}
        <label className="block text-gray-400 text-xs font-bold uppercase tracking-widest mb-3">
          Entrega ou Retirada?
        </label>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {[
            { id: 'entrega',  icon: '🚚', label: 'Entrega',  sub: 'Fornecedor entrega' },
            { id: 'retirada', icon: '📦', label: 'Retirada', sub: 'Busco no fornecedor' },
          ].map(o => (
            <button key={o.id} onClick={() => setDeliveryType(o.id)}
              className={`rounded-xl py-3 px-3 flex flex-col items-center gap-1 border transition-all ${
                deliveryType === o.id
                  ? 'border-emerald-500 bg-emerald-900/40 text-white'
                  : 'border-gray-700 bg-gray-800 text-gray-400'
              }`}>
              <span className="text-2xl">{o.icon}</span>
              <span className="text-xs font-black">{o.label}</span>
              <span className="text-[10px] text-gray-500">{o.sub}</span>
            </button>
          ))}
        </div>

        {deliveryType === 'entrega' && (
          <div className="mb-4">
            <label className="block text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">
              <MapPin size={11} className="inline mr-1" />Endereço de Entrega
            </label>
            <input value={address} onChange={e => setAddress(e.target.value)}
              placeholder="Ex: Rua das Flores 123, Centro"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-gray-300 text-sm mb-2 outline-none focus:border-emerald-500"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mb-5">
          <div>
            <label className="block text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">
              <CalendarClock size={11} className="inline mr-1" />
              {deliveryType === 'entrega' ? 'Data de Entrega' : 'Data de Retirada'}
            </label>
            <input type="date" value={schedDate} onChange={e => setSchedDate(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 text-gray-300 text-sm outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">
              Horário
            </label>
            <input type="time" value={schedTime} onChange={e => setSchedTime(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 text-gray-300 text-sm outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Note */}
        <label className="block text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">
          Observação (opcional)
        </label>
        <textarea value={note} onChange={e => setNote(e.target.value)}
          placeholder="Ex: Entrada pelos fundos, ligar antes..."
          rows={2}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-gray-300 text-sm mb-5 outline-none focus:border-emerald-500 resize-none"
        />

        {/* Confirm */}
        <button
          onClick={handleConfirm}
          disabled={!canPlace || loading}
          className="w-full py-4 rounded-2xl font-black text-lg text-white flex items-center justify-center gap-3 transition-all"
          style={{
            background: canPlace ? 'linear-gradient(135deg,#10b981,#059669)' : '#1f2937',
            opacity: loading ? 0.7 : 1,
          }}>
          <ClipboardList size={20} />
          {loading ? 'Enviando pedido...' : `Pedir ${qtyNum > 0 ? `${qtyNum} ${offer.unit}` : ''}${qtyNum > 0 ? ` · ${BRL.format(total)}` : ''}`}
        </button>

        {offer.supplierPhone && canPlace && (
          <div className="text-center text-gray-500 text-xs mt-3">
            📲 O fornecedor receberá seu pedido por WhatsApp
          </div>
        )}
      </div>
    </div>
  )
}

/* ── MAIN ───────────────────────────────────────────────────── */
export default function Ofertas() {
  const { upsertProduct, products }  = useStore()
  const storeSettings = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('cp_settings') || '{}') } catch { return {} }
  }, [])
  const storeName  = storeSettings.storeName  || 'Mercado'
  const storePhone = storeSettings.phone       || ''
  const [offers,      setOffers]     = useState([])
  const [loading,     setLoading]    = useState(true)
  const [accepting,   setAccepting]  = useState(false)
  const [filter,      setFilter]     = useState('all')
  const [toast,       setToast]      = useState(null)
  const [refreshAt,   setRefreshAt]  = useState(Date.now())
  const [pedidoOffer, setPedidoOffer] = useState(null)

  /* load */
  useEffect(() => {
    setLoading(true)
    loadOffers().then(o => { setOffers(o); setLoading(false) })
  }, [refreshAt])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  /* accept → update offer status + update market stock + reduce supplier stock */
  async function handleAccept(offer) {
    setAccepting(true)
    try {
      const updated = offers.map(o => o.id === offer.id ? { ...o, status: 'accepted', acceptedAt: new Date().toISOString() } : o)
      setOffers(updated)
      await saveOffers(updated)

      /* 1. reduce supplier stock (baixa automática no estoque do fornecedor) */
      await reduceSupplierStock(offer)

      /* 2. try to find product in market store and update stock */
      const existing = offer.productId ? products.find(p => p.id === offer.productId)
        : products.find(p => p.sku === offer.sku || p.name.toLowerCase() === offer.productName.toLowerCase())

      if (existing) {
        upsertProduct({
          ...existing,
          stock: (existing.stock || 0) + offer.qty,
          expiryDate: offer.expiryDate || existing.expiryDate,
          cost: offer.offerPrice,
        })
        showToast(`✅ ${offer.productName} — estoque atualizado! +${offer.qty} ${offer.unit}`)
      } else {
        showToast(`✅ Oferta aceita! Produto não encontrado no cadastro — confira em Estoque.`, 'warn')
      }
    } catch (e) {
      showToast('Erro ao aceitar oferta', 'error')
    }
    setAccepting(false)
  }

  /* reject */
  async function handleReject(id) {
    const updated = offers.map(o => o.id === id ? { ...o, status: 'rejected' } : o)
    setOffers(updated)
    await saveOffers(updated)
    showToast('Oferta recusada')
  }

  /* mark as received — show link, don't force navigate */
  function handleReceive(offer) {
    // noop — acceptance already updates stock automatically via upsertProduct
    // user can navigate to /estoque independently
  }

  /* place order → save to cp_supplier_orders + WhatsApp to supplier */
  async function handlePedido(orderData) {
    const order = { id: uid(), storeName, storePhone, ...orderData }
    try {
      const r   = await fetch(API_RESTORE)
      const j   = await r.json()
      const raw = j?.data?.[ORDERS_KEY]
      const existing = raw ? JSON.parse(raw) : []
      await saveOrders([order, ...existing])
    } catch {}

    /* open WhatsApp to supplier with full order details */
    const pay       = PAYMENT_OPTS.find(p => p.id === order.paymentMethod)
    const isEntrega = order.deliveryType !== 'retirada'
    const sched     = [order.schedDate, order.schedTime].filter(Boolean).join(' às ')
    const msg  = [
      `🛒 *NOVO PEDIDO — ${storeName || 'Mercado'}*`,
      ``,
      `📦 *${order.productName}*${order.sku ? ` (${order.sku})` : ''}`,
      `   Qtd: *${order.qtyRequested} ${order.unit}*`,
      `   Total: *${BRL.format(order.totalPrice)}*`,
      `   ${pay?.emoji || '💰'} Pagamento: *${pay?.label || order.paymentMethod}*`,
      ``,
      isEntrega
        ? `🚚 *ENTREGA* no mercado${order.address ? `\n   📍 ${order.address}` : ''}`
        : `📦 *RETIRADA* no fornecedor`,
      sched ? `   🕐 ${sched}` : '',
      order.note ? `\n💬 ${order.note}` : '',
      ``,
      `✅ Responda confirmando para confirmar`,
    ].filter(Boolean).join('\n')

    if (order.supplierPhone) {
      window.open(`https://wa.me/${cleanPhone(order.supplierPhone)}?text=${encodeURIComponent(msg)}`, '_blank')
    }

    setPedidoOffer(null)
    showToast(`✅ Pedido enviado! ${order.qtyRequested} ${order.unit} de ${order.productName}`)
  }

  /* filtered */
  const filtered = useMemo(() => {
    const sorted = [...offers].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    if (filter === 'pending')      return sorted.filter(o => o.status === 'pending')
    if (filter === 'accepted')     return sorted.filter(o => o.status === 'accepted')
    if (filter === 'opportunity')  return sorted.filter(o => o.isOpportunity)
    return sorted
  }, [offers, filter])

  const pendingCount     = offers.filter(o => o.status === 'pending').length
  const oppCount         = offers.filter(o => o.isOpportunity && o.status === 'pending').length

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-8 relative">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-4 right-4 z-50 rounded-xl px-4 py-3 font-bold text-sm shadow-2xl ${
          toast.type === 'error' ? 'bg-red-600' : toast.type === 'warn' ? 'bg-amber-600' : 'bg-emerald-600'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-5 py-4 sticky top-0 z-30">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-white font-black text-xl flex items-center gap-2">
              <Truck size={20} className="text-emerald-400" />
              Ofertas do Fornecedor
            </h1>
            <p className="text-gray-500 text-xs mt-0.5">
              {pendingCount > 0
                ? <span className="text-emerald-400 font-bold">{pendingCount} nova{pendingCount > 1 ? 's' : ''} aguardando</span>
                : 'Nenhuma oferta pendente'}
            </p>
          </div>
          <button onClick={() => setRefreshAt(Date.now())}
            className="p-2.5 bg-gray-800 rounded-xl hover:bg-gray-700 transition-all">
            <RefreshCw size={16} className="text-gray-400" />
          </button>
        </div>

        {/* Alert banners */}
        {pendingCount > 0 && (
          <div className="bg-emerald-900/40 border border-emerald-700/50 rounded-xl px-3 py-2.5 flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-900 flex items-center justify-center flex-shrink-0">
              <Truck size={15} className="text-emerald-400" />
            </div>
            <div>
              <div className="text-emerald-300 font-black text-sm">
                {pendingCount} oferta{pendingCount > 1 ? 's' : ''} aguardando resposta
              </div>
              <div className="text-emerald-600 text-xs">Aceite para atualizar o estoque automaticamente</div>
            </div>
          </div>
        )}
        {oppCount > 0 && (
          <div className="bg-amber-900/30 border border-amber-700/50 rounded-xl px-3 py-2.5 flex items-center gap-3">
            <span className="text-xl">🔥</span>
            <div>
              <div className="text-amber-300 font-black text-sm">
                {oppCount} oportunidade{oppCount > 1 ? 's' : ''} especial{oppCount > 1 ? 'is' : ''}!
              </div>
              <div className="text-amber-700 text-xs">Produtos com oferta ou validade próxima</div>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="px-5 py-3 flex gap-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'all',         label: `Todas (${offers.length})` },
          { id: 'pending',     label: `Pendentes (${pendingCount})` },
          { id: 'accepted',    label: 'Aceitas' },
          { id: 'opportunity', label: '🔥 Oportunidade' },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 ${
              filter === f.id
                ? 'bg-emerald-500 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-5">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-600">
            <RefreshCw size={28} className="animate-spin mb-3" />
            <div className="text-sm">Carregando ofertas...</div>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Package size={48} className="text-gray-800 mb-4" />
            <div className="text-gray-500 font-bold text-base">Nenhuma oferta encontrada</div>
            <div className="text-gray-700 text-sm mt-1">
              {filter === 'all'
                ? 'Quando um fornecedor publicar uma oferta, ela aparecerá aqui'
                : 'Tente outro filtro'}
            </div>
          </div>
        )}

        {!loading && filtered.map(offer => (
          <OfferCard
            key={offer.id}
            offer={offer}
            onAccept={handleAccept}
            onReject={handleReject}
            onReceive={handleReceive}
            onPedido={setPedidoOffer}
            accepting={accepting}
          />
        ))}
      </div>

      {/* Pedido Modal */}
      {pedidoOffer && (
        <PedidoModal
          offer={pedidoOffer}
          onClose={() => setPedidoOffer(null)}
          onConfirm={handlePedido}
        />
      )}

      {/* Info footer */}
      {!loading && offers.length > 0 && (
        <div className="px-5 mt-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-gray-500 text-xs font-bold mb-1">📲 LINK PARA O FORNECEDOR</div>
            <div className="bg-gray-800 rounded-lg px-3 py-2 text-emerald-400 text-xs font-mono">
              corta-precos-pdv.netlify.app/fornecedor
            </div>
            <div className="text-gray-600 text-[11px] mt-2">
              Envie este link para o fornecedor publicar ofertas diretamente pelo celular
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
