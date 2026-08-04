/**
 * /fornecedor — Portal do Fornecedor (Sistema Independente)
 * Vendido separadamente para distribuidoras/fornecedores.
 * Fluxo: carreta chega -> escaneia -> estoque proprio -> dispara pra mercados -> baixa automatica ao aceite.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Truck, Package, Users, Plus, Camera, Search, Check, Trash2, X,
  MessageCircle, LayoutDashboard, ClipboardList, ArrowDownToLine,
  ShoppingCart, TrendingUp, Boxes, CircleDollarSign, CheckCircle,
  RefreshCw, Phone, Send, MapPin, Zap, ChevronDown, ChevronUp,
} from 'lucide-react'
import CameraScanner from '../components/CameraScanner.jsx'
import PRODUCTS_SEED from '../utils/products_seed.json'

const BRL         = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const LOCAL       = 'cp_fornecedor_v1'
const OFFERS_KEY  = 'cp_supplier_offers'
const ESTOQUE_KEY = 'cp_fornecedor_estoque'
const ORDERS_KEY  = 'cp_supplier_orders'
const MKTS_KEY    = LOCAL + '_markets'
const MKTS_SERVER_KEY = 'cp_distribuidor_markets'  // server-side persistence (cross-device)
const API_PERSIST = '/api/persist'
const API_RESTORE = '/api/restore'
const UNITS       = ['CX', 'UND', 'FD', 'KG', 'LT', 'PC', 'DZ', 'SC']

const PAYMENT_INFO = {
  pix:      { emoji: '⚡', label: 'PIX',       color: '#10b981' },
  dinheiro: { emoji: '💵', label: 'Dinheiro',  color: '#3b82f6' },
  boleto:   { emoji: '📄', label: 'Boleto',    color: '#f59e0b' },
  prazo30:  { emoji: '📅', label: 'Prazo 30d', color: '#8b5cf6' },
  prazo60:  { emoji: '📅', label: 'Prazo 60d', color: '#ec4899' },
  cartao:   { emoji: '💳', label: 'Cartao',    color: '#06b6d4' },
}

const SKU_MAP = Object.fromEntries(
  PRODUCTS_SEED.filter(p => p.sku && p.sku.length > 3).map(p => [p.sku, p])
)

const cleanPhone  = p => '55' + (p || '').replace(/\D/g, '').replace(/^0/, '').slice(-11)
const fmtDate     = iso => iso ? new Date(iso + 'T00:00').toLocaleDateString('pt-BR') : '-'
const fmtDT       = dt  => new Date(dt).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })
const uid         = () => `${Date.now()}_${Math.random().toString(36).slice(2,6)}`
const today       = () => new Date().toISOString().slice(0, 10)
const parseNum    = s  => parseFloat((s || '0').replace(',', '.')) || 0

async function persistKey(key, value) {
  try {
    await fetch(API_PERSIST, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value: JSON.stringify(value) }),
    })
  } catch {}
}

async function fetchAll() {
  try {
    const r = await fetch(API_RESTORE)
    const { data } = await r.json()
    return {
      estoque:  data?.[ESTOQUE_KEY]    ? JSON.parse(data[ESTOQUE_KEY])    : [],
      offers:   data?.[OFFERS_KEY]     ? JSON.parse(data[OFFERS_KEY])     : [],
      orders:   data?.[ORDERS_KEY]     ? JSON.parse(data[ORDERS_KEY])     : [],
      markets:  data?.[MKTS_SERVER_KEY]? JSON.parse(data[MKTS_SERVER_KEY]): null, // null = not on server yet
    }
  } catch { return { estoque: [], offers: [], orders: [], markets: null } }
}

function buildOfferMsg(offer, supplierName, supplierPhone) {
  const urgente = offer.expiryDate
    ? (() => { const d = Math.ceil((new Date(offer.expiryDate) - new Date()) / 86400000); return d > 0 && d <= 14 })()
    : false
  const lines = [
    offer.isOpportunity
      ? '🔥 *QUEIMA DE ESTOQUE — ' + supplierName + '*'
      : '🚚 *CHEGOU MERCADORIA — ' + supplierName + '*',
    '',
    '📦 *' + offer.productName + '*',
    offer.sku ? '   Cód: ' + offer.sku : '',
    '',
    '💰 *' + BRL.format(offer.offerPrice) + '/un*',
    '📦 ' + offer.qty + ' ' + offer.unit + ' disponíveis',
    offer.expiryDate ? '📅 Validade: ' + fmtDate(offer.expiryDate) + (urgente ? ' ⚠️ URGENTE' : '') : '',
    offer.note ? '💬 ' + offer.note : '',
    '',
    '👉 *Fazer pedido agora:*',
    'https://corta-precos-pdv.netlify.app/ofertas',
    '',
    supplierPhone ? '📞 ' + supplierName + ' · ' + supplierPhone : '📞 ' + supplierName,
  ]
  return lines.filter(l => l !== null && l !== undefined).join('\n')
}

/* ── Btn ────────────────────────────────────────────────────── */
function Btn({ onClick, children, disabled, secondary, danger, full, sm }) {
  return (
    <button onClick={disabled ? undefined : onClick} style={{
      display:'flex', alignItems:'center', justifyContent:'center', gap:8,
      padding: sm ? '10px 16px' : '14px 20px', borderRadius:14, border:'none',
      cursor: disabled ? 'not-allowed' : 'pointer', fontWeight:900,
      fontSize: sm ? 13 : 15, width: full ? '100%' : 'auto', opacity: disabled ? 0.45 : 1,
      background: danger ? '#ef4444' : secondary ? 'rgba(16,185,129,0.12)' : 'linear-gradient(135deg,#10b981,#059669)',
      color: danger ? '#fff' : secondary ? '#10b981' : '#fff',
      border: secondary ? '1px solid rgba(16,185,129,0.3)' : 'none',
    }}>{children}</button>
  )
}

/* ── StatCard ───────────────────────────────────────────────── */
function StatCard({ icon: Icon, label, value, sub, color='#10b981' }) {
  return (
    <div style={{ background:'#0d2137', borderRadius:16, padding:16, border:'1px solid #1a3a50', flex:1, minWidth:0 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
        <div style={{ width:32, height:32, borderRadius:10, background:color+'22', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon size={16} color={color} />
        </div>
        <span style={{ color:'#64748b', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</span>
      </div>
      <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:22, lineHeight:1 }}>{value}</div>
      {sub && <div style={{ color:'#475569', fontSize:11, marginTop:4 }}>{sub}</div>}
    </div>
  )
}

/* ── ProductSearch ──────────────────────────────────────────── */
function ProductSearch({ onSelect }) {
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState([])
  const [scan,    setScan]    = useState(false)

  const search = q => {
    setQuery(q)
    if (!q || q.length < 2) { setResults([]); return }
    const ql = q.toLowerCase()
    const hits = SKU_MAP[q]
      ? [SKU_MAP[q]]
      : PRODUCTS_SEED.filter(p => p.name?.toLowerCase().includes(ql) || p.sku?.includes(q)).slice(0, 8)
    setResults(hits)
  }

  const pick = p => { setQuery(''); setResults([]); onSelect(p) }

  return (
    <div style={{ position:'relative' }}>
      {scan && (
        <div style={{ position:'fixed', inset:0, zIndex:999, background:'#000' }}>
          <CameraScanner onDetected={sku => { setScan(false); search(sku) }} onClose={() => setScan(false)} />
        </div>
      )}
      <div style={{ display:'flex', gap:8 }}>
        <div style={{ position:'relative', flex:1 }}>
          <Search size={15} color="#475569" style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)' }} />
          <input value={query} onChange={e => search(e.target.value)} placeholder="Buscar produto ou escanear codigo..."
            style={{ width:'100%', background:'#0d2137', border:'1px solid #1e4060', borderRadius:12, padding:'12px 12px 12px 36px', color:'#e2e8f0', fontSize:14, boxSizing:'border-box', outline:'none' }}
          />
        </div>
        <button onClick={() => setScan(true)} style={{ background:'#0d2137', border:'1px solid #1e4060', borderRadius:12, padding:'0 14px', cursor:'pointer', display:'flex', alignItems:'center' }}>
          <Camera size={18} color="#10b981" />
        </button>
      </div>
      {results.length > 0 && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:100, background:'#0a1929', border:'1px solid #1e4060', borderRadius:12, marginTop:4, maxHeight:260, overflowY:'auto' }}>
          {results.map(p => (
            <button key={p.id} onClick={() => pick(p)} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', padding:'12px 14px', background:'transparent', border:'none', borderBottom:'1px solid #1a3a50', cursor:'pointer', textAlign:'left' }}>
              <div>
                <div style={{ color:'#e2e8f0', fontWeight:700, fontSize:13 }}>{p.name}</div>
                <div style={{ color:'#475569', fontSize:11, fontFamily:'monospace' }}>{p.sku}</div>
              </div>
              {p.price != null && <span style={{ color:'#10b981', fontWeight:900, fontSize:14, flexShrink:0 }}>{BRL.format(p.price)}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── WaOverlay ──────────────────────────────────────────────── */
function WaOverlay({ offer, markets, supplierName, supplierPhone, orders = [], onClose }) {
  const msg = buildOfferMsg(offer, supplierName, supplierPhone)

  function marketStats(m) {
    const mOrders = orders.filter(o =>
      (o.storePhone && cleanPhone(o.storePhone) === cleanPhone(m.phone)) ||
      (o.storeName  && o.storeName.toLowerCase() === m.name.toLowerCase())
    )
    const total   = mOrders.reduce((s, o) => s + (o.totalPrice || 0), 0)
    const last    = mOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
    const daysAgo = last ? Math.floor((Date.now() - new Date(last.createdAt)) / 86400000) : null
    return { count: mOrders.length, total, daysAgo, lastProduct: last?.productName }
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.88)', display:'flex', flexDirection:'column', padding:20, overflowY:'auto' }}>
      <div style={{ background:'#0a1929', borderRadius:24, padding:'24px 20px', width:'100%', maxWidth:420, margin:'auto' }}>

        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:20 }}>
          <div style={{ width:52, height:52, borderRadius:16, background:'#14532d', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 10px' }}>
            <CheckCircle size={26} color="#4ade80" />
          </div>
          <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:19 }}>Oferta Publicada! 🎉</div>
          <div style={{ color:'#10b981', fontSize:13, marginTop:4 }}>Toque em cada mercado para abrir o WhatsApp</div>
        </div>

        {/* Offer summary pill */}
        <div style={{ background:'#0d2137', borderRadius:14, padding:'10px 14px', marginBottom:16, display:'flex', gap:10, alignItems:'center' }}>
          <Package size={16} color="#10b981" style={{ flexShrink:0 }} />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ color:'#f1f5f9', fontWeight:800, fontSize:13, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{offer.productName}</div>
            <div style={{ color:'#10b981', fontSize:12, fontWeight:700 }}>{BRL.format(offer.offerPrice)}/un · {offer.qty} {offer.unit} · Total: {BRL.format(offer.offerPrice * offer.qty)}</div>
          </div>
          {offer.expiryDate && (
            <div style={{ background:'#7c2d12', borderRadius:8, padding:'3px 8px', color:'#fed7aa', fontSize:10, fontWeight:700, flexShrink:0 }}>
              📅 {offer.expiryDate}
            </div>
          )}
        </div>

        {/* Markets list */}
        {markets.length === 0
          ? (
            <div style={{ background:'#0d2137', borderRadius:14, padding:24, textAlign:'center', marginBottom:12 }}>
              <Users size={28} color="#1e4060" style={{ marginBottom:8 }} />
              <div style={{ color:'#475569', fontSize:13, marginBottom:8 }}>Nenhum mercado cadastrado</div>
              <div style={{ color:'#334155', fontSize:12 }}>Vá em "Mercados" e adicione seus clientes</div>
            </div>
          )
          : markets.map(m => {
            const st = marketStats(m)
            return (
              <a key={m.id} href={'https://wa.me/' + cleanPhone(m.phone) + '?text=' + encodeURIComponent(msg)} target="_blank" rel="noreferrer"
                style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', background:'#0d2137', borderRadius:14, border:'1px solid #1e4060', textDecoration:'none', marginBottom:8 }}>
                <div style={{ width:42, height:42, borderRadius:12, background:'linear-gradient(135deg,#0f4c35,#14532d)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:16, fontWeight:900, color:'#4ade80' }}>
                  {m.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ color:'#e2e8f0', fontWeight:800, fontSize:14, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{m.name}</div>
                  {m.contact && <div style={{ color:'#64748b', fontSize:11 }}>👤 {m.contact}</div>}
                  {st.count > 0
                    ? <div style={{ color:'#475569', fontSize:11, marginTop:2 }}>
                        {st.count} pedido{st.count !== 1 ? 's' : ''} · {BRL.format(st.total)}
                        {st.daysAgo !== null && ` · última: ${st.daysAgo === 0 ? 'hoje' : `${st.daysAgo}d atrás`}`}
                      </div>
                    : <div style={{ color:'#334155', fontSize:11, marginTop:2 }}>Nenhum pedido ainda</div>
                  }
                </div>
                <div style={{ background:'#14532d', borderRadius:10, padding:'6px 10px', flexShrink:0 }}>
                  <MessageCircle size={16} color="#4ade80" />
                </div>
              </a>
            )
          })
        }

        <div style={{ marginTop:12 }}><Btn full onClick={onClose}>✓ Pronto, fechar</Btn></div>
      </div>
    </div>
  )
}

/* ── BlastScreen ─────────────────────────────────────────────── */
/* Full-screen sequential WA dispatcher — one market at a time   */
function BlastScreen({ offer, markets, supplierName, supplierPhone, onDone }) {
  const [idx, setIdx] = useState(0)
  const valid  = (markets || []).filter(m => m.phone)
  const done   = idx >= valid.length
  const pct    = valid.length ? Math.round((idx / valid.length) * 100) : 100
  const curr   = valid[idx]
  const msg    = buildOfferMsg(offer, supplierName, supplierPhone)

  function sendCurrent() {
    if (!curr) return
    window.open(`https://wa.me/${cleanPhone(curr.phone)}?text=${encodeURIComponent(msg)}`, '_blank')
    setIdx(i => i + 1)
  }

  const btnBase = { border:'none', borderRadius:16, cursor:'pointer', fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center', gap:10 }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:300, background:'#050f1a', display:'flex', flexDirection:'column', padding:'env(safe-area-inset-top,24px) 24px 40px' }}>

      {/* Top bar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24, paddingTop:16 }}>
        <div>
          <div style={{ color:'#10b981', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em' }}>
            {done ? '✅ Concluído' : 'Disparando no WhatsApp'}
          </div>
          <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:22 }}>
            {done ? 'Todos notificados!' : `${idx} / ${valid.length} mercados`}
          </div>
        </div>
        <button onClick={onDone} style={{ background:'#0d2137', border:'1px solid #1e4060', borderRadius:12, padding:'8px 14px', color:'#64748b', fontSize:13, fontWeight:700, cursor:'pointer' }}>
          {done ? 'Fechar' : 'Pular tudo'}
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ background:'#0d2137', borderRadius:99, height:8, marginBottom:20, overflow:'hidden' }}>
        <div style={{ background: done ? '#10b981' : 'linear-gradient(90deg,#3b82f6,#10b981)', height:'100%', width:`${pct}%`, borderRadius:99, transition:'width 0.4s ease' }} />
      </div>

      {/* Offer summary */}
      <div style={{ background:'#0d2137', borderRadius:16, padding:'12px 16px', marginBottom:24, display:'flex', gap:12, alignItems:'center', border:'1px solid #1a3a50' }}>
        <div style={{ width:40, height:40, borderRadius:12, background:'#0a2540', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <Package size={18} color="#10b981" />
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ color:'#f1f5f9', fontWeight:800, fontSize:14, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{offer.productName}</div>
          <div style={{ color:'#10b981', fontSize:12, fontWeight:700 }}>{BRL.format(offer.offerPrice)}/un · {offer.qty} {offer.unit}</div>
        </div>
        {offer.expiryDate && (
          <div style={{ background:'#7c2d12', borderRadius:8, padding:'3px 8px', color:'#fed7aa', fontSize:10, fontWeight:700, flexShrink:0 }}>📅 {offer.expiryDate}</div>
        )}
      </div>

      {/* Main area */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:20 }}>
        {done ? (
          <>
            <div style={{ width:100, height:100, borderRadius:28, background:'linear-gradient(135deg,#14532d,#065f46)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <CheckCircle size={52} color="#4ade80" />
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ color:'#4ade80', fontWeight:900, fontSize:22, marginBottom:4 }}>{valid.length} mercado{valid.length !== 1 ? 's' : ''} notificado{valid.length !== 1 ? 's' : ''}!</div>
              <div style={{ color:'#475569', fontSize:14 }}>A oferta já está visível no portal de todos os mercados.</div>
            </div>
          </>
        ) : (
          <>
            {/* Market avatar */}
            <div style={{ width:96, height:96, borderRadius:28, background:'linear-gradient(135deg,#0f3460,#1e40af)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:40, fontWeight:900, color:'#93c5fd', boxShadow:'0 0 40px rgba(59,130,246,0.3)' }}>
              {curr?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:22, marginBottom:4 }}>{curr?.name}</div>
              {curr?.contact && <div style={{ color:'#64748b', fontSize:13 }}>👤 {curr.contact}</div>}
              {curr?.phone  && <div style={{ color:'#4ade80', fontSize:13, fontWeight:700, marginTop:2 }}>📞 {curr.phone}</div>}
              {curr?.address && <div style={{ color:'#475569', fontSize:12, marginTop:4 }}>📍 {curr.address}</div>}
            </div>
            {/* Send button */}
            <button onClick={sendCurrent}
              style={{ ...btnBase, width:'100%', maxWidth:340, background:'linear-gradient(135deg,#16a34a,#15803d)', padding:'18px 24px', fontSize:17, color:'#fff', boxShadow:'0 8px 32px rgba(16,185,129,0.4)' }}>
              <MessageCircle size={22} />
              Abrir WhatsApp — {curr?.name?.split(' ')[0]}
            </button>
            <button onClick={() => setIdx(i => i + 1)} style={{ background:'none', border:'none', color:'#334155', cursor:'pointer', fontSize:13, padding:8 }}>
              Pular este mercado →
            </button>
          </>
        )}
      </div>

      {/* Bottom close */}
      {done && (
        <button onClick={onDone}
          style={{ ...btnBase, width:'100%', background:'linear-gradient(135deg,#10b981,#059669)', padding:'16px', fontSize:16, color:'#fff', marginTop:8 }}>
          <Check size={20} /> Fechar — voltar ao início
        </button>
      )}
    </div>
  )
}

/* ── OfferCard ──────────────────────────────────────────────── */
function OfferCard({ offer, markets, supplierName, orders = [], onDelete, onUpdatePrice }) {
  const [showWa,    setShowWa]    = useState(false)
  const [editMode,  setEditMode]  = useState(false)
  const [newPrice,  setNewPrice]  = useState('')

  const daysLeft  = offer.expiryDate ? Math.ceil((new Date(offer.expiryDate) - new Date()) / 86400000) : null
  const expColor  = daysLeft == null ? null : daysLeft <= 0 ? '#ef4444' : daysLeft <= 7 ? '#f97316' : daysLeft <= 30 ? '#eab308' : '#6ee7b7'
  const totalVal  = offer.offerPrice * offer.qty
  const accepted  = offer.status === 'accepted'

  function savePrice() {
    const p = parseFloat(newPrice.replace(',', '.'))
    if (!p || p <= 0) return
    onUpdatePrice?.(offer.id, p)
    setEditMode(false)
  }

  return (
    <>
      {showWa && <WaOverlay offer={offer} markets={markets} supplierName={supplierName} supplierPhone={offer.supplierPhone} orders={orders} onClose={() => setShowWa(false)} />}

      <div style={{ background:'#0d2137', borderRadius:18, marginBottom:12, border:'1px solid ' + (offer.isOpportunity ? '#d97706' : '#1a3a50'), overflow:'hidden' }}>

        {/* Top stripe for oportunidade */}
        {offer.isOpportunity && (
          <div style={{ background:'linear-gradient(90deg,#92400e,#d97706)', padding:'5px 14px', display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ color:'#fef3c7', fontSize:11, fontWeight:900 }}>🔥 OPORTUNIDADE — Queima de estoque!</span>
          </div>
        )}

        <div style={{ padding:'14px 16px' }}>
          {/* Product name + SKU */}
          <div style={{ marginBottom:10 }}>
            <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:16, lineHeight:1.2 }}>{offer.productName}</div>
            {offer.sku && <div style={{ color:'#334155', fontSize:11, fontFamily:'monospace', marginTop:2 }}>{offer.sku}</div>}
          </div>

          {/* Price row */}
          <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8, flexWrap:'wrap' }}>
            {editMode
              ? (
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <span style={{ color:'#475569', fontWeight:700 }}>R$</span>
                  <input autoFocus value={newPrice} onChange={e => setNewPrice(e.target.value)} onKeyDown={e => e.key === 'Enter' && savePrice()}
                    placeholder={String(offer.offerPrice).replace('.',',')}
                    style={{ width:80, background:'#0a1929', border:'1px solid #10b981', borderRadius:8, padding:'6px 8px', color:'#10b981', fontSize:15, fontWeight:700, outline:'none' }}
                  />
                  <button onClick={savePrice} style={{ background:'#14532d', border:'none', borderRadius:8, padding:'6px 10px', color:'#4ade80', fontWeight:700, cursor:'pointer', fontSize:12 }}>✓</button>
                  <button onClick={() => setEditMode(false)} style={{ background:'none', border:'none', color:'#475569', cursor:'pointer', fontSize:14 }}>✕</button>
                </div>
              )
              : (
                <button onClick={() => { setEditMode(true); setNewPrice(String(offer.offerPrice).replace('.',',')) }}
                  style={{ background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:4, padding:0 }}>
                  <span style={{ color:'#10b981', fontWeight:900, fontSize:20 }}>{BRL.format(offer.offerPrice)}</span>
                  <span style={{ color:'#475569', fontSize:13, fontWeight:600 }}>/un</span>
                  <span style={{ color:'#334155', fontSize:11, marginLeft:2 }}>✏️</span>
                </button>
              )
            }
            <span style={{ background:'#0a2540', color:'#93c5fd', fontSize:12, fontWeight:700, padding:'4px 10px', borderRadius:10 }}>{offer.qty} {offer.unit}</span>
            <span style={{ fontSize:12, fontWeight:700, padding:'4px 10px', borderRadius:20,
              background: accepted ? '#14532d' : '#1a3050',
              color:      accepted ? '#86efac' : '#64748b' }}>
              {accepted ? '✓ Aceita' : '⏳ Aguardando pedido'}
            </span>
          </div>

          {/* Total value */}
          <div style={{ color:'#475569', fontSize:12, fontWeight:600, marginBottom:8 }}>
            💰 Valor total em estoque: <strong style={{ color:'#f1f5f9' }}>{BRL.format(totalVal)}</strong>
          </div>

          {/* Expiry */}
          {daysLeft !== null && (
            <div style={{ background: daysLeft <= 7 ? '#7c2d1222' : '#0a1929', border:'1px solid ' + (daysLeft <= 7 ? '#7c2d12' : '#1a3a50'), borderRadius:10, padding:'6px 10px', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:13 }}>📅</span>
              <span style={{ color: expColor, fontWeight:800, fontSize:12 }}>
                {daysLeft <= 0 ? 'VENCIDO' : `Vence em ${daysLeft} dia${daysLeft !== 1 ? 's' : ''}`}
                {' — '}{offer.expiryDate}
              </span>
              {daysLeft > 0 && daysLeft <= 14 && (
                <span style={{ background:'#7c2d12', color:'#fca5a5', fontSize:10, fontWeight:900, padding:'1px 6px', borderRadius:6, marginLeft:4 }}>URGENTE</span>
              )}
            </div>
          )}

          {/* Note */}
          {offer.note && (
            <div style={{ color:'#64748b', fontSize:12, fontStyle:'italic', marginBottom:8, padding:'6px 10px', background:'#0a1929', borderRadius:8 }}>
              💬 "{offer.note}"
            </div>
          )}

          {/* Footer */}
          <div style={{ display:'flex', alignItems:'center', gap:6, paddingTop:10, borderTop:'1px solid #1a3a50', flexWrap:'wrap' }}>
            <span style={{ color:'#334155', fontSize:10, flex:1 }}>
              🕐 {fmtDT(offer.publishedAt)} · {markets.length} mercado{markets.length !== 1 ? 's' : ''}
            </span>
            <button onClick={() => setShowWa(true)}
              style={{ background:'#14532d', color:'#86efac', border:'none', cursor:'pointer', padding:'7px 14px', borderRadius:10, fontSize:12, fontWeight:700, display:'flex', alignItems:'center', gap:5 }}>
              <MessageCircle size={13} /> Reenviar ZAP
            </button>
            {onDelete && (
              <button onClick={() => onDelete(offer.id)} style={{ background:'#1a0a0a', color:'#ef4444', border:'none', cursor:'pointer', padding:'7px 10px', borderRadius:10 }}>
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

/* ── SetupScreen ────────────────────────────────────────────── */
function SetupScreen({ onDone }) {
  const saved = (() => { try { return JSON.parse(localStorage.getItem(LOCAL)) || {} } catch { return {} } })()
  const [name, setName]   = useState(saved.name  || '')
  const [phone, setPhone] = useState(saved.phone || '')
  return (
    <div style={{ minHeight:'100dvh', background:'#050f1a', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ textAlign:'center', marginBottom:24 }}>
        <div style={{ width:72, height:72, borderRadius:22, background:'linear-gradient(135deg,#10b981,#059669)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
          <Truck size={36} color="#fff" />
        </div>
        <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:28 }}>DISTRIBUIDOR</div>
        <div style={{ color:'#10b981', fontSize:14, marginTop:4 }}>
          {saved.name ? `Bem-vindo de volta, ${saved.name.split(' ')[0]}!` : 'Portal do Distribuidor'}
        </div>
      </div>
      <div style={{ background:'#0d2137', borderRadius:20, padding:24, width:'100%', maxWidth:360, border:'1px solid #1e4060' }}>
        <div style={{ color:'#f1f5f9', fontWeight:800, fontSize:16, marginBottom:20 }}>
          {saved.name ? '✓ Confirmar identidade' : 'Identifique-se'}
        </div>
        <label style={{ color:'#64748b', fontSize:11, fontWeight:700, textTransform:'uppercase' }}>Nome / Distribuidora</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Joao Distribuidora"
          style={{ display:'block', width:'100%', marginTop:6, marginBottom:16, background:'#0a1929', border:'1px solid #1e4060', borderRadius:12, padding:'12px 14px', color:'#e2e8f0', fontSize:15, boxSizing:'border-box', outline:'none' }}
        />
        <label style={{ color:'#64748b', fontSize:11, fontWeight:700, textTransform:'uppercase' }}>Seu WhatsApp</label>
        <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(15) 99999-9999" type="tel"
          style={{ display:'block', width:'100%', marginTop:6, marginBottom:20, background:'#0a1929', border:'1px solid #1e4060', borderRadius:12, padding:'12px 14px', color:'#e2e8f0', fontSize:15, boxSizing:'border-box', outline:'none' }}
        />
        <Btn full disabled={!name.trim()} onClick={() => onDone({ name: name.trim(), phone: phone.trim() })}>
          <Check size={18} /> Entrar
        </Btn>
      </div>
      <div style={{ color:'#1e4060', fontSize:12, marginTop:24 }}>Corta Precos PDV · Plataforma Distribuidor v2.0</div>
    </div>
  )
}

/* ── Demo seed data ─────────────────────────────────────────── */
const DEMO_DATE = (d) => { const dt = new Date(); dt.setDate(dt.getDate() + d); return dt.toISOString().slice(0,10) }
const DEMO_AGO  = (d) => { const dt = new Date(); dt.setDate(dt.getDate() - d); return dt.toISOString() }
const DEMO_ESTOQUE = [
  { id:'demo1', productName:'Coca-Cola 2L',           sku:'7894900011630', qty:120, unit:'UND', cost:5.20,  expiryDate:DEMO_DATE(45),  receivedAt:today(), updatedAt:new Date().toISOString() },
  { id:'demo2', productName:'Arroz Tio João 5kg',     sku:'7896036500572', qty:80,  unit:'SC',  cost:18.50, expiryDate:DEMO_DATE(365), receivedAt:today(), updatedAt:new Date().toISOString() },
  { id:'demo3', productName:'Óleo de Soja Soya 900ml',sku:'7896036500573', qty:60,  unit:'UND', cost:6.80,  expiryDate:DEMO_DATE(180), receivedAt:today(), updatedAt:new Date().toISOString() },
  { id:'demo4', productName:'Biscoito Oreo 90g',      sku:'7622210651557', qty:200, unit:'UND', cost:2.90,  expiryDate:DEMO_DATE(12),  receivedAt:today(), updatedAt:new Date().toISOString() },
  { id:'demo5', productName:'Leite Integral Itambé 1L',sku:'7896051190016',qty:144, unit:'CX',  cost:4.30,  expiryDate:DEMO_DATE(30),  receivedAt:today(), updatedAt:new Date().toISOString() },
]
const DEMO_OFFERS = [
  { id:'doff1', supplierId:LOCAL, supplierName:'Distribuidora Demo', supplierPhone:'15999990000', productName:'Biscoito Oreo 90g', sku:'7622210651557', qty:200, unit:'UND', offerPrice:3.49, expiryDate:DEMO_DATE(12), isOpportunity:true,  note:'Próximo do vencimento — oportunidade única!', status:'pending', publishedAt:DEMO_AGO(1) },
  { id:'doff2', supplierId:LOCAL, supplierName:'Distribuidora Demo', supplierPhone:'15999990000', productName:'Coca-Cola 2L',      sku:'7894900011630', qty:120, unit:'UND', offerPrice:6.90, expiryDate:DEMO_DATE(45), isOpportunity:false, note:'Lote novo, entrega imediata',               status:'pending', publishedAt:DEMO_AGO(0) },
]
const DEMO_MARKETS = [
  { id:'dmkt1', name:'Mercado Qualidade Preço', phone:'15996604075', contact:'André Porfírio', address:'Rua das Rosas 450, Centro, Sorocaba/SP', cnpj:'12.345.678/0001-99', notes:'Paga à vista, prefere entrega 2ª e 5ª feira' },
  { id:'dmkt2', name:'Supermercado São João',   phone:'15999110001', contact:'Maria Costa',   address:'Av. Paulista 1200, Jardim, Sorocaba/SP',  cnpj:'98.765.432/0001-11', notes:'Compra grande quantidade, paga em 15 dias' },
  { id:'dmkt3', name:'Mercadinho do Bairro',    phone:'15988220002', contact:'Carlos Mendes', address:'Rua das Orquídeas 88, Vila Nova, SP',      cnpj:'',                   notes:'Pequeno volume, mas fidelizado' },
]
const DEMO_ORDERS_HIST = [
  { id:'dord1', storeName:'Mercado Qualidade Preço', storePhone:'15996604075', productName:'Coca-Cola 2L',      qtyRequested:48, unit:'UND', totalPrice:331.20, status:'delivered', createdAt:DEMO_AGO(12) },
  { id:'dord2', storeName:'Mercado Qualidade Preço', storePhone:'15996604075', productName:'Arroz Tio João 5kg',qtyRequested:20, unit:'SC',  totalPrice:370.00, status:'confirmed', createdAt:DEMO_AGO(3)  },
  { id:'dord3', storeName:'Supermercado São João',   storePhone:'15999110001', productName:'Leite Itambé 1L',   qtyRequested:96, unit:'CX',  totalPrice:412.80, status:'delivered', createdAt:DEMO_AGO(20) },
  { id:'dord4', storeName:'Supermercado São João',   storePhone:'15999110001', productName:'Óleo Soya 900ml',   qtyRequested:60, unit:'UND', totalPrice:408.00, status:'delivered', createdAt:DEMO_AGO(7)  },
  { id:'dord5', storeName:'Mercadinho do Bairro',    storePhone:'15988220002', productName:'Biscoito Oreo',     qtyRequested:50, unit:'UND', totalPrice:174.50, status:'pending',   createdAt:DEMO_AGO(1)  },
]

/* ── TabInicio ──────────────────────────────────────────────── */
function TabInicio({ estoque, offers, orders, profile, setEstoque, setOffers, setMarkets, setOrders }) {
  const stats = useMemo(() => ({
    itens:    estoque.filter(e => e.qty > 0).length,
    qtdTotal: estoque.reduce((s, e) => s + (e.qty || 0), 0),
    ativas:   offers.filter(o => o.status === 'pending').length,
    pedidos:  orders.filter(o => o.status === 'pending').length,
    receita:  orders.reduce((s, o) => s + (o.totalPrice || 0), 0),
  }), [estoque, offers, orders])

  async function carregarDemo() {
    setEstoque(DEMO_ESTOQUE)
    setOffers(DEMO_OFFERS)
    setMarkets(DEMO_MARKETS)
    setOrders(prev => {
      const ids = new Set(prev.map(o => o.id))
      return [...DEMO_ORDERS_HIST.filter(o => !ids.has(o.id)), ...prev]
    })
    await persistKey(ESTOQUE_KEY, DEMO_ESTOQUE)
    await persistKey(OFFERS_KEY,  DEMO_OFFERS)
    await persistKey(MKTS_SERVER_KEY, DEMO_MARKETS)
  }

  return (
    <div style={{ padding:'16px 16px 100px' }}>
      <div style={{ marginBottom:20 }}>
        <div style={{ color:'#10b981', fontSize:13, fontWeight:700 }}>Bom dia! 👋</div>
        <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:22 }}>{profile.name}</div>
      </div>
      <div style={{ display:'flex', gap:10, marginBottom:10 }}>
        <StatCard icon={Boxes}            label="Em Estoque" value={stats.itens}               sub={stats.qtdTotal + ' unidades'} color="#10b981" />
        <StatCard icon={TrendingUp}       label="Ofertas"    value={stats.ativas}               sub="aguardando aceite"            color="#3b82f6" />
      </div>
      <div style={{ display:'flex', gap:10, marginBottom:24 }}>
        <StatCard icon={ClipboardList}    label="Pedidos"    value={stats.pedidos}              sub="a confirmar"                  color="#f59e0b" />
        <StatCard icon={CircleDollarSign} label="Receita"    value={BRL.format(stats.receita)} sub="em pedidos"                   color="#8b5cf6" />
      </div>
      <div style={{ color:'#64748b', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:10 }}>Estoque</div>
      {estoque.length === 0 ? (
        <div style={{ background:'#0d2137', borderRadius:16, padding:24, textAlign:'center', border:'1px solid #1a3a50' }}>
          <Boxes size={32} color="#1e4060" style={{ marginBottom:8 }} />
          <div style={{ color:'#475569', fontSize:14 }}>Nenhum produto em estoque</div>
          <div style={{ color:'#334155', fontSize:12, marginTop:4, marginBottom:16 }}>Use a aba Receber para dar entrada</div>
          <button onClick={carregarDemo} style={{ background:'#0a2a4a', border:'1px solid #1e6091', borderRadius:12, padding:'10px 20px', color:'#93c5fd', fontSize:13, fontWeight:700, cursor:'pointer' }}>
            🎯 Carregar dados de exemplo
          </button>
        </div>
      ) : estoque.map(item => (
        <div key={item.id} style={{ background:'#0d2137', borderRadius:14, padding:'12px 16px', marginBottom:8, border:'1px solid #1a3a50', display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:40, height:40, borderRadius:10, background:'#0a2540', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Package size={18} color="#10b981" />
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ color:'#e2e8f0', fontWeight:700, fontSize:13, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.productName}</div>
            {item.sku && <div style={{ color:'#334155', fontSize:11, fontFamily:'monospace' }}>{item.sku}</div>}
          </div>
          <div style={{ textAlign:'right', flexShrink:0 }}>
            <div style={{ color: item.qty > 0 ? '#10b981' : '#ef4444', fontWeight:900, fontSize:18 }}>{item.qty}</div>
            <div style={{ color:'#475569', fontSize:11 }}>{item.unit}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── TabReceber ─────────────────────────────────────────────── */
function TabReceber({ estoque, setEstoque, offers, setOffers, markets, profile }) {
  const [selected,   setSelected]   = useState(null)
  const [qty,        setQty]        = useState('')
  const [unit,       setUnit]       = useState('UND')
  const [cost,       setCost]       = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [offerPrice, setOfferPrice] = useState('')
  const [isOpp,      setIsOpp]      = useState(false)
  const [offerNote,  setOfferNote]  = useState('')
  const [saving,     setSaving]     = useState(false)
  const [blast,      setBlast]      = useState(null) // offer to blast

  function handleSelect(p) {
    setSelected(p); setQty(''); setUnit('UND'); setExpiryDate('')
    setCost(p.price ? String(p.price).replace('.', ',') : '')
    setOfferPrice(p.price ? String((p.price * 1.3).toFixed(2)).replace('.', ',') : '')
    setIsOpp(false); setOfferNote('')
  }

  function reset() {
    setSelected(null); setQty(''); setCost(''); setExpiryDate('')
    setOfferPrice(''); setIsOpp(false); setOfferNote('')
  }

  async function handleSubmit() {
    if (!selected || !qty) return
    setSaving(true)
    const qtyNum = parseFloat(qty) || 0

    // 1. Add to estoque
    const item = { id: uid(), productName: selected.name, sku: selected.sku || '', qty: qtyNum, unit, cost: parseNum(cost), expiryDate: expiryDate || null, receivedAt: today(), updatedAt: new Date().toISOString() }
    const idx  = estoque.findIndex(e => e.sku === selected.sku && e.unit === unit)
    const nextEstoque = idx >= 0
      ? estoque.map((e, i) => i === idx ? { ...e, qty: e.qty + qtyNum, expiryDate: expiryDate || e.expiryDate, updatedAt: new Date().toISOString() } : e)
      : [...estoque, item]
    setEstoque(nextEstoque)
    await persistKey(ESTOQUE_KEY, nextEstoque)

    // 2. Create + publish offer if price filled
    const price = parseNum(offerPrice)
    if (price > 0) {
      const offer = {
        id: uid(), supplierId: LOCAL, supplierName: profile?.name || 'Distribuidora', supplierPhone: profile?.phone || '',
        productName: selected.name, sku: selected.sku || '', qty: qtyNum, unit,
        offerPrice: price, expiryDate: expiryDate || null, isOpportunity: isOpp,
        note: offerNote.trim(), status: 'pending', publishedAt: new Date().toISOString(),
      }
      const nextOffers = [offer, ...(offers || [])]
      setOffers(nextOffers)
      await persistKey(OFFERS_KEY, nextOffers)

      // 3. Trigger blast if markets exist
      const validMkts = (markets || []).filter(m => m.phone)
      if (validMkts.length > 0) { setSaving(false); reset(); setBlast(offer); return }
    }

    setSaving(false); reset()
  }

  async function handleRemove(id) {
    const next = estoque.filter(e => e.id !== id)
    setEstoque(next); await persistKey(ESTOQUE_KEY, next)
  }

  if (blast) {
    return <BlastScreen offer={blast} markets={markets} supplierName={profile?.name || 'Distribuidora'} supplierPhone={profile?.phone || ''} onDone={() => setBlast(null)} />
  }

  const price     = parseNum(offerPrice)
  const canBlast  = price > 0
  const validMkts = (markets || []).filter(m => m.phone).length
  const qtyNum    = parseFloat(qty) || 0
  const inp       = { display:'block', width:'100%', background:'#0a1929', border:'1px solid #1e4060', borderRadius:12, padding:'11px 14px', color:'#e2e8f0', fontSize:15, fontWeight:600, boxSizing:'border-box', outline:'none' }

  return (
    <div style={{ padding:'16px 16px 100px' }}>

      {/* Header */}
      <div style={{ marginBottom:18 }}>
        <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:20, marginBottom:2 }}>📦 Receber Produto</div>
        <div style={{ color:'#475569', fontSize:13 }}>
          Escaneia ou busca · produto aparece no portal de todos os mercados automaticamente
        </div>
        {validMkts > 0 && (
          <div style={{ display:'inline-flex', alignItems:'center', gap:5, background:'#0d2137', border:'1px solid #14532d', borderRadius:20, padding:'4px 12px', marginTop:8 }}>
            <div style={{ width:6, height:6, borderRadius:3, background:'#10b981' }} />
            <span style={{ color:'#10b981', fontSize:12, fontWeight:700 }}>{validMkts} mercados conectados</span>
          </div>
        )}
      </div>

      <ProductSearch onSelect={handleSelect} />

      {selected && (
        <div style={{ marginTop:14, borderRadius:20, overflow:'hidden', border:'1px solid #10b981' }}>

          {/* Product header */}
          <div style={{ background:'linear-gradient(135deg,#0f3d27,#0a2a1c)', padding:'14px 16px 12px', display:'flex', gap:12 }}>
            <div style={{ flex:1 }}>
              <div style={{ color:'#4ade80', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:3 }}>✓ Produto</div>
              <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:18, lineHeight:1.2 }}>{selected.name}</div>
              {selected.sku && <div style={{ color:'#334155', fontSize:11, fontFamily:'monospace', marginTop:3 }}>{selected.sku}</div>}
            </div>
            <button onClick={reset} style={{ background:'rgba(0,0,0,0.3)', border:'none', borderRadius:10, padding:8, cursor:'pointer', color:'#64748b', alignSelf:'flex-start' }}><X size={17} /></button>
          </div>

          <div style={{ background:'#0d2137', padding:'16px', display:'flex', flexDirection:'column', gap:14 }}>

            {/* Qty + Unit */}
            <div>
              <div style={{ color:'#94a3b8', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>Quantidade recebida</div>
              <div style={{ display:'flex', gap:8 }}>
                <input value={qty} onChange={e => setQty(e.target.value)} type="number" placeholder="Ex: 200"
                  autoFocus style={{ ...inp, flex:2, fontSize:20, fontWeight:900, color:'#e2e8f0' }} />
                <select value={unit} onChange={e => setUnit(e.target.value)}
                  style={{ ...inp, flex:1, padding:'11px 8px' }}>
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>

            {/* Custo + Validade */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div>
                <div style={{ color:'#64748b', fontSize:10, fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>Custo (R$)</div>
                <div style={{ position:'relative' }}>
                  <span style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:'#475569', fontSize:12 }}>R$</span>
                  <input value={cost} onChange={e => setCost(e.target.value)} placeholder="0,00" style={{ ...inp, paddingLeft:28 }} />
                </div>
              </div>
              <div>
                <div style={{ color:'#f97316', fontSize:10, fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>📅 Validade</div>
                <input value={expiryDate} onChange={e => setExpiryDate(e.target.value)} type="date"
                  style={{ ...inp, border:'1px solid #7c2d12', color:'#fed7aa' }} />
              </div>
            </div>

            {/* ────────────── OFFER SECTION ────────────── */}
            <div style={{ background:'#0a1929', borderRadius:14, padding:14, border:`1px solid ${canBlast ? '#2563eb55' : '#1e3050'}` }}>
              <div style={{ color:'#93c5fd', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                <Zap size={12} /> Publicar oferta para os mercados
              </div>

              <div style={{ marginBottom: canBlast ? 10 : 0 }}>
                <div style={{ color:'#64748b', fontSize:10, fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>Preço de venda para os mercados</div>
                <div style={{ position:'relative' }}>
                  <span style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:'#3b82f6', fontSize:13, fontWeight:700 }}>R$</span>
                  <input value={offerPrice} onChange={e => setOfferPrice(e.target.value)}
                    placeholder={cost ? 'Sugerido: ' + String((parseNum(cost) * 1.3).toFixed(2)).replace('.', ',') : 'quanto quer cobrar?'}
                    style={{ ...inp, border:`1px solid ${canBlast ? '#2563eb' : '#1e3050'}`, color:'#60a5fa', paddingLeft:28, fontSize:17, fontWeight:900 }} />
                </div>
                {canBlast && qty && (
                  <div style={{ color:'#475569', fontSize:11, marginTop:4 }}>
                    💰 Valor do lote: <strong style={{ color:'#f1f5f9' }}>{BRL.format(price * qtyNum)}</strong>
                    {cost && parseNum(cost) > 0 && <span style={{ color:'#10b981', marginLeft:8 }}>· Margem: {Math.round(((price - parseNum(cost)) / parseNum(cost)) * 100)}%</span>}
                  </div>
                )}
              </div>

              {canBlast && (
                <>
                  <button onClick={() => setIsOpp(v => !v)}
                    style={{ display:'flex', alignItems:'center', gap:8, background:'none', border:'none', cursor:'pointer', padding:'6px 0', marginBottom:8 }}>
                    <div style={{ width:22, height:22, borderRadius:7, background: isOpp ? '#d97706' : '#1a3050', border:`1px solid ${isOpp ? '#f59e0b' : '#334155'}`, display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.2s' }}>
                      {isOpp && <Check size={13} color="#fff" />}
                    </div>
                    <span style={{ color: isOpp ? '#fbbf24' : '#475569', fontSize:13, fontWeight:700 }}>🔥 Queima de estoque</span>
                  </button>
                  <input value={offerNote} onChange={e => setOfferNote(e.target.value)}
                    placeholder="Nota para os mercados (ex: lote novo, entrega imediata...)"
                    style={{ ...inp, fontSize:13 }} />
                </>
              )}
            </div>

            {/* ── ACTION BUTTON ── */}
            <button
              disabled={!qty || qtyNum <= 0 || saving}
              onClick={handleSubmit}
              style={{
                display:'flex', alignItems:'center', justifyContent:'center', gap:10,
                padding: canBlast ? '18px 20px' : '15px 20px',
                borderRadius:16, border:'none', fontWeight:900, fontSize: canBlast ? 16 : 15,
                cursor: (!qty || qtyNum <= 0 || saving) ? 'not-allowed' : 'pointer',
                opacity: (!qty || qtyNum <= 0 || saving) ? 0.45 : 1,
                background: canBlast
                  ? 'linear-gradient(135deg,#1d4ed8,#10b981)'
                  : 'linear-gradient(135deg,#10b981,#059669)',
                color:'#fff',
                boxShadow: canBlast ? '0 6px 24px rgba(16,185,129,0.3)' : 'none',
                transition:'all 0.2s',
              }}>
              {saving ? '⏳ Salvando...'
                : canBlast
                  ? <><ArrowDownToLine size={18} /> Dar Entrada + <MessageCircle size={18} /> Disparar para {validMkts} mercado{validMkts !== 1 ? 's' : ''}</>
                  : <><ArrowDownToLine size={18} /> Dar Entrada — {qtyNum || 0} {unit}</>
              }
            </button>
            {canBlast && (
              <div style={{ color:'#334155', fontSize:12, textAlign:'center', marginTop:-8 }}>
                Produto será publicado no portal + WhatsApp enviado para cada mercado
              </div>
            )}

          </div>
        </div>
      )}
      {estoque.length > 0 && (
        <>
          <div style={{ color:'#64748b', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', margin:'24px 0 10px' }}>
            Estoque Atual ({estoque.length} itens)
          </div>
          {estoque.map(item => {
            const daysLeft = item.expiryDate ? Math.ceil((new Date(item.expiryDate) - new Date()) / 86400000) : null
            const expColor = daysLeft == null ? null : daysLeft <= 0 ? '#ef4444' : daysLeft <= 7 ? '#f97316' : daysLeft <= 30 ? '#eab308' : '#10b981'
            return (
              <div key={item.id} style={{ background:'#0d2137', borderRadius:14, padding:'12px 16px', marginBottom:8, border:'1px solid ' + (item.qty <= 0 ? '#7f1d1d' : '#1a3a50'), display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ color:'#e2e8f0', fontWeight:700, fontSize:14, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.productName}</div>
                  {item.expiryDate && (
                    <div style={{ color: expColor, fontSize:11, fontWeight:700, marginTop:2 }}>
                      📅 {daysLeft <= 0 ? 'VENCIDO' : `vence em ${daysLeft}d`} · {item.expiryDate}
                    </div>
                  )}
                  {!item.expiryDate && <div style={{ color:'#334155', fontSize:11 }}>sem validade</div>}
                </div>
                <div style={{ textAlign:'center', flexShrink:0 }}>
                  <div style={{ color: item.qty > 0 ? '#10b981' : '#ef4444', fontWeight:900, fontSize:22, lineHeight:1 }}>{item.qty}</div>
                  <div style={{ color:'#475569', fontSize:11 }}>{item.unit}</div>
                </div>
                <button onClick={() => handleRemove(item.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#334155', padding:4 }}><Trash2 size={16} /></button>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

/* ── TabOfertas ─────────────────────────────────────────────── */
function TabOfertas({ estoque, offers, setOffers, markets, profile, orders, preSelected, onClearPreSelected }) {
  const [mode, setMode]           = useState('list')
  const [selected, setSelected]   = useState(null)
  const [fromStock, setFromStock] = useState(null)
  const [qty,  setQty]    = useState('')
  const [unit, setUnit]   = useState('CX')
  const [price, setPrice] = useState('')
  const [expiry, setExpiry] = useState('')
  const [isOpp, setIsOpp] = useState(false)
  const [note, setNote]   = useState('')
  const [publishing, setPublishing] = useState(false)
  const [waOffer, setWaOffer] = useState(null)

  // Pre-fill from "Receber → Criar Oferta" shortcut
  useEffect(() => {
    if (!preSelected) return
    pickFromStock(preSelected)
    if (preSelected.expiryDate) setExpiry(preSelected.expiryDate)
    setMode('new')
    onClearPreSelected?.()
  }, [preSelected]) // eslint-disable-line

  function reset() { setSelected(null); setFromStock(null); setQty(''); setPrice(''); setExpiry(''); setIsOpp(false); setNote(''); setMode('list') }
  function pickFromStock(item) {
    setFromStock(item); setSelected({ name: item.productName, sku: item.sku })
    setUnit(item.unit); setQty(String(item.qty)); setPrice(item.cost ? String(item.cost).replace('.', ',') : '')
    if (item.expiryDate) setExpiry(item.expiryDate)
  }

  async function handlePublish() {
    if (!selected || !qty || !price) return
    setPublishing(true)
    const offer = {
      id: uid(), supplierId: LOCAL, supplierName: profile.name, supplierPhone: profile.phone,
      productName: selected.name, sku: selected.sku || '', qty: parseFloat(qty) || 0, unit,
      offerPrice: parseNum(price), expiryDate: expiry || null, isOpportunity: isOpp,
      note: note.trim(), status: 'pending', publishedAt: new Date().toISOString(),
      stockItemId: fromStock?.id || null,
    }
    const next = [offer, ...offers]
    setOffers(next); await persistKey(OFFERS_KEY, next)
    setPublishing(false); setWaOffer(offer); reset()
  }

  async function handleDelete(id) {
    const next = offers.filter(o => o.id !== id)
    setOffers(next); await persistKey(OFFERS_KEY, next)
  }

  async function handleUpdatePrice(id, newPrice) {
    const next = offers.map(o => o.id === id ? { ...o, offerPrice: newPrice } : o)
    setOffers(next); await persistKey(OFFERS_KEY, next)
  }

  if (waOffer) return <WaOverlay offer={waOffer} markets={markets} supplierName={profile.name} supplierPhone={profile.phone} orders={orders} onClose={() => setWaOffer(null)} />

  if (mode === 'new') {
    const ok = selected && qty && price && !publishing
    return (
      <div style={{ padding:'16px 16px 100px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          <button onClick={reset} style={{ background:'#0d2137', border:'1px solid #1e4060', borderRadius:10, padding:'8px 12px', cursor:'pointer', display:'flex', alignItems:'center' }}><X size={18} color="#94a3b8" /></button>
          <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:18 }}>Nova Oferta</div>
          <div style={{ color:'#475569', fontSize:12, marginLeft:'auto' }}>{markets.length} mercados serao notificados</div>
        </div>

        {estoque.filter(e => e.qty > 0).length > 0 && (
          <>
            <div style={{ color:'#64748b', fontSize:11, fontWeight:700, textTransform:'uppercase', marginBottom:10 }}>Do Seu Estoque</div>
            <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:10, marginBottom:16 }}>
              {estoque.filter(e => e.qty > 0).map(item => (
                <button key={item.id} onClick={() => pickFromStock(item)} style={{ flexShrink:0, background: fromStock?.id === item.id ? '#14532d' : '#0d2137', border:'1px solid ' + (fromStock?.id === item.id ? '#10b981' : '#1e4060'), borderRadius:12, padding:'10px 14px', cursor:'pointer', textAlign:'left', minWidth:120 }}>
                  <div style={{ color: fromStock?.id === item.id ? '#4ade80' : '#e2e8f0', fontWeight:700, fontSize:12, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:130 }}>{item.productName}</div>
                  <div style={{ color:'#10b981', fontWeight:900, fontSize:16, marginTop:2 }}>{item.qty}<span style={{ fontSize:11, color:'#475569' }}> {item.unit}</span></div>
                </button>
              ))}
            </div>
            <div style={{ color:'#334155', fontSize:12, textAlign:'center', marginBottom:16 }}>— ou busque outro produto —</div>
          </>
        )}

        <ProductSearch onSelect={p => { setFromStock(null); setSelected(p); setUnit('CX') }} />

        {selected && (
          <div style={{ background:'#0d2137', border:'1px solid #10b981', borderRadius:14, padding:'10px 14px', marginTop:12, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ color:'#10b981', fontSize:11, fontWeight:700 }}>PRODUTO</div>
              <div style={{ color:'#f1f5f9', fontWeight:800, fontSize:15 }}>{selected.name}</div>
            </div>
            <button onClick={() => { setSelected(null); setFromStock(null) }} style={{ background:'none', border:'none', cursor:'pointer', color:'#475569' }}><X size={18} /></button>
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'1fr 100px', gap:10, marginTop:16 }}>
          <div>
            <label style={{ color:'#64748b', fontSize:11, fontWeight:700, textTransform:'uppercase' }}>QUANTIDADE</label>
            <input value={qty} onChange={e => setQty(e.target.value)} type="number"
              style={{ display:'block', width:'100%', marginTop:6, background:'#0a1929', border:'1px solid #1e4060', borderRadius:10, padding:12, color:'#e2e8f0', fontSize:16, fontWeight:700, boxSizing:'border-box', outline:'none' }}
            />
          </div>
          <div>
            <label style={{ color:'#64748b', fontSize:11, fontWeight:700, textTransform:'uppercase' }}>UNID.</label>
            <select value={unit} onChange={e => setUnit(e.target.value)}
              style={{ display:'block', width:'100%', marginTop:6, background:'#0a1929', border:'1px solid #1e4060', borderRadius:10, padding:12, color:'#e2e8f0', fontSize:14, boxSizing:'border-box', outline:'none' }}>
              {UNITS.map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginTop:12 }}>
          <label style={{ color:'#64748b', fontSize:11, fontWeight:700, textTransform:'uppercase' }}>PRECO DE OFERTA (/unidade)</label>
          <div style={{ position:'relative', marginTop:6 }}>
            <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#10b981', fontWeight:700 }}>R$</span>
            <input value={price} onChange={e => setPrice(e.target.value)} placeholder="0,00"
              style={{ width:'100%', background:'#0a1929', border:'1px solid #1e4060', borderRadius:10, padding:'12px 12px 12px 36px', color:'#10b981', fontSize:18, fontWeight:900, boxSizing:'border-box', outline:'none' }}
            />
          </div>
        </div>

        <div style={{ marginTop:12 }}>
          <label style={{ color:'#64748b', fontSize:11, fontWeight:700, textTransform:'uppercase' }}>VENCIMENTO (opcional)</label>
          <input type="date" value={expiry} onChange={e => setExpiry(e.target.value)}
            style={{ display:'block', width:'100%', marginTop:6, background:'#0a1929', border:'1px solid #1e4060', borderRadius:10, padding:12, color:'#e2e8f0', fontSize:14, boxSizing:'border-box', outline:'none' }}
          />
        </div>

        <div style={{ marginTop:12, background:'#0d2137', border:'1px solid #1e4060', borderRadius:14, padding:'14px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer' }} onClick={() => setIsOpp(v => !v)}>
          <div>
            <div style={{ color: isOpp ? '#fcd34d' : '#94a3b8', fontWeight:800, fontSize:14 }}>{isOpp ? '🔥' : '⭐'} Marcar como Oportunidade</div>
            <div style={{ color:'#475569', fontSize:12 }}>Preco especial ou estoque urgente</div>
          </div>
          <div style={{ width:44, height:24, borderRadius:12, background: isOpp ? '#10b981' : '#1e4060', display:'flex', alignItems:'center', padding:'0 3px', transition:'all .2s' }}>
            <div style={{ width:18, height:18, borderRadius:'50%', background:'#fff', transform: isOpp ? 'translateX(20px)' : 'translateX(0)', transition:'transform .2s' }} />
          </div>
        </div>

        <div style={{ marginTop:12 }}>
          <label style={{ color:'#64748b', fontSize:11, fontWeight:700, textTransform:'uppercase' }}>OBSERVACAO (opcional)</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Ex: Carreta chegou hoje, preco so ate amanha..." rows={2}
            style={{ display:'block', width:'100%', marginTop:6, background:'#0a1929', border:'1px solid #1e4060', borderRadius:10, padding:12, color:'#94a3b8', fontSize:13, boxSizing:'border-box', outline:'none', resize:'none' }}
          />
        </div>

        <div style={{ marginTop:20 }}>
          <Btn full disabled={!ok} onClick={handlePublish}>
            <Send size={18} />
            {publishing ? 'Publicando...' : 'Publicar + Notificar ' + markets.length + ' mercado' + (markets.length !== 1 ? 's' : '')}
          </Btn>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding:'16px 16px 100px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:18 }}>Minhas Ofertas</div>
        <Btn sm onClick={() => setMode('new')}><Plus size={16} /> Nova Oferta</Btn>
      </div>
      {offers.length === 0 ? (
        <div style={{ background:'#0d2137', borderRadius:20, padding:32, textAlign:'center', border:'1px solid #1a3a50' }}>
          <Send size={32} color="#1e4060" style={{ marginBottom:8 }} />
          <div style={{ color:'#475569', fontSize:15 }}>Nenhuma oferta enviada ainda</div>
        </div>
      ) : offers.map(o => <OfferCard key={o.id} offer={o} markets={markets} supplierName={profile.name} orders={orders} onDelete={handleDelete} onUpdatePrice={handleUpdatePrice} />)}
    </div>
  )
}

/* ── TabPedidos ─────────────────────────────────────────────── */
function TabPedidos({ orders, setOrders }) {
  const pending = orders.filter(o => o.status === 'pending').length
  const total   = orders.reduce((s, o) => s + (o.totalPrice || 0), 0)
  const payInfo = id => PAYMENT_INFO[id] || { emoji: '💰', label: id || 'N/A', color: '#94a3b8' }

  async function updateStatus(id, status) {
    const next = orders.map(o => o.id === id ? { ...o, status, updatedAt: new Date().toISOString() } : o)
    setOrders(next); await persistKey(ORDERS_KEY, next)
  }

  async function deleteOrder(id) {
    const next = orders.filter(o => o.id !== id)
    setOrders(next); await persistKey(ORDERS_KEY, next)
  }

  const sBg  = s => s === 'delivered' ? '#14532d' : s === 'confirmed' ? '#1e3a5f' : '#78350f'
  const sTxt = s => s === 'delivered' ? '#86efac' : s === 'confirmed' ? '#93c5fd' : '#fcd34d'
  const sLbl = s => s === 'delivered' ? '✓ Entregue' : s === 'confirmed' ? '✓ Confirmado' : '📦 Pendente'

  return (
    <div style={{ padding:'16px 16px 100px' }}>
      <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:18, marginBottom:16 }}>Pedidos Recebidos</div>

      <div style={{ display:'flex', gap:10, marginBottom:20 }}>
        <div style={{ flex:1, background:'#0d2137', borderRadius:14, padding:12, border:'1px solid #1a3a50', textAlign:'center' }}>
          <div style={{ color:'#f59e0b', fontWeight:900, fontSize:20 }}>{pending}</div>
          <div style={{ color:'#64748b', fontSize:11, fontWeight:700 }}>PENDENTES</div>
        </div>
        <div style={{ flex:1, background:'#0d2137', borderRadius:14, padding:12, border:'1px solid #1a3a50', textAlign:'center' }}>
          <div style={{ color:'#8b5cf6', fontWeight:900, fontSize:16 }}>{BRL.format(total)}</div>
          <div style={{ color:'#64748b', fontSize:11, fontWeight:700 }}>TOTAL</div>
        </div>
      </div>

      {orders.length === 0 ? (
        <div style={{ background:'#0d2137', borderRadius:20, padding:32, textAlign:'center', border:'1px solid #1a3a50' }}>
          <ClipboardList size={32} color="#1e4060" style={{ marginBottom:8 }} />
          <div style={{ color:'#475569', fontSize:15 }}>Nenhum pedido recebido ainda</div>
          <div style={{ color:'#334155', fontSize:12, marginTop:4 }}>Quando um mercado fizer pedido, aparece aqui</div>
        </div>
      ) : orders.map(order => {
        const pay = payInfo(order.paymentMethod)
        return (
          <div key={order.id} style={{ background:'#0d2137', borderRadius:16, padding:'14px 16px', marginBottom:12, border:'1px solid ' + (order.status === 'pending' ? '#78350f' : '#1a3a50') }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:10 }}>
              <div style={{ width:40, height:40, borderRadius:10, background:'#0a2540', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Package size={18} color="#10b981" />
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ color:'#f1f5f9', fontWeight:800, fontSize:14, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{order.productName}</div>
                <div style={{ display:'flex', gap:6, marginTop:4, flexWrap:'wrap', alignItems:'center' }}>
                  <span style={{ color:'#10b981', fontWeight:900, fontSize:15 }}>{BRL.format(order.totalPrice)}</span>
                  <span style={{ background:'#0a2540', color:'#93c5fd', fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:8 }}>{order.qtyRequested} {order.unit}</span>
                  <span style={{ fontSize:13 }}>{pay.emoji}</span>
                  <span style={{ color:pay.color, fontSize:11, fontWeight:700 }}>{pay.label}</span>
                </div>
              </div>
              <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:sBg(order.status), color:sTxt(order.status), flexShrink:0, whiteSpace:'nowrap' }}>
                {sLbl(order.status)}
              </span>
            </div>
            {order.note && <div style={{ background:'#0a1929', borderRadius:10, padding:'8px 12px', marginBottom:10, color:'#64748b', fontSize:12, fontStyle:'italic' }}>"{order.note}"</div>}
            <div style={{ color:'#334155', fontSize:10, marginBottom:10 }}>{fmtDT(order.createdAt)}</div>
            <div style={{ display:'flex', gap:8 }}>
              {order.status === 'pending' && (
                <button onClick={() => updateStatus(order.id, 'confirmed')}
                  style={{ flex:1, background:'linear-gradient(135deg,#10b981,#059669)', color:'#fff', border:'none', borderRadius:12, padding:10, fontWeight:800, fontSize:13, cursor:'pointer' }}>
                  ✓ Confirmar Pedido
                </button>
              )}
              {order.status === 'confirmed' && (
                <button onClick={() => updateStatus(order.id, 'delivered')}
                  style={{ flex:1, background:'linear-gradient(135deg,#3b82f6,#2563eb)', color:'#fff', border:'none', borderRadius:12, padding:10, fontWeight:800, fontSize:13, cursor:'pointer' }}>
                  🚚 Marcar Entregue
                </button>
              )}
              {order.status === 'delivered' && (
                <div style={{ flex:1, textAlign:'center', color:'#86efac', fontSize:13, fontWeight:700, padding:10 }}>✓ Entregue</div>
              )}
              <button onClick={() => deleteOrder(order.id)} style={{ background:'#1a0a0a', color:'#ef4444', border:'none', borderRadius:10, padding:'8px 10px', cursor:'pointer' }}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── MarketForm ─────────────────────────────────────────────── */
function MarketForm({ initial = {}, onSave, onCancel }) {
  const F = (k) => ({ value: form[k], onChange: e => setForm(p => ({...p, [k]: e.target.value})) })
  const [form, setForm] = useState({ name:'', phone:'', address:'', contact:'', cnpj:'', notes:'', ...initial })
  const inp = { background:'#0a1929', border:'1px solid #1e4060', borderRadius:10, padding:'10px 12px', color:'#e2e8f0', fontSize:14, boxSizing:'border-box', outline:'none', width:'100%', display:'block', marginBottom:10 }
  return (
    <div style={{ background:'#0d2137', borderRadius:16, padding:16, marginBottom:16, border:'1px solid #10b981' }}>
      <div style={{ color:'#10b981', fontSize:11, fontWeight:700, textTransform:'uppercase', marginBottom:12 }}>
        {initial.id ? '✏️ Editar Mercado' : '+ Novo Mercado'}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:0 }}>
        <div>
          <label style={{ color:'#64748b', fontSize:10, fontWeight:700, textTransform:'uppercase' }}>Nome do Mercado *</label>
          <input {...F('name')} placeholder="Mercado Qualidade" style={inp} />
        </div>
        <div>
          <label style={{ color:'#64748b', fontSize:10, fontWeight:700, textTransform:'uppercase' }}>WhatsApp *</label>
          <input {...F('phone')} placeholder="(15) 99999-0000" type="tel" style={inp} />
        </div>
      </div>
      <div>
        <label style={{ color:'#64748b', fontSize:10, fontWeight:700, textTransform:'uppercase' }}>Endereço Completo</label>
        <input {...F('address')} placeholder="Rua das Flores 123, Centro, Sorocaba" style={inp} />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <div>
          <label style={{ color:'#64748b', fontSize:10, fontWeight:700, textTransform:'uppercase' }}>Responsável / Comprador</label>
          <input {...F('contact')} placeholder="João Silva" style={inp} />
        </div>
        <div>
          <label style={{ color:'#64748b', fontSize:10, fontWeight:700, textTransform:'uppercase' }}>CNPJ (opcional)</label>
          <input {...F('cnpj')} placeholder="00.000.000/0001-00" style={inp} />
        </div>
      </div>
      <div>
        <label style={{ color:'#64748b', fontSize:10, fontWeight:700, textTransform:'uppercase' }}>Observações</label>
        <input {...F('notes')} placeholder="Ex: Paga só no prazo, prefere entrega 2ª feira" style={inp} />
      </div>
      <div style={{ display:'flex', gap:10 }}>
        <Btn full disabled={!form.name.trim()} onClick={() => onSave(form)}><Check size={15} /> Salvar</Btn>
        <Btn secondary full onClick={onCancel}>Cancelar</Btn>
      </div>
    </div>
  )
}

/* ── TabMercados ────────────────────────────────────────────── */
function TabMercados({ markets, setMarkets, orders }) {
  const [adding,  setAdding]  = useState(false)
  const [editing, setEditing] = useState(null) // market id being edited

  async function saveMarkets(next) {
    setMarkets(next)
    try { localStorage.setItem(MKTS_KEY, JSON.stringify(next)) } catch {}
    await persistKey(MKTS_SERVER_KEY, next)
  }

  async function handleAdd(form) {
    await saveMarkets([...markets, { id: uid(), ...form }])
    setAdding(false)
  }

  async function handleEdit(form) {
    await saveMarkets(markets.map(m => m.id === editing ? { ...m, ...form } : m))
    setEditing(null)
  }

  async function handleDelete(id) {
    if (!window.confirm('Remover este mercado?')) return
    await saveMarkets(markets.filter(m => m.id !== id))
  }

  function marketStats(m) {
    const mOrders = (orders || []).filter(o =>
      (o.storePhone && cleanPhone(o.storePhone) === cleanPhone(m.phone)) ||
      (o.storeName  && o.storeName.toLowerCase() === m.name.toLowerCase())
    )
    const delivered = mOrders.filter(o => o.status === 'delivered')
    const total     = mOrders.reduce((s, o) => s + (o.totalPrice || 0), 0)
    const last      = mOrders.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
    const daysAgo   = last ? Math.floor((Date.now() - new Date(last.createdAt)) / 86400000) : null
    return { count: mOrders.length, delivered: delivered.length, total, daysAgo, lastProduct: last?.productName }
  }

  return (
    <div style={{ padding:'16px 16px 100px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:18 }}>Meus Mercados</div>
          <div style={{ color:'#475569', fontSize:12 }}>{markets.length} cliente{markets.length !== 1 ? 's' : ''} cadastrado{markets.length !== 1 ? 's' : ''}</div>
        </div>
        {!adding && <Btn sm onClick={() => setAdding(true)}><Plus size={16} /> Adicionar</Btn>}
      </div>

      {adding && <MarketForm onSave={handleAdd} onCancel={() => setAdding(false)} />}

      {markets.length === 0 && !adding ? (
        <div style={{ background:'#0d2137', borderRadius:20, padding:32, textAlign:'center', border:'1px solid #1a3a50' }}>
          <Users size={32} color="#1e4060" style={{ marginBottom:8 }} />
          <div style={{ color:'#475569', fontSize:15, marginBottom:4 }}>Nenhum mercado ainda</div>
          <div style={{ color:'#334155', fontSize:12 }}>Adicione seus clientes para disparar ofertas pelo ZAP</div>
        </div>
      ) : markets.map(m => {
        const st = marketStats(m)
        if (editing === m.id) return <MarketForm key={m.id} initial={m} onSave={handleEdit} onCancel={() => setEditing(null)} />
        return (
          <div key={m.id} style={{ background:'#0d2137', borderRadius:16, marginBottom:12, border:'1px solid #1a3a50', overflow:'hidden' }}>
            {/* Header row */}
            <div style={{ padding:'14px 16px 10px', display:'flex', gap:12, alignItems:'flex-start' }}>
              <div style={{ width:44, height:44, borderRadius:14, background:'linear-gradient(135deg,#0f3460,#1a5276)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:18, fontWeight:900, color:'#93c5fd' }}>
                {m.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:15, lineHeight:1.2 }}>{m.name}</div>
                {m.contact && <div style={{ color:'#64748b', fontSize:12, marginTop:1 }}>👤 {m.contact}</div>}
                <a href={'https://wa.me/' + cleanPhone(m.phone)} target="_blank" rel="noreferrer"
                  style={{ color:'#4ade80', fontSize:12, fontWeight:700, display:'inline-flex', alignItems:'center', gap:4, marginTop:3, textDecoration:'none' }}>
                  <Phone size={11} /> {m.phone || 'sem número'}
                </a>
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <button onClick={() => setEditing(m.id)} style={{ background:'#0a2540', border:'1px solid #1e4060', borderRadius:8, padding:'6px 8px', cursor:'pointer', color:'#64748b' }}>✏️</button>
                <button onClick={() => handleDelete(m.id)} style={{ background:'#1a0a0a', border:'none', borderRadius:8, padding:'6px 8px', cursor:'pointer', color:'#ef4444' }}><Trash2 size={13} /></button>
              </div>
            </div>

            {/* Address + CNPJ */}
            {(m.address || m.cnpj) && (
              <div style={{ padding:'0 16px 10px', display:'flex', gap:12, flexWrap:'wrap' }}>
                {m.address && <span style={{ color:'#475569', fontSize:11, display:'flex', alignItems:'center', gap:4 }}><MapPin size={10} /> {m.address}</span>}
                {m.cnpj && <span style={{ color:'#475569', fontSize:11 }}>📋 {m.cnpj}</span>}
              </div>
            )}

            {/* Notes */}
            {m.notes && (
              <div style={{ margin:'0 16px 10px', background:'#0a1929', borderRadius:8, padding:'6px 10px', color:'#64748b', fontSize:11, fontStyle:'italic' }}>
                💬 {m.notes}
              </div>
            )}

            {/* Purchase history */}
            <div style={{ padding:'10px 16px 14px', borderTop:'1px solid #1a3a50', background:'#0a1929' }}>
              {st.count === 0 ? (
                <div style={{ color:'#334155', fontSize:12, textAlign:'center' }}>Nenhum pedido ainda — envie uma oferta! 🚀</div>
              ) : (
                <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
                  <div style={{ textAlign:'center' }}>
                    <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:18, lineHeight:1 }}>{st.count}</div>
                    <div style={{ color:'#64748b', fontSize:10 }}>pedidos</div>
                  </div>
                  <div style={{ textAlign:'center' }}>
                    <div style={{ color:'#10b981', fontWeight:900, fontSize:18, lineHeight:1 }}>{BRL.format(st.total)}</div>
                    <div style={{ color:'#64748b', fontSize:10 }}>comprado</div>
                  </div>
                  <div style={{ textAlign:'center' }}>
                    <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:18, lineHeight:1 }}>{st.delivered}</div>
                    <div style={{ color:'#64748b', fontSize:10 }}>entregues</div>
                  </div>
                  {st.daysAgo !== null && (
                    <div style={{ textAlign:'center' }}>
                      <div style={{ color:'#93c5fd', fontWeight:900, fontSize:18, lineHeight:1 }}>
                        {st.daysAgo === 0 ? 'hoje' : `${st.daysAgo}d`}
                      </div>
                      <div style={{ color:'#64748b', fontSize:10 }}>último</div>
                    </div>
                  )}
                  {st.lastProduct && (
                    <div style={{ flex:1, minWidth:120 }}>
                      <div style={{ color:'#475569', fontSize:10 }}>último produto</div>
                      <div style={{ color:'#e2e8f0', fontSize:12, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{st.lastProduct}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}

      {/* Portal link for markets */}
      <div style={{ background:'#0a1929', borderRadius:14, padding:'14px 16px', marginTop:8, border:'1px solid #1e4060' }}>
        <div style={{ color:'#10b981', fontSize:11, fontWeight:700, textTransform:'uppercase', marginBottom:4 }}>🔗 Link do Portal (envie para os mercados)</div>
        <div style={{ color:'#60a5fa', fontSize:13, fontFamily:'monospace', wordBreak:'break-all', marginBottom:8 }}>
          https://corta-precos-pdv.netlify.app/ofertas
        </div>
        <a href={'https://wa.me/?text=' + encodeURIComponent('Olá! Acesse nossas ofertas exclusivas aqui: https://corta-precos-pdv.netlify.app/ofertas')}
          target="_blank" rel="noreferrer"
          style={{ display:'inline-flex', alignItems:'center', gap:6, background:'#14532d', color:'#4ade80', borderRadius:10, padding:'8px 14px', textDecoration:'none', fontSize:12, fontWeight:700 }}>
          <MessageCircle size={13} /> Enviar link pelo ZAP
        </a>
      </div>
    </div>
  )
}

/* ── Main Component ─────────────────────────────────────────── */
/* ── EditProfileModal ────────────────────────────────────────── */
function EditProfileModal({ profile, onSave, onClose }) {
  const [name, setName]   = useState(profile.name || '')
  const [phone, setPhone] = useState(profile.phone || '')
  return (
    <div style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'#0a1929', borderRadius:20, padding:24, width:'100%', maxWidth:360, border:'1px solid #1e4060' }}>
        <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:18, marginBottom:20 }}>Editar Perfil</div>
        <label style={{ color:'#64748b', fontSize:11, fontWeight:700, textTransform:'uppercase' }}>Nome / Distribuidora</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: João Distribuidora"
          style={{ display:'block', width:'100%', marginTop:6, marginBottom:14, background:'#0d2137', border:'1px solid #1e4060', borderRadius:12, padding:'12px 14px', color:'#e2e8f0', fontSize:15, boxSizing:'border-box', outline:'none' }}
        />
        <label style={{ color:'#64748b', fontSize:11, fontWeight:700, textTransform:'uppercase' }}>Seu WhatsApp</label>
        <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(15) 99999-9999" type="tel"
          style={{ display:'block', width:'100%', marginTop:6, marginBottom:20, background:'#0d2137', border:'1px solid #1e4060', borderRadius:12, padding:'12px 14px', color:'#e2e8f0', fontSize:15, boxSizing:'border-box', outline:'none' }}
        />
        <div style={{ display:'flex', gap:10 }}>
          <Btn full disabled={!name.trim()} onClick={() => onSave({ name: name.trim(), phone: phone.trim() })}>
            <Check size={16} /> Salvar
          </Btn>
          <Btn secondary full onClick={onClose}>Cancelar</Btn>
        </div>
      </div>
    </div>
  )
}

export default function Fornecedor() {
  /* Default profile — no login gate. User can edit name/phone via header. */
  const defaultProfile = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(LOCAL))
      if (saved?.name) return saved
    } catch {}
    return { name: 'Distribuidor', phone: '' }
  }

  const [profile,     setProfile]     = useState(defaultProfile)
  const [markets,     setMarkets]     = useState(() => { try { return JSON.parse(localStorage.getItem(MKTS_KEY)) || [] } catch { return [] } })
  const [estoque,     setEstoque]     = useState([])
  const [offers,      setOffers]      = useState([])
  const [orders,      setOrders]      = useState([])
  const [tab,         setTab]         = useState('inicio')
  const [syncing,     setSyncing]     = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)
  const [preSelectedForOffer, setPreSelectedForOffer] = useState(null) // item from Receber → Ofertas

  const goToOferta = useCallback((item) => {
    setPreSelectedForOffer(item)
    setTab('ofertas')
  }, [])

  const saveProfile = (data) => {
    setProfile(data)
    try { localStorage.setItem(LOCAL, JSON.stringify(data)) } catch {}
    setEditingProfile(false)
  }

  const sync = useCallback(async () => {
    setSyncing(true)
    const { estoque: e, offers: o, orders: ord, markets: mkt } = await fetchAll()
    setEstoque(e)
    setOffers(o.filter(of => of.supplierId === LOCAL || !of.supplierId))
    setOrders(ord)
    // markets: server takes priority over localStorage when available
    if (mkt !== null) {
      setMarkets(mkt)
      try { localStorage.setItem(MKTS_KEY, JSON.stringify(mkt)) } catch {}
    }
    setSyncing(false)
  }, [])

  useEffect(() => { sync() }, [sync])

  const pendingOrders = orders.filter(o => o.status === 'pending').length

  const TABS = [
    { id:'inicio',   icon: LayoutDashboard, label:'Inicio',   badge: 0 },
    { id:'receber',  icon: ArrowDownToLine, label:'Receber',  badge: 0 },
    { id:'ofertas',  icon: Send,            label:'Ofertas',  badge: offers.filter(o => o.status === 'pending').length },
    { id:'pedidos',  icon: ClipboardList,   label:'Pedidos',  badge: pendingOrders },
    { id:'mercados', icon: Users,           label:'Mercados', badge: markets.length },
  ]

  return (
    <div style={{ minHeight:'100dvh', background:'#050f1a', display:'flex', flexDirection:'column', fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>

      {/* Edit profile modal */}
      {editingProfile && (
        <EditProfileModal profile={profile} onSave={saveProfile} onClose={() => setEditingProfile(false)} />
      )}

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px 10px', background:'#060e1a', borderBottom:'1px solid #0f2035', position:'sticky', top:0, zIndex:10 }}>
        <button onClick={() => setEditingProfile(true)} style={{ display:'flex', alignItems:'center', gap:10, background:'none', border:'none', cursor:'pointer', padding:0 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#10b981,#059669)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Truck size={18} color="#fff" />
          </div>
          <div style={{ textAlign:'left' }}>
            <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:15, lineHeight:1 }}>
              {profile.name}
              <span style={{ color:'#334155', fontWeight:400, fontSize:11, marginLeft:6 }}>✏️</span>
            </div>
            <div style={{ color:'#10b981', fontSize:11, fontWeight:600 }}>Portal do Distribuidor</div>
          </div>
        </button>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button onClick={sync} disabled={syncing} style={{ background:'none', border:'none', cursor:'pointer', color:'#475569', padding:4 }}>
            <RefreshCw size={16} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          {pendingOrders > 0 && (
            <div style={{ background:'#78350f', border:'1px solid #92400e', borderRadius:10, padding:'4px 10px', color:'#fcd34d', fontSize:12, fontWeight:700 }}>
              {pendingOrders} pedido{pendingOrders !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto' }}>
        {tab === 'inicio'   && <TabInicio  estoque={estoque} offers={offers} orders={orders} profile={profile} setEstoque={setEstoque} setOffers={setOffers} setMarkets={setMarkets} setOrders={setOrders} />}
        {tab === 'receber'  && <TabReceber estoque={estoque} setEstoque={setEstoque} offers={offers} setOffers={setOffers} markets={markets} profile={profile} />}
        {tab === 'ofertas'  && <TabOfertas estoque={estoque} offers={offers} setOffers={setOffers} markets={markets} profile={profile} orders={orders} preSelected={preSelectedForOffer} onClearPreSelected={() => setPreSelectedForOffer(null)} />}
        {tab === 'pedidos'  && <TabPedidos orders={orders} setOrders={setOrders} />}
        {tab === 'mercados' && <TabMercados markets={markets} setMarkets={setMarkets} orders={orders} />}
      </div>

      <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'#060e1a', borderTop:'1px solid #0f2035', display:'flex', padding:'0 0 env(safe-area-inset-bottom,0)', zIndex:20 }}>
        {TABS.map(({ id, icon: Icon, label, badge }) => {
          const active = tab === id
          return (
            <button key={id} onClick={() => setTab(id)} style={{ flex:1, background:'none', border:'none', cursor:'pointer', padding:'12px 4px 8px', display:'flex', flexDirection:'column', alignItems:'center', gap:3, position:'relative' }}>
              {badge > 0 && (
                <div style={{ position:'absolute', top:8, right:'50%', transform:'translateX(10px)', background:'#ef4444', color:'#fff', borderRadius:10, minWidth:16, height:16, fontSize:10, fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 4px' }}>{badge}</div>
              )}
              <Icon size={20} color={active ? '#10b981' : '#475569'} />
              <span style={{ fontSize:9, fontWeight:700, color: active ? '#10b981' : '#475569' }}>{label}</span>
            </button>
          )
        })}
      </div>
      <style>{"@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }"}</style>
    </div>
  )
}
