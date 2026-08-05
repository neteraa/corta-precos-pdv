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
  RefreshCw, Phone, Send, MapPin, Zap, ChevronDown, ChevronUp, BarChart2,
} from 'lucide-react'
import CameraScanner from '../components/CameraScanner.jsx'
import PRODUCTS_SEED from '../utils/products_seed.json'
import { fornKey, migrateToNamespace } from '../utils/tenantStorage.js'
import Footer from '../components/Footer.jsx'
import ZatendeStockLogo from '../components/ZatendeStockLogo.jsx'

const BRL         = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const LOCAL       = 'cp_fornecedor_v1'

/* URL do portal de mercados com ID do tenant (para WhatsApp link preview correto) */
function ofertasUrl() {
  try {
    const s = JSON.parse(localStorage.getItem('cp_session_v1') || '{}')
    const id = s.id || 'mega'
    return `https://zatendestock.netlify.app/ofertas?s=${id}`
  } catch {
    return 'https://zatendestock.netlify.app/ofertas?s=mega'
  }
}
const OFFERS_KEY  = 'cp_supplier_offers'
const ESTOQUE_KEY = 'cp_fornecedor_estoque'
const ORDERS_KEY  = 'cp_supplier_orders'
const MKTS_KEY    = LOCAL + '_markets'
const MKTS_SERVER_KEY     = 'cp_distribuidor_markets'   // server-side persistence (cross-device)
const PROFILE_SERVER_KEY  = 'cp_forn_profile_v1'         // profile + logoUrl cross-device
const RECURRENCE_KEY      = 'cp_forn_recurrences_v1'     // recorrências por mercado
const API_PERSIST = '/api/persist'
const API_RESTORE = '/api/restore'
const UNITS       = ['UND', 'CX', 'FD', 'KG', 'LT', 'PC', 'DZ', 'SC']

/* 🔒 INTERNAL ONLY — never sent to market-facing offer objects */
const SOURCE_TYPES = [
  { id:'leilao',     emoji:'🔨', label:'Leilão',      color:'#f59e0b', bg:'#78350f' },
  { id:'danificado', emoji:'📦', label:'Danificado',  color:'#f87171', bg:'#7f1d1d' },
  { id:'contato',    emoji:'👤', label:'Contato',     color:'#4ade80', bg:'#14532d' },
  { id:'atacadista', emoji:'🏭', label:'Atacadista',  color:'#93c5fd', bg:'#1e3a5f' },
  { id:'avulso',     emoji:'❓', label:'Avulso',      color:'#94a3b8', bg:'#1e293b' },
]
const EXPIRY_SHORTCUTS = [
  { label:'7d',  days:7  },
  { label:'15d', days:15 },
  { label:'30d', days:30 },
  { label:'60d', days:60 },
  { label:'90d', days:90 },
]

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

/* ── Currency input mask ── */
function CurrencyInput({ value, onChange, placeholder, style, autoFocus }) {
  function handleChange(e) {
    const digits = e.target.value.replace(/\D/g, '')
    if (!digits) { onChange(''); return }
    const num = parseInt(digits, 10) / 100
    onChange(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
  }
  return (
    <input
      value={value}
      onChange={handleChange}
      placeholder={placeholder || '0,00'}
      style={style}
      inputMode="numeric"
      autoFocus={autoFocus}
    />
  )
}

/* ── Open Food Facts EAN lookup ── */
const eanCache = {}
async function fetchEAN(ean) {
  if (!ean || ean.length < 8) return null
  if (eanCache[ean] !== undefined) return eanCache[ean]
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${ean}.json?fields=product_name,brands,image_front_url,stores,quantity`, { signal: AbortSignal.timeout(4000) })
    const j = await r.json()
    const result = j.status === 1 ? j.product : null
    eanCache[ean] = result
    return result
  } catch {
    eanCache[ean] = null
    return null
  }
}
const uid         = () => `${Date.now()}_${Math.random().toString(36).slice(2,6)}`
const today       = () => new Date().toISOString().slice(0, 10)
const parseNum    = s  => parseFloat((s || '0').replace(',', '.')) || 0

async function persistKey(key, value) {
  // Always write to flat localStorage key (shared with Ofertas.jsx for same-device demo)
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
  // Best-effort server sync (Netlify Blobs — cross-device)
  try {
    await fetch(API_PERSIST, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value: JSON.stringify(value) }),
    })
  } catch {}
}

function fromLocalOrNull(key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null } catch { return null }
}

async function fetchAll() {
  try {
    const r   = await fetch(API_RESTORE)
    const ct  = r.headers.get('content-type') || ''
    if (!ct.includes('application/json')) throw new Error('not JSON')
    const { data } = await r.json()
    return {
      estoque:  data?.[ESTOQUE_KEY]        ? JSON.parse(data[ESTOQUE_KEY])        : (fromLocalOrNull(ESTOQUE_KEY)  || []),
      offers:   data?.[OFFERS_KEY]         ? JSON.parse(data[OFFERS_KEY])         : (fromLocalOrNull(OFFERS_KEY)   || []),
      orders:   data?.[ORDERS_KEY]         ? JSON.parse(data[ORDERS_KEY])         : (fromLocalOrNull(ORDERS_KEY)   || []),
      markets:  data?.[MKTS_SERVER_KEY]    ? JSON.parse(data[MKTS_SERVER_KEY])    : fromLocalOrNull(MKTS_SERVER_KEY),
      profile:  data?.[PROFILE_SERVER_KEY] ? JSON.parse(data[PROFILE_SERVER_KEY]) : null,
    }
  } catch {
    // Server unavailable — fall back to flat localStorage (written by persistKey above)
    return {
      estoque: fromLocalOrNull(ESTOQUE_KEY)      || [],
      offers:  fromLocalOrNull(OFFERS_KEY)       || [],
      orders:  fromLocalOrNull(ORDERS_KEY)       || [],
      markets: fromLocalOrNull(MKTS_SERVER_KEY),
      profile: null,
    }
  }
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
    ofertasUrl(),
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

/* ── QuickProductInput ──────────────────────────────────────── */
/* Free-text OR scan — no SKU required; suggests from seed DB   */
function QuickProductInput({ onSelect }) {
  const [text,    setText]    = useState('')
  const [results, setResults] = useState([])
  const [scan,      setScan]      = useState(false)
  const [offInfo,   setOffInfo]   = useState(null)  // Open Food Facts product info
  const [offLoading, setOffLoading] = useState(false)

  const doSearch = (q) => {
    setText(q); setOffInfo(null)
    if (!q || q.length < 2) { setResults([]); return }
    const ql = q.toLowerCase()
    const skuHit = SKU_MAP[q]
    const hits = skuHit
      ? [skuHit]
      : PRODUCTS_SEED.filter(p => p.name?.toLowerCase().includes(ql) || p.sku?.includes(q)).slice(0, 5)
    setResults(hits)
  }

  const handleScan = async (sku) => {
    setScan(false)
    doSearch(sku)
    // Look up EAN in Open Food Facts to confirm product
    if (/^\d{8,14}$/.test(sku)) {
      setOffLoading(true)
      const info = await fetchEAN(sku)
      setOffLoading(false)
      setOffInfo(info)
    }
  }

  const confirmFreeText = () => {
    if (!text.trim()) return
    onSelect({ name: text.trim(), sku: '', price: null })
    setText(''); setResults([]); setOffInfo(null)
  }

  const pick = (p) => { onSelect(p); setText(''); setResults([]); setOffInfo(null) }

  const inp = { flex:1, background:'#0a1929', border:'1px solid #1e4060', borderRadius:12, padding:'13px 14px', color:'#e2e8f0', fontSize:16, outline:'none' }

  return (
    <div style={{ position:'relative' }}>
      {scan && (
        <div style={{ position:'fixed', inset:0, zIndex:999, background:'#000' }}>
          <CameraScanner onDetected={handleScan} onClose={() => setScan(false)} />
        </div>
      )}
      {/* Open Food Facts product confirmation card */}
      {offLoading && (
        <div style={{ background:'#0d2137', borderRadius:12, padding:'10px 14px', marginBottom:8, border:'1px solid #1e4060', color:'#64748b', fontSize:12 }}>
          🔍 Buscando produto no banco global...
        </div>
      )}
      {offInfo && !offLoading && (
        <div style={{ background:'#0d3d27', borderRadius:12, padding:'12px 14px', marginBottom:8, border:'1px solid #14532d', display:'flex', gap:10, alignItems:'center' }}>
          {offInfo.image_front_url && (
            <img src={offInfo.image_front_url} alt="" style={{ width:44, height:44, borderRadius:8, objectFit:'cover', flexShrink:0 }} />
          )}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ color:'#4ade80', fontSize:10, fontWeight:700, textTransform:'uppercase', marginBottom:2 }}>✅ Produto identificado</div>
            <div style={{ color:'#f1f5f9', fontWeight:800, fontSize:13 }}>{offInfo.product_name || offInfo.brands || 'Nome não disponível'}</div>
            {offInfo.brands && offInfo.product_name && <div style={{ color:'#64748b', fontSize:11 }}>{offInfo.brands}{offInfo.quantity ? ` · ${offInfo.quantity}` : ''}</div>}
          </div>
          <button onClick={() => {
            const name = offInfo.product_name || offInfo.brands || text.trim()
            pick({ name, sku: text.trim(), price: null })
          }} style={{ background:'#14532d', border:'none', borderRadius:10, padding:'8px 12px', color:'#4ade80', fontWeight:700, fontSize:12, cursor:'pointer', flexShrink:0 }}>
            Usar este
          </button>
        </div>
      )}
      <div style={{ display:'flex', gap:8 }}>
        <input value={text} onChange={e => doSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && confirmFreeText()}
          placeholder="Nome do produto ou código de barras..." style={inp} autoFocus />
        <button onClick={() => setScan(true)} style={{ background:'#0d2137', border:'1px solid #1e4060', borderRadius:12, padding:'0 14px', cursor:'pointer' }}>
          <Camera size={20} color="#10b981" />
        </button>
      </div>
      {text.trim().length >= 1 && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:100, background:'#0a1929', border:'1px solid #1e4060', borderRadius:12, marginTop:4 }}>
          {/* Always show "use as typed" first */}
          <button onClick={confirmFreeText}
            style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'12px 14px', background:'transparent', border:'none', borderBottom:'1px solid #1a3a50', cursor:'pointer', textAlign:'left' }}>
            <div style={{ width:28, height:28, borderRadius:8, background:'#14532d', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Check size={14} color="#4ade80" />
            </div>
            <div>
              <div style={{ color:'#4ade80', fontWeight:800, fontSize:13 }}>Usar: "{text.trim()}"</div>
              <div style={{ color:'#475569', fontSize:11 }}>produto novo / sem cadastro</div>
            </div>
          </button>
          {/* Seed matches */}
          {results.map(p => (
            <button key={p.id || p.sku} onClick={() => pick(p)}
              style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', padding:'11px 14px', background:'transparent', border:'none', borderBottom:'1px solid #1a3a50', cursor:'pointer', textAlign:'left' }}>
              <div>
                <div style={{ color:'#e2e8f0', fontWeight:700, fontSize:13 }}>{p.name}</div>
                {p.sku && <div style={{ color:'#475569', fontSize:11, fontFamily:'monospace' }}>{p.sku}</div>}
              </div>
              {p.price != null && <span style={{ color:'#10b981', fontWeight:900, fontSize:14, flexShrink:0 }}>{BRL.format(p.price)}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── BlitzModal ──────────────────────────────────────────────── */
function BlitzModal({ offers, setOffers, markets, profile, onClose, zapServerUrl, zapConnected }) {
  const [pct,     setPct]     = useState(20)
  const [blasting, setBlasting] = useState(false)
  const [blastMsg, setBlastMsg] = useState(null)

  const active  = offers.filter(o => o.status !== 'delivered' && o.offerPrice > 0)
  const avgOld  = active.length ? active.reduce((s,o) => s + o.offerPrice, 0) / active.length : 0
  const avgNew  = avgOld * (1 - pct / 100)

  function buildBlitzMsg() {
    const lines = [
      `⚡ *BLITZ FINAL DO DIA — ${profile.name}*`,
      '',
      `Preços caíram ${pct}%! Garanta agora:`,
      '',
      ...active.map(o => `📦 *${o.productName}* — ${BRL.format(o.offerPrice * (1 - pct / 100))}/un (${o.qty} ${o.unit})`),
      '',
      '🏃 Estoque limitado! Primeiro que pedir leva!',
      '',
      '👉 *Fazer pedido:*',
      ofertasUrl(),
      '',
      profile.phone ? `📞 ${profile.name} · ${profile.phone}` : `📞 ${profile.name}`,
    ]
    return lines.join('\n')
  }

  async function applyBlitz() {
    // Update all active offer prices
    const factor = 1 - pct / 100
    const nextOffers = offers.map(o =>
      o.status !== 'delivered' ? { ...o, offerPrice: parseFloat((o.offerPrice * factor).toFixed(2)) } : o
    )
    setOffers(nextOffers)
    await persistKey(OFFERS_KEY, nextOffers)
    setBlastMsg(buildBlitzMsg())
    setBlasting(true)
  }

  const validMkts = (markets || []).filter(m => m.phone)

  if (blasting && blastMsg) {
    // Reuse BlastScreen logic but with custom combined message
    return <BlastScreen customMsg={blastMsg} markets={markets} supplierName={profile.name} supplierPhone={profile.phone} onDone={onClose} zapServerUrl={zapServerUrl} zapConnected={zapConnected} />
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:250, background:'rgba(0,0,0,0.9)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'#0a1929', borderRadius:24, padding:24, width:'100%', maxWidth:400 }}>
        <div style={{ textAlign:'center', marginBottom:20 }}>
          <div style={{ fontSize:36, marginBottom:8 }}>⚡</div>
          <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:20 }}>Blitz Final do Dia</div>
          <div style={{ color:'#64748b', fontSize:13, marginTop:4 }}>{active.length} ofer{active.length !== 1 ? 'tas' : 'ta'} · {validMkts.length} mercados</div>
        </div>

        {/* Discount selector */}
        <div style={{ marginBottom:20 }}>
          <div style={{ color:'#64748b', fontSize:11, fontWeight:700, textTransform:'uppercase', marginBottom:10, textAlign:'center' }}>Quanto baixar?</div>
          <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
            {[10, 20, 30, 50].map(p => (
              <button key={p} onClick={() => setPct(p)} style={{
                flex:1, padding:'14px 0', borderRadius:14, border:`2px solid ${pct === p ? '#f59e0b' : '#1e4060'}`,
                background: pct === p ? '#78350f' : '#0d2137', color: pct === p ? '#fbbf24' : '#64748b',
                fontWeight:900, fontSize:18, cursor:'pointer',
              }}>{p}%</button>
            ))}
          </div>
        </div>

        {/* Preview */}
        {active.length > 0 && (
          <div style={{ background:'#0d2137', borderRadius:14, padding:'12px 14px', marginBottom:20 }}>
            <div style={{ color:'#64748b', fontSize:11, marginBottom:8 }}>Exemplo de preços:</div>
            {active.slice(0, 3).map(o => (
              <div key={o.id} style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ color:'#e2e8f0', fontSize:13, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'60%' }}>{o.productName}</span>
                <span style={{ color:'#64748b', fontSize:12, textDecoration:'line-through', marginRight:6 }}>{BRL.format(o.offerPrice)}</span>
                <span style={{ color:'#4ade80', fontSize:13, fontWeight:800 }}>→ {BRL.format(o.offerPrice * (1 - pct / 100))}</span>
              </div>
            ))}
            {active.length > 3 && <div style={{ color:'#334155', fontSize:11, marginTop:4 }}>+{active.length - 3} mais...</div>}
          </div>
        )}

        <div style={{ display:'flex', gap:10 }}>
          <Btn secondary full onClick={onClose}>Cancelar</Btn>
          <Btn full disabled={active.length === 0} onClick={applyBlitz}>
            <Zap size={16} /> Aplicar e Disparar
          </Btn>
        </div>
      </div>
    </div>
  )
}

/* ── BlastScreen ─────────────────────────────────────────────── */
/* Full-screen sequential WA dispatcher — one market at a time   */
function BlastScreen({ offer, customMsg, markets, supplierName, supplierPhone, onDone, zapServerUrl, zapConnected }) {
  const [idx,     setIdx]   = useState(0)
  const [apiSent, setApiSent] = useState(null) // null | 'sending' | { results, sent, total, error? }
  const valid  = (markets || []).filter(m => m.phone)
  const done   = apiSent?.sent != null ? true : idx >= valid.length
  const pct    = apiSent?.sent != null
    ? Math.round((apiSent.sent / Math.max(apiSent.total, 1)) * 100)
    : valid.length ? Math.round((idx / valid.length) * 100) : 100
  const curr   = valid[idx]
  const msg    = customMsg || buildOfferMsg(offer, supplierName, supplierPhone)

  /* ── Send via Baileys server — dispara TODOS de uma vez ── */
  async function sendViaServer() {
    if (!zapConnected || !zapServerUrl) return
    setApiSent('sending')
    try {
      const r = await fetch(`${zapServerUrl}/send-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phones: valid.map(m => m.phone), message: msg }),
      })
      const data = await r.json()
      setApiSent(data)
    } catch (err) {
      setApiSent({ sent: 0, total: valid.length, results: [], error: err.message })
    }
  }

  /* ── Manual fallback via wa.me ── */
  function sendCurrent() {
    if (!curr) return
    window.open(`https://wa.me/${cleanPhone(curr.phone)}?text=${encodeURIComponent(msg)}`, '_blank')
    setIdx(i => i + 1)
  }

  const btnBase = { border:'none', borderRadius:16, cursor:'pointer', fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center', gap:10 }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:300, background:'#050f1a', display:'flex', flexDirection:'column', padding:'env(safe-area-inset-top,24px) 24px 40px' }}>

      {/* Top bar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, paddingTop:16 }}>
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

      {/* Lista de transmissão — copiar números */}
      {!done && (
        <button onClick={() => {
          const nums = valid.map(m => cleanPhone(m.phone)).join('\n')
          navigator.clipboard?.writeText(nums).catch(() => {})
          alert(`📋 ${valid.length} números copiados!\n\nCole no WhatsApp:\nNovo grupo → Lista de Transmissão → colar os contatos\n\n${nums}`)
        }} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, width:'100%', marginBottom:12, padding:'10px', background:'#0d2137', border:'1px solid #1e4060', borderRadius:12, color:'#64748b', fontSize:12, fontWeight:700, cursor:'pointer' }}>
          📋 Copiar todos os números (lista de transmissão)
        </button>
      )}

      {/* Progress bar */}
      <div style={{ background:'#0d2137', borderRadius:99, height:8, marginBottom:20, overflow:'hidden' }}>
        <div style={{ background: done ? '#10b981' : 'linear-gradient(90deg,#3b82f6,#10b981)', height:'100%', width:`${pct}%`, borderRadius:99, transition:'width 0.4s ease' }} />
      </div>

      {/* Offer summary — safe for both single-offer and customMsg (all-offers) modes */}
      <div style={{ background:'#0d2137', borderRadius:16, padding:'12px 16px', marginBottom:24, display:'flex', gap:12, alignItems:'center', border:'1px solid #1a3a50' }}>
        <div style={{ width:40, height:40, borderRadius:12, background:'#0a2540', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <Package size={18} color="#10b981" />
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          {offer ? (
            <>
              <div style={{ color:'#f1f5f9', fontWeight:800, fontSize:14, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{offer.productName}</div>
              <div style={{ color:'#10b981', fontSize:12, fontWeight:700 }}>{BRL.format(offer.offerPrice)}/un · {offer.qty} {offer.unit}</div>
            </>
          ) : (
            <>
              <div style={{ color:'#f1f5f9', fontWeight:800, fontSize:14 }}>Todas as ofertas do dia</div>
              <div style={{ color:'#10b981', fontSize:12, fontWeight:700 }}>Mensagem com todos os produtos enviada</div>
            </>
          )}
        </div>
        {offer?.expiryDate && (
          <div style={{ background:'#7c2d12', borderRadius:8, padding:'3px 8px', color:'#fed7aa', fontSize:10, fontWeight:700, flexShrink:0 }}>📅 {offer.expiryDate}</div>
        )}
      </div>

      {/* Main area */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:20 }}>

        {/* ── API mode: done ── */}
        {apiSent?.sent != null ? (
          <>
            <div style={{ width:100, height:100, borderRadius:28, background:'linear-gradient(135deg,#14532d,#065f46)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <CheckCircle size={52} color="#4ade80" />
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ color:'#4ade80', fontWeight:900, fontSize:22, marginBottom:4 }}>
                {apiSent.sent}/{apiSent.total} mensagem{apiSent.total !== 1 ? 's' : ''} enviada{apiSent.total !== 1 ? 's' : ''}!
              </div>
              <div style={{ color:'#475569', fontSize:13 }}>Enviado direto pelo Baileys ⚡</div>
              {apiSent.error && <div style={{ color:'#f87171', fontSize:12, marginTop:6 }}>Erro: {apiSent.error}</div>}
            </div>
            {/* Per-market results */}
            {apiSent.results?.map(r => (
              <div key={r.phone} style={{ display:'flex', alignItems:'center', gap:8, color: r.ok ? '#4ade80' : '#f87171', fontSize:12 }}>
                {r.ok ? '✅' : '❌'} {r.phone} {r.error ? `— ${r.error}` : ''}
              </div>
            ))}
          </>

        /* ── API mode: sending ── */
        ) : apiSent === 'sending' ? (
          <>
            <div style={{ width:100, height:100, borderRadius:28, background:'linear-gradient(135deg,#1e3a8a,#1d4ed8)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <MessageCircle size={52} color="#93c5fd" style={{ animation:'spin 1s linear infinite' }} />
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ color:'#93c5fd', fontWeight:900, fontSize:20 }}>Enviando para {valid.length} mercados...</div>
              <div style={{ color:'#475569', fontSize:13, marginTop:4 }}>Aguarde ~{Math.round(valid.length * 1.5)}s (1 por vez pra não levar ban)</div>
            </div>
          </>

        /* ── Manual mode: done ── */
        ) : done ? (
          <>
            <div style={{ width:100, height:100, borderRadius:28, background:'linear-gradient(135deg,#14532d,#065f46)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <CheckCircle size={52} color="#4ade80" />
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ color:'#4ade80', fontWeight:900, fontSize:22, marginBottom:4 }}>{idx} mercado{idx !== 1 ? 's' : ''} notificado{idx !== 1 ? 's' : ''}!</div>
              <div style={{ color:'#475569', fontSize:14 }}>A oferta já está visível no portal.</div>
            </div>
          </>

        /* ── Main: server connected → 1 click ── */
        ) : zapConnected ? (
          <>
            <div style={{ width:96, height:96, borderRadius:28, background:'linear-gradient(135deg,#064e3b,#065f46)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 40px rgba(16,185,129,0.4)' }}>
              <Zap size={48} color="#4ade80" />
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ color:'#10b981', fontWeight:700, fontSize:11, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4 }}>⚡ Servidor ZAP conectado</div>
              <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:20, marginBottom:4 }}>Disparar para {valid.length} mercados</div>
              <div style={{ color:'#475569', fontSize:13 }}>de uma vez, sem abrir o WA!</div>
            </div>
            <button onClick={sendViaServer}
              style={{ ...btnBase, width:'100%', maxWidth:340, background:'linear-gradient(135deg,#10b981,#059669)', padding:'20px 24px', fontSize:18, color:'#fff', boxShadow:'0 8px 32px rgba(16,185,129,0.5)' }}>
              <Zap size={24} />
              Disparar para todos agora!
            </button>
            <div style={{ color:'#334155', fontSize:12 }}>ou continue manual →</div>
            <button onClick={sendCurrent}
              style={{ ...btnBase, width:'100%', maxWidth:340, background:'#0d2137', border:'1px solid #1e4060', padding:'12px 24px', fontSize:14, color:'#64748b' }}>
              <MessageCircle size={16} /> Abrir WA — {curr?.name?.split(' ')[0]}
            </button>
          </>

        /* ── Manual mode: step by step ── */
        ) : (
          <>
            <div style={{ width:96, height:96, borderRadius:28, background:'linear-gradient(135deg,#0f3460,#1e40af)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:40, fontWeight:900, color:'#93c5fd', boxShadow:'0 0 40px rgba(59,130,246,0.3)' }}>
              {curr?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:22, marginBottom:4 }}>{curr?.name}</div>
              {curr?.contact && <div style={{ color:'#64748b', fontSize:13 }}>👤 {curr.contact}</div>}
              {curr?.phone  && <div style={{ color:'#4ade80', fontSize:13, fontWeight:700, marginTop:2 }}>📞 {curr.phone}</div>}
              {curr?.address && <div style={{ color:'#475569', fontSize:12, marginTop:4 }}>📍 {curr.address}</div>}
            </div>
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
function OfferCard({ offer, markets, supplierName, orders = [], onDelete, onUpdatePrice, onBlast }) {
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
          <div style={{ paddingTop:10, borderTop:'1px solid #1a3a50' }}>
            {/* BIG blast button */}
            {onBlast && markets.filter(m => m.phone).length > 0 && (
              <button onClick={() => onBlast(offer)}
                style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, width:'100%', padding:'12px', borderRadius:14, border:'none', cursor:'pointer', marginBottom:8,
                  background:'linear-gradient(135deg,#16a34a,#15803d)', color:'#fff', fontWeight:900, fontSize:14,
                  boxShadow:'0 4px 16px rgba(16,185,129,0.35)' }}>
                <MessageCircle size={16} />
                📱 Disparar para {markets.filter(m=>m.phone).length} mercados agora
              </button>
            )}
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ color:'#334155', fontSize:10, flex:1 }}>
                🕐 {fmtDT(offer.publishedAt)} · {markets.length} mercado{markets.length !== 1 ? 's' : ''}
              </span>
              <button onClick={() => setShowWa(true)}
                style={{ background:'#0a1929', color:'#64748b', border:'1px solid #1e3050', cursor:'pointer', padding:'5px 10px', borderRadius:8, fontSize:11, fontWeight:700, display:'flex', alignItems:'center', gap:4 }}>
                <MessageCircle size={11} /> Por mercado
              </button>
              {onDelete && (
                <button onClick={() => onDelete(offer.id)} style={{ background:'#1a0a0a', color:'#ef4444', border:'none', cursor:'pointer', padding:'5px 8px', borderRadius:8 }}>
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

/* ── SetupScreen ────────────────────────────────────────────── */
function SetupScreen({ onDone }) {
  const saved = (() => { try { return JSON.parse(localStorage.getItem(fornKey(LOCAL))) || {} } catch { return {} } })()
  const [name, setName]   = useState(saved.name  || '')
  const [phone, setPhone] = useState(saved.phone || '')
  return (
    <div style={{ minHeight:'100dvh', background:'#050f1a', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ textAlign:'center', marginBottom:24 }}>
        <ZatendeStockLogo variant="full" />
        <div style={{ color:'#10b981', fontSize:14, marginTop:10, fontWeight:700 }}>
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
      <div style={{ color:'#1e4060', fontSize:12, marginTop:24 }}>ZatendeStock · Plataforma Distribuidora</div>
    </div>
  )
}

/* ── Demo seed data ─────────────────────────────────────────── */
const DEMO_DATE = (d) => { const dt = new Date(); dt.setDate(dt.getDate() + d); return dt.toISOString().slice(0,10) }
const DEMO_AGO  = (d) => { const dt = new Date(); dt.setDate(dt.getDate() - d); return dt.toISOString() }

/* ── Demo data — 30 dias de operação simulada ─────────────── */
const DEMO_MARKETS = [
  { id:'dmkt1', name:'Supermercado São Jorge',  phone:'15988554433', contact:'Jorge Pereira',  address:'Rua das Acácias, 80, Tatuí, SP',              city:'Tatuí/SP'          },
  { id:'dmkt2', name:'Mercearia do Dinho',       phone:'15997665544', contact:'Claudinho',      address:'Rua Benedito Costa, 220, Itapetininga, SP',    city:'Itapetininga/SP'   },
  { id:'dmkt3', name:'Mini Mercado Expresso',    phone:'15976543210', contact:'Fátima Alves',   address:'Av. Brasil, 1200, Sorocaba, SP',               city:'Sorocaba/SP'       },
  { id:'dmkt4', name:'Armazém do Povo',          phone:'15991234567', contact:'Roberto Santos', address:'Rua Central, 44, São Roque, SP',               city:'São Roque/SP'      },
]

const DEMO_ESTOQUE = [
  // Hoje
  { id:'demo1', productName:'Coca-Cola 2L',              sku:'7894900011630', qty:120, unit:'UND', unitCost:5.20,  totalPaid:624,  sourceType:'atacadista', sourceName:'Atacado Central SP',         expiryDate:DEMO_DATE(45),  receivedAt:today(),       updatedAt:new Date().toISOString() },
  { id:'demo2', productName:'Arroz Tio João 5kg',        sku:'7896036500572', qty:80,  unit:'SC',  unitCost:18.50, totalPaid:1480, sourceType:'atacadista', sourceName:'Atacado Central SP',         expiryDate:DEMO_DATE(365), receivedAt:today(),       updatedAt:new Date().toISOString() },
  // Ontem
  { id:'demo3', productName:'Óleo de Soja Soya 900ml',   sku:'7896036500573', qty:60,  unit:'UND', unitCost:6.80,  totalPaid:408,  sourceType:'contato',    sourceName:'Pedro Distribuição',         expiryDate:DEMO_DATE(180), receivedAt:DEMO_DATE(-1), updatedAt:new Date().toISOString() },
  // 2 dias — URGENTE
  { id:'demo4', productName:'Panetone Bauducco Amassado', sku:'',             qty:156, unit:'UND', unitCost:0.80,  totalPaid:125,  sourceType:'leilao',     sourceName:'Leilão CAIXA SP — Lote 44', expiryDate:DEMO_DATE(12),  receivedAt:DEMO_DATE(-2), updatedAt:new Date().toISOString() },
  { id:'demo5', productName:'Leite Integral Itambé 1L',  sku:'7896051190016', qty:144, unit:'CX',  unitCost:4.30,  totalPaid:619,  sourceType:'danificado', sourceName:'Caixa amassada, produto OK', expiryDate:DEMO_DATE(30),  receivedAt:DEMO_DATE(-2), updatedAt:new Date().toISOString() },
  // Semana passada — histórico
  { id:'demo6', productName:'Biscoito Oreo 90g',         sku:'7622210651557', qty:200, unit:'UND', unitCost:1.80,  totalPaid:360,  sourceType:'danificado', sourceName:'Estoque amassado',           expiryDate:DEMO_DATE(8),   receivedAt:DEMO_DATE(-6), updatedAt:new Date().toISOString() },
  { id:'demo7', productName:'Heineken 350ml Lata',       sku:'7896045506873', qty:300, unit:'UND', unitCost:2.10,  totalPaid:630,  sourceType:'contato',    sourceName:'Distribuidora Gobo',         expiryDate:DEMO_DATE(90),  receivedAt:DEMO_DATE(-8), updatedAt:new Date().toISOString() },
  { id:'demo8', productName:'Feijão Preto 1kg',          sku:'7896085085505', qty:100, unit:'SC',  unitCost:5.40,  totalPaid:540,  sourceType:'atacadista', sourceName:'Atacado Central SP',         expiryDate:DEMO_DATE(180), receivedAt:DEMO_DATE(-15),updatedAt:new Date().toISOString() },
]

const DEMO_OFFERS = [
  { id:'doff1', supplierId:LOCAL, supplierName:'Mega Tudo Barato', supplierPhone:'11 2815-1989', productName:'Panetone Bauducco Amassado', sku:'',             qty:156, unit:'UND', offerPrice:1.50, expiryDate:DEMO_DATE(12), isOpportunity:true,  note:'Embalagem amassada, produto 100% OK — preço abaixo do custo!', status:'pending', publishedAt:DEMO_AGO(2)  },
  { id:'doff2', supplierId:LOCAL, supplierName:'Mega Tudo Barato', supplierPhone:'11 2815-1989', productName:'Leite Integral Itambé 1L',  sku:'7896051190016', qty:144, unit:'CX',  offerPrice:5.20, expiryDate:DEMO_DATE(30), isOpportunity:true,  note:'Caixa amassada — leite perfeito. Entrega imediata.',           status:'pending', publishedAt:DEMO_AGO(2)  },
  { id:'doff3', supplierId:LOCAL, supplierName:'Mega Tudo Barato', supplierPhone:'11 2815-1989', productName:'Coca-Cola 2L',             sku:'7894900011630', qty:120, unit:'UND', offerPrice:6.90, expiryDate:DEMO_DATE(45), isOpportunity:false, note:'Lote novo, direto do atacado. Mínimo 12 un.',                  status:'pending', publishedAt:DEMO_AGO(0)  },
  { id:'doff4', supplierId:LOCAL, supplierName:'Mega Tudo Barato', supplierPhone:'11 2815-1989', productName:'Heineken 350ml Lata',      sku:'7896045506873', qty:300, unit:'UND', offerPrice:3.80, expiryDate:DEMO_DATE(90), isOpportunity:false, note:'Geladinha. Frete incluso acima de 100 unidades.',              status:'pending', publishedAt:DEMO_AGO(8)  },
  { id:'doff5', supplierId:LOCAL, supplierName:'Mega Tudo Barato', supplierPhone:'11 2815-1989', productName:'Biscoito Oreo 90g',        sku:'7622210651557', qty:200, unit:'UND', offerPrice:2.20, expiryDate:DEMO_DATE(8),  isOpportunity:true,  note:'⚠️ Vence em breve — URGENTE! Preço especial pra girar rápido.', status:'pending', publishedAt:DEMO_AGO(6)  },
]

const DEMO_ORDERS_HIST = [
  // ── 2 meses atrás (60-30 dias) ─────────────────────────────
  { id:'dord12', storeName:'Mercado Corta Preços',   storePhone:'15996604075', productName:'Heineken 350ml Lata',       qtyRequested:96,  unit:'UND', totalPrice:364.80, status:'delivered', createdAt:DEMO_AGO(60) },
  { id:'dord13', storeName:'Supermercado São Jorge', storePhone:'15988554433', productName:'Óleo de Soja Soya 900ml',   qtyRequested:30,  unit:'UND', totalPrice:207.00, status:'delivered', createdAt:DEMO_AGO(58) },
  { id:'dord14', storeName:'Armazém do Povo',        storePhone:'15991234567', productName:'Coca-Cola 2L',              qtyRequested:48,  unit:'UND', totalPrice:331.20, status:'delivered', createdAt:DEMO_AGO(55) },
  { id:'dord15', storeName:'Mercado Corta Preços',   storePhone:'15996604075', productName:'Arroz Tio João 5kg',        qtyRequested:15,  unit:'SC',  totalPrice:277.50, status:'delivered', createdAt:DEMO_AGO(52) },
  { id:'dord16', storeName:'Mini Mercado Expresso',  storePhone:'15976543210', productName:'Feijão Preto 1kg',          qtyRequested:20,  unit:'SC',  totalPrice:108.00, status:'delivered', createdAt:DEMO_AGO(50) },
  { id:'dord17', storeName:'Mercearia do Dinho',     storePhone:'15997665544', productName:'Heineken 350ml Lata',       qtyRequested:60,  unit:'UND', totalPrice:228.00, status:'delivered', createdAt:DEMO_AGO(47) },
  { id:'dord18', storeName:'Supermercado São Jorge', storePhone:'15988554433', productName:'Biscoito Oreo 90g',         qtyRequested:100, unit:'UND', totalPrice:220.00, status:'delivered', createdAt:DEMO_AGO(44) },
  { id:'dord19', storeName:'Mercado Corta Preços',   storePhone:'15996604075', productName:'Óleo de Soja Soya 900ml',   qtyRequested:36,  unit:'UND', totalPrice:244.80, status:'delivered', createdAt:DEMO_AGO(41) },
  { id:'dord20', storeName:'Armazém do Povo',        storePhone:'15991234567', productName:'Arroz Tio João 5kg',        qtyRequested:10,  unit:'SC',  totalPrice:185.00, status:'delivered', createdAt:DEMO_AGO(38) },
  { id:'dord21', storeName:'Mini Mercado Expresso',  storePhone:'15976543210', productName:'Heineken 350ml Lata',       qtyRequested:80,  unit:'UND', totalPrice:304.00, status:'delivered', createdAt:DEMO_AGO(35) },
  { id:'dord22', storeName:'Mercearia do Dinho',     storePhone:'15997665544', productName:'Coca-Cola 2L',              qtyRequested:60,  unit:'UND', totalPrice:414.00, status:'delivered', createdAt:DEMO_AGO(32) },
  { id:'dord23', storeName:'Mercado Corta Preços',   storePhone:'15996604075', productName:'Leite Integral Itambé 1L', qtyRequested:24,  unit:'CX',  totalPrice:124.80, status:'delivered', createdAt:DEMO_AGO(30) },
  // ── Mês passado (28-7 dias) ──────────────────────────────────
  { id:'dord1',  storeName:'Supermercado São Jorge', storePhone:'15988554433', productName:'Feijão Preto 1kg',          qtyRequested:40,  unit:'SC',  totalPrice:248.00, status:'delivered', createdAt:DEMO_AGO(28) },
  { id:'dord2',  storeName:'Mercearia do Dinho',     storePhone:'15997665544', productName:'Óleo de Soja Soya 900ml',   qtyRequested:24,  unit:'UND', totalPrice:196.80, status:'delivered', createdAt:DEMO_AGO(25) },
  { id:'dord3',  storeName:'Armazém do Povo',        storePhone:'15991234567', productName:'Feijão Preto 1kg',          qtyRequested:30,  unit:'SC',  totalPrice:186.00, status:'delivered', createdAt:DEMO_AGO(22) },
  { id:'dord4',  storeName:'Mini Mercado Expresso',  storePhone:'15976543210', productName:'Coca-Cola 2L',              qtyRequested:60,  unit:'UND', totalPrice:414.00, status:'delivered', createdAt:DEMO_AGO(20) },
  { id:'dord5',  storeName:'Supermercado São Jorge', storePhone:'15988554433', productName:'Heineken 350ml Lata',       qtyRequested:120, unit:'UND', totalPrice:456.00, status:'delivered', createdAt:DEMO_AGO(15) },
  { id:'dord6',  storeName:'Mercearia do Dinho',     storePhone:'15997665544', productName:'Biscoito Oreo 90g',         qtyRequested:50,  unit:'UND', totalPrice:110.00, status:'delivered', createdAt:DEMO_AGO(12) },
  { id:'dord7',  storeName:'Armazém do Povo',        storePhone:'15991234567', productName:'Heineken 350ml Lata',       qtyRequested:60,  unit:'UND', totalPrice:228.00, status:'delivered', createdAt:DEMO_AGO(10) },
  { id:'dord8',  storeName:'Mini Mercado Expresso',  storePhone:'15976543210', productName:'Leite Integral Itambé 1L', qtyRequested:48,  unit:'CX',  totalPrice:249.60, status:'delivered', createdAt:DEMO_AGO(7)  },
  // ── Semana — confirmados ─────────────────────────────────────
  { id:'dord9',  storeName:'Supermercado São Jorge', storePhone:'15988554433', productName:'Arroz Tio João 5kg',        qtyRequested:20,  unit:'SC',  totalPrice:370.00, status:'confirmed', createdAt:DEMO_AGO(3)  },
  { id:'dord10', storeName:'Mercearia do Dinho',     storePhone:'15997665544', productName:'Panetone Bauducco Amassado',qtyRequested:60,  unit:'UND', totalPrice:90.00,  status:'confirmed', createdAt:DEMO_AGO(2)  },
  // ── Hoje — pendente (acaba de chegar!) ───────────────────────
  { id:'dord11', storeName:'Mini Mercado Expresso',  storePhone:'15976543210', productName:'Coca-Cola 2L',              qtyRequested:24,  unit:'UND', totalPrice:165.60, status:'pending',   createdAt:DEMO_AGO(0)  },
]

/* ── TabInicio ──────────────────────────────────────────────── */
function TabInicio({ estoque, offers, orders, profile, markets, setEstoque, setOffers, setMarkets, setOrders, onNavigate, zapServerUrl, zapConnected, recurrences, setRecurrences }) {
  const [showBlitz,  setShowBlitz]  = useState(false)
  const [blastAll,   setBlastAll]   = useState(false)
  const [editItem,   setEditItem]   = useState(null)
  const [toast,      setToast]      = useState('')
  const todayStr = today()

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3500) }

  async function deleteEstoque(id) {
    if (!window.confirm('Remover este item do estoque?')) return
    const next = estoque.filter(e => e.id !== id)
    setEstoque(next); await persistKey(ESTOQUE_KEY, next)
  }

  async function saveEditItem(patch) {
    const next = estoque.map(e => e.id === editItem.id ? { ...e, ...patch } : e)
    setEstoque(next); await persistKey(ESTOQUE_KEY, next)
    setEditItem(null)
  }

  /* Build combined WA message for ALL active offers — no price change */
  function buildDailyBlastMsg() {
    const active = offers.filter(o => o.status !== 'delivered' && o.offerPrice > 0)
    if (!active.length) return null
    const lines = [
      `🚚 *OFERTAS DO DIA — ${profile.name}*`,
      '',
      ...active.map(o => `📦 *${o.productName}* — ${BRL.format(o.offerPrice)}/un  ·  ${o.qty} ${o.unit}${o.expiryDate ? `  ·  val ${fmtDate(o.expiryDate)}` : ''}`),
      '',
      '👉 *Fazer pedido agora:*',
      ofertasUrl(),
      '',
      profile.phone ? `📞 ${profile.name} · ${profile.phone}` : `📞 ${profile.name}`,
    ]
    return lines.join('\n')
  }

  /* FIFO aging */
  const withAge = useMemo(() =>
    estoque.filter(e => e.qty > 0).map(e => ({
      ...e,
      ageInDays: Math.max(0, Math.floor((Date.now() - new Date((e.receivedAt || todayStr) + 'T12:00:00')) / 86400000))
    })).sort((a, b) => b.ageInDays - a.ageInDays)
  , [estoque])

  const urgent    = withAge.filter(e => e.ageInDays >= 2)
  const attention = withAge.filter(e => e.ageInDays === 1)
  const newToday  = withAge.filter(e => e.ageInDays === 0)

  /* Daily P&L */
  const spentToday = useMemo(() =>
    estoque.filter(e => e.receivedAt === todayStr).reduce((s, e) => s + (e.totalPaid || 0), 0)
  , [estoque, todayStr])
  const soldToday = useMemo(() =>
    orders.filter(o => o.createdAt?.slice(0, 10) === todayStr).reduce((s, o) => s + (o.totalPrice || 0), 0)
  , [orders, todayStr])
  const profit = soldToday - spentToday

  /* Sold qty per product (from delivered orders) */
  const soldPerProduct = useMemo(() => {
    const map = {}
    orders.filter(o => o.status === 'delivered').forEach(o => {
      const key = (o.productName || '').toLowerCase()
      if (key) map[key] = (map[key] || 0) + (o.qtyRequested || 0)
    })
    return map
  }, [orders])

  /* Find matching active offer for a stock item */
  function findOffer(item) {
    return offers.find(o => o.status !== 'delivered' &&
      o.productName.toLowerCase() === item.productName.toLowerCase()
    )
  }

  /* Reduce offer price and start blast — accepts stock item OR offer object */
  const [singleBlast, setSingleBlast] = useState(null)
  async function quickBlast(itemOrOffer, discountPct) {
    // Support both: stock item (has productName, look up offer) or direct offer object (has offerPrice)
    const offer = itemOrOffer.offerPrice !== undefined
      ? itemOrOffer  // direct offer object
      : findOffer(itemOrOffer) // stock item → find matching offer
    if (!offer) return
    const newPrice = parseFloat((offer.offerPrice * (1 - discountPct / 100)).toFixed(2))
    const newOffer = { ...offer, offerPrice: newPrice }
    const nextOffers = offers.map(o => o.id === offer.id ? newOffer : o)
    setOffers(nextOffers)
    await persistKey(OFFERS_KEY, nextOffers)
    setSingleBlast(newOffer)
  }

  async function carregarDemo() {
    // Mercados já gerenciados pelo auto-seed — só recarrega estoque/ofertas/pedidos
    setEstoque(DEMO_ESTOQUE); setOffers(DEMO_OFFERS)
    setOrders(prev => { const ids = new Set(prev.map(o => o.id)); return [...DEMO_ORDERS_HIST.filter(o => !ids.has(o.id)), ...prev] })
    await persistKey(ESTOQUE_KEY, DEMO_ESTOQUE)
    await persistKey(OFFERS_KEY,  DEMO_OFFERS)
    await persistKey(ORDERS_KEY,  DEMO_ORDERS_HIST)
  }

  if (singleBlast) return <BlastScreen offer={singleBlast} markets={markets} supplierName={profile.name} supplierPhone={profile.phone} onDone={() => setSingleBlast(null)} zapServerUrl={zapServerUrl} zapConnected={zapConnected} />
  if (blastAll) {

    const msg = buildDailyBlastMsg()
    if (!msg) { setBlastAll(false) }
    else return <BlastScreen customMsg={msg} markets={markets} supplierName={profile.name} supplierPhone={profile.phone} onDone={() => setBlastAll(false)} zapServerUrl={zapServerUrl} zapConnected={zapConnected} />
  }

  const srcCfg = (id) => SOURCE_TYPES.find(s => s.id === id) || SOURCE_TYPES[4]
  const pendingOrders = orders.filter(o => o.status === 'pending').length
  const totalRevenue  = orders.reduce((s, o) => s + (o.totalPrice || 0), 0)

  const FifoRow = ({ item }) => {
    const offer    = findOffer(item)
    const src      = srcCfg(item.sourceType)
    const exp      = item.expiryDate ? Math.ceil((new Date(item.expiryDate) - new Date()) / 86400000) : null
    const soldQty  = soldPerProduct[(item.productName || '').toLowerCase()] || 0
    const remaining = Math.max(0, item.qty - soldQty)
    const expColor = exp === null ? null : exp <= 0 ? '#ef4444' : exp <= 7 ? '#f87171' : exp <= 30 ? '#f59e0b' : '#10b981'
    return (
      <div style={{ background:'#0d2137', borderRadius:14, marginBottom:8, overflow:'hidden', border:'1px solid ' + (item.ageInDays >= 2 ? '#7f1d1d' : '#78350f') }}>
        <div style={{ padding:'10px 14px', display:'flex', gap:10, alignItems:'flex-start' }}>
          <div style={{ flexShrink:0, fontSize:16, marginTop:2 }}>{src.emoji}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ color:'#f1f5f9', fontWeight:800, fontSize:14, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.productName}</div>

            {/* Estoque: recebido / vendido / restante */}
            <div style={{ display:'flex', gap:10, marginTop:4, flexWrap:'wrap' }}>
              <span style={{ color:'#64748b', fontSize:11 }}>Recebido: <strong style={{ color:'#94a3b8' }}>{item.qty} {item.unit}</strong></span>
              {soldQty > 0 && <span style={{ color:'#64748b', fontSize:11 }}>Vendido: <strong style={{ color:'#f97316' }}>{soldQty} {item.unit}</strong></span>}
              <span style={{ color:'#64748b', fontSize:11 }}>Restam: <strong style={{ color: remaining <= 0 ? '#ef4444' : remaining <= item.qty * 0.2 ? '#f59e0b' : '#4ade80' }}>{remaining} {item.unit}</strong></span>
            </div>

            {/* Validade + custo */}
            <div style={{ display:'flex', gap:8, marginTop:3, flexWrap:'wrap', alignItems:'center' }}>
              {exp !== null && (
                <span style={{ background: expColor + '22', color: expColor, borderRadius:6, padding:'1px 7px', fontSize:10, fontWeight:800 }}>
                  {exp <= 0 ? '⚠️ VENCIDO' : exp <= 7 ? `🔴 Vence em ${exp}d` : exp <= 30 ? `🟡 Val: ${exp}d` : `🟢 Val: ${exp}d`}
                </span>
              )}
              {item.unitCost > 0 && (
                <span style={{ color:'#334155', fontSize:10 }}>
                  🔒 custo {item.unitCost < 0.01 ? `R$${item.unitCost.toFixed(4).replace('.',',')}` : BRL.format(item.unitCost)}/un
                </span>
              )}
            </div>
          </div>
          <div style={{ textAlign:'right', flexShrink:0 }}>
            {offer && <div style={{ color:'#10b981', fontWeight:900, fontSize:15 }}>{BRL.format(offer.offerPrice)}/un</div>}
            <div style={{ color: item.ageInDays >= 2 ? '#f87171' : '#fbbf24', fontSize:11, fontWeight:700 }}>
              {item.ageInDays === 0 ? 'hoje' : `há ${item.ageInDays}d`}
            </div>
            {/* Barra de giro */}
            {item.qty > 0 && (
              <div style={{ width:52, height:4, background:'#1a3a50', borderRadius:2, marginTop:4, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${Math.round((soldQty / item.qty) * 100)}%`, background:'#f97316', borderRadius:2 }} />
              </div>
            )}
          </div>
        </div>
        {offer && (
          <div style={{ display:'flex', gap:0, borderTop:'1px solid #1a3a50' }}>
            {[10, 20, 30].map(pct => (
              <button key={pct} onClick={() => quickBlast(item, pct)}
                style={{ flex:1, padding:'9px 0', background:'transparent', border:'none', borderRight:'1px solid #1a3a50', cursor:'pointer', color:'#fbbf24', fontSize:12, fontWeight:700 }}>
                -{pct}% + ZAP
              </button>
            ))}
            <button onClick={() => setSingleBlast(offer)}
              style={{ flex:1, padding:'9px 0', background:'#14532d', border:'none', cursor:'pointer', color:'#4ade80', fontSize:12, fontWeight:700 }}>
              📱 ZAP
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ padding:'16px 16px 100px' }}>

      {showBlitz && <BlitzModal offers={offers} setOffers={setOffers} markets={markets} profile={profile} onClose={() => setShowBlitz(false)} zapServerUrl={zapServerUrl} zapConnected={zapConnected} />}

      {/* Edit stock item modal */}
      {editItem && (() => {
        let newQty = String(editItem.qty)
        let newExpiry = editItem.expiryDate || ''
        let newPaid = editItem.totalPaid ? editItem.totalPaid.toLocaleString('pt-BR',{minimumFractionDigits:2}) : ''
        return (
          <div style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
            <div style={{ background:'#0a1929', borderRadius:20, padding:24, width:'100%', maxWidth:360, border:'1px solid #1e4060' }}>
              <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:16, marginBottom:4 }}>✏️ Editar Estoque</div>
              <div style={{ color:'#64748b', fontSize:12, marginBottom:16, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{editItem.productName}</div>
              <label style={{ color:'#64748b', fontSize:10, fontWeight:700, textTransform:'uppercase' }}>Quantidade</label>
              <input defaultValue={newQty} onChange={e => newQty = e.target.value} type="number"
                style={{ display:'block', width:'100%', marginTop:6, marginBottom:12, background:'#0d2137', border:'1px solid #1e4060', borderRadius:12, padding:'12px 14px', color:'#e2e8f0', fontSize:18, fontWeight:900, boxSizing:'border-box', outline:'none' }} />
              <label style={{ color:'#64748b', fontSize:10, fontWeight:700, textTransform:'uppercase' }}>Total Pago (R$)</label>
              <input defaultValue={newPaid} onChange={e => newPaid = e.target.value} inputMode="decimal"
                style={{ display:'block', width:'100%', marginTop:6, marginBottom:12, background:'#0d2137', border:'1px solid #1e4060', borderRadius:12, padding:'12px 14px', color:'#e2e8f0', fontSize:15, boxSizing:'border-box', outline:'none' }} />
              <label style={{ color:'#64748b', fontSize:10, fontWeight:700, textTransform:'uppercase' }}>Validade</label>
              <input defaultValue={newExpiry} onChange={e => newExpiry = e.target.value} type="date"
                style={{ display:'block', width:'100%', marginTop:6, marginBottom:20, background:'#0d2137', border:'1px solid #7c2d12', borderRadius:12, padding:'12px 14px', color:'#fed7aa', fontSize:14, boxSizing:'border-box', outline:'none' }} />
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={() => {
                  const paid = parseNum(newPaid)
                  const q    = parseFloat(newQty) || 0
                  saveEditItem({ qty: q, expiryDate: newExpiry || null, totalPaid: paid, unitCost: paid > 0 && q > 0 ? paid/q : editItem.unitCost })
                }} style={{ flex:1, background:'linear-gradient(135deg,#10b981,#059669)', border:'none', borderRadius:12, padding:12, color:'#fff', fontWeight:800, fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                  <Check size={16} /> Salvar
                </button>
                <button onClick={() => setEditItem(null)} style={{ flex:1, background:'#0d2137', border:'1px solid #1e4060', borderRadius:12, padding:12, color:'#64748b', fontWeight:800, fontSize:14, cursor:'pointer' }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Header greeting */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <div>
          <div style={{ color:'#10b981', fontSize:13, fontWeight:700 }}>Bom dia! 👋</div>
          <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:20 }}>{profile.name}</div>
        </div>
        {offers.filter(o => o.status !== 'delivered').length > 0 && (
          <button onClick={() => setShowBlitz(true)}
            style={{ background:'linear-gradient(135deg,#78350f,#d97706)', border:'none', borderRadius:14, padding:'10px 14px', cursor:'pointer', display:'flex', alignItems:'center', gap:6, color:'#fef3c7', fontWeight:800, fontSize:13 }}>
            <Zap size={16} /> Blitz
          </button>
        )}
      </div>

      {/* Quick action buttons */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:16 }}>
        {[
          { emoji:'📦', label:'Receber\nMercadoria', action:() => onNavigate?.('receber'), bg:'#0d3d27', border:'#14532d', color:'#4ade80' },
          { emoji:'📱', label:'Disparar\nZAP',       action:() => {
              const active = offers.filter(o => o.status !== 'delivered' && o.offerPrice > 0)
              if (active.length > 0) setBlastAll(true)
              else if (markets.length === 0) showToast('⚠️ Nenhum mercado cadastrado! Vá em "Mercados" e adicione um cliente.')
              else showToast('⚠️ Sem ofertas com preço! Receba uma mercadoria e defina o preço de venda.')
            }, bg:'#1e3a5f', border:'#2563eb', color:'#93c5fd' },
          { emoji:'📋', label:'Ver\nPedidos',        action:() => onNavigate?.('pedidos'), bg: withAge.filter(e=>e.ageInDays>=2).length>0?'#3d1a0a':'#0d2137', border: withAge.filter(e=>e.ageInDays>=2).length>0?'#92400e':'#1a3a50', color:'#fcd34d' },
        ].map((btn, i) => (
          <button key={i} onClick={btn.action} style={{
            background:btn.bg, border:`1px solid ${btn.border}`, borderRadius:14, padding:'12px 8px',
            cursor:'pointer', textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:4,
          }}>
            <span style={{ fontSize:24 }}>{btn.emoji}</span>
            <span style={{ color:btn.color, fontSize:10, fontWeight:700, lineHeight:1.3, whiteSpace:'pre-line' }}>{btn.label}</span>
          </button>
        ))}
      </div>

      {/* ── Recorrências do dia ── */}
      {recurrences?.length > 0 && (() => {
        const due = recurrences.filter(r => {
          if (!r.lastContact) return true
          const d = new Date(r.lastContact)
          d.setDate(d.getDate() + parseInt(r.frequency, 10))
          return d <= new Date()
        })
        if (due.length === 0) return null
        return (
          <div style={{ background:'#7c2d1222', borderRadius:14, padding:'12px 14px', marginBottom:14, border:'1px solid #92400e' }}>
            <div style={{ color:'#fcd34d', fontSize:12, fontWeight:800, marginBottom:8 }}>📅 {due.length} recorrência{due.length !== 1 ? 's' : ''} pra contatar hoje</div>
            {due.slice(0, 3).map(r => (
              <div key={r.id} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                <span style={{ color:'#f1f5f9', fontSize:12, flex:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  <strong>{r.marketName}</strong> — {r.productName} ({r.qty} {r.unit})
                </span>
                <a href={`https://wa.me/${cleanPhone(r.marketPhone)}?text=${encodeURIComponent(`Olá ${r.marketName}! Você costuma pedir ${r.productName} (${r.qty} ${r.unit}). Quer renovar? 📦`)}`}
                  target="_blank" rel="noreferrer"
                  style={{ background:'#14532d', borderRadius:8, padding:'4px 10px', color:'#4ade80', fontSize:11, fontWeight:700, textDecoration:'none', display:'flex', alignItems:'center', gap:3, flexShrink:0 }}>
                  <MessageCircle size={11} /> ZAP
                </a>
              </div>
            ))}
            {due.length > 3 && <div style={{ color:'#64748b', fontSize:11, marginTop:4 }}>+{due.length - 3} mais — veja em Mercados</div>}
          </div>
        )
      })()}

      {/* ── FIFO Urgency ── */}
      {urgent.length > 0 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
            <div style={{ width:8, height:8, borderRadius:4, background:'#ef4444' }} />
            <span style={{ color:'#f87171', fontSize:12, fontWeight:800, textTransform:'uppercase' }}>🔴 Gire agora — {urgent.length} item{urgent.length !== 1 ? 's' : ''} parado{urgent.length !== 1 ? 's' : ''} ({urgent[0]?.ageInDays}d+)</span>
          </div>
          {urgent.map(item => <FifoRow key={item.id} item={item} />)}
        </div>
      )}

      {attention.length > 0 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
            <div style={{ width:8, height:8, borderRadius:4, background:'#f59e0b' }} />
            <span style={{ color:'#fbbf24', fontSize:12, fontWeight:800, textTransform:'uppercase' }}>⚡ Chegou ontem — {attention.length} item{attention.length !== 1 ? 's' : ''}</span>
          </div>
          {attention.map(item => <FifoRow key={item.id} item={item} />)}
        </div>
      )}

      {/* ── Balanço do Dia ── */}
      {(() => {
        const todayEntradas = estoque.filter(e => e.receivedAt === todayStr)
        const hasCostData   = todayEntradas.some(e => e.totalPaid > 0)
        const showProfit    = hasCostData && soldToday > 0
        return (
          <div style={{ background:'#0d2137', borderRadius:16, padding:'14px 16px', marginBottom:16, border:'1px solid #1a3a50' }}>
            <div style={{ color:'#64748b', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10 }}>💰 Balanço de Hoje</div>
            <div style={{ display:'flex', gap:0 }}>
              <div style={{ flex:1, textAlign:'center' }}>
                <div style={{ color:'#f87171', fontWeight:900, fontSize:18 }}>{hasCostData ? BRL.format(spentToday) : '—'}</div>
                <div style={{ color:'#64748b', fontSize:11 }}>investido</div>
              </div>
              <div style={{ width:1, background:'#1a3a50' }} />
              <div style={{ flex:1, textAlign:'center' }}>
                <div style={{ color:'#4ade80', fontWeight:900, fontSize:18 }}>{soldToday > 0 ? BRL.format(soldToday) : '—'}</div>
                <div style={{ color:'#64748b', fontSize:11 }}>faturado</div>
              </div>
              <div style={{ width:1, background:'#1a3a50' }} />
              <div style={{ flex:1, textAlign:'center' }}>
                <div style={{ color: showProfit ? (profit >= 0 ? '#10b981' : '#f87171') : '#334155', fontWeight:900, fontSize:18 }}>
                  {showProfit ? BRL.format(Math.abs(profit)) : '—'}
                </div>
                <div style={{ color:'#64748b', fontSize:11 }}>{showProfit ? (profit >= 0 ? 'lucro' : 'prejuízo') : 'resultado'}</div>
              </div>
            </div>
            {!hasCostData && todayEntradas.length > 0 && (
              <div style={{ color:'#334155', fontSize:10, textAlign:'center', marginTop:8 }}>
                ℹ️ Informe o "Total pago" ao dar entrada para ver o lucro
              </div>
            )}
          </div>
        )
      })()}

      {/* ── Stats ── */}
      <div style={{ display:'flex', gap:10, marginBottom:10 }}>
        <StatCard icon={Boxes}         label="Em Estoque" value={withAge.length}                    sub={withAge.reduce((s,e)=>s+e.qty,0) + ' unidades'} color="#10b981" />
        <StatCard icon={TrendingUp}    label="Ofertas"    value={offers.filter(o=>o.status==='pending').length} sub="aguardando aceite" color="#3b82f6" />
      </div>
      <div style={{ display:'flex', gap:10, marginBottom:20 }}>
        <StatCard icon={ClipboardList}    label="Pedidos"  value={pendingOrders}         sub="a confirmar"  color="#f59e0b" />
        <StatCard icon={CircleDollarSign} label="Total"    value={BRL.format(totalRevenue)} sub="em pedidos" color="#8b5cf6" />
      </div>

      {/* ── Ofertas Ativas — blast por produto ── */}
      {offers.filter(o => o.status !== 'delivered').length > 0 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ color:'#64748b', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10 }}>
            📢 Ofertas Ativas — toque para disparar
          </div>
          {offers.filter(o => o.status !== 'delivered').map(offer => (
            <div key={offer.id} style={{ background:'#0d2137', borderRadius:12, marginBottom:6, border:'1px solid #1a3a50', overflow:'hidden' }}>
              <div style={{ padding:'10px 14px', display:'flex', gap:10, alignItems:'center' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ color:'#e2e8f0', fontWeight:800, fontSize:13, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{offer.productName}</div>
                  <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:2 }}>
                    <span style={{ color:'#10b981', fontWeight:900, fontSize:15 }}>{BRL.format(offer.offerPrice)}/un</span>
                    <span style={{ color:'#334155', fontSize:11 }}>{offer.qty} {offer.unit}</span>
                    {offer.expiryDate && (() => { const d = Math.ceil((new Date(offer.expiryDate) - Date.now())/86400000); return d <= 14 ? <span style={{ background:'#7c2d12', color:'#fca5a5', fontSize:10, fontWeight:900, padding:'1px 6px', borderRadius:6 }}>URGENTE</span> : null })()}
                  </div>
                </div>
              </div>
              {/* Per-offer blast buttons */}
              <div style={{ display:'flex', borderTop:'1px solid #1a3a50' }}>
                <button onClick={() => setSingleBlast(offer)}
                  style={{ flex:1, background:'linear-gradient(135deg,#14532d,#166534)', color:'#4ade80', border:'none', cursor:'pointer', padding:'9px 0', fontWeight:800, fontSize:12, display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                  <MessageCircle size={13} /> 📱 Disparar para {markets.filter(m=>m.phone).length} mercados
                </button>
                {[10,20,30].map(pct => (
                  <button key={pct} onClick={() => quickBlast(offer.productName ? { ...estoque.find(e=>e.productName===offer.productName), ...offer } : offer, pct)}
                    style={{ background:'#78350f', color:'#fcd34d', border:'none', borderLeft:'1px solid #1a3a50', cursor:'pointer', padding:'9px 10px', fontWeight:800, fontSize:11, whiteSpace:'nowrap' }}>
                    -{pct}%
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Chegou hoje ── */}
      {newToday.length > 0 && (
        <>
          <div style={{ color:'#64748b', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10 }}>
            ✅ Chegou hoje ({newToday.length})
          </div>
          {newToday.map(item => {
            const src = srcCfg(item.sourceType)
            return (
              <div key={item.id} style={{ background:'#0d2137', borderRadius:12, marginBottom:6, border:'1px solid #1a3a50', overflow:'hidden' }}>
                <div style={{ display:'flex', gap:10, alignItems:'center', padding:'10px 14px' }}>
                  <span style={{ fontSize:16, flexShrink:0 }}>{src.emoji}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ color:'#e2e8f0', fontWeight:700, fontSize:13, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.productName}</div>
                    {item.sourceName && <div style={{ color:'#334155', fontSize:11 }}>{item.sourceName}</div>}
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <div style={{ color:'#10b981', fontWeight:900, fontSize:16 }}>{item.qty} <span style={{ fontSize:11, color:'#475569' }}>{item.unit}</span></div>
                    {item.totalPaid > 0 && <div style={{ color:'#334155', fontSize:11 }}>🔒 {BRL.format(item.totalPaid)}</div>}
                  </div>
                </div>
                <div style={{ display:'flex', borderTop:'1px solid #1a3a50' }}>
                  <button onClick={() => setEditItem(item)}
                    style={{ flex:1, background:'#1e3a5f22', border:'none', padding:'7px 0', color:'#64748b', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
                    ✏️ Editar
                  </button>
                  <button onClick={() => deleteEstoque(item.id)}
                    style={{ flex:1, background:'#7c1d1d22', border:'none', borderLeft:'1px solid #1a3a50', padding:'7px 0', color:'#f87171', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
                    🗑 Deletar
                  </button>
                </div>
              </div>
            )
          })}
        </>
      )}

      {/* ── Empty state ── */}
      {estoque.length === 0 && (
        <div style={{ background:'#0d2137', borderRadius:16, padding:24, textAlign:'center', border:'1px solid #1a3a50' }}>
          <Boxes size={32} color="#1e4060" style={{ marginBottom:8 }} />
          <div style={{ color:'#475569', fontSize:14, marginBottom:4 }}>Sem estoque ainda</div>
          <div style={{ color:'#334155', fontSize:12, marginBottom:16 }}>Use Receber pra dar entrada</div>
          <button onClick={carregarDemo} style={{ background:'#0a2a4a', border:'1px solid #1e6091', borderRadius:12, padding:'10px 20px', color:'#93c5fd', fontSize:13, fontWeight:700, cursor:'pointer' }}>
            🎯 Carregar dados de exemplo
          </button>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{ position:'fixed', bottom:88, left:'50%', transform:'translateX(-50%)', zIndex:500, background:'#1c1917', border:'1px solid #f97316', borderRadius:16, padding:'14px 22px', color:'#fed7aa', fontSize:14, fontWeight:700, boxShadow:'0 8px 40px rgba(0,0,0,0.6)', maxWidth:'90vw', textAlign:'center', whiteSpace:'pre-line' }}>
          {toast}
        </div>
      )}
    </div>
  )
}

const SUPPLIERS_KEY = 'cp_fornecedor_suppliers'

/* ── TabReceber ─────────────────────────────────────────────── */
function TabReceber({ estoque, setEstoque, offers, setOffers, markets, profile, zapServerUrl, zapConnected }) {
  const [selected,    setSelected]   = useState(null)  // { name, sku, price }
  const [sourceType,  setSourceType] = useState('leilao')
  const [sourceName,  setSourceName] = useState('')
  const [supplierSuggestions, setSupplierSuggestions] = useState(false) // show dropdown
  const [qty,           setQty]           = useState('')
  const [unit,          setUnit]          = useState('UND')
  const [totalPaid,     setTotalPaid]     = useState('')
  const [expiryDate,    setExpiryDate]    = useState('')
  const [offerPrice,    setOfferPrice]    = useState('')
  const [isOpp,         setIsOpp]         = useState(false)
  const [offerNote,     setOfferNote]     = useState('')
  const [saving,        setSaving]        = useState(false)
  const [blast,         setBlast]         = useState(null)
  const [paletMode,     setPaletMode]     = useState(false)
  const [paletCount,    setPaletCount]    = useState('')
  const [unitsPerPalet, setUnitsPerPalet] = useState('')
  const [costMode,      setCostMode]      = useState('perUnit') // 'perUnit' | 'totalLot'
  const [viewMode,      setViewMode]      = useState('entry')   // 'entry' | 'stock'
  const [stockFilter,   setStockFilter]   = useState('all')     // 'all' | 'noPrice' | 'expiring' | 'lowQty'
  const [editPrice,     setEditPrice]     = useState(null)      // id of item being inline-edited

  function handleSelect(p) {
    setSelected(p)
    if (p.price) setOfferPrice(String((p.price * 1.35).toFixed(2)).replace('.', ','))
  }

  function applyExpiryShortcut(days) {
    const dt = new Date(); dt.setDate(dt.getDate() + days)
    setExpiryDate(dt.toISOString().slice(0, 10))
  }

  function reset() {
    setSelected(null); setQty(''); setTotalPaid(''); setExpiryDate('')
    setOfferPrice(''); setIsOpp(false); setOfferNote(''); setSourceName('')
    setPaletMode(false); setPaletCount(''); setUnitsPerPalet(''); setCostMode('perUnit')
  }

  // Qty resolved: palete mode multiplies paletes × unidades/palete
  const paletTotal = paletMode ? (parseFloat(paletCount || 0) * parseFloat(unitsPerPalet || 0)) : 0
  const qtyNum     = paletMode ? paletTotal : (parseFloat(qty) || 0)
  const paid       = parseNum(totalPaid)
  // costMode: 'perUnit' = usuário digita preço/un, sistema calcula total
  //           'totalLot' = usuário digita o total pago, sistema calcula custo/un
  const unitCost        = costMode === 'perUnit'
    ? paid                                              // direto: R$3/un
    : (paid > 0 && qtyNum > 0 ? paid / qtyNum : 0)     // total ÷ qty
  const totalPaidActual = costMode === 'perUnit'
    ? paid * qtyNum                                     // R$3 × 700 = R$2.100
    : paid                                              // valor digitado já é o total
  const sellPrice  = parseNum(offerPrice)
  // Margem bruta (sobre venda), não markup — max 100%, intuitiva para varejo
  const margin     = sellPrice > 0 ? Math.round(((sellPrice - unitCost) / sellPrice) * 100) : null
  const fmtCost    = v => v <= 0 ? '—' : v < 0.01 ? `R$${v.toFixed(4).replace('.',',')}` : v < 0.10 ? `R$${v.toFixed(3).replace('.',',')}` : BRL.format(v)
  const canBlast   = sellPrice > 0
  const validMkts = (markets || []).filter(m => m.phone).length
  const inp = { display:'block', width:'100%', background:'#0a1929', border:'1px solid #1e4060', borderRadius:12, padding:'11px 14px', color:'#e2e8f0', fontSize:16, fontWeight:600, boxSizing:'border-box', outline:'none' }

  // Supplier autocomplete — local list keyed by sourceType
  const savedSuppliers = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(fornKey(SUPPLIERS_KEY)) || '{}') } catch { return {} }
  }, [sourceName]) // re-read when user types (to refresh after save)
  const currentTypeSuggestions = (savedSuppliers[sourceType] || []).filter(
    s => sourceName.trim() === '' || s.toLowerCase().includes(sourceName.toLowerCase())
  )

  function pickSupplier(name) { setSourceName(name); setSupplierSuggestions(false) }

  function saveSupplierIfNew(name) {
    if (!name.trim()) return
    try {
      const all = JSON.parse(localStorage.getItem(fornKey(SUPPLIERS_KEY)) || '{}')
      const list = all[sourceType] || []
      if (!list.includes(name.trim())) {
        all[sourceType] = [name.trim(), ...list].slice(0, 20)
        localStorage.setItem(fornKey(SUPPLIERS_KEY), JSON.stringify(all))
      }
    } catch {}
  }

  async function handleSubmit() {
    if (!selected || qtyNum <= 0) return
    // Warn if no sell price — can't ZAP without it
    if (sellPrice === 0) {
      const ok = window.confirm('⚠️ Preço de venda não definido!\n\nSem preço você não consegue disparar no ZAP.\n\nDefinir depois? (OK = sim, salva sem preço)')
      if (!ok) return
    }
    setSaving(true)

    // 1. Add to estoque — 🔒 internal fields (never in offer object)
    const item = {
      id: uid(), productName: selected.name, sku: selected.sku || '',
      qty: qtyNum, unit, unitCost, totalPaid: totalPaidActual,
      sourceType, sourceName: sourceName.trim() || null, // save supplier name for autocomplete

      expiryDate: expiryDate || null,
      receivedAt: today(), updatedAt: new Date().toISOString(),
    }
    const idx = estoque.findIndex(e => e.productName === selected.name && e.unit === unit)
    const nextEstoque = idx >= 0
      ? estoque.map((e, i) => i === idx ? { ...e, qty: e.qty + qtyNum, expiryDate: expiryDate || e.expiryDate, updatedAt: new Date().toISOString() } : e)
      : [...estoque, item]
    setEstoque(nextEstoque)
    await persistKey(ESTOQUE_KEY, nextEstoque)
    saveSupplierIfNew(sourceName.trim())

    // 2. Create offer (🔒 cost/source NEVER included)
    if (sellPrice > 0) {
      const offer = {
        id: uid(), supplierId: LOCAL, supplierName: profile?.name || 'Distribuidora', supplierPhone: profile?.phone || '',
        productName: selected.name, sku: selected.sku || '', qty: qtyNum, unit,
        offerPrice: sellPrice, expiryDate: expiryDate || null, isOpportunity: isOpp,
        note: offerNote.trim(), status: 'pending', publishedAt: new Date().toISOString(),
      }
      const nextOffers = [offer, ...(offers || [])]
      setOffers(nextOffers)
      await persistKey(OFFERS_KEY, nextOffers)
      if (validMkts > 0) { setSaving(false); reset(); setBlast(offer); return }
    }

    setSaving(false); reset()
  }

  async function handleRemove(id) {
    const next = estoque.filter(e => e.id !== id)
    setEstoque(next); await persistKey(ESTOQUE_KEY, next)
  }

  if (blast) return <BlastScreen offer={blast} markets={markets} supplierName={profile?.name || 'Distribuidora'} supplierPhone={profile?.phone || ''} onDone={() => setBlast(null)} zapServerUrl={zapServerUrl} zapConnected={zapConnected} />

  /* ── Stock view computed values ── */
  const totalInvested = estoque.reduce((s, e) => s + (e.totalPaid || 0), 0)
  const hoje = today()
  const stockWithMeta = estoque.map(e => {
    const daysLeft = e.expiryDate ? Math.ceil((new Date(e.expiryDate) - new Date()) / 86400000) : null
    const hasPrice  = !!e.offerPrice && e.offerPrice > 0
    const margin    = (e.offerPrice > 0 && e.unitCost > 0) ? Math.round(((e.offerPrice - e.unitCost) / e.offerPrice) * 100) : null
    return { ...e, daysLeft, hasPrice, margin }
  })
  const filteredStock = stockFilter === 'all'     ? stockWithMeta
    : stockFilter === 'noPrice'  ? stockWithMeta.filter(e => !e.hasPrice)
    : stockFilter === 'expiring' ? stockWithMeta.filter(e => e.daysLeft != null && e.daysLeft <= 30)
    : stockFilter === 'lowQty'   ? stockWithMeta.filter(e => e.qty <= 5)
    : stockWithMeta
  const stockAlerts = {
    noPrice:  stockWithMeta.filter(e => !e.hasPrice).length,
    expiring: stockWithMeta.filter(e => e.daysLeft != null && e.daysLeft <= 30).length,
    lowQty:   stockWithMeta.filter(e => e.qty <= 5).length,
  }

  return (
    <div style={{ padding:'16px 16px 100px' }}>

      {/* ── Segmented control: Entrada vs Estoque ── */}
      <div style={{ display:'flex', background:'#0a1929', borderRadius:14, padding:4, marginBottom:16, border:'1px solid #1e4060' }}>
        <button onClick={() => setViewMode('entry')} style={{ flex:1, padding:'10px 0', borderRadius:10, border:'none', background: viewMode === 'entry' ? 'linear-gradient(135deg,#10b981,#059669)' : 'transparent', color: viewMode === 'entry' ? '#fff' : '#475569', fontWeight:800, fontSize:13, cursor:'pointer', transition:'all 0.2s' }}>
          📥 Dar Entrada
        </button>
        <button onClick={() => setViewMode('stock')} style={{ flex:1, padding:'10px 0', borderRadius:10, border:'none', background: viewMode === 'stock' ? '#1e3a5f' : 'transparent', color: viewMode === 'stock' ? '#93c5fd' : '#475569', fontWeight:800, fontSize:13, cursor:'pointer', transition:'all 0.2s', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
          📦 Estoque {estoque.length > 0 && <span style={{ background: viewMode === 'stock' ? '#2563eb44' : '#1a3a50', borderRadius:10, padding:'1px 6px', fontSize:11 }}>{estoque.length}</span>}
        </button>
      </div>

      {/* ════════════════════════════════════════
          STOCK VIEW
      ════════════════════════════════════════ */}
      {viewMode === 'stock' && (
        <div>
          {/* Stats row */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:14 }}>
            <div style={{ background:'#0d2137', borderRadius:12, padding:'10px 12px', border:'1px solid #1a3a50', textAlign:'center' }}>
              <div style={{ color:'#10b981', fontWeight:900, fontSize:18 }}>{estoque.filter(e => e.qty > 0).length}</div>
              <div style={{ color:'#475569', fontSize:10, fontWeight:700 }}>ITENS</div>
            </div>
            <div style={{ background:'#0d2137', borderRadius:12, padding:'10px 12px', border:'1px solid #1a3a50', textAlign:'center' }}>
              <div style={{ color:'#c4b5fd', fontWeight:900, fontSize:14 }}>{BRL.format(totalInvested)}</div>
              <div style={{ color:'#475569', fontSize:10, fontWeight:700 }}>INVESTIDO</div>
            </div>
            <div style={{ background: stockAlerts.expiring > 0 ? '#7c2d1222' : '#0d2137', borderRadius:12, padding:'10px 12px', border:`1px solid ${stockAlerts.expiring > 0 ? '#92400e' : '#1a3a50'}`, textAlign:'center' }}>
              <div style={{ color: stockAlerts.expiring > 0 ? '#fcd34d' : '#64748b', fontWeight:900, fontSize:18 }}>{stockAlerts.expiring}</div>
              <div style={{ color:'#475569', fontSize:10, fontWeight:700 }}>VENCENDO</div>
            </div>
          </div>

          {/* Filter pills */}
          <div style={{ display:'flex', gap:6, marginBottom:12, overflowX:'auto', paddingBottom:4 }}>
            {[
              { id:'all',      label:`Todos`, count: estoque.length, color:'#64748b' },
              { id:'noPrice',  label:'Sem preço', count: stockAlerts.noPrice,  color:'#f59e0b' },
              { id:'expiring', label:'Vencendo',  count: stockAlerts.expiring, color:'#f97316' },
              { id:'lowQty',   label:'Pouco estoque', count: stockAlerts.lowQty, color:'#ef4444' },
            ].map(f => (
              <button key={f.id} onClick={() => setStockFilter(f.id)} style={{
                flexShrink:0, padding:'6px 12px', borderRadius:20,
                border:`1.5px solid ${stockFilter === f.id ? f.color : '#1e4060'}`,
                background: stockFilter === f.id ? f.color+'22' : '#0d2137',
                color: stockFilter === f.id ? f.color : '#475569',
                fontSize:11, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap',
              }}>
                {f.label}{f.count > 0 ? ` (${f.count})` : ''}
              </button>
            ))}
          </div>

          {/* Stock table */}
          {filteredStock.length === 0 ? (
            <div style={{ textAlign:'center', padding:32, color:'#334155' }}>Nenhum item neste filtro</div>
          ) : (
            filteredStock.map(item => {
              const expColor = item.daysLeft == null ? '#334155'
                : item.daysLeft <= 0 ? '#ef4444' : item.daysLeft <= 7 ? '#f97316'
                : item.daysLeft <= 30 ? '#eab308' : '#10b981'
              return (
                <div key={item.id} style={{ background:'#0d2137', borderRadius:14, padding:'12px 14px', marginBottom:8, border:`1px solid ${item.daysLeft != null && item.daysLeft <= 7 ? '#92400e' : '#1a3a50'}` }}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                    {/* Qty badge */}
                    <div style={{ width:52, flexShrink:0, textAlign:'center', background:'#050f1a', borderRadius:10, padding:'8px 4px', border:`1px solid ${item.qty > 0 ? '#1e4060' : '#7f1d1d'}` }}>
                      <div style={{ color: item.qty > 0 ? '#10b981' : '#ef4444', fontWeight:900, fontSize:20, lineHeight:1 }}>{item.qty}</div>
                      <div style={{ color:'#475569', fontSize:10 }}>{item.unit}</div>
                    </div>
                    {/* Info */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ color:'#f1f5f9', fontWeight:800, fontSize:14, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.productName}</div>
                      <div style={{ display:'flex', gap:8, marginTop:3, flexWrap:'wrap' }}>
                        {item.unitCost > 0 && <span style={{ color:'#94a3b8', fontSize:11 }}>💸 {fmtCost(item.unitCost)}/un</span>}
                        {item.hasPrice
                          ? <span style={{ color: item.margin >= 40 ? '#4ade80' : item.margin >= 20 ? '#fbbf24' : '#f87171', fontSize:11, fontWeight:700 }}>
                              🏷️ {BRL.format(item.offerPrice)} · {item.margin}% mg
                            </span>
                          : <span style={{ color:'#f59e0b', fontSize:11, fontWeight:700 }}>⚠️ sem preço de venda</span>
                        }
                        {item.daysLeft != null && (
                          <span style={{ color: expColor, fontSize:11, fontWeight:700 }}>
                            📅 {item.daysLeft <= 0 ? 'VENCIDO' : `${item.daysLeft}d`}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Actions */}
                    <button onClick={() => handleRemove(item.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#334155', padding:4, flexShrink:0 }}><Trash2 size={15} /></button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ════════════════════════════════════════
          ENTRY VIEW (original form)
      ════════════════════════════════════════ */}
      {viewMode === 'entry' && (<>

      {/* Header */}
      <div style={{ marginBottom:16 }}>
        <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:20, marginBottom:2 }}>📦 Entrada de Mercadoria</div>
        <div style={{ color:'#475569', fontSize:13 }}>Chegou o lote? Registra e já dispara pra todos os mercados.</div>
        {validMkts > 0 && (
          <div style={{ display:'inline-flex', alignItems:'center', gap:5, background:'#0d2137', border:'1px solid #14532d', borderRadius:20, padding:'4px 12px', marginTop:8 }}>
            <div style={{ width:6, height:6, borderRadius:3, background:'#10b981' }} />
            <span style={{ color:'#10b981', fontSize:12, fontWeight:700 }}>{validMkts} mercados conectados</span>
          </div>
        )}
      </div>

      {/* ── Step 1: Source type ── */}
      <div style={{ marginBottom:14 }}>
        <div style={{ color:'#64748b', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>De onde veio? (interno)</div>
        <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:4 }}>
          {SOURCE_TYPES.map(s => (
            <button key={s.id} onClick={() => setSourceType(s.id)} style={{
              flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center', gap:3,
              padding:'10px 14px', borderRadius:14, border:`2px solid ${sourceType === s.id ? s.color : '#1e3050'}`,
              background: sourceType === s.id ? s.bg : '#0d2137',
              cursor:'pointer', minWidth:72,
            }}>
              <span style={{ fontSize:20 }}>{s.emoji}</span>
              <span style={{ color: sourceType === s.id ? s.color : '#475569', fontSize:11, fontWeight:700 }}>{s.label}</span>
            </button>
          ))}
        </div>
        {/* Supplier autocomplete */}
        <div style={{ position:'relative', marginTop:8 }}>
          <input
            value={sourceName}
            onChange={e => { setSourceName(e.target.value); setSupplierSuggestions(true) }}
            onFocus={() => setSupplierSuggestions(true)}
            onBlur={() => setTimeout(() => setSupplierSuggestions(false), 150)}
            placeholder="Quem vendeu? (ex: Pedro, Leilão CAIXA SP — opcional)"
            style={{ ...inp, fontSize:13, color:'#94a3b8' }}
          />
          {supplierSuggestions && currentTypeSuggestions.length > 0 && (
            <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:99, background:'#0a1929', border:'1px solid #1e4060', borderRadius:12, marginTop:4, overflow:'hidden', boxShadow:'0 8px 32px rgba(0,0,0,0.5)' }}>
              {currentTypeSuggestions.map(s => (
                <button key={s} onMouseDown={() => pickSupplier(s)} style={{ display:'block', width:'100%', textAlign:'left', background:'none', border:'none', padding:'10px 14px', color:'#e2e8f0', fontSize:13, cursor:'pointer' }}>
                  ⭐ {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Step 2: Product ── */}
      <div style={{ marginBottom:14 }}>
        <div style={{ color:'#64748b', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Produto</div>
        {!selected
          ? <QuickProductInput onSelect={handleSelect} />
          : (
            <div style={{ background:'linear-gradient(135deg,#0f3d27,#0a2a1c)', borderRadius:14, padding:'12px 14px', display:'flex', gap:10, alignItems:'center', border:'1px solid #10b981' }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ color:'#4ade80', fontSize:10, fontWeight:700, textTransform:'uppercase', marginBottom:2 }}>✓ Selecionado</div>
                <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:16 }}>{selected.name}</div>
                {selected.sku && <div style={{ color:'#334155', fontSize:11, fontFamily:'monospace' }}>{selected.sku}</div>}
              </div>
              <button onClick={() => { setSelected(null); setOfferPrice('') }} style={{ background:'none', border:'none', cursor:'pointer', color:'#475569' }}><X size={18} /></button>
            </div>
          )
        }
      </div>

      {selected && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

          {/* ── Qty + Unit ── */}
          <div>
            {/* Toggle: por unidade ou por palete */}
            <div style={{ display:'flex', gap:6, marginBottom:8 }}>
              <button onClick={() => setPaletMode(false)} style={{ flex:1, padding:'7px 0', borderRadius:10, border:`1px solid ${!paletMode ? '#10b981' : '#1e4060'}`, background: !paletMode ? '#0d3d27' : '#0a1929', color: !paletMode ? '#4ade80' : '#475569', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                📦 Por Unidade / Caixa
              </button>
              <button onClick={() => setPaletMode(true)} style={{ flex:1, padding:'7px 0', borderRadius:10, border:`1px solid ${paletMode ? '#f59e0b' : '#1e4060'}`, background: paletMode ? '#78350f' : '#0a1929', color: paletMode ? '#fbbf24' : '#475569', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                🏗️ Por Palete
              </button>
            </div>

            <div style={{ color:'#94a3b8', fontSize:10, fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>
              {paletMode ? 'Composição do Palete' : 'Quantidade do lote'}
            </div>

            {paletMode ? (
              <>
                <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ color:'#64748b', fontSize:10, marginBottom:4 }}>Nº de paletes</div>
                    <input value={paletCount} onChange={e => setPaletCount(e.target.value)} type="number" placeholder="Ex: 3" autoFocus
                      style={{ ...inp, fontSize:20, fontWeight:900, textAlign:'center' }} />
                  </div>
                  <div style={{ display:'flex', alignItems:'center', color:'#475569', fontWeight:900, fontSize:18, paddingTop:16 }}>×</div>
                  <div style={{ flex:1 }}>
                    <div style={{ color:'#64748b', fontSize:10, marginBottom:4 }}>Und / palete</div>
                    <input value={unitsPerPalet} onChange={e => setUnitsPerPalet(e.target.value)} type="number" placeholder="Ex: 24"
                      style={{ ...inp, fontSize:20, fontWeight:900, textAlign:'center' }} />
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ color:'#64748b', fontSize:10, marginBottom:4 }}>Unidade</div>
                    <select value={unit} onChange={e => setUnit(e.target.value)} style={{ ...inp, padding:'11px 8px' }}>
                      {UNITS.map(u => <option key={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
                {paletTotal > 0 && (
                  <div style={{ background:'#0d3d27', borderRadius:10, padding:'8px 14px', color:'#4ade80', fontSize:13, fontWeight:700, marginBottom:4 }}>
                    ✅ Total: {paletCount} pal × {unitsPerPalet} = <strong>{paletTotal} {unit}</strong>
                  </div>
                )}
              </>
            ) : (
              <div style={{ display:'flex', gap:8 }}>
                <input value={qty} onChange={e => setQty(e.target.value)} type="number" placeholder="Ex: 200" autoFocus
                  style={{ ...inp, flex:2, fontSize:22, fontWeight:900 }} />
                <select value={unit} onChange={e => setUnit(e.target.value)} style={{ ...inp, flex:1, padding:'11px 8px' }}>
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* ── Custo de compra ── */}
          <div>
            {/* Toggle modo de custo */}
            <div style={{ display:'flex', gap:6, marginBottom:8 }}>
              <button onClick={() => setCostMode('perUnit')} style={{ flex:1, padding:'7px 0', borderRadius:10, border:`1px solid ${costMode === 'perUnit' ? '#3b82f6' : '#1e4060'}`, background: costMode === 'perUnit' ? '#1e3a5f' : '#0a1929', color: costMode === 'perUnit' ? '#93c5fd' : '#475569', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                💸 Preço por unidade
              </button>
              <button onClick={() => setCostMode('totalLot')} style={{ flex:1, padding:'7px 0', borderRadius:10, border:`1px solid ${costMode === 'totalLot' ? '#8b5cf6' : '#1e4060'}`, background: costMode === 'totalLot' ? '#2e1065' : '#0a1929', color: costMode === 'totalLot' ? '#c4b5fd' : '#475569', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                🧾 Total do lote
              </button>
            </div>

            <div style={{ color:'#64748b', fontSize:10, fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>
              {costMode === 'perUnit' ? 'Custo por unidade (interno 🔒)' : 'Total pago pelo lote (interno 🔒)'}
            </div>
            <div style={{ display:'flex', gap:0, alignItems:'center', background:'#0a1929', border:`1px solid ${costMode === 'perUnit' ? '#2563eb55' : '#4c1d9555'}`, borderRadius:12, overflow:'hidden' }}>
              <span style={{ padding:'0 12px', color:'#475569', fontSize:13, fontWeight:700 }}>R$</span>
              <CurrencyInput value={totalPaid} onChange={setTotalPaid}
                placeholder={costMode === 'perUnit' ? 'Ex: 3,00 — quanto pagou por unidade' : 'Ex: 2.100,00 — total investido no lote'}
                style={{ flex:1, background:'transparent', border:'none', padding:'13px 12px 13px 0', color:'#e2e8f0', fontSize:16, fontWeight:700, outline:'none', width:'100%' }} />
              {costMode === 'perUnit' && <span style={{ padding:'0 12px', color:'#475569', fontSize:12, fontWeight:700, flexShrink:0 }}>/un</span>}
            </div>

            {/* Feedback de custo/total */}
            {paid > 0 && qtyNum > 0 && (
              <div style={{ marginTop:6, background:'#050f1a', borderRadius:8, padding:'8px 12px' }}>
                {costMode === 'perUnit' ? (
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap', fontSize:12 }}>
                    <span style={{ color:'#64748b' }}>💸 {fmtCost(unitCost)}/un</span>
                    <span style={{ color:'#64748b' }}>×</span>
                    <span style={{ color:'#94a3b8', fontWeight:700 }}>{qtyNum} {unit}</span>
                    <span style={{ color:'#64748b' }}>=</span>
                    <span style={{ color:'#c4b5fd', fontWeight:900 }}>{BRL.format(totalPaidActual)} total investido</span>
                  </div>
                ) : (
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap', fontSize:12 }}>
                    <span style={{ color:'#c4b5fd', fontWeight:900 }}>{BRL.format(totalPaidActual)}</span>
                    <span style={{ color:'#64748b' }}>÷ {qtyNum} {unit} =</span>
                    <span style={{ color:'#94a3b8', fontWeight:700 }}>💸 {fmtCost(unitCost)}/un</span>
                  </div>
                )}
                {margin !== null && sellPrice > 0 && (
                  <div style={{ marginTop:4, color: margin >= 40 ? '#4ade80' : margin >= 20 ? '#fbbf24' : '#f87171', fontSize:12, fontWeight:700 }}>
                    Margem bruta: {margin}%
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Validade ── */}
          <div>
            <div style={{ color:'#f97316', fontSize:10, fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>📅 Validade</div>
            {/* Shortcuts */}
            <div style={{ display:'flex', gap:6, marginBottom:8 }}>
              {EXPIRY_SHORTCUTS.map(s => (
                <button key={s.label} onClick={() => applyExpiryShortcut(s.days)} style={{
                  padding:'6px 12px', borderRadius:20, border:`1px solid ${expiryDate && Math.ceil((new Date(expiryDate) - new Date()) / 86400000) === s.days ? '#f97316' : '#1e3050'}`,
                  background: expiryDate && Math.ceil((new Date(expiryDate) - new Date()) / 86400000) === s.days ? '#7c2d12' : '#0a1929',
                  color: expiryDate && Math.ceil((new Date(expiryDate) - new Date()) / 86400000) === s.days ? '#fed7aa' : '#64748b',
                  fontSize:12, fontWeight:700, cursor:'pointer',
                }}>{s.label}</button>
              ))}
              <input value={expiryDate} onChange={e => setExpiryDate(e.target.value)} type="date"
                style={{ flex:1, background:'#0a1929', border:'1px solid #7c2d12', borderRadius:10, padding:'6px 10px', color:'#fed7aa', fontSize:12, outline:'none', boxSizing:'border-box' }} />
            </div>
          </div>

          {/* ── Preço de venda para mercados ── */}
          <div style={{ background:'#0a1929', borderRadius:14, padding:14, border:`1px solid ${canBlast ? '#2563eb55' : '#1e3050'}` }}>
            <div style={{ color:'#93c5fd', fontSize:11, fontWeight:700, textTransform:'uppercase', marginBottom:8, display:'flex', alignItems:'center', gap:5 }}>
              <Zap size={12} /> Preço p/ mercados (repasse) — mercados NÃO veem custo
            </div>
            {/* Suggested price pills */}
            {(selected?.price || unitCost > 0) && (
              <div style={{ display:'flex', gap:6, marginBottom:8, flexWrap:'wrap' }}>
                {unitCost > 0 && [1.3, 1.5, 1.8, 2.0].map(mult => {
                  const sug = (unitCost * mult)
                  const sugStr = sug.toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 })
                  return (
                    <button key={mult} onClick={() => setOfferPrice(sugStr)} style={{
                      background:'#1e3a5f', border:'1px solid #2563eb44', borderRadius:20, padding:'4px 10px',
                      color:'#93c5fd', fontSize:11, fontWeight:700, cursor:'pointer',
                    }}>+{Math.round((mult-1)*100)}% → {BRL.format(sug)}</button>
                  )
                })}
                {selected?.price && (
                  <button onClick={() => setOfferPrice(selected.price.toLocaleString('pt-BR', {minimumFractionDigits:2}))} style={{
                    background:'#0d3d1a', border:'1px solid #14532d', borderRadius:20, padding:'4px 10px',
                    color:'#4ade80', fontSize:11, fontWeight:700, cursor:'pointer',
                  }}>📊 Varejo: {BRL.format(selected.price)}</button>
                )}
              </div>
            )}
            <div style={{ display:'flex', gap:0, alignItems:'center', background:'#060e1a', border:`1px solid ${canBlast ? '#2563eb' : '#1e3050'}`, borderRadius:12, overflow:'hidden', marginBottom: canBlast ? 10 : 0 }}>
              <span style={{ padding:'0 12px', color:'#3b82f6', fontSize:14, fontWeight:700 }}>R$</span>
              <CurrencyInput value={offerPrice} onChange={setOfferPrice}
                placeholder={unitCost > 0 ? `sugerido: ${fmtCost(unitCost * 1.5)}` : 'preço por unidade para mercados'}
                style={{ flex:1, background:'transparent', border:'none', padding:'13px 12px 13px 0', color:'#60a5fa', fontSize:20, fontWeight:900, outline:'none', width:'100%' }} />
            </div>
            {canBlast && qtyNum > 0 && (
              <div style={{ color:'#475569', fontSize:12, marginBottom:10, display:'flex', gap:10, flexWrap:'wrap' }}>
                <span>💰 Faturamento: <strong style={{ color:'#f1f5f9' }}>{BRL.format(sellPrice * qtyNum)}</strong></span>
                {unitCost > 0 && <span style={{ color: margin >= 40 ? '#4ade80' : margin >= 20 ? '#fbbf24' : '#f87171' }}>· Margem: {margin}%</span>}
                {paid > 0 && <span style={{ color:'#10b981' }}>· Lucro: {BRL.format((sellPrice - unitCost) * qtyNum)}</span>}
                {paid > 0 && <span style={{ color:'#c4b5fd' }}>· Investido: {BRL.format(totalPaidActual)}</span>}
              </div>
            )}
            {canBlast && (
              <>
                <button onClick={() => setIsOpp(v => !v)}
                  style={{ display:'flex', alignItems:'center', gap:8, background:'none', border:'none', cursor:'pointer', padding:'5px 0', marginBottom:8 }}>
                  <div style={{ width:22, height:22, borderRadius:7, background: isOpp ? '#d97706' : '#1a3050', border:`1px solid ${isOpp ? '#f59e0b' : '#334155'}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {isOpp && <Check size={13} color="#fff" />}
                  </div>
                  <span style={{ color: isOpp ? '#fbbf24' : '#475569', fontSize:13, fontWeight:700 }}>🔥 Queima / danificado (destaca no portal)</span>
                </button>
                <input value={offerNote} onChange={e => setOfferNote(e.target.value)}
                  placeholder="Nota para mercados (ex: embalagem amassada, produto OK)"
                  style={{ ...inp, fontSize:13 }} />
              </>
            )}
          </div>

          {/* ── Action button ── */}
          <button
            disabled={!selected || qtyNum <= 0 || saving}
            onClick={handleSubmit}
            style={{
              display:'flex', alignItems:'center', justifyContent:'center', gap:10,
              padding: canBlast ? '19px 20px' : '15px 20px',
              borderRadius:16, border:'none', fontWeight:900, fontSize: canBlast ? 16 : 15,
              cursor: (!qty || qtyNum <= 0 || saving) ? 'not-allowed' : 'pointer',
              opacity: (!qty || qtyNum <= 0 || saving) ? 0.45 : 1,
              background: canBlast ? 'linear-gradient(135deg,#1d4ed8,#10b981)' : 'linear-gradient(135deg,#10b981,#059669)',
              color:'#fff', boxShadow: canBlast ? '0 6px 24px rgba(16,185,129,0.3)' : 'none',
            }}>
            {saving ? '⏳ Registrando...'
              : canBlast
                ? <><ArrowDownToLine size={18} /> Dar Entrada + <MessageCircle size={18} /> Disparar {validMkts} mercado{validMkts !== 1 ? 's' : ''}</>
                : <><ArrowDownToLine size={18} /> Só dar entrada — {qtyNum || 0} {unit}</>
            }
          </button>
          {canBlast && <div style={{ color:'#334155', fontSize:12, textAlign:'center', marginTop:-6 }}>Mercados não veem custo, origem ou margem</div>}
        </div>
      )}
      </>)}
    </div>
  )
}

/* ── TabOfertas ─────────────────────────────────────────────── */
function TabOfertas({ estoque, offers, setOffers, markets, profile, orders, preSelected, onClearPreSelected, zapServerUrl, zapConnected }) {
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
  const [waOffer,    setWaOffer]    = useState(null)
  const [blast,      setBlast]      = useState(null)  // single-offer blast
  const [showBlitz,  setShowBlitz]  = useState(false) // all-offers blitz

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
  if (blast)   return <BlastScreen offer={blast} markets={markets} supplierName={profile.name} supplierPhone={profile.phone} onDone={() => setBlast(null)} zapServerUrl={zapServerUrl} zapConnected={zapConnected} />

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

  const validMkts = markets.filter(m => m.phone).length
  const activeOffers = offers.filter(o => o.status !== 'delivered')

  return (
    <div style={{ padding:'16px 16px 100px' }}>
      {showBlitz && <BlitzModal offers={offers} setOffers={setOffers} markets={markets} profile={profile} onClose={() => setShowBlitz(false)} zapServerUrl={zapServerUrl} zapConnected={zapConnected} />}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:18 }}>Minhas Ofertas</div>
        <Btn sm onClick={() => setMode('new')}><Plus size={16} /> Nova</Btn>
      </div>

      {/* GLOBAL BLAST CTA — only if there are offers + markets */}
      {activeOffers.length > 0 && validMkts > 0 && (
        <div style={{ background:'linear-gradient(135deg,#0d3d1a,#0a2a12)', borderRadius:16, padding:'14px 16px', marginBottom:16, border:'1px solid #14532d' }}>
          <div style={{ color:'#4ade80', fontWeight:900, fontSize:14, marginBottom:4 }}>
            📢 {activeOffers.length} oferta{activeOffers.length !== 1 ? 's' : ''} ativa{activeOffers.length !== 1 ? 's' : ''} · {validMkts} mercados
          </div>
          <div style={{ color:'#334155', fontSize:12, marginBottom:12 }}>Ainda não disparou? Avise todos agora.</div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => setBlast(activeOffers[0])}
              style={{ flex:1, background:'linear-gradient(135deg,#16a34a,#15803d)', color:'#fff', border:'none', borderRadius:12, padding:'12px', fontWeight:900, fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
              <MessageCircle size={16} /> Disparar ZAP Agora
            </button>
            <button onClick={() => setShowBlitz(true)}
              style={{ background:'#78350f', color:'#fcd34d', border:'none', borderRadius:12, padding:'12px 14px', fontWeight:800, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}>
              <Zap size={14} /> Blitz
            </button>
          </div>
        </div>
      )}

      {offers.length === 0 ? (
        <div style={{ background:'#0d2137', borderRadius:20, padding:32, textAlign:'center', border:'1px solid #1a3a50' }}>
          <Send size={32} color="#1e4060" style={{ marginBottom:8 }} />
          <div style={{ color:'#475569', fontSize:15 }}>Nenhuma oferta ainda</div>
          <div style={{ color:'#334155', fontSize:12, marginTop:4 }}>Use "Receber" para dar entrada e publicar</div>
        </div>
      ) : offers.map(o => (
        <OfferCard key={o.id} offer={o} markets={markets} supplierName={profile.name} orders={orders}
          onDelete={handleDelete} onUpdatePrice={handleUpdatePrice} onBlast={setBlast} />
      ))}
    </div>
  )
}

/* ── TabPedidos ─────────────────────────────────────────────── */
function TabPedidos({ orders, setOrders, markets }) {
  const [filter,    setFilter]    = useState('pending')
  const [expanded,  setExpanded]  = useState({})

  const payInfo = id => PAYMENT_INFO[id] || { emoji: '💰', label: id || 'N/A', color: '#94a3b8' }

  /* Enrich order with registered market data (by phone match) */
  const enrichOrder = (order) => {
    if (!markets?.length) return order
    const mkt = markets.find(m => m.phone && cleanPhone(m.phone) === cleanPhone(order.storePhone || ''))
    if (!mkt) return order
    return {
      ...order,
      storeName:    order.storeName  || mkt.name,
      storeContact: mkt.contact,
      storeCity:    mkt.city,
      storeAddress: order.address    || mkt.address,
      storeLogoUrl: mkt.logoUrl,
    }
  }

  const pendingCount   = orders.filter(o => o.status === 'pending').length
  const confirmedCount = orders.filter(o => o.status === 'confirmed').length
  const totalRevenue   = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.totalPrice || 0), 0)

  const FILTERS = [
    { id:'pending',   label:'🟡 Aguardando', count: pendingCount,   color:'#f59e0b' },
    { id:'confirmed', label:'🔵 Confirmados', count: confirmedCount, color:'#3b82f6' },
    { id:'delivered', label:'✅ Entregues',  count: orders.filter(o=>o.status==='delivered').length, color:'#10b981' },
    { id:'all',       label:'Todos',         count: orders.length,  color:'#64748b' },
  ].filter(f => f.id === 'all' || f.count > 0)

  const filtered = (filter === 'all' ? orders : orders.filter(o => o.status === filter))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(enrichOrder)

  /* time elapsed */
  const timeAgo = (iso) => {
    if (!iso) return ''
    const diff = Math.floor((Date.now() - new Date(iso)) / 60000)
    if (diff < 1)   return 'agora'
    if (diff < 60)  return `${diff}min atrás`
    const h = Math.floor(diff / 60)
    if (h < 24)     return `${h}h atrás`
    return `${Math.floor(h / 24)}d atrás`
  }

  /* avatar color per store name */
  const avatarColor = (name) => {
    const colors = ['#f97316','#3b82f6','#10b981','#8b5cf6','#ec4899','#f59e0b','#06b6d4','#ef4444']
    let h = 0; for (const c of (name || 'M')) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
    return colors[Math.abs(h) % colors.length]
  }

  async function updateStatus(id, status) {
    const next = orders.map(o => o.id === id ? { ...o, status, updatedAt: new Date().toISOString() } : o)
    setOrders(next)
    await persistKey(ORDERS_KEY, next)
    const order = orders.find(o => o.id === id)
    if (!order?.storePhone) return
    const msgs = {
      confirmed: `✅ *PEDIDO CONFIRMADO!*\n\nOlá, ${order.storeName || 'Mercado'}!\n\nSeu pedido foi confirmado:\n📦 *${order.productName}*\n   ${order.qtyRequested} ${order.unit} · ${BRL.format(order.totalPrice)}\n\nCombine a entrega pelo chat 🚚`,
      delivered: `📦 *ENTREGUE COM SUCESSO!*\n\nOlá, ${order.storeName || 'Mercado'}!\n\n${order.productName} foi entregue!\n   ${order.qtyRequested} ${order.unit} · ${BRL.format(order.totalPrice)}\n\nObrigado pela parceria! 🤝\n_Mega Tudo Barato_`,
    }
    if (msgs[status]) window.open(`https://wa.me/${cleanPhone(order.storePhone)}?text=${encodeURIComponent(msgs[status])}`, '_blank')
  }

  async function deleteOrder(id) {
    const next = orders.filter(o => o.id !== id)
    setOrders(next)
    await persistKey(ORDERS_KEY, next)
  }

  /* status config */
  const statusCfg = {
    pending:   { bar:'#f59e0b', bg:'#78350f22', border:'#92400e66', txt:'#fcd34d', label:'Aguardando' },
    confirmed: { bar:'#3b82f6', bg:'#1e3a5f22', border:'#2563eb66', txt:'#93c5fd', label:'Confirmado' },
    delivered: { bar:'#10b981', bg:'#14532d22', border:'#059669aa', txt:'#86efac', label:'Entregue'   },
    cancelled: { bar:'#ef4444', bg:'#7f1d1d22', border:'#ef444466', txt:'#fca5a5', label:'Cancelado'  },
  }

  return (
    <div style={{ padding:'16px 16px 100px' }}>

      {/* ── Header stats ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:16 }}>
        {[
          { label:'Pendentes', value: pendingCount,            color:'#f59e0b', bg:'#78350f' },
          { label:'Confirmados',value: confirmedCount,         color:'#3b82f6', bg:'#1e3a5f' },
          { label:'Faturado',  value: BRL.format(totalRevenue),color:'#10b981', bg:'#14532d' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg + '33', border:`1px solid ${s.color}33`, borderRadius:12, padding:'10px 12px', textAlign:'center' }}>
            <div style={{ color: s.color, fontWeight:900, fontSize:15 }}>{s.value}</div>
            <div style={{ color:'#475569', fontSize:10, marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Filter pills ── */}
      <div style={{ display:'flex', gap:6, marginBottom:16, overflowX:'auto', paddingBottom:4 }}>
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            flexShrink:0, padding:'7px 14px', borderRadius:20,
            border: `1.5px solid ${filter === f.id ? f.color : '#1e4060'}`,
            background: filter === f.id ? f.color + '22' : '#0d2137',
            color: filter === f.id ? f.color : '#475569',
            fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap',
          }}>
            {f.label}
            {f.count > 0 && <span style={{ background: filter === f.id ? f.color + '44' : '#1a3a50', borderRadius:10, padding:'1px 6px', marginLeft:4, fontSize:11 }}>{f.count}</span>}
          </button>
        ))}
      </div>

      {/* ── Empty states ── */}
      {orders.length === 0 ? (
        <div style={{ background:'#0d2137', borderRadius:20, padding:40, textAlign:'center', border:'1px solid #1a3a50' }}>
          <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
          <div style={{ color:'#475569', fontSize:15, fontWeight:700 }}>Nenhum pedido recebido ainda</div>
          <div style={{ color:'#334155', fontSize:12, marginTop:6 }}>Quando um mercado fizer pedido via WhatsApp, aparece aqui em tempo real</div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background:'#0d2137', borderRadius:14, padding:24, textAlign:'center', border:'1px solid #1a3a50', color:'#475569', fontSize:14 }}>
          Nenhum pedido "{FILTERS.find(f=>f.id===filter)?.label}" no momento
        </div>
      ) : filtered.map(order => {
        const pay   = payInfo(order.paymentMethod)
        const st    = statusCfg[order.status] || statusCfg.pending
        const aColor = avatarColor(order.storeName)
        const initials = (order.storeName || '?').split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()
        const isExpanded = expanded[order.id]
        const hasDelivery = order.deliveryType === 'entrega'
        const hasSchedule = order.schedDate || order.schedTime

        return (
          <div key={order.id} style={{
            background:'#0a1929', borderRadius:18, marginBottom:14,
            border:`1px solid ${st.border}`,
            overflow:'hidden',
            boxShadow: order.status === 'pending' ? `0 0 0 1px ${st.bar}33, 0 4px 24px rgba(0,0,0,0.4)` : '0 2px 12px rgba(0,0,0,0.3)',
          }}>

            {/* ── Colored top bar ── */}
            <div style={{ height:4, background: st.bar, borderRadius:'18px 18px 0 0' }} />

            {/* ── Market identity header ── */}
            <div style={{ padding:'14px 16px 0', display:'flex', alignItems:'center', gap:12 }}>
              {/* Avatar */}
              <div style={{
                width:48, height:48, borderRadius:14, flexShrink:0,
                background: `linear-gradient(135deg, ${aColor}, ${aColor}99)`,
                display:'flex', alignItems:'center', justifyContent:'center',
                border:`2px solid ${aColor}44`,
              }}>
                {order.storeLogoUrl
                  ? <img src={order.storeLogoUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:12 }} />
                  : <span style={{ color:'#fff', fontWeight:900, fontSize:17 }}>{initials}</span>}
              </div>

              <div style={{ flex:1, minWidth:0 }}>
                {/* Store name */}
                <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:16, lineHeight:1.2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {order.storeName || <span style={{ color:'#475569', fontStyle:'italic' }}>Mercado não identificado</span>}
                </div>
                {/* Phone + city */}
                <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:3, flexWrap:'wrap' }}>
                  {order.storePhone
                    ? <span style={{ color:'#64748b', fontSize:12 }}>{order.storePhone}</span>
                    : <span style={{ color:'#334155', fontSize:11, fontStyle:'italic' }}>Sem telefone</span>}
                  {order.storeCity && <span style={{ color:'#334155', fontSize:11 }}>· {order.storeCity}</span>}
                  {order.storeContact && <span style={{ color:'#334155', fontSize:11 }}>· {order.storeContact}</span>}
                </div>
              </div>

              {/* Status pill + time */}
              <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flexShrink:0 }}>
                <span style={{ fontSize:10, fontWeight:800, padding:'3px 10px', borderRadius:20, background: st.bg, color: st.txt, border:`1px solid ${st.border}`, whiteSpace:'nowrap' }}>
                  {st.label}
                </span>
                <span style={{ color:'#334155', fontSize:10 }}>{timeAgo(order.createdAt)}</span>
              </div>
            </div>

            {/* ── WhatsApp quick-action bar ── */}
            {order.storePhone && (
              <div style={{ padding:'8px 16px 0', display:'flex', gap:6 }}>
                <a href={`https://wa.me/${cleanPhone(order.storePhone)}`} target="_blank" rel="noreferrer"
                  style={{ display:'inline-flex', alignItems:'center', gap:5, background:'#14532d', border:'1px solid #166534', borderRadius:10, padding:'5px 12px', color:'#4ade80', fontSize:12, fontWeight:700, textDecoration:'none' }}>
                  📱 WhatsApp
                </a>
                <a href={`tel:${order.storePhone.replace(/\D/g,'')}`}
                  style={{ display:'inline-flex', alignItems:'center', gap:5, background:'#0d2137', border:'1px solid #1e4060', borderRadius:10, padding:'5px 12px', color:'#64748b', fontSize:12, fontWeight:700, textDecoration:'none' }}>
                  📞 Ligar
                </a>
              </div>
            )}

            {/* ── Product + financials ── */}
            <div style={{ margin:'12px 16px 0', background:'#0d2137', borderRadius:12, padding:'12px 14px', border:'1px solid #1a3a50' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:34, height:34, borderRadius:10, background:'#0a2540', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <Package size={16} color="#10b981" />
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ color:'#f1f5f9', fontWeight:800, fontSize:14, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{order.productName}</div>
                  {order.sku && <div style={{ color:'#334155', fontSize:10, fontFamily:'monospace', marginTop:1 }}>{order.sku}</div>}
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginTop:10 }}>
                <div style={{ textAlign:'center' }}>
                  <div style={{ color:'#93c5fd', fontWeight:900, fontSize:15 }}>{order.qtyRequested} <span style={{ fontSize:11 }}>{order.unit}</span></div>
                  <div style={{ color:'#334155', fontSize:9, textTransform:'uppercase' }}>Qtd</div>
                </div>
                <div style={{ textAlign:'center' }}>
                  <div style={{ color:'#64748b', fontWeight:700, fontSize:13 }}>{BRL.format(order.offerPrice || 0)}</div>
                  <div style={{ color:'#334155', fontSize:9, textTransform:'uppercase' }}>por {order.unit}</div>
                </div>
                <div style={{ textAlign:'center' }}>
                  <div style={{ color:'#10b981', fontWeight:900, fontSize:15 }}>{BRL.format(order.totalPrice || 0)}</div>
                  <div style={{ color:'#334155', fontSize:9, textTransform:'uppercase' }}>Total</div>
                </div>
              </div>
            </div>

            {/* ── Delivery + payment pills ── */}
            <div style={{ padding:'10px 16px 0', display:'flex', gap:6, flexWrap:'wrap' }}>
              {/* Payment */}
              <span style={{ display:'inline-flex', alignItems:'center', gap:4, background:'#0d2137', border:`1px solid ${pay.color}44`, borderRadius:10, padding:'4px 10px', color: pay.color, fontSize:12, fontWeight:700 }}>
                {pay.emoji} {pay.label}
              </span>
              {/* Delivery type */}
              {order.deliveryType && (
                <span style={{ display:'inline-flex', alignItems:'center', gap:4, background:'#0d2137', border:'1px solid #1e4060', borderRadius:10, padding:'4px 10px', color: hasDelivery ? '#93c5fd' : '#a78bfa', fontSize:12, fontWeight:700 }}>
                  {hasDelivery ? '🚚 Entrega' : '📦 Retirada'}
                </span>
              )}
            </div>

            {/* ── Expandable details ── */}
            <button onClick={() => setExpanded(p => ({...p, [order.id]: !p[order.id]}))}
              style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px 0', background:'none', border:'none', cursor:'pointer', color:'#334155' }}>
              <span style={{ fontSize:11, fontWeight:600 }}>
                {isExpanded ? '▲ Menos detalhes' : '▼ Ver detalhes completos'}
              </span>
              <span style={{ fontSize:10, color:'#1e4060' }}>{fmtDT(order.createdAt)}</span>
            </button>

            {isExpanded && (
              <div style={{ margin:'8px 16px 0', display:'flex', flexDirection:'column', gap:6 }}>
                {/* Delivery address */}
                {hasDelivery && order.storeAddress && (
                  <div style={{ background:'#060e1a', borderRadius:10, padding:'8px 12px', display:'flex', gap:8, alignItems:'flex-start' }}>
                    <span style={{ fontSize:14, flexShrink:0 }}>📍</span>
                    <div>
                      <div style={{ color:'#64748b', fontSize:10, fontWeight:700, textTransform:'uppercase' }}>Endereço de entrega</div>
                      <div style={{ color:'#94a3b8', fontSize:12, marginTop:2 }}>{order.storeAddress}</div>
                    </div>
                  </div>
                )}
                {/* Schedule */}
                {hasSchedule && (
                  <div style={{ background:'#060e1a', borderRadius:10, padding:'8px 12px', display:'flex', gap:8, alignItems:'center' }}>
                    <span style={{ fontSize:14 }}>🕐</span>
                    <div>
                      <div style={{ color:'#64748b', fontSize:10, fontWeight:700, textTransform:'uppercase' }}>Agendamento</div>
                      <div style={{ color:'#94a3b8', fontSize:12, marginTop:1 }}>
                        {[order.schedDate, order.schedTime].filter(Boolean).join(' às ')}
                      </div>
                    </div>
                  </div>
                )}
                {/* Note */}
                {order.note && (
                  <div style={{ background:'#060e1a', borderRadius:10, padding:'8px 12px', display:'flex', gap:8, alignItems:'flex-start' }}>
                    <span style={{ fontSize:14, flexShrink:0 }}>💬</span>
                    <div>
                      <div style={{ color:'#64748b', fontSize:10, fontWeight:700, textTransform:'uppercase' }}>Observação</div>
                      <div style={{ color:'#94a3b8', fontSize:12, marginTop:2, fontStyle:'italic' }}>"{order.note}"</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Action buttons ── */}
            <div style={{ padding:'12px 16px 14px', display:'flex', gap:8, marginTop:4 }}>
              {order.status === 'pending' && (
                <button onClick={() => updateStatus(order.id, 'confirmed')}
                  style={{ flex:1, background:'linear-gradient(135deg,#10b981,#059669)', color:'#fff', border:'none', borderRadius:12, padding:'11px 0', fontWeight:800, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                  <Check size={15} /> Confirmar + 📱 Avisar
                </button>
              )}
              {order.status === 'confirmed' && (
                <button onClick={() => updateStatus(order.id, 'delivered')}
                  style={{ flex:1, background:'linear-gradient(135deg,#3b82f6,#2563eb)', color:'#fff', border:'none', borderRadius:12, padding:'11px 0', fontWeight:800, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                  🚚 Marcar Entregue + 📱 Avisar
                </button>
              )}
              {order.status === 'delivered' && (
                <div style={{ flex:1, textAlign:'center', color:'#86efac', fontSize:13, fontWeight:700, padding:11 }}>✓ Entregue com sucesso!</div>
              )}
              <button onClick={() => deleteOrder(order.id)}
                style={{ background:'#1a0a0a', color:'#475569', border:'1px solid #1f2937', borderRadius:10, padding:'0 12px', cursor:'pointer', display:'flex', alignItems:'center' }}>
                <Trash2 size={14} />
              </button>
            </div>

          </div>
        )
      })}
    </div>
  )
}

/* ── TabSellOut ─────────────────────────────────────────────── */
/* Fase 1: análise de recompra a partir de pedidos existentes
   Fase 2: eventos reais do PDV Corta Preço (se mercado adotou) */
function TabSellOut({ orders, markets }) {
  const [events,    setEvents]    = useState([])
  const [loadingEv, setLoadingEv] = useState(true)

  /* fetch sell-out events from server + poll 30s */
  useEffect(() => {
    async function load() {
      try {
        const r = await fetch(API_RESTORE)
        if (!r.ok) throw new Error()
        const { data } = await r.json()
        const raw = data?.cp_sellout_events
        if (raw) setEvents(JSON.parse(raw))
      } catch {} finally { setLoadingEv(false) }
    }
    load()
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [])

  /* ── Phase 1: reorder analysis from orders ── */
  const delivered = orders.filter(o => o.status === 'delivered' || o.status === 'confirmed')

  /* group by (market, product) → list of order dates */
  const marketMap = {}
  for (const o of delivered) {
    const mk = o.storeName || o.storePhone || 'Desconhecido'
    if (!marketMap[mk]) marketMap[mk] = { name: mk, phone: o.storePhone, products: {} }
    const pk = (o.productName || '').toLowerCase()
    if (!marketMap[mk].products[pk]) marketMap[mk].products[pk] = { name: o.productName, orders: [] }
    marketMap[mk].products[pk].orders.push({ date: new Date(o.createdAt), qty: o.qtyRequested, total: o.totalPrice })
  }

  /* giro médio = avg days between consecutive orders */
  function giro(productOrders) {
    if (productOrders.length < 2) return null
    const sorted = [...productOrders].sort((a, b) => a.date - b.date)
    let gaps = 0
    for (let i = 1; i < sorted.length; i++) gaps += (sorted[i].date - sorted[i-1].date) / 86400000
    return Math.round(gaps / (sorted.length - 1))
  }

  const marketList = Object.values(marketMap).map(m => {
    const prods = Object.values(m.products).map(p => {
      const g    = giro(p.orders)
      const last = [...p.orders].sort((a,b) => b.date - a.date)[0]
      const daysAgo    = Math.floor((Date.now() - last.date) / 86400000)
      const daysToNext = g ? Math.max(0, g - daysAgo) : null
      const urgency    = daysToNext !== null && daysToNext <= 3 ? 'hot'
                       : daysToNext !== null && daysToNext <= 7 ? 'warm' : 'ok'
      const totalVol   = p.orders.reduce((s, o) => s + (o.qty || 0), 0)
      const totalRev   = p.orders.reduce((s, o) => s + (o.total || 0), 0)
      return { ...p, giro: g, daysAgo, daysToNext, urgency, totalVol, totalRev }
    }).sort((a, b) => (a.daysToNext ?? 99) - (b.daysToNext ?? 99))
    const totalRev = prods.reduce((s, p) => s + p.totalRev, 0)
    const hotCount = prods.filter(p => p.urgency === 'hot').length
    return { ...m, prods, totalRev, hotCount }
  }).sort((a, b) => b.totalRev - a.totalRev)

  /* ── Phase 2 stats ── */
  const today = new Date().toISOString().slice(0, 10)
  const evToday      = events.filter(e => e.soldAt?.startsWith(today))
  const evRevToday   = evToday.reduce((s, e) => s + (e.totalRevenue || 0), 0)
  const evMarketsSet = new Set(events.map(e => e.storeName).filter(Boolean))
  const topEvProduct = (() => {
    const m = {}
    for (const e of events) m[e.productName] = (m[e.productName] || 0) + (e.qtySold || 0)
    return Object.entries(m).sort((a,b) => b[1]-a[1])[0]
  })()

  /* urgency colors */
  const uColor = { hot: '#ef4444', warm: '#f59e0b', ok: '#10b981' }
  const uBg    = { hot: '#7f1d1d22', warm: '#78350f22', ok: '#14532d22' }
  const uLabel = { hot: 'PEDIR HOJE', warm: 'Em breve', ok: 'No prazo' }

  return (
    <div style={{ padding:'16px 16px 100px' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom:16 }}>
        <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:18 }}>📡 Sell-Out Tracker</div>
        <div style={{ color:'#475569', fontSize:12, marginTop:2 }}>
          O que seus mercados estão vendendo — previsão de recompra em tempo real
        </div>
      </div>

      {/* ── Stats (Phase 1 + 2) ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>
        {[
          { label:'Mercados ativos',   value: marketList.length,           color:'#3b82f6', icon:'🏪' },
          { label:'🔥 Pedir hoje',     value: marketList.reduce((s,m)=>s+m.hotCount,0), color:'#ef4444', icon:'🔥' },
          { label:'Sell-out hoje',     value: evToday.length ? `${evToday.length} vendas` : events.length ? `${evMarketsSet.size} mkt` : 'Ativar PDV', color: events.length ? '#10b981' : '#334155', icon:'📊' },
          { label:'Top produto',       value: topEvProduct ? topEvProduct[0].split(' ').slice(0,2).join(' ') : (orders[0]?.productName?.split(' ').slice(0,2).join(' ') || '—'), color:'#f97316', icon:'🏆' },
        ].map(s => (
          <div key={s.label} style={{ background:'#0d2137', border:`1px solid ${s.color}33`, borderRadius:14, padding:'12px 14px' }}>
            <div style={{ color: s.color, fontWeight:900, fontSize:16, lineHeight:1.2 }}>{s.icon} {s.value}</div>
            <div style={{ color:'#475569', fontSize:10, marginTop:3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Phase 2: Live sell-out feed ── */}
      <div style={{ background:'#0d2137', borderRadius:16, border:'1px solid #1a3a50', marginBottom:16, overflow:'hidden' }}>
        <div style={{ padding:'12px 16px', borderBottom:'1px solid #0a2540', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ color:'#f1f5f9', fontWeight:800, fontSize:14 }}>
              📡 Sell-out ao vivo
              {events.length > 0 && <span style={{ marginLeft:8, background:'#10b98122', border:'1px solid #10b98144', color:'#10b981', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20 }}>● {events.length} eventos</span>}
            </div>
            <div style={{ color:'#334155', fontSize:11, marginTop:2 }}>Vendas capturadas direto do PDV Corta Preço</div>
          </div>
          {loadingEv && <div style={{ width:16, height:16, border:'2px solid #10b981', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 1s linear infinite' }} />}
        </div>

        {events.length === 0 ? (
          <div style={{ padding:'24px 20px', textAlign:'center' }}>
            <div style={{ fontSize:32, marginBottom:8 }}>📲</div>
            <div style={{ color:'#f1f5f9', fontWeight:800, fontSize:14, marginBottom:6 }}>
              Ative nos seus mercados
            </div>
            <div style={{ color:'#475569', fontSize:12, lineHeight:1.6, marginBottom:16 }}>
              Quando o mercado usa o <strong style={{ color:'#f97316' }}>PDV Corta Preço</strong> e vende um
              produto que comprou de você, o evento aparece aqui automaticamente.
            </div>
            {/* CTA */}
            <div style={{ background:'#060e1a', borderRadius:12, padding:'12px 14px', border:'1px solid #10b98133' }}>
              <div style={{ color:'#10b981', fontWeight:800, fontSize:12, marginBottom:4 }}>💡 Como ativar</div>
              <div style={{ color:'#475569', fontSize:11, lineHeight:1.5 }}>
                1. Envie o link do PDV pro mercado<br/>
                2. Eles fazem login e escaneiam as vendas<br/>
                3. Dados chegam aqui em tempo real
              </div>
            </div>
          </div>
        ) : (
          <div style={{ maxHeight:280, overflowY:'auto' }}>
            {events.slice(0, 20).map((e, i) => {
              const mins = Math.floor((Date.now() - new Date(e.soldAt)) / 60000)
              const when = mins < 1 ? 'agora' : mins < 60 ? `${mins}min` : mins < 1440 ? `${Math.floor(mins/60)}h` : `${Math.floor(mins/1440)}d`
              return (
                <div key={e.id || i} style={{ padding:'10px 16px', borderTop: i ? '1px solid #0a2540' : 'none', display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:'#10b981', flexShrink:0, boxShadow:'0 0 6px #10b981' }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ color:'#f1f5f9', fontWeight:700, fontSize:13, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {e.storeName || 'Mercado'} <span style={{ color:'#475569', fontWeight:400 }}>vendeu</span> {e.productName}
                    </div>
                    <div style={{ color:'#475569', fontSize:11, marginTop:1 }}>{e.qtySold} {e.unit || 'un'} · {BRL.format(e.totalRevenue || 0)}</div>
                  </div>
                  <div style={{ color:'#334155', fontSize:11, flexShrink:0 }}>{when}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Phase 1: Previsão de Recompra por Mercado ── */}
      <div style={{ color:'#475569', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:10 }}>
        🔄 Previsão de recompra — baseado no histórico de pedidos
      </div>

      {marketList.length === 0 ? (
        <div style={{ background:'#0d2137', borderRadius:14, padding:24, textAlign:'center', border:'1px solid #1a3a50', color:'#475569' }}>
          Nenhum pedido entregue ainda
        </div>
      ) : marketList.map(m => (
        <div key={m.name} style={{ background:'#0a1929', borderRadius:16, marginBottom:12, border:'1px solid #1a3a50', overflow:'hidden' }}>
          {/* Market header */}
          <div style={{ padding:'12px 16px', background:'#0d2137', display:'flex', alignItems:'center', gap:10, borderBottom:'1px solid #0a2540' }}>
            <div style={{
              width:36, height:36, borderRadius:10, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
              background: `linear-gradient(135deg,${['#3b82f6','#10b981','#f97316','#8b5cf6','#f59e0b'][Math.abs([...m.name].reduce((h,c)=>h*31+c.charCodeAt(0),0)) % 5]},#0d2137)`,
            }}>
              <span style={{ color:'#fff', fontWeight:900, fontSize:14 }}>{(m.name||'?')[0].toUpperCase()}</span>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ color:'#f1f5f9', fontWeight:800, fontSize:14, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{m.name}</div>
              <div style={{ color:'#475569', fontSize:11 }}>{m.prods.length} produto{m.prods.length !== 1 ? 's' : ''} · {BRL.format(m.totalRev)} total</div>
            </div>
            {m.hotCount > 0 && (
              <div style={{ background:'#7f1d1d', border:'1px solid #ef444466', borderRadius:10, padding:'3px 10px', color:'#fca5a5', fontSize:11, fontWeight:800, flexShrink:0 }}>
                🔥 {m.hotCount} URGENTE{m.hotCount > 1 ? 'S' : ''}
              </div>
            )}
            {m.phone && (
              <a href={`https://wa.me/${m.phone.replace(/\D/g,'').replace(/^0/,'').length < 11 ? '55' + m.phone.replace(/\D/g,'') : m.phone.replace(/\D/g,'')}`}
                target="_blank" rel="noreferrer"
                style={{ background:'#14532d', border:'1px solid #166534', borderRadius:10, padding:'5px 10px', color:'#4ade80', fontSize:11, fontWeight:700, textDecoration:'none', flexShrink:0 }}>
                📱
              </a>
            )}
          </div>

          {/* Products restock grid */}
          <div style={{ padding:'10px 12px', display:'flex', flexDirection:'column', gap:6 }}>
            {m.prods.map(p => (
              <div key={p.name} style={{ background: uBg[p.urgency], border:`1px solid ${uColor[p.urgency]}33`, borderRadius:10, padding:'8px 12px', display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ color:'#f1f5f9', fontWeight:700, fontSize:13, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.name}</div>
                  <div style={{ display:'flex', gap:8, marginTop:3, flexWrap:'wrap' }}>
                    {p.giro && <span style={{ color:'#64748b', fontSize:11 }}>🔄 giro ~{p.giro}d</span>}
                    <span style={{ color:'#475569', fontSize:11 }}>{p.orders.length}x pedido{p.orders.length !== 1 ? 's' : ''}</span>
                    <span style={{ color:'#475569', fontSize:11 }}>{BRL.format(p.totalRev)}</span>
                  </div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  {p.daysToNext !== null ? (
                    <>
                      <div style={{ color: uColor[p.urgency], fontWeight:900, fontSize:14 }}>
                        {p.daysToNext === 0 ? 'HOJE' : `${p.daysToNext}d`}
                      </div>
                      <div style={{ color: uColor[p.urgency], fontSize:9, fontWeight:700, textTransform:'uppercase' }}>{uLabel[p.urgency]}</div>
                    </>
                  ) : (
                    <div style={{ color:'#334155', fontSize:11 }}>1 pedido</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* ── CTA vender o PDV ── */}
      <div style={{ background:'linear-gradient(135deg,#0f3460,#1a1a2e)', borderRadius:18, padding:'20px 16px', border:'1px solid #3b82f633', marginTop:8 }}>
        <div style={{ color:'#93c5fd', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>💡 Ative o sell-out em tempo real</div>
        <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:16, marginBottom:8 }}>
          Seus mercados usando o Corta Preço PDV = você enxerga cada venda na prateleira deles
        </div>
        <div style={{ color:'#64748b', fontSize:12, lineHeight:1.6, marginBottom:14 }}>
          Ofereça desconto de 10–15% pra quem adotar. É como a Cimed faz com as farmácias — e vira diferencial competitivo no seu nicho.
        </div>
        <a href="https://zatendestock.netlify.app/qr.html" target="_blank" rel="noreferrer"
          style={{ display:'inline-flex', alignItems:'center', gap:6, background:'linear-gradient(135deg,#3b82f6,#2563eb)', color:'#fff', borderRadius:12, padding:'10px 18px', fontSize:13, fontWeight:800, textDecoration:'none' }}>
          📱 Ver QR codes para os mercados
        </a>
      </div>

    </div>
  )
}

/* ── MarketForm ─────────────────────────────────────────────── */
function MarketForm({ initial = {}, onSave, onCancel }) {
  const F = (k) => ({ value: form[k], onChange: e => setForm(p => ({...p, [k]: e.target.value})) })
  const [form, setForm] = useState({ name:'', phone:'', address:'', contact:'', cnpj:'', notes:'', logoUrl:'', ...initial })
  const inp = { background:'#0a1929', border:'1px solid #1e4060', borderRadius:10, padding:'10px 12px', color:'#e2e8f0', fontSize:16, boxSizing:'border-box', outline:'none', width:'100%', display:'block', marginBottom:10 }

  function handleLogo(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setForm(p => ({ ...p, logoUrl: ev.target.result }))
    reader.readAsDataURL(file)
  }

  return (
    <div style={{ background:'#0d2137', borderRadius:16, padding:16, marginBottom:16, border:'1px solid #10b981' }}>
      <div style={{ color:'#10b981', fontSize:11, fontWeight:700, textTransform:'uppercase', marginBottom:12 }}>
        {initial.id ? '✏️ Editar Mercado' : '+ Novo Mercado'}
      </div>

      {/* Logo upload */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
        <div style={{ width:52, height:52, borderRadius:14, background:'linear-gradient(135deg,#0f3460,#1a5276)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', flexShrink:0, border:'1px solid #1e4060' }}>
          {form.logoUrl
            ? <img src={form.logoUrl} alt="logo" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            : <span style={{ color:'#93c5fd', fontSize:20, fontWeight:900 }}>{form.name?.charAt(0)?.toUpperCase() || '?'}</span>
          }
        </div>
        <div>
          <label style={{ display:'inline-flex', alignItems:'center', gap:6, background:'#0a1929', border:'1px solid #1e4060', borderRadius:8, padding:'7px 12px', cursor:'pointer', color:'#64748b', fontSize:12, fontWeight:700 }}>
            📷 {form.logoUrl ? 'Trocar logo' : 'Adicionar logo'}
            <input type="file" accept="image/*" onChange={handleLogo} style={{ display:'none' }} />
          </label>
          {form.logoUrl && <button onClick={() => setForm(p => ({...p, logoUrl:''}))} style={{ marginLeft:8, background:'none', border:'none', color:'#ef4444', fontSize:11, cursor:'pointer', fontWeight:700 }}>✕ remover</button>}
        </div>
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

/* ── RecurrenceForm ──────────────────────────────────────────── */
function RecurrenceForm({ onSave, onCancel }) {
  const [form, setForm] = useState({ productName:'', qty:'', unit:'CX', price:'', frequency:'7', note:'' })
  const F = k => ({ value: form[k], onChange: e => setForm(p => ({...p, [k]: e.target.value})) })
  const inp = { background:'#050f1a', border:'1px solid #1e4060', borderRadius:8, padding:'7px 10px', color:'#e2e8f0', fontSize:14, outline:'none', width:'100%', boxSizing:'border-box' }
  return (
    <div style={{ background:'#0a1929', borderRadius:12, padding:12, marginBottom:10, border:'1px solid #10b981' }}>
      <div style={{ color:'#10b981', fontSize:11, fontWeight:700, textTransform:'uppercase', marginBottom:10 }}>+ Nova Recorrência</div>
      <input {...F('productName')} placeholder="Produto (ex: Coca-Cola 2L)" style={{ ...inp, marginBottom:8 }} />
      <div style={{ display:'grid', gridTemplateColumns:'1fr 80px 80px', gap:6, marginBottom:8 }}>
        <input {...F('qty')} placeholder="Qtd" type="number" min="1" style={inp} />
        <select value={form.unit} onChange={e => setForm(p => ({...p, unit: e.target.value}))} style={{ ...inp, padding:'7px 6px' }}>
          {UNITS.map(u => <option key={u}>{u}</option>)}
        </select>
        <select value={form.frequency} onChange={e => setForm(p => ({...p, frequency: e.target.value}))} style={{ ...inp, padding:'7px 6px' }}>
          <option value="7">7d</option>
          <option value="14">14d</option>
          <option value="30">30d</option>
          <option value="60">60d</option>
          <option value="90">90d</option>
        </select>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:8 }}>
        <input {...F('price')} placeholder="Preço/un (opcional)" type="number" step="0.01" style={inp} />
        <input {...F('note')} placeholder="Obs (opcional)" style={inp} />
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <Btn full disabled={!form.productName.trim() || !form.qty} onClick={() => onSave({ ...form, qty: parseInt(form.qty), price: parseFloat(form.price) || 0 })}>
          <Check size={14} /> Salvar
        </Btn>
        <Btn secondary onClick={onCancel}>Cancelar</Btn>
      </div>
    </div>
  )
}

/* ── TabMercados ────────────────────────────────────────────── */
function TabMercados({ markets, setMarkets, orders, recurrences, setRecurrences }) {
  const [adding,    setAdding]    = useState(false)
  const [editing,   setEditing]   = useState(null)
  const [expanded,  setExpanded]  = useState(null)   // market id → show order history
  const [showRecur, setShowRecur] = useState(null)   // market id → show recurrence panel
  const [addingRec, setAddingRec] = useState(null)   // market id → show add recurrence form

  /* Recurrence helpers */
  function saveRecurrences(next) {
    setRecurrences(next)
    try { localStorage.setItem(fornKey(RECURRENCE_KEY), JSON.stringify(next)) } catch {}
    persistKey(RECURRENCE_KEY, next)
  }

  function addRecurrence(mkt, form) {
    const rec = { id: uid(), marketId: mkt.id, marketName: mkt.name, marketPhone: mkt.phone, ...form, lastContact: null, createdAt: new Date().toISOString() }
    saveRecurrences([...recurrences, rec])
    setAddingRec(null)
  }

  function removeRecurrence(id) {
    saveRecurrences(recurrences.filter(r => r.id !== id))
  }

  function markContacted(id) {
    saveRecurrences(recurrences.map(r => r.id === id ? { ...r, lastContact: today() } : r))
  }

  function isDue(rec) {
    if (!rec.lastContact) return true
    const freqDays = parseInt(rec.frequency, 10)
    const nextDue = new Date(rec.lastContact)
    nextDue.setDate(nextDue.getDate() + freqDays)
    return nextDue <= new Date()
  }

  async function saveMarkets(next) {
    setMarkets(next)
    try { localStorage.setItem(fornKey(MKTS_KEY), JSON.stringify(next)) } catch {}
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
    const mOrders   = (orders || []).filter(o =>
      (o.storePhone && cleanPhone(o.storePhone) === cleanPhone(m.phone)) ||
      (o.storeName  && o.storeName.toLowerCase() === m.name.toLowerCase())
    ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    const delivered = mOrders.filter(o => o.status === 'delivered')
    const total     = mOrders.reduce((s, o) => s + (o.totalPrice || 0), 0)
    const last      = mOrders[0]
    const daysAgo   = last ? Math.floor((Date.now() - new Date(last.createdAt)) / 86400000) : null
    return { count: mOrders.length, delivered: delivered.length, total, daysAgo, lastProduct: last?.productName, orders: mOrders }
  }

  const STATUS_LABEL = { delivered: { t:'Entregue', c:'#10b981' }, confirmed: { t:'Confirmado', c:'#3b82f6' }, pending: { t:'Pendente', c:'#f97316' }, cancelled: { t:'Cancelado', c:'#ef4444' } }
  const fmtShort = iso => { const [y,m,d] = (iso || '').slice(0,10).split('-'); return `${d}/${m}/${y?.slice(2)}` }

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
              <div style={{ width:44, height:44, borderRadius:14, background:'linear-gradient(135deg,#0f3460,#1a5276)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:18, fontWeight:900, color:'#93c5fd', overflow:'hidden' }}>
                {m.logoUrl
                  ? <img src={m.logoUrl} alt={m.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  : m.name.charAt(0).toUpperCase()
                }
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

            {/* Purchase stats + histórico toggle */}
            <div style={{ padding:'10px 16px 14px', borderTop:'1px solid #1a3a50', background:'#0a1929' }}>
              {st.count === 0 ? (
                <div style={{ color:'#334155', fontSize:12, textAlign:'center' }}>Nenhum pedido ainda — envie uma oferta! 🚀</div>
              ) : (<>
                <div style={{ display:'flex', gap:14, flexWrap:'wrap', alignItems:'center' }}>
                  <div style={{ textAlign:'center' }}>
                    <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:18, lineHeight:1 }}>{st.count}</div>
                    <div style={{ color:'#64748b', fontSize:10 }}>pedidos</div>
                  </div>
                  <div style={{ textAlign:'center' }}>
                    <div style={{ color:'#10b981', fontWeight:900, fontSize:18, lineHeight:1 }}>{BRL.format(st.total)}</div>
                    <div style={{ color:'#64748b', fontSize:10 }}>faturado</div>
                  </div>
                  <div style={{ textAlign:'center' }}>
                    <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:18, lineHeight:1 }}>{st.delivered}</div>
                    <div style={{ color:'#64748b', fontSize:10 }}>entregues</div>
                  </div>
                  {st.daysAgo !== null && (
                    <div style={{ textAlign:'center' }}>
                      <div style={{ color:'#93c5fd', fontWeight:900, fontSize:18, lineHeight:1 }}>{st.daysAgo === 0 ? 'hoje' : `${st.daysAgo}d`}</div>
                      <div style={{ color:'#64748b', fontSize:10 }}>último</div>
                    </div>
                  )}
                  <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
                    {/* Recorrências button */}
                    {(() => {
                      const mRecs = recurrences.filter(r => r.marketId === m.id)
                      const due   = mRecs.filter(isDue).length
                      return (
                        <button onClick={() => { setShowRecur(showRecur === m.id ? null : m.id); setExpanded(null) }}
                          style={{ background: due > 0 ? '#78350f22' : 'none', border:`1px solid ${due > 0 ? '#92400e' : '#1e4060'}`, borderRadius:8, padding:'5px 10px', cursor:'pointer', color: due > 0 ? '#fcd34d' : '#64748b', fontSize:11, fontWeight:700, display:'flex', alignItems:'center', gap:4 }}>
                          📅 {mRecs.length > 0 ? mRecs.length : '+'}
                          {due > 0 && <span style={{ background:'#ef4444', color:'#fff', borderRadius:8, width:14, height:14, fontSize:9, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900 }}>{due}</span>}
                        </button>
                      )
                    })()}
                    <button onClick={() => { setExpanded(expanded === m.id ? null : m.id); setShowRecur(null) }} style={{ background:'none', border:'1px solid #1e4060', borderRadius:8, padding:'5px 10px', color:'#64748b', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                      {expanded === m.id ? '▲' : '📋'}
                    </button>
                  </div>
                </div>

                {/* ── Recurrence panel ── */}
                {showRecur === m.id && (() => {
                  const mRecs = recurrences.filter(r => r.marketId === m.id)
                  return (
                    <div style={{ marginTop:10, borderTop:'1px solid #1a3a50', paddingTop:10 }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                        <div style={{ color:'#f1f5f9', fontSize:12, fontWeight:800 }}>📅 Pedidos Recorrentes</div>
                        <button onClick={() => setAddingRec(addingRec === m.id ? null : m.id)}
                          style={{ background:'#0d2137', border:'1px solid #10b981', borderRadius:8, padding:'4px 10px', color:'#10b981', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                          + Adicionar
                        </button>
                      </div>

                      {/* Add recurrence form */}
                      {addingRec === m.id && <RecurrenceForm onSave={form => addRecurrence(m, form)} onCancel={() => setAddingRec(null)} />}

                      {/* Recurrence list */}
                      {mRecs.length === 0 ? (
                        <div style={{ color:'#334155', fontSize:12, textAlign:'center', padding:'12px 0' }}>
                          Sem recorrências. Adicione um produto que ele compra regularmente.
                        </div>
                      ) : mRecs.map(rec => {
                        const due = isDue(rec)
                        return (
                          <div key={rec.id} style={{ background: due ? '#7c2d1222' : '#050f1a', borderRadius:10, padding:'10px 12px', marginBottom:6, border:`1px solid ${due ? '#92400e' : '#1e4060'}` }}>
                            <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                              <div style={{ flex:1 }}>
                                <div style={{ color:'#f1f5f9', fontWeight:700, fontSize:13 }}>{rec.productName}</div>
                                <div style={{ display:'flex', gap:8, marginTop:2, flexWrap:'wrap' }}>
                                  <span style={{ color:'#64748b', fontSize:11 }}>{rec.qty} {rec.unit}</span>
                                  {rec.price > 0 && <span style={{ color:'#10b981', fontSize:11 }}>{BRL.format(rec.price)}/un</span>}
                                  <span style={{ color:'#8b5cf6', fontSize:11 }}>a cada {rec.frequency}d</span>
                                  {rec.lastContact
                                    ? <span style={{ color: due ? '#fcd34d' : '#475569', fontSize:11 }}>
                                        {due ? '⚠️ DUE!' : `✓ ${rec.lastContact}`}
                                      </span>
                                    : <span style={{ color:'#f59e0b', fontSize:11 }}>⚡ Nunca contatado</span>
                                  }
                                </div>
                                {rec.note && <div style={{ color:'#475569', fontSize:11, marginTop:2 }}>💬 {rec.note}</div>}
                              </div>
                              <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                                {due && (
                                  <a href={`https://wa.me/${cleanPhone(m.phone)}?text=${encodeURIComponent(`Olá ${m.name}! Você costuma pedir ${rec.productName} (${rec.qty} ${rec.unit}). Quer renovar? 📦`)}`}
                                    target="_blank" rel="noreferrer" onClick={() => markContacted(rec.id)}
                                    style={{ background:'#14532d', border:'none', borderRadius:8, padding:'5px 8px', color:'#4ade80', fontSize:11, cursor:'pointer', textDecoration:'none', display:'flex', alignItems:'center', gap:3, fontWeight:700 }}>
                                    <MessageCircle size={11} /> ZAP
                                  </a>
                                )}
                                <button onClick={() => markContacted(rec.id)} title="Marcar como contatado hoje"
                                  style={{ background:'none', border:'1px solid #1e4060', borderRadius:8, padding:'5px 8px', color:'#64748b', fontSize:11, cursor:'pointer' }}>✓</button>
                                <button onClick={() => removeRecurrence(rec.id)}
                                  style={{ background:'none', border:'none', cursor:'pointer', color:'#334155', padding:4 }}><Trash2 size={12} /></button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}

                {/* Expandable order history */}
                {expanded === m.id && (
                  <div style={{ marginTop:12, borderTop:'1px solid #1a3a50', paddingTop:10 }}>
                    <div style={{ color:'#475569', fontSize:10, fontWeight:700, textTransform:'uppercase', marginBottom:8 }}>Histórico de compras — {st.count} pedido{st.count !== 1 ? 's' : ''}</div>
                    {st.orders.map((o, i) => {
                      const sl = STATUS_LABEL[o.status] || { t: o.status, c:'#64748b' }
                      return (
                        <div key={o.id} style={{ display:'flex', alignItems:'center', gap:8, paddingBottom:8, marginBottom: i < st.orders.length - 1 ? 8 : 0, borderBottom: i < st.orders.length - 1 ? '1px solid #0f2035' : 'none' }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ color:'#e2e8f0', fontSize:13, fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{o.productName}</div>
                            <div style={{ color:'#64748b', fontSize:11 }}>{o.qtyRequested} {o.unit} · {fmtShort(o.createdAt)}</div>
                          </div>
                          <div style={{ textAlign:'right', flexShrink:0 }}>
                            <div style={{ color:'#10b981', fontWeight:800, fontSize:13 }}>{BRL.format(o.totalPrice || 0)}</div>
                            <div style={{ background: sl.c + '22', color: sl.c, borderRadius:6, padding:'1px 6px', fontSize:10, fontWeight:700, marginTop:2 }}>{sl.t}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>)}
            </div>
          </div>
        )
      })}

      {/* Portal link for markets */}
      <div style={{ background:'#0a1929', borderRadius:14, padding:'14px 16px', marginTop:8, border:'1px solid #1e4060' }}>
        <div style={{ color:'#10b981', fontSize:11, fontWeight:700, textTransform:'uppercase', marginBottom:4 }}>🔗 Link do Portal (envie para os mercados)</div>
        <div style={{ color:'#60a5fa', fontSize:13, fontFamily:'monospace', wordBreak:'break-all', marginBottom:8 }}>
          {ofertasUrl()}
        </div>
        <a href={'https://wa.me/?text=' + encodeURIComponent('Olá! Acesse nossas ofertas exclusivas aqui: ' + ofertasUrl())}
          target="_blank" rel="noreferrer"
          style={{ display:'inline-flex', alignItems:'center', gap:6, background:'#14532d', color:'#4ade80', borderRadius:10, padding:'8px 14px', textDecoration:'none', fontSize:12, fontWeight:700 }}>
          <MessageCircle size={13} /> Enviar link pelo ZAP
        </a>
      </div>
    </div>
  )
}

/* ── TabRelatorio ────────────────────────────────────────────── */
function TabRelatorio({ estoque, offers, orders, markets }) {
  const [period, setPeriod] = useState('today') // today | week | month | all

  const todayStr = today()
  const periodStart = useMemo(() => {
    const d = new Date()
    if (period === 'today') return todayStr
    if (period === 'week')  { d.setDate(d.getDate() - 7);  return d.toISOString().slice(0, 10) }
    if (period === 'month') { d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10) }
    return '2000-01-01'
  }, [period, todayStr])

  // Orders in period
  const periodOrders = useMemo(() =>
    orders.filter(o => (o.createdAt || '').slice(0, 10) >= periodStart)
  , [orders, periodStart])

  // Estoque received in period
  const periodEstoque = useMemo(() =>
    estoque.filter(e => (e.receivedAt || '').slice(0, 10) >= periodStart)
  , [estoque, periodStart])

  const revenue  = periodOrders.reduce((s, o) => s + (o.totalPrice || 0), 0)
  const spent    = periodEstoque.reduce((s, e) => s + (e.totalPaid || 0), 0)
  const profit   = revenue - spent
  const ordersCount = periodOrders.length

  // Top products by revenue
  const topProducts = useMemo(() => {
    const map = {}
    periodOrders.forEach(o => {
      const k = o.productName || 'Desconhecido'
      map[k] = (map[k] || 0) + (o.totalPrice || 0)
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [periodOrders])

  // Top markets by volume
  const topMarkets = useMemo(() => {
    const map = {}
    periodOrders.forEach(o => {
      const k = o.storeName || 'Desconhecido'
      map[k] = (map[k] || 0) + (o.totalPrice || 0)
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [periodOrders])

  // Pending (market hasn't paid yet)
  const pending  = periodOrders.filter(o => o.status === 'pending').length
  const confirmed = periodOrders.filter(o => o.status === 'confirmed').length
  const delivered = periodOrders.filter(o => o.status === 'delivered').length

  const card = { background:'#0d2137', borderRadius:14, padding:'14px 16px', border:'1px solid #1a3a50' }
  const periodLabel = { today:'Hoje', week:'Últimos 7 dias', month:'Últimos 30 dias', all:'Todo período' }[period]

  function exportCSV() {
    const rows = [
      ['# RELATÓRIO CORTA PREÇOS — ' + periodLabel],
      ['# Gerado em ' + new Date().toLocaleString('pt-BR')],
      [],
      ['## PEDIDOS RECEBIDOS'],
      ['Data', 'Mercado', 'Telefone', 'Produto', 'Qtd', 'Unidade', 'Total (R$)', 'Status'],
      ...periodOrders.map(o => [
        o.createdAt?.slice(0,10) || '', o.storeName || '', o.storePhone || '',
        o.productName || '', o.qtyRequested || '', o.unit || '',
        (o.totalPrice || 0).toFixed(2).replace('.', ','), o.status || '',
      ]),
      [],
      ['## ENTRADAS DE ESTOQUE'],
      ['Data', 'Produto', 'Qtd', 'Unidade', 'Origem', 'Fornecedor', 'Total Pago (R$)', 'Custo/Un (R$)'],
      ...periodEstoque.map(e => [
        e.receivedAt || '', e.productName || '', e.qty || '', e.unit || '',
        e.sourceType || '', e.sourceName || '',
        (e.totalPaid || 0).toFixed(2).replace('.', ','),
        (e.unitCost  || 0).toFixed(2).replace('.', ','),
      ]),
      [],
      ['## RESUMO'],
      ['Faturado (R$)', revenue.toFixed(2).replace('.', ',')],
      ['Investido (R$)', spent.toFixed(2).replace('.', ',')],
      ['Resultado (R$)', profit.toFixed(2).replace('.', ',')],
    ]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(';')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `relatorio-${period}-${today()}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ padding:'16px 16px 100px' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:16 }}>
        <div>
          <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:20, marginBottom:2 }}>📊 Relatórios</div>
          <div style={{ color:'#475569', fontSize:13 }}>{periodLabel} · {ordersCount} pedido{ordersCount !== 1 ? 's' : ''}</div>
        </div>
        <button onClick={exportCSV}
          style={{ background:'#0d3d27', border:'1px solid #14532d', borderRadius:12, padding:'8px 14px', color:'#4ade80', fontWeight:800, fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>
          ⬇️ CSV
        </button>
      </div>

      {/* Period selector */}
      <div style={{ display:'flex', gap:6, marginBottom:16 }}>
        {[['today','Hoje'],['week','7 dias'],['month','30 dias'],['all','Tudo']].map(([id, label]) => (
          <button key={id} onClick={() => setPeriod(id)} style={{
            flex:1, padding:'8px 0', borderRadius:12, border:`1px solid ${period===id?'#10b981':'#1e3050'}`,
            background: period===id ? '#0d3d27' : '#0d2137',
            color: period===id ? '#4ade80' : '#475569', fontWeight:800, fontSize:12, cursor:'pointer',
          }}>{label}</button>
        ))}
      </div>

      {/* P&L cards */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:16 }}>
        {[
          { label:'Faturado', value:BRL.format(revenue), color:'#4ade80' },
          { label:'Investido', value:spent > 0 ? BRL.format(spent) : '—', color:'#f87171' },
          { label: profit > 0 ? 'Lucro' : profit < 0 ? 'Prejuízo' : 'Resultado',
            value: profit !== 0 ? BRL.format(Math.abs(profit)) : '—',
            color: profit > 0 ? '#10b981' : profit < 0 ? '#ef4444' : '#475569' },
        ].map(c => (
          <div key={c.label} style={{ ...card, textAlign:'center' }}>
            <div style={{ color:c.color, fontWeight:900, fontSize:15 }}>{c.value}</div>
            <div style={{ color:'#64748b', fontSize:10, fontWeight:700, marginTop:2 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Order status breakdown */}
      <div style={{ ...card, marginBottom:16 }}>
        <div style={{ color:'#94a3b8', fontSize:11, fontWeight:700, textTransform:'uppercase', marginBottom:10 }}>Status dos Pedidos</div>
        <div style={{ display:'flex', gap:0 }}>
          {[
            { label:'Pendentes', value:pending,   color:'#f59e0b' },
            { label:'Confirmados', value:confirmed, color:'#3b82f6' },
            { label:'Entregues',  value:delivered, color:'#10b981' },
          ].map((s, i) => (
            <div key={s.label} style={{ flex:1, textAlign:'center', borderRight: i < 2 ? '1px solid #1a3a50' : 'none' }}>
              <div style={{ color:s.color, fontWeight:900, fontSize:22 }}>{s.value}</div>
              <div style={{ color:'#475569', fontSize:10 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Top products */}
      {topProducts.length > 0 && (
        <div style={{ ...card, marginBottom:16 }}>
          <div style={{ color:'#94a3b8', fontSize:11, fontWeight:700, textTransform:'uppercase', marginBottom:10 }}>🏆 Top Produtos</div>
          {topProducts.map(([name, rev], i) => {
            const pct = topProducts[0][1] > 0 ? (rev / topProducts[0][1]) * 100 : 0
            return (
              <div key={name} style={{ marginBottom: i < topProducts.length - 1 ? 10 : 0 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                  <span style={{ color:'#e2e8f0', fontSize:13, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', paddingRight:8 }}>
                    {i+1}. {name}
                  </span>
                  <span style={{ color:'#10b981', fontWeight:800, fontSize:13 }}>{BRL.format(rev)}</span>
                </div>
                <div style={{ height:4, background:'#1a3a50', borderRadius:2 }}>
                  <div style={{ height:'100%', width:`${pct}%`, background:'#10b981', borderRadius:2, transition:'width 0.4s' }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Conversão de mercados ── */}
      {(markets || []).length > 0 && (() => {
        const buyerPhones = new Set(periodOrders.map(o => o.storePhone).filter(Boolean))
        const buyerNames  = new Set(periodOrders.map(o => o.storeName).filter(Boolean))
        const activeMkts  = (markets || []).filter(m => buyerPhones.has(m.phone) || buyerNames.has(m.name))
        const total       = (markets || []).length
        const pct         = total > 0 ? Math.round((activeMkts.length / total) * 100) : 0
        const barColor    = pct >= 75 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444'
        return (
          <div style={{ ...card, marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <div style={{ color:'#94a3b8', fontSize:11, fontWeight:700, textTransform:'uppercase' }}>📊 Conversão de Mercados</div>
              <div style={{ color: barColor, fontWeight:900, fontSize:22, lineHeight:1 }}>{pct}<span style={{ fontSize:13, fontWeight:700 }}>%</span></div>
            </div>
            {/* Barra principal */}
            <div style={{ height:12, background:'#1a3a50', borderRadius:99, marginBottom:12, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${pct}%`, background:`linear-gradient(90deg,${barColor}88,${barColor})`, borderRadius:99, transition:'width 0.6s ease' }} />
            </div>
            <div style={{ color:'#475569', fontSize:12, marginBottom:12 }}>
              <span style={{ color:'#e2e8f0', fontWeight:700 }}>{activeMkts.length}</span> de <span style={{ color:'#e2e8f0', fontWeight:700 }}>{total}</span> mercados compraram no período
            </div>
            {/* Lista de mercados com status */}
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {(markets || []).map(m => {
                const bought = buyerPhones.has(m.phone) || buyerNames.has(m.name)
                const revenue = periodOrders.filter(o => o.storePhone === m.phone || o.storeName === m.name).reduce((s, o) => s + (o.totalPrice || 0), 0)
                return (
                  <div key={m.id} style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:8, height:8, borderRadius:4, background: bought ? barColor : '#1e4060', flexShrink:0 }} />
                    <span style={{ color: bought ? '#e2e8f0' : '#475569', fontSize:13, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.name}</span>
                    {bought
                      ? <span style={{ color: barColor, fontWeight:700, fontSize:12, flexShrink:0 }}>{BRL.format(revenue)}</span>
                      : <span style={{ color:'#334155', fontSize:11, flexShrink:0 }}>sem pedido</span>
                    }
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Top markets */}
      {topMarkets.length > 0 && (
        <div style={{ ...card, marginBottom:16 }}>
          <div style={{ color:'#94a3b8', fontSize:11, fontWeight:700, textTransform:'uppercase', marginBottom:10 }}>🏪 Top Mercados</div>
          {topMarkets.map(([name, rev], i) => {
            const pct = topMarkets[0][1] > 0 ? (rev / topMarkets[0][1]) * 100 : 0
            return (
              <div key={name} style={{ marginBottom: i < topMarkets.length - 1 ? 10 : 0 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                  <span style={{ color:'#e2e8f0', fontSize:13, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', paddingRight:8 }}>
                    {i+1}. {name}
                  </span>
                  <span style={{ color:'#3b82f6', fontWeight:800, fontSize:13 }}>{BRL.format(rev)}</span>
                </div>
                <div style={{ height:4, background:'#1a3a50', borderRadius:2 }}>
                  <div style={{ height:'100%', width:`${pct}%`, background:'#3b82f6', borderRadius:2, transition:'width 0.4s' }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Estoque investido no período */}
      {periodEstoque.length > 0 && (
        <div style={card}>
          <div style={{ color:'#94a3b8', fontSize:11, fontWeight:700, textTransform:'uppercase', marginBottom:10 }}>
            📦 Entradas no Período ({periodEstoque.length} lote{periodEstoque.length !== 1 ? 's' : ''})
          </div>
          {periodEstoque.map(item => {
            const src = SOURCE_TYPES.find(s => s.id === item.sourceType) || SOURCE_TYPES[4]
            return (
              <div key={item.id} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, paddingBottom:8, borderBottom:'1px solid #1a3a50' }}>
                <span style={{ fontSize:14 }}>{src.emoji}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ color:'#e2e8f0', fontSize:13, fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.productName}</div>
                  <div style={{ color:'#475569', fontSize:11 }}>{item.qty} {item.unit} · {item.receivedAt}</div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  {item.totalPaid > 0 && <div style={{ color:'#f87171', fontWeight:700, fontSize:13 }}>{BRL.format(item.totalPaid)}</div>}
                  {item.unitCost > 0 && <div style={{ color:'#334155', fontSize:11 }}>{BRL.format(item.unitCost)}/un</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pedidos list */}
      {periodOrders.length > 0 && (
        <div style={card}>
          <div style={{ color:'#94a3b8', fontSize:11, fontWeight:700, textTransform:'uppercase', marginBottom:10 }}>
            📋 Pedidos no Período
          </div>
          {periodOrders.map(o => {
            const stBg  = o.status === 'delivered' ? '#14532d' : o.status === 'confirmed' ? '#1e3a5f' : '#78350f'
            const stClr = o.status === 'delivered' ? '#86efac' : o.status === 'confirmed' ? '#93c5fd' : '#fcd34d'
            const stLbl = o.status === 'delivered' ? 'Entregue' : o.status === 'confirmed' ? 'Confirmado' : 'Pendente'
            return (
              <div key={o.id} style={{ display:'flex', alignItems:'center', gap:8, paddingBottom:8, marginBottom:8, borderBottom:'1px solid #1a3a50' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ color:'#e2e8f0', fontSize:13, fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{o.productName}</div>
                  <div style={{ color:'#475569', fontSize:11 }}>{o.storeName} · {o.qtyRequested} {o.unit} · {o.createdAt?.slice(0,10)}</div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ color:'#10b981', fontWeight:800, fontSize:13 }}>{BRL.format(o.totalPrice)}</div>
                  <span style={{ fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:10, background:stBg, color:stClr }}>{stLbl}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {ordersCount === 0 && (
        <div style={{ textAlign:'center', padding:'40px 0', color:'#334155' }}>
          <BarChart2 size={40} style={{ marginBottom:8, opacity:0.3 }} />
          <div style={{ fontSize:14 }}>Nenhum dado para {periodLabel.toLowerCase()}</div>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════ */
/* ── MULTI-TENANT AUTH ─────────────────────────────────────── */
/* ══════════════════════════════════════════════════════════════ */
const SESSION_KEY    = 'cp_session_v1'
const ZAP_SERVER_KEY = 'cp_zap_server_url'
const ZAP_DEFAULT    = 'http://localhost:3001'

const TENANTS = [
  {
    id: 'mega',
    username: 'megatudo',
    password: 'mega2024',
    profile: {
      name: 'Mega Tudo Barato',
      phone: '11 2815-1989',
      businessName: 'MEGA TUDO BARATO',
      city: 'Cotia, SP',
      address: 'Rua Bandeirantes, 221, Portal da Primavera, Cotia, SP',
      cnpj: '18.755.137/0001-11',
      themeColor: '#f97316',
    },
    seedMarkets: [
      { id:'mega_mkt1', name:'Mercado Corta Preços',  phone:'15996604075', contact:'Proprietário',  address:'Vila Bom Jesus, Itapeva, SP',           city:'Itapeva/SP'        },
      { id:'mega_mkt2', name:'Supermercado São Jorge', phone:'15988554433', contact:'Jorge Pereira', address:'Rua das Acácias, 80, Tatuí, SP',        city:'Tatuí/SP'          },
      { id:'mega_mkt3', name:'Mercearia do Dinho',     phone:'15997665544', contact:'Claudinho',     address:'Rua Benedito Costa, 220, Itapetininga', city:'Itapetininga/SP'   },
      { id:'mega_mkt4', name:'Mini Mercado Expresso',  phone:'15976543210', contact:'Fátima Alves',  address:'Av. Brasil, 1200, Sorocaba, SP',        city:'Sorocaba/SP'       },
      { id:'mega_mkt5', name:'Armazém do Povo',        phone:'15991234567', contact:'Roberto Santos',address:'Rua Central, 44, São Roque, SP',        city:'São Roque/SP'      },
    ],
    autoSeedDemo: true, // carrega DEMO_ESTOQUE/OFFERS/ORDERS na primeira entrada
  },
]

/* ── LoginPage ───────────────────────────────────────────────── */
function LoginPage({ onLogin }) {
  const [user,    setUser]    = useState('')
  const [pass,    setPass]    = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)

  const inp = { display:'block', width:'100%', background:'#0a1929', border:'1px solid #1e4060', borderRadius:14, padding:'14px 16px', color:'#e2e8f0', fontSize:16, boxSizing:'border-box', outline:'none', marginBottom:12 }

  function handleLogin() {
    if (!user || !pass) return
    setLoading(true); setError('')
    setTimeout(() => {
      const tenant = TENANTS.find(t => t.username === user.trim().toLowerCase() && t.password === pass)
      if (tenant) {
        onLogin(tenant)
      } else {
        setError('Usuário ou senha incorretos')
        setLoading(false)
      }
    }, 700) // simulate network delay
  }

  return (
    <div style={{ minHeight:'100vh', background:'#050f1a', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px 20px' }}>

      {/* Platform branding */}
      <div style={{ textAlign:'center', marginBottom:32 }}>
        <ZatendeStockLogo variant="full" />
        <div style={{ color:'#10b981', fontSize:12, fontWeight:700, marginTop:10, textTransform:'uppercase', letterSpacing:'0.12em' }}>Portal do Distribuidor</div>
      </div>

      {/* Login card */}
      <div style={{ background:'#0a1929', borderRadius:24, padding:'28px 24px', width:'100%', maxWidth:380, border:'1px solid #1e4060', boxShadow:'0 24px 64px rgba(0,0,0,0.5)' }}>
        <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:20, marginBottom:4 }}>Entrar</div>
        <div style={{ color:'#475569', fontSize:13, marginBottom:24 }}>Acesso restrito a distribuidoras cadastradas</div>

        <label style={{ color:'#64748b', fontSize:11, fontWeight:700, textTransform:'uppercase' }}>Usuário</label>
        <input value={user} onChange={e => { setUser(e.target.value); setError('') }} placeholder="Seu usuário"
          style={{ ...inp, marginTop:6 }} autoCapitalize="none" autoCorrect="off"
          onKeyDown={e => e.key === 'Enter' && handleLogin()} />

        <label style={{ color:'#64748b', fontSize:11, fontWeight:700, textTransform:'uppercase' }}>Senha</label>
        <div style={{ position:'relative', marginTop:6, marginBottom: error ? 8 : 20 }}>
          <input value={pass} onChange={e => { setPass(e.target.value); setError('') }}
            type={showPass ? 'text' : 'password'} placeholder="Sua senha"
            style={{ ...inp, marginBottom:0, paddingRight:48 }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()} />
          <button onClick={() => setShowPass(v => !v)} style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#475569', padding:4 }}>
            {showPass ? '🙈' : '👁'}
          </button>
        </div>

        {error && (
          <div style={{ background:'#7c1d1d', border:'1px solid #991b1b', borderRadius:10, padding:'10px 14px', color:'#fca5a5', fontSize:13, marginBottom:16, display:'flex', alignItems:'center', gap:6 }}>
            ⚠️ {error}
          </div>
        )}

        <button onClick={handleLogin} disabled={loading || !user || !pass}
          style={{ width:'100%', background: loading || !user || !pass ? '#1e4060' : 'linear-gradient(135deg,#10b981,#059669)', border:'none', borderRadius:14, padding:'16px', color:'#fff', fontWeight:900, fontSize:16, cursor: loading ? 'wait' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:10, transition:'all 0.2s', boxShadow: !loading && user && pass ? '0 8px 24px rgba(16,185,129,0.35)' : 'none' }}>
          {loading ? '⏳ Entrando...' : '🔐 Entrar'}
        </button>

        {/* Demo credentials */}
        <div style={{ marginTop:20, padding:'14px 16px', background:'#060e1a', borderRadius:14, border:'1px dashed #1e4060' }}>
          <div style={{ color:'#334155', fontSize:10, fontWeight:700, textTransform:'uppercase', marginBottom:10 }}>ACESSO PARA DEMONSTRAÇÃO</div>
          {TENANTS.map(t => (
            <button key={t.id} onClick={() => { setUser(t.username); setPass(t.password); setError('') }}
              style={{ display:'flex', alignItems:'center', gap:10, width:'100%', background:'#0d2137', border:'1px solid #1e4060', borderRadius:12, padding:'10px 14px', cursor:'pointer', marginBottom:6 }}>
              <div style={{ width:32, height:32, borderRadius:10, background:`linear-gradient(135deg,${t.profile.themeColor},${t.profile.themeColor}aa)`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <span style={{ color:'#fff', fontWeight:900, fontSize:11 }}>{t.profile.businessName.split(' ').map(w=>w[0]).slice(0,3).join('')}</span>
              </div>
              <div style={{ textAlign:'left' }}>
                <div style={{ color:'#e2e8f0', fontWeight:700, fontSize:13 }}>{t.profile.businessName}</div>
                <div style={{ color:'#475569', fontSize:11 }}>👤 {t.username} · 🔑 {t.password}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <Footer variant="forn" />
    </div>
  )
}

/* ── EditProfileModal ────────────────────────────────────────── */
const THEME_COLORS = [
  { color:'#10b981', label:'Verde'    },
  { color:'#f97316', label:'Laranja'  },
  { color:'#3b82f6', label:'Azul'     },
  { color:'#8b5cf6', label:'Roxo'     },
  { color:'#ef4444', label:'Vermelho' },
  { color:'#f59e0b', label:'Amarelo'  },
]

function EditProfileModal({ profile, onSave, onClose }) {
  const inp = { display:'block', width:'100%', marginTop:6, marginBottom:14, background:'#0d2137', border:'1px solid #1e4060', borderRadius:12, padding:'12px 14px', color:'#e2e8f0', fontSize:14, boxSizing:'border-box', outline:'none' }
  const lbl = { color:'#64748b', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }
  const [form, setForm] = useState({
    name:         profile.name         || '',
    phone:        profile.phone        || '',
    businessName: profile.businessName || '',
    city:         profile.city         || '',
    address:      profile.address      || '',
    cnpj:         profile.cnpj         || '',
    themeColor:   profile.themeColor   || '#10b981',
    logo:         profile.logo         || '',
  })
  const F = k => ({ value: form[k], onChange: e => setForm(p => ({ ...p, [k]: e.target.value })) })

  function handleLogo(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { alert('Imagem muito grande! Use uma com menos de 2MB.'); return }
    const reader = new FileReader()
    reader.onload = ev => setForm(p => ({ ...p, logo: ev.target.result }))
    reader.readAsDataURL(file)
  }

  const theme = form.themeColor || '#10b981'
  const initials = (form.businessName || form.name || '?').split(' ').map(w => w[0]).slice(0,3).join('').toUpperCase()

  return (
    <div style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'20px 20px', overflowY:'auto' }}>
      <div style={{ background:'#0a1929', borderRadius:20, padding:24, width:'100%', maxWidth:400, border:'1px solid #1e4060', marginTop:20 }}>
        <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:18, marginBottom:4 }}>⚙️ Perfil da Distribuidora</div>
        <div style={{ color:'#334155', fontSize:12, marginBottom:20 }}>Estas informações aparecem no cabeçalho e nas mensagens do ZAP</div>

        {/* Logo upload */}
        <label style={lbl}>Logo da Empresa</label>
        <div style={{ display:'flex', alignItems:'center', gap:16, marginTop:8, marginBottom:16 }}>
          <div style={{ width:72, height:72, borderRadius:18, background:`linear-gradient(135deg,${theme},${theme}99)`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, overflow:'hidden', border:`2px solid ${theme}44` }}>
            {form.logo
              ? <img src={form.logo} alt="logo" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              : <span style={{ color:'#fff', fontWeight:900, fontSize:18 }}>{initials}</span>
            }
          </div>
          <div style={{ flex:1 }}>
            <label style={{ display:'block', background:'#0d2137', border:'1px dashed #1e4060', borderRadius:12, padding:'12px 16px', cursor:'pointer', textAlign:'center', color:'#64748b', fontSize:13 }}>
              📷 {form.logo ? 'Trocar logo' : 'Enviar logo'}
              <input type="file" accept="image/*" onChange={handleLogo} style={{ display:'none' }} />
            </label>
            {form.logo && (
              <button onClick={() => setForm(p => ({ ...p, logo: '' }))} style={{ marginTop:6, background:'none', border:'none', color:'#ef4444', fontSize:12, cursor:'pointer', width:'100%' }}>
                🗑 Remover logo
              </button>
            )}
          </div>
        </div>

        <label style={lbl}>Nome do Responsável *</label>
        <input {...F('name')} placeholder="Ex: João Silva" style={inp} />

        <label style={lbl}>WhatsApp do Responsável *</label>
        <input {...F('phone')} placeholder="(11) 99999-0000" type="tel" style={inp} />

        <div style={{ borderTop:'1px solid #1a3a50', paddingTop:16, marginBottom:16 }}>
          <div style={{ color:'#475569', fontSize:11, fontWeight:700, marginBottom:12 }}>DADOS DA EMPRESA</div>

          <label style={lbl}>Nome da Empresa</label>
          <input {...F('businessName')} placeholder="Ex: MEGA TUDO BARATO" style={inp} />

          <label style={lbl}>Cidade / Estado</label>
          <input {...F('city')} placeholder="Ex: Cotia, SP" style={inp} />

          <label style={lbl}>Endereço</label>
          <input {...F('address')} placeholder="Rua Bandeirantes, 221, Cotia, SP" style={inp} />

          <label style={lbl}>CNPJ (opcional)</label>
          <input {...F('cnpj')} placeholder="18.755.137/0001-11" style={{ ...inp, marginBottom:12 }} />

          <label style={lbl}>Cor do tema</label>
          <div style={{ display:'flex', gap:8, marginTop:6, marginBottom:14, flexWrap:'wrap' }}>
            {THEME_COLORS.map(c => (
              <button key={c.color} onClick={() => setForm(p => ({ ...p, themeColor: c.color }))} style={{
                width:36, height:36, borderRadius:10, background:c.color,
                border: form.themeColor === c.color ? '3px solid #fff' : '3px solid transparent',
                cursor:'pointer', flexShrink:0, boxShadow: form.themeColor === c.color ? `0 0 12px ${c.color}88` : 'none',
              }} title={c.label} />
            ))}
          </div>
        </div>

        <div style={{ display:'flex', gap:10 }}>
          <Btn full disabled={!form.name.trim()} onClick={() => onSave({ ...form, name: form.name.trim(), phone: form.phone.trim() })}>
            <Check size={16} /> Salvar
          </Btn>
          <Btn secondary full onClick={onClose}>Cancelar</Btn>
        </div>
      </div>
    </div>
  )
}

export default function Fornecedor() {
  /* ── One-time migration: copy flat legacy keys → forn:{tenantId}: namespace.
     Runs before any useState so returning sessions get their data on first render. ── */
  ;(() => {
    try {
      const sess = JSON.parse(localStorage.getItem(SESSION_KEY))
      if (!sess?.id) return
      const fk = (base) => `forn:${sess.id}:${base}`
      const BASES = [LOCAL, MKTS_KEY, RECURRENCE_KEY, SUPPLIERS_KEY]
      migrateToNamespace(BASES, fk)
    } catch {}
  })()

  /* ══ ALL HOOKS FIRST — no conditional hooks (React rules) ══ */

  /* ── Session ── */
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)) } catch { return null }
  })

  /* ── Profile — loaded from localStorage, falls back to tenant default ── */
  const [profile, setProfile] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(fornKey(LOCAL)))
      if (saved?.name) return saved
    } catch {}
    const s = (() => { try { return JSON.parse(localStorage.getItem(SESSION_KEY)) } catch { return null } })()
    const tenant = s ? TENANTS.find(t => t.id === s.id) : null
    return tenant?.profile || { name: 'Distribuidor', phone: '' }
  })

  const [markets,     setMarkets]     = useState(() => { try { return JSON.parse(localStorage.getItem(fornKey(MKTS_KEY))) || [] } catch { return [] } })
  const [estoque,     setEstoque]     = useState([])
  const [offers,      setOffers]      = useState([])
  const [orders,      setOrders]      = useState([])
  const [recurrences, setRecurrences] = useState(() => {
    try { return JSON.parse(localStorage.getItem(fornKey(RECURRENCE_KEY)) || '[]') } catch { return [] }
  })
  const [tab,         setTab]         = useState('inicio')
  const [syncing,     setSyncing]     = useState(false)
  const [synced,      setSynced]      = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)
  const [preSelectedForOffer, setPreSelectedForOffer] = useState(null)
  const [zapServerUrl,  setZapServerUrl]  = useState(() => localStorage.getItem(ZAP_SERVER_KEY) || ZAP_DEFAULT)
  const [zapConnected,  setZapConnected]  = useState(false)
  const [zapPhone,      setZapPhone]      = useState(null)
  const [editingZap,    setEditingZap]    = useState(false)

  const goToOferta = useCallback((item) => {
    setPreSelectedForOffer(item)
    setTab('ofertas')
  }, [])

  const saveProfile = (data) => {
    setProfile(data)
    try { localStorage.setItem(fornKey(LOCAL), JSON.stringify(data)) } catch {}
    persistKey(PROFILE_SERVER_KEY, data)   // sincroniza logo e tema em todos os dispositivos
    setEditingProfile(false)
  }

  /* ── Auth handlers ── */
  async function handleLogin(tenant) {
    const s = { id: tenant.id, username: tenant.username }
    setSession(s)
    localStorage.setItem(SESSION_KEY, JSON.stringify(s))

    // Migrate flat legacy keys → forn:{tenantId}: namespace on first login after upgrade
    migrateToNamespace([LOCAL, MKTS_KEY, RECURRENCE_KEY, SUPPLIERS_KEY], fornKey)

    // Set profile from tenant (preserve edits if businessName matches)
    const saved = (() => { try { return JSON.parse(localStorage.getItem(fornKey(LOCAL))) } catch { return null } })()
    const prof = (saved?.businessName === tenant.profile.businessName) ? saved : tenant.profile
    setProfile(prof)
    localStorage.setItem(fornKey(LOCAL), JSON.stringify(prof))

    // Demo tenants: substituir mercados completamente (limpa lixo de sessões antigas)
    // Real tenants: merge preservando cadastros manuais
    if (tenant.seedMarkets?.length) {
      const mkts = tenant.autoSeedDemo
        ? tenant.seedMarkets                        // substitui — demo sempre parte limpo
        : (() => {                                  // merge — real preserva cadastros manuais
            const saved = (() => { try { return JSON.parse(localStorage.getItem(fornKey(MKTS_KEY))) || [] } catch { return [] } })()
            const ids   = new Set(saved.map(m => m.id))
            return [...saved, ...tenant.seedMarkets.filter(m => !ids.has(m.id))]
          })()
      setMarkets(mkts)
      localStorage.setItem(fornKey(MKTS_KEY), JSON.stringify(mkts))
      persistKey(MKTS_SERVER_KEY, mkts)
    }
  }

  function handleLogout() {
    setSession(null)
    localStorage.removeItem(SESSION_KEY)
  }

  const sync = useCallback(async () => {
    setSyncing(true)
    const { estoque: e, offers: o, orders: ord, markets: mkt, profile: srvProfile } = await fetchAll()
    setEstoque(e)
    setOffers(o.filter(of => of.supplierId === LOCAL || !of.supplierId))
    setOrders(ord)
    // markets: merge server data with localStorage seed
    const localMkts = (() => { try { return JSON.parse(localStorage.getItem(fornKey(MKTS_KEY))) || [] } catch { return [] } })()
    if (mkt !== null) {
      const serverIds = new Set(mkt.map(m => m.id))
      const merged = [...mkt, ...localMkts.filter(m => !serverIds.has(m.id))]
      setMarkets(merged)
      try { localStorage.setItem(fornKey(MKTS_KEY), JSON.stringify(merged)) } catch {}
    }
    // profile: server wins for logoUrl (so mobile picks up logo uploaded on PC)
    if (srvProfile) {
      setProfile(prev => {
        // merge: prefer server's logoUrl and themeColor if local is missing them
        const merged = { ...prev, ...srvProfile }
        try { localStorage.setItem(fornKey(LOCAL), JSON.stringify(merged)) } catch {}
        return merged
      })
    }
    setSyncing(false)
    setSynced(true)
  }, [])

  useEffect(() => { sync() }, [sync])

  // Auto-seed demo data — ALWAYS merge after sync (dedup by ID; safe for real data)
  useEffect(() => {
    if (!synced || !session) return
    const tenant = TENANTS.find(t => t.id === session.id)
    if (!tenant?.autoSeedDemo) return

    setOrders(prev => {
      const ids = new Set(prev.map(o => o.id))
      const merged = [...prev, ...DEMO_ORDERS_HIST.filter(o => !ids.has(o.id))]
      persistKey(ORDERS_KEY, merged)
      return merged
    })
    setOffers(prev => {
      const ids = new Set(prev.map(o => o.id))
      const merged = [...prev, ...DEMO_OFFERS.filter(o => !ids.has(o.id))]
      persistKey(OFFERS_KEY, merged)
      return merged
    })
    setEstoque(prev => {
      const ids = new Set(prev.map(e => e.id))
      const merged = [...prev, ...DEMO_ESTOQUE.filter(e => !ids.has(e.id))]
      persistKey(ESTOQUE_KEY, merged)
      return merged
    })
    // Demo tenant: substituir mercados completamente (remove telefones errados de sessões antigas)
    const freshMkts = tenant.seedMarkets || []
    setMarkets(freshMkts)
    localStorage.setItem(fornKey(MKTS_KEY), JSON.stringify(freshMkts))
    persistKey(MKTS_SERVER_KEY, freshMkts)
  }, [synced]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const prev = document.title
    document.title = 'ZatendeStock – Portal do Distribuidor'
    return () => { document.title = prev }
  }, [])

  // Auto-detect new orders written by Ofertas.jsx (same browser, cross-tab)
  useEffect(() => {
    if (!session) return
    function checkOrders() {
      const raw = localStorage.getItem(ORDERS_KEY)
      if (!raw) return
      try {
        const fresh = JSON.parse(raw)
        setOrders(prev => {
          const prevIds = new Set(prev.map(o => o.id))
          return fresh.some(o => !prevIds.has(o.id)) || fresh.length !== prev.length ? fresh : prev
        })
      } catch {}
    }
    function onStorageOrders(e) {
      if (e.key === ORDERS_KEY) checkOrders()
    }
    const iv = setInterval(checkOrders, 10_000)
    window.addEventListener('storage', onStorageOrders)
    return () => {
      clearInterval(iv)
      window.removeEventListener('storage', onStorageOrders)
    }
  }, [session])

  // Ping local ZAP server every 8 seconds to check connection
  useEffect(() => {
    if (!session) return
    async function ping() {
      try {
        const r = await fetch(`${zapServerUrl}/status`, { signal: AbortSignal.timeout(2000) })
        const d = await r.json()
        setZapConnected(d.connected === true)
        setZapPhone(d.phone || null)
      } catch {
        setZapConnected(false)
        setZapPhone(null)
      }
    }
    ping()
    const id = setInterval(ping, 8000)
    return () => clearInterval(id)
  }, [session, zapServerUrl])

  /* ── Login gate — after ALL hooks ── */
  if (!session) return <LoginPage onLogin={handleLogin} />

  const pendingOrders = orders.filter(o => o.status === 'pending').length

  const TABS = [
    { id:'inicio',    icon: LayoutDashboard, label:'Início',    badge: 0 },
    { id:'receber',   icon: ArrowDownToLine, label:'Receber',   badge: 0 },
    { id:'ofertas',   icon: Send,            label:'Ofertas',   badge: offers.filter(o=>o.status==='pending').length },
    { id:'pedidos',   icon: ClipboardList,   label:'Pedidos',   badge: pendingOrders },
    { id:'sellout',   icon: TrendingUp,      label:'Sell-Out',  badge: 0 },
    { id:'mercados',  icon: Users,           label:'Mercados',  badge: 0 },
    { id:'relatorio', icon: BarChart2,       label:'Resultado', badge: 0 },
  ]

  return (
    <div style={{ minHeight:'100dvh', background:'#050f1a', display:'flex', flexDirection:'column', fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>

      {/* Edit profile modal */}
      {editingProfile && (
        <EditProfileModal profile={profile} onSave={saveProfile} onClose={() => setEditingProfile(false)} />
      )}

      {/* ZAP Server config modal */}
      {editingZap && (
        <div style={{ position:'fixed', inset:0, zIndex:400, background:'rgba(0,0,0,0.92)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:'#0a1929', borderRadius:20, padding:24, width:'100%', maxWidth:380, border:'1px solid #1e4060' }}>
            <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:18, marginBottom:4 }}>⚡ Servidor ZAP Local</div>
            <div style={{ color:'#475569', fontSize:12, marginBottom:16 }}>
              Baileys no seu Mac dispara mensagens direto sem abrir o WA um por um
            </div>
            {/* Status */}
            <div style={{ display:'flex', alignItems:'center', gap:10, background:'#0d2137', borderRadius:12, padding:'12px 14px', marginBottom:14, border:`1px solid ${zapConnected ? '#10b981' : '#1e4060'}` }}>
              <div style={{ width:10, height:10, borderRadius:5, flexShrink:0, background: zapConnected ? '#10b981' : '#ef4444', boxShadow: zapConnected ? '0 0 8px #10b981' : 'none' }} />
              <div>
                <div style={{ color: zapConnected ? '#10b981' : '#f87171', fontWeight:800, fontSize:13 }}>
                  {zapConnected ? `✅ Conectado${zapPhone ? ' — ' + zapPhone : ''}` : '🔴 Servidor offline'}
                </div>
                <div style={{ color:'#475569', fontSize:11 }}>
                  {zapConnected ? 'Disparos automáticos prontos!' : 'Rode: cd zap-server && node server.js'}
                </div>
              </div>
            </div>
            {/* URL */}
            <div style={{ color:'#64748b', fontSize:10, fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>URL do servidor</div>
            <input value={zapServerUrl} onChange={e => setZapServerUrl(e.target.value)} placeholder="http://localhost:3001"
              style={{ display:'block', width:'100%', background:'#0d2137', border:'1px solid #1e4060', borderRadius:12, padding:'11px 14px', color:'#e2e8f0', fontSize:14, boxSizing:'border-box', outline:'none', marginBottom:14 }} />
            {/* Commands */}
            <div style={{ background:'#050f1a', borderRadius:10, padding:'10px 14px', marginBottom:14, border:'1px solid #0f2035' }}>
              <div style={{ color:'#64748b', fontSize:10, fontWeight:700, marginBottom:6 }}>Comandos no seu Mac:</div>
              {['git pull', 'cd zap-server', 'npm install', 'node server.js'].map((cmd, i) => (
                <div key={i} style={{ color:'#10b981', fontFamily:'monospace', fontSize:12, marginBottom:2 }}>$ {cmd}</div>
              ))}
              <div style={{ color:'#475569', fontSize:10, marginTop:6 }}>Escaneie o QR com o WA do distribuidor</div>
            </div>
            <div style={{ color:'#64748b', fontSize:10, marginBottom:14 }}>
              💡 Acesse pelo <strong style={{ color:'#93c5fd' }}>localhost:5173</strong> (npm run dev) para evitar bloqueio HTTPS↔HTTP.
              Para acesso remoto use <strong style={{ color:'#93c5fd' }}>ngrok http 3001</strong> e cole a URL https:// aqui.
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => { localStorage.setItem(ZAP_SERVER_KEY, zapServerUrl); setEditingZap(false) }}
                style={{ flex:1, padding:'12px', background:'linear-gradient(135deg,#10b981,#059669)', border:'none', borderRadius:12, color:'#fff', fontWeight:900, fontSize:14, cursor:'pointer' }}>
                Salvar
              </button>
              <button onClick={() => setEditingZap(false)}
                style={{ flex:1, padding:'12px', background:'#0d2137', border:'1px solid #1e4060', borderRadius:12, color:'#64748b', fontWeight:700, fontSize:14, cursor:'pointer' }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', alignItems:'center', padding:'10px 14px 8px', background:'#060e1a', borderBottom:`1px solid ${(profile.themeColor||'#10b981')}22`, position:'sticky', top:0, zIndex:10 }}>
        <button onClick={() => setEditingProfile(true)} style={{ display:'flex', alignItems:'center', gap:10, background:'none', border:'none', cursor:'pointer', padding:0, flex:1, minWidth:0 }}>
          {/* Logo circle with initials or truck icon */}
          <div style={{ width:40, height:40, borderRadius:12, background:`linear-gradient(135deg,${profile.themeColor||'#10b981'},${(profile.themeColor||'#10b981')}aa)`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:`0 4px 12px ${(profile.themeColor||'#10b981')}44`, overflow:'hidden' }}>
            {profile.logo
              ? <img src={profile.logo} alt="logo" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              : profile.businessName
                ? <span style={{ color:'#fff', fontWeight:900, fontSize:13 }}>{profile.businessName.split(' ').map(w=>w[0]).slice(0,3).join('').toUpperCase()}</span>
                : <Truck size={18} color="#fff" />
            }
          </div>
          <div style={{ textAlign:'left', flex:1, minWidth:0 }}>
            <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:14, lineHeight:1.1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {profile.businessName || profile.name}
              <span style={{ color:'#334155', fontWeight:400, fontSize:10, marginLeft:5 }}>✏️</span>
            </div>
            {!profile.businessName
              ? <div style={{ color:'#f59e0b', fontSize:10, fontWeight:700 }}>⚠️ Toque aqui para configurar empresa</div>
              : <div style={{ color: profile.themeColor || '#10b981', fontSize:10, fontWeight:700 }}>📍 {profile.city || 'Portal do Distribuidor'}</div>
            }
          </div>
        </button>

        {/* ── center: ZatendeStock platform brand ── */}
        <ZatendeStockLogo variant="wordmark" style={{ justifyContent:'center' }} />

        <div style={{ display:'flex', gap:6, alignItems:'center', justifyContent:'flex-end' }}>
          <button onClick={sync} disabled={syncing} style={{ background:'none', border:'none', cursor:'pointer', color:'#475569', padding:4 }}>
            <RefreshCw size={16} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          {/* ZAP Server indicator */}
          <button onClick={() => setEditingZap(true)} title={zapConnected ? `ZAP conectado${zapPhone ? ': '+zapPhone : ''}` : 'Configurar Servidor ZAP'} style={{ display:'flex', alignItems:'center', gap:4, background:'#0d2137', border:`1px solid ${zapConnected ? '#10b981' : '#1e4060'}`, borderRadius:8, padding:'5px 8px', cursor:'pointer' }}>
            <div style={{ width:6, height:6, borderRadius:3, background: zapConnected ? '#10b981' : '#334155', boxShadow: zapConnected ? '0 0 5px #10b981' : 'none', flexShrink:0 }} />
            <span style={{ color: zapConnected ? '#10b981' : '#475569', fontSize:10, fontWeight:800, letterSpacing:'0.05em' }}>ZAP</span>
          </button>
          <button onClick={handleLogout} title="Sair" style={{ background:'#1a1a2e', border:'1px solid #2d2d4e', borderRadius:8, padding:'5px 8px', cursor:'pointer', color:'#475569', fontSize:12, fontWeight:700 }}>
            Sair
          </button>
          {pendingOrders > 0 && (
            <div style={{ background:'#78350f', border:'1px solid #92400e', borderRadius:10, padding:'4px 10px', color:'#fcd34d', fontSize:12, fontWeight:700 }}>
              {pendingOrders} pedido{pendingOrders !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto' }}>
        {tab === 'inicio'    && <TabInicio    estoque={estoque} offers={offers} orders={orders} profile={profile} markets={markets} setEstoque={setEstoque} setOffers={setOffers} setMarkets={setMarkets} setOrders={setOrders} onNavigate={setTab} zapServerUrl={zapServerUrl} zapConnected={zapConnected} recurrences={recurrences} setRecurrences={setRecurrences} />}
        {tab === 'receber'   && <TabReceber   estoque={estoque} setEstoque={setEstoque} offers={offers} setOffers={setOffers} markets={markets} profile={profile} zapServerUrl={zapServerUrl} zapConnected={zapConnected} />}
        {tab === 'ofertas'   && <TabOfertas   estoque={estoque} offers={offers} setOffers={setOffers} markets={markets} profile={profile} orders={orders} preSelected={preSelectedForOffer} onClearPreSelected={() => setPreSelectedForOffer(null)} zapServerUrl={zapServerUrl} zapConnected={zapConnected} />}
        {tab === 'pedidos'   && <TabPedidos   orders={orders} setOrders={setOrders} markets={markets} />}
        {tab === 'sellout'   && <TabSellOut   orders={orders} markets={markets} />}
        {tab === 'mercados'  && <TabMercados  markets={markets} setMarkets={setMarkets} orders={orders} recurrences={recurrences} setRecurrences={setRecurrences} />}
        {tab === 'relatorio' && <TabRelatorio estoque={estoque} offers={offers} orders={orders} markets={markets} />}
      </div>

      <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'#060e1a', borderTop:'1px solid #0f2035', display:'flex', padding:'0 0 env(safe-area-inset-bottom,0)', zIndex:20 }}>
        {TABS.map(({ id, icon: Icon, label, badge }) => {
          const active = tab === id
          return (
            <button key={id} onClick={() => setTab(id)} style={{ flex:1, background:'none', border:'none', cursor:'pointer', padding:'12px 4px 8px', display:'flex', flexDirection:'column', alignItems:'center', gap:3, position:'relative' }}>
              {badge > 0 && (
                <div style={{ position:'absolute', top:8, right:'50%', transform:'translateX(10px)', background:'#ef4444', color:'#fff', borderRadius:10, minWidth:16, height:16, fontSize:10, fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 4px', animation: id === 'pedidos' ? 'badgePulse 1.2s ease-in-out infinite' : 'none' }}>{badge}</div>
              )}
              <Icon size={20} color={active ? '#10b981' : '#475569'} />
              <span style={{ fontSize:9, fontWeight:700, color: active ? '#10b981' : '#475569' }}>{label}</span>
            </button>
          )
        })}
      </div>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes badgePulse { 0%,100% { transform: translateX(10px) scale(1) } 50% { transform: translateX(10px) scale(1.35) } }
      `}</style>
    </div>
  )
}
