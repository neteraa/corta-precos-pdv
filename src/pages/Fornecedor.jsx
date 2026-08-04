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

const BRL         = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const LOCAL       = 'cp_fornecedor_v1'
const OFFERS_KEY  = 'cp_supplier_offers'
const ESTOQUE_KEY = 'cp_fornecedor_estoque'
const ORDERS_KEY  = 'cp_supplier_orders'
const MKTS_KEY    = LOCAL + '_markets'
const MKTS_SERVER_KEY = 'cp_distribuidor_markets'  // server-side persistence (cross-device)
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
function BlitzModal({ offers, setOffers, markets, profile, onClose }) {
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
      'https://corta-precos-pdv.netlify.app/ofertas',
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
    return <BlastScreen customMsg={blastMsg} markets={markets} supplierName={profile.name} supplierPhone={profile.phone} onDone={onClose} />
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
function BlastScreen({ offer, customMsg, markets, supplierName, supplierPhone, onDone }) {
  const [idx, setIdx] = useState(0)
  const valid  = (markets || []).filter(m => m.phone)
  const done   = idx >= valid.length
  const pct    = valid.length ? Math.round((idx / valid.length) * 100) : 100
  const curr   = valid[idx]
  const msg    = customMsg || buildOfferMsg(offer, supplierName, supplierPhone)

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
  // Arrived today — normal
  { id:'demo1', productName:'Coca-Cola 2L',           sku:'7894900011630', qty:120, unit:'UND', unitCost:5.20,  totalPaid:624,  sourceType:'atacadista', sourceName:'Atacado Central SP', expiryDate:DEMO_DATE(45),  receivedAt:today(), updatedAt:new Date().toISOString() },
  { id:'demo2', productName:'Arroz Tio João 5kg',     sku:'7896036500572', qty:80,  unit:'SC',  unitCost:18.50, totalPaid:1480, sourceType:'atacadista', sourceName:'Atacado Central SP', expiryDate:DEMO_DATE(365), receivedAt:today(), updatedAt:new Date().toISOString() },
  // Arrived yesterday — attention
  { id:'demo3', productName:'Óleo de Soja Soya 900ml',sku:'7896036500573', qty:60,  unit:'UND', unitCost:6.80,  totalPaid:408,  sourceType:'contato',    sourceName:'Pedro da Soya',      expiryDate:DEMO_DATE(180), receivedAt:DEMO_DATE(-1), updatedAt:new Date().toISOString() },
  // Arrived 2 days ago — URGENT
  { id:'demo4', productName:'Panetone Bauducco Amassado', sku:'', qty:156, unit:'UND', unitCost:0.80, totalPaid:125, sourceType:'leilao', sourceName:'Leilão CAIXA SP — Lote 44', expiryDate:DEMO_DATE(12), receivedAt:DEMO_DATE(-2), updatedAt:new Date().toISOString() },
  { id:'demo5', productName:'Leite Integral Itambé 1L',sku:'7896051190016',qty:144, unit:'CX',  unitCost:4.30,  totalPaid:619,  sourceType:'danificado',  sourceName:'Caixa amassada, produto OK', expiryDate:DEMO_DATE(30),  receivedAt:DEMO_DATE(-2), updatedAt:new Date().toISOString() },
]
const DEMO_OFFERS = [
  { id:'doff1', supplierId:LOCAL, supplierName:'Distribuidora Demo', supplierPhone:'15999990000', productName:'Panetone Bauducco Amassado', sku:'', qty:156, unit:'UND', offerPrice:1.50, expiryDate:DEMO_DATE(12), isOpportunity:true,  note:'Embalagem amassada, produto 100% OK — preço de custo!', status:'pending', publishedAt:DEMO_AGO(2) },
  { id:'doff2', supplierId:LOCAL, supplierName:'Distribuidora Demo', supplierPhone:'15999990000', productName:'Leite Integral Itambé 1L',   sku:'7896051190016', qty:144, unit:'CX',  offerPrice:5.20, expiryDate:DEMO_DATE(30), isOpportunity:true,  note:'Caixa amassada, leite perfeito — entrega imediata', status:'pending', publishedAt:DEMO_AGO(2) },
  { id:'doff3', supplierId:LOCAL, supplierName:'Distribuidora Demo', supplierPhone:'15999990000', productName:'Coca-Cola 2L',              sku:'7894900011630', qty:120, unit:'UND', offerPrice:6.90, expiryDate:DEMO_DATE(45), isOpportunity:false, note:'Lote novo, direto do atacado',                      status:'pending', publishedAt:DEMO_AGO(0) },
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
function TabInicio({ estoque, offers, orders, profile, markets, setEstoque, setOffers, setMarkets, setOrders, onNavigate }) {
  const [showBlitz,  setShowBlitz]  = useState(false)
  const [blastAll,   setBlastAll]   = useState(false)
  const [editItem,   setEditItem]   = useState(null)  // stock item being edited
  const todayStr = today()

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
      'https://corta-precos-pdv.netlify.app/ofertas',
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
    setEstoque(DEMO_ESTOQUE); setOffers(DEMO_OFFERS); setMarkets(DEMO_MARKETS)
    setOrders(prev => { const ids = new Set(prev.map(o => o.id)); return [...DEMO_ORDERS_HIST.filter(o => !ids.has(o.id)), ...prev] })
    await persistKey(ESTOQUE_KEY, DEMO_ESTOQUE)
    await persistKey(OFFERS_KEY,  DEMO_OFFERS)
    await persistKey(MKTS_SERVER_KEY, DEMO_MARKETS)
  }

  if (singleBlast) return <BlastScreen offer={singleBlast} markets={markets} supplierName={profile.name} supplierPhone={profile.phone} onDone={() => setSingleBlast(null)} />
  if (blastAll) {

    const msg = buildDailyBlastMsg()
    if (!msg) { setBlastAll(false) }
    else return <BlastScreen customMsg={msg} markets={markets} supplierName={profile.name} supplierPhone={profile.phone} onDone={() => setBlastAll(false)} />
  }

  const srcCfg = (id) => SOURCE_TYPES.find(s => s.id === id) || SOURCE_TYPES[4]
  const pendingOrders = orders.filter(o => o.status === 'pending').length
  const totalRevenue  = orders.reduce((s, o) => s + (o.totalPrice || 0), 0)

  const FifoRow = ({ item }) => {
    const offer = findOffer(item)
    const src   = srcCfg(item.sourceType)
    const exp   = item.expiryDate ? Math.ceil((new Date(item.expiryDate) - new Date()) / 86400000) : null
    return (
      <div style={{ background:'#0d2137', borderRadius:14, marginBottom:8, overflow:'hidden', border:'1px solid ' + (item.ageInDays >= 2 ? '#7f1d1d' : '#78350f') }}>
        <div style={{ padding:'10px 14px', display:'flex', gap:10, alignItems:'center' }}>
          <div style={{ flexShrink:0, fontSize:16 }}>{src.emoji}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ color:'#f1f5f9', fontWeight:800, fontSize:14, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.productName}</div>
            <div style={{ color:'#64748b', fontSize:11, marginTop:1, display:'flex', gap:8 }}>
              <span>{item.qty} {item.unit}</span>
              {exp !== null && <span style={{ color: exp <= 7 ? '#f87171' : '#fbbf24' }}>· val: {exp <= 0 ? 'VENCIDO' : `${exp}d`}</span>}
              {item.unitCost > 0 && <span style={{ color:'#334155' }}>· custo {BRL.format(item.unitCost)}/un 🔒</span>}
            </div>
          </div>
          <div style={{ textAlign:'right', flexShrink:0 }}>
            {offer && <div style={{ color:'#10b981', fontWeight:900, fontSize:15 }}>{BRL.format(offer.offerPrice)}/un</div>}
            <div style={{ color: item.ageInDays >= 2 ? '#f87171' : '#fbbf24', fontSize:11, fontWeight:700 }}>
              {item.ageInDays === 0 ? 'hoje' : `há ${item.ageInDays}d`}
            </div>
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

      {showBlitz && <BlitzModal offers={offers} setOffers={setOffers} markets={markets} profile={profile} onClose={() => setShowBlitz(false)} />}

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
          { emoji:'📱', label:'Disparar\nZAP',       action:() => { if (offers.filter(o=>o.status!=='delivered').length > 0) setBlastAll(true) }, bg:'#1e3a5f', border:'#2563eb', color:'#93c5fd' },
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
    </div>
  )
}

const SUPPLIERS_KEY = 'cp_fornecedor_suppliers'

/* ── TabReceber ─────────────────────────────────────────────── */
function TabReceber({ estoque, setEstoque, offers, setOffers, markets, profile }) {
  const [selected,    setSelected]   = useState(null)  // { name, sku, price }
  const [sourceType,  setSourceType] = useState('leilao')
  const [sourceName,  setSourceName] = useState('')
  const [supplierSuggestions, setSupplierSuggestions] = useState(false) // show dropdown
  const [qty,         setQty]        = useState('')
  const [unit,        setUnit]       = useState('UND')
  const [totalPaid,   setTotalPaid]  = useState('')   // total pago pelo lote
  const [expiryDate,  setExpiryDate] = useState('')
  const [offerPrice,  setOfferPrice] = useState('')
  const [isOpp,       setIsOpp]      = useState(false)
  const [offerNote,   setOfferNote]  = useState('')
  const [saving,      setSaving]     = useState(false)
  const [blast,       setBlast]      = useState(null)

  function handleSelect(p) {
    setSelected(p)
    // Source stays as chosen; auto-suggest offer price from seed if available
    if (p.price) setOfferPrice(String((p.price * 1.35).toFixed(2)).replace('.', ','))
  }

  function applyExpiryShortcut(days) {
    const dt = new Date(); dt.setDate(dt.getDate() + days)
    setExpiryDate(dt.toISOString().slice(0, 10))
  }

  function reset() {
    setSelected(null); setQty(''); setTotalPaid(''); setExpiryDate('')
    setOfferPrice(''); setIsOpp(false); setOfferNote(''); setSourceName('')
  }

  const qtyNum   = parseFloat(qty) || 0
  const paid     = parseNum(totalPaid)
  const unitCost = (paid > 0 && qtyNum > 0) ? paid / qtyNum : 0
  const sellPrice = parseNum(offerPrice)
  const margin   = unitCost > 0 && sellPrice > 0 ? Math.round(((sellPrice - unitCost) / unitCost) * 100) : null
  const canBlast = sellPrice > 0
  const validMkts = (markets || []).filter(m => m.phone).length
  const inp = { display:'block', width:'100%', background:'#0a1929', border:'1px solid #1e4060', borderRadius:12, padding:'11px 14px', color:'#e2e8f0', fontSize:15, fontWeight:600, boxSizing:'border-box', outline:'none' }

  // Supplier autocomplete — local list keyed by sourceType
  const savedSuppliers = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(SUPPLIERS_KEY) || '{}') } catch { return {} }
  }, [sourceName]) // re-read when user types (to refresh after save)
  const currentTypeSuggestions = (savedSuppliers[sourceType] || []).filter(
    s => sourceName.trim() === '' || s.toLowerCase().includes(sourceName.toLowerCase())
  )

  function pickSupplier(name) { setSourceName(name); setSupplierSuggestions(false) }

  function saveSupplierIfNew(name) {
    if (!name.trim()) return
    try {
      const all = JSON.parse(localStorage.getItem(SUPPLIERS_KEY) || '{}')
      const list = all[sourceType] || []
      if (!list.includes(name.trim())) {
        all[sourceType] = [name.trim(), ...list].slice(0, 20)
        localStorage.setItem(SUPPLIERS_KEY, JSON.stringify(all))
      }
    } catch {}
  }

  async function handleSubmit() {
    if (!selected || !qty) return
    setSaving(true)

    // 1. Add to estoque — 🔒 internal fields (never in offer object)
    const item = {
      id: uid(), productName: selected.name, sku: selected.sku || '',
      qty: qtyNum, unit, unitCost, totalPaid: paid,
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

  if (blast) return <BlastScreen offer={blast} markets={markets} supplierName={profile?.name || 'Distribuidora'} supplierPhone={profile?.phone || ''} onDone={() => setBlast(null)} />

  return (
    <div style={{ padding:'16px 16px 100px' }}>

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
            <div style={{ color:'#94a3b8', fontSize:10, fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>Quantidade do lote</div>
            <div style={{ display:'flex', gap:8 }}>
              <input value={qty} onChange={e => setQty(e.target.value)} type="number" placeholder="Ex: 200" autoFocus
                style={{ ...inp, flex:2, fontSize:22, fontWeight:900 }} />
              <select value={unit} onChange={e => setUnit(e.target.value)} style={{ ...inp, flex:1, padding:'11px 8px' }}>
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {/* ── Total pago + unit cost ── */}
          <div>
            <div style={{ color:'#64748b', fontSize:10, fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>Total pago pelo lote (interno 🔒)</div>
            <div style={{ display:'flex', gap:0, alignItems:'center', background:'#0a1929', border:'1px solid #1e4060', borderRadius:12, overflow:'hidden' }}>
              <span style={{ padding:'0 12px', color:'#475569', fontSize:13, fontWeight:700 }}>R$</span>
              <CurrencyInput value={totalPaid} onChange={setTotalPaid} placeholder="0,00 — quanto pagou no total"
                style={{ flex:1, background:'transparent', border:'none', padding:'13px 12px 13px 0', color:'#e2e8f0', fontSize:16, fontWeight:700, outline:'none', width:'100%' }} />
            </div>
            {unitCost > 0 && (
              <div style={{ color:'#64748b', fontSize:12, marginTop:4, display:'flex', gap:10 }}>
                <span>💸 Custo/un: <strong style={{ color:'#f1f5f9' }}>{BRL.format(unitCost)}</strong></span>
                {margin !== null && <span style={{ color: margin >= 30 ? '#4ade80' : margin >= 0 ? '#fbbf24' : '#f87171' }}>
                  Margem: {margin > 0 ? '+' : ''}{margin}%
                </span>}
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
                placeholder={unitCost > 0 ? `sugerido: ${(unitCost*1.5).toLocaleString('pt-BR',{minimumFractionDigits:2})}` : 'preço por unidade para mercados'}
                style={{ flex:1, background:'transparent', border:'none', padding:'13px 12px 13px 0', color:'#60a5fa', fontSize:20, fontWeight:900, outline:'none', width:'100%' }} />
            </div>
            {canBlast && qtyNum > 0 && (
              <div style={{ color:'#475569', fontSize:12, marginBottom:10, display:'flex', gap:10, flexWrap:'wrap' }}>
                <span>💰 Fatura total: <strong style={{ color:'#f1f5f9' }}>{BRL.format(sellPrice * qtyNum)}</strong></span>
                {unitCost > 0 && <span style={{ color: margin >= 0 ? '#4ade80' : '#f87171' }}>· Margem: {margin > 0 ? '+' : ''}{margin}%</span>}
                {paid > 0 && <span style={{ color:'#10b981' }}>· Lucro lote: {BRL.format((sellPrice - unitCost) * qtyNum)}</span>}
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
            disabled={!qty || qtyNum <= 0 || saving}
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
  if (blast)   return <BlastScreen offer={blast} markets={markets} supplierName={profile.name} supplierPhone={profile.phone} onDone={() => setBlast(null)} />

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
      {showBlitz && <BlitzModal offers={offers} setOffers={setOffers} markets={markets} profile={profile} onClose={() => setShowBlitz(false)} />}

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
function TabPedidos({ orders, setOrders }) {
  const pending = orders.filter(o => o.status === 'pending').length
  const total   = orders.reduce((s, o) => s + (o.totalPrice || 0), 0)
  const payInfo = id => PAYMENT_INFO[id] || { emoji: '💰', label: id || 'N/A', color: '#94a3b8' }

  async function updateStatus(id, status) {
    const next = orders.map(o => o.id === id ? { ...o, status, updatedAt: new Date().toISOString() } : o)
    setOrders(next); await persistKey(ORDERS_KEY, next)

    // Auto-notify market via WhatsApp
    const order = orders.find(o => o.id === id)
    if (!order?.storePhone) return
    const msgs = {
      confirmed: `✅ *PEDIDO CONFIRMADO!*\n\nOlá, ${order.storeName || 'Mercado'}!\n\nSeu pedido foi confirmado:\n📦 *${order.productName}*\n   ${order.qtyRequested} ${order.unit} · ${BRL.format(order.totalPrice)}\n\nCombine a entrega pelo chat 🚚`,
      delivered: `📦 *ENTREGUE!*\n\nOlá, ${order.storeName || 'Mercado'}!\n\n${order.productName} foi entregue com sucesso!\n   ${order.qtyRequested} ${order.unit} · ${BRL.format(order.totalPrice)}\n\nObrigado pela parceria! 🤝`,
    }
    if (msgs[status]) {
      window.open(`https://wa.me/${cleanPhone(order.storePhone)}?text=${encodeURIComponent(msgs[status])}`, '_blank')
    }
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
                  style={{ flex:1, background:'linear-gradient(135deg,#10b981,#059669)', color:'#fff', border:'none', borderRadius:12, padding:10, fontWeight:800, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                  <Check size={15} /> Confirmar + 📱 Avisar Mercado
                </button>
              )}
              {order.status === 'confirmed' && (
                <button onClick={() => updateStatus(order.id, 'delivered')}
                  style={{ flex:1, background:'linear-gradient(135deg,#3b82f6,#2563eb)', color:'#fff', border:'none', borderRadius:12, padding:10, fontWeight:800, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                  🚚 Entreguei + 📱 Avisar Mercado
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

/* ── TabRelatorio ────────────────────────────────────────────── */
function TabRelatorio({ estoque, offers, orders }) {
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
const SESSION_KEY = 'cp_session_v1'

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
      { id:'mega_mkt1', name:'Mercado Corta Preços',    phone:'15996604075', contact:'Proprietário',  address:'Vila Bom Jesus, Itapeva, SP',        city:'Itapeva/SP'   },
      { id:'mega_mkt2', name:'Supermercado Família',    phone:'11987654321', contact:'Donizete',      address:'Rua das Flores, 150, Cotia, SP',     city:'Cotia/SP'     },
      { id:'mega_mkt3', name:'Mercearia Boa Compra',    phone:'11976543210', contact:'Maria Silva',   address:'Rua das Oliveiras, 400, São Roque',  city:'São Roque/SP' },
      { id:'mega_mkt4', name:'Hortifruti das Colinas',  phone:'15988776655', contact:'Pedro Almeida', address:'Av. Central, 22, Boituva, SP',       city:'Boituva/SP'   },
      { id:'mega_mkt5', name:'Atacado Bom Preço',       phone:'15991234567', contact:'Ana Clara',     address:'Rua do Comércio, 320, Sorocaba, SP', city:'Sorocaba/SP'  },
    ],
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
      <div style={{ textAlign:'center', marginBottom:36 }}>
        <div style={{ width:80, height:80, borderRadius:24, background:'linear-gradient(135deg,#10b981,#059669)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', boxShadow:'0 12px 40px rgba(16,185,129,0.35)' }}>
          <Truck size={38} color="#fff" />
        </div>
        <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:28, letterSpacing:'-0.02em' }}>Corta Preços</div>
        <div style={{ color:'#10b981', fontSize:13, fontWeight:700, marginTop:4, textTransform:'uppercase', letterSpacing:'0.1em' }}>Portal do Distribuidor</div>
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

      <div style={{ color:'#1e3a50', fontSize:12, marginTop:24, textAlign:'center' }}>
        Corta Preços Soluções Comerciais • {new Date().getFullYear()}
      </div>
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
  })
  const F = k => ({ value: form[k], onChange: e => setForm(p => ({ ...p, [k]: e.target.value })) })

  return (
    <div style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'20px 20px', overflowY:'auto' }}>
      <div style={{ background:'#0a1929', borderRadius:20, padding:24, width:'100%', maxWidth:400, border:'1px solid #1e4060', marginTop:20 }}>
        <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:18, marginBottom:4 }}>⚙️ Perfil da Distribuidora</div>
        <div style={{ color:'#334155', fontSize:12, marginBottom:20 }}>Estas informações aparecem no cabeçalho e nas mensagens do ZAP</div>

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
                width:36, height:36, borderRadius:10, background:c.color, border: form.themeColor === c.color ? '3px solid #fff' : '3px solid transparent', cursor:'pointer', flexShrink:0,
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
  /* ══ ALL HOOKS FIRST — no conditional hooks (React rules) ══ */

  /* ── Session ── */
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)) } catch { return null }
  })

  /* ── Profile — loaded from localStorage, falls back to tenant default ── */
  const [profile, setProfile] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LOCAL))
      if (saved?.name) return saved
    } catch {}
    const s = (() => { try { return JSON.parse(localStorage.getItem(SESSION_KEY)) } catch { return null } })()
    const tenant = s ? TENANTS.find(t => t.id === s.id) : null
    return tenant?.profile || { name: 'Distribuidor', phone: '' }
  })

  const [markets,     setMarkets]     = useState(() => { try { return JSON.parse(localStorage.getItem(MKTS_KEY)) || [] } catch { return [] } })
  const [estoque,     setEstoque]     = useState([])
  const [offers,      setOffers]      = useState([])
  const [orders,      setOrders]      = useState([])
  const [tab,         setTab]         = useState('inicio')
  const [syncing,     setSyncing]     = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)
  const [preSelectedForOffer, setPreSelectedForOffer] = useState(null)

  const goToOferta = useCallback((item) => {
    setPreSelectedForOffer(item)
    setTab('ofertas')
  }, [])

  const saveProfile = (data) => {
    setProfile(data)
    try { localStorage.setItem(LOCAL, JSON.stringify(data)) } catch {}
    setEditingProfile(false)
  }

  /* ── Auth handlers ── */
  function handleLogin(tenant) {
    const s = { id: tenant.id, username: tenant.username }
    setSession(s)
    localStorage.setItem(SESSION_KEY, JSON.stringify(s))

    // Set profile from tenant (preserve edits if businessName matches)
    const saved = (() => { try { return JSON.parse(localStorage.getItem(LOCAL)) } catch { return null } })()
    const prof = (saved?.businessName === tenant.profile.businessName) ? saved : tenant.profile
    setProfile(prof)
    localStorage.setItem(LOCAL, JSON.stringify(prof))

    // Merge seed markets into existing — ensures demo clients always present
    if (tenant.seedMarkets?.length) {
      const savedMkts = (() => { try { return JSON.parse(localStorage.getItem(MKTS_KEY)) || [] } catch { return [] } })()
      const existingIds = new Set(savedMkts.map(m => m.id))
      const merged = [...savedMkts, ...tenant.seedMarkets.filter(m => !existingIds.has(m.id))]
      setMarkets(merged)
      localStorage.setItem(MKTS_KEY, JSON.stringify(merged))
    }
  }

  function handleLogout() {
    setSession(null)
    localStorage.removeItem(SESSION_KEY)
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

  /* ── Login gate — after ALL hooks ── */
  if (!session) return <LoginPage onLogin={handleLogin} />

  const pendingOrders = orders.filter(o => o.status === 'pending').length

  const TABS = [
    { id:'inicio',    icon: LayoutDashboard, label:'Início',    badge: 0 },
    { id:'receber',   icon: ArrowDownToLine, label:'Receber',   badge: 0 },
    { id:'ofertas',   icon: Send,            label:'Ofertas',   badge: offers.filter(o=>o.status==='pending').length },
    { id:'pedidos',   icon: ClipboardList,   label:'Pedidos',   badge: pendingOrders },
    { id:'mercados',  icon: Users,           label:'Mercados',  badge: 0 },
    { id:'relatorio', icon: BarChart2,       label:'Resultado', badge: 0 },
  ]

  return (
    <div style={{ minHeight:'100dvh', background:'#050f1a', display:'flex', flexDirection:'column', fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>

      {/* Edit profile modal */}
      {editingProfile && (
        <EditProfileModal profile={profile} onSave={saveProfile} onClose={() => setEditingProfile(false)} />
      )}

      {/* ── HEADER ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px 10px', background:'#060e1a', borderBottom:`1px solid ${(profile.themeColor||'#10b981')}22`, position:'sticky', top:0, zIndex:10 }}>
        <button onClick={() => setEditingProfile(true)} style={{ display:'flex', alignItems:'center', gap:10, background:'none', border:'none', cursor:'pointer', padding:0, flex:1, minWidth:0 }}>
          {/* Logo circle with initials or truck icon */}
          <div style={{ width:40, height:40, borderRadius:12, background:`linear-gradient(135deg,${profile.themeColor||'#10b981'},${(profile.themeColor||'#10b981')}aa)`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:`0 4px 12px ${(profile.themeColor||'#10b981')}44` }}>
            {profile.businessName
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
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <button onClick={sync} disabled={syncing} style={{ background:'none', border:'none', cursor:'pointer', color:'#475569', padding:4 }}>
            <RefreshCw size={16} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
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
        {tab === 'inicio'    && <TabInicio    estoque={estoque} offers={offers} orders={orders} profile={profile} markets={markets} setEstoque={setEstoque} setOffers={setOffers} setMarkets={setMarkets} setOrders={setOrders} onNavigate={setTab} />}
        {tab === 'receber'   && <TabReceber   estoque={estoque} setEstoque={setEstoque} offers={offers} setOffers={setOffers} markets={markets} profile={profile} />}
        {tab === 'ofertas'   && <TabOfertas   estoque={estoque} offers={offers} setOffers={setOffers} markets={markets} profile={profile} orders={orders} preSelected={preSelectedForOffer} onClearPreSelected={() => setPreSelectedForOffer(null)} />}
        {tab === 'pedidos'   && <TabPedidos   orders={orders} setOrders={setOrders} />}
        {tab === 'mercados'  && <TabMercados  markets={markets} setMarkets={setMarkets} orders={orders} />}
        {tab === 'relatorio' && <TabRelatorio estoque={estoque} offers={offers} orders={orders} />}
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
