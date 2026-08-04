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
  RefreshCw, Phone, Send,
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

function buildOfferMsg(offer, supplierName) {
  const lines = [
    '🚚 *NOVA OFERTA - ' + supplierName + '*',
    '',
    '📦 *' + offer.productName + '*',
    offer.sku ? '   Cod: ' + offer.sku : '',
    '   ' + offer.qty + ' ' + offer.unit + '  .  ' + BRL.format(offer.offerPrice) + '/un',
    offer.expiryDate ? '📅 Vence: ' + fmtDate(offer.expiryDate) : '',
    offer.isOpportunity ? '🔥 *OPORTUNIDADE - estoque limitado!*' : '',
    offer.note ? '\ud83d\udcac ' + offer.note : '',
    '',
    '\u2705 Ver e aceitar: https://corta-precos-pdv.netlify.app/ofertas',
  ]
  return lines.filter(Boolean).join('\n')
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
function WaOverlay({ offer, markets, supplierName, onClose }) {
  const msg = buildOfferMsg(offer, supplierName)
  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'#0a1929', borderRadius:24, padding:'28px 20px', width:'100%', maxWidth:400 }}>
        <div style={{ textAlign:'center', marginBottom:24 }}>
          <div style={{ width:56, height:56, borderRadius:18, background:'#14532d', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
            <CheckCircle size={28} color="#4ade80" />
          </div>
          <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:20 }}>Oferta Publicada! 🎉</div>
          <div style={{ color:'#10b981', fontSize:13, marginTop:4 }}>Notifique os mercados pelo WhatsApp</div>
        </div>
        {markets.length === 0
          ? <div style={{ color:'#64748b', textAlign:'center', fontSize:13 }}>Nenhum mercado cadastrado.</div>
          : markets.map(m => (
            <a key={m.id} href={'https://wa.me/' + cleanPhone(m.phone) + '?text=' + encodeURIComponent(msg)} target="_blank" rel="noreferrer"
              style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', background:'#0d2137', borderRadius:14, border:'1px solid #1e4060', textDecoration:'none', marginBottom:8 }}>
              <div style={{ width:36, height:36, borderRadius:10, background:'#14532d', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <MessageCircle size={18} color="#4ade80" />
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ color:'#e2e8f0', fontWeight:800, fontSize:14, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{m.name}</div>
                <div style={{ color:'#10b981', fontSize:11, fontWeight:600 }}>Toque para abrir o WhatsApp</div>
              </div>
            </a>
          ))
        }
        <div style={{ marginTop:8 }}><Btn full onClick={onClose}>✓ Pronto, fechar</Btn></div>
      </div>
    </div>
  )
}

/* ── OfferCard ──────────────────────────────────────────────── */
function OfferCard({ offer, markets, supplierName, onDelete }) {
  const [showWa, setShowWa] = useState(false)
  const accepted = offer.status === 'accepted'
  return (
    <>
      {showWa && <WaOverlay offer={offer} markets={markets} supplierName={supplierName} onClose={() => setShowWa(false)} />}
      <div style={{ background:'#0d2137', borderRadius:16, padding:'14px 16px', marginBottom:10, border:'1px solid ' + (offer.isOpportunity ? '#059669' : '#1a3a50'), position:'relative', overflow:'hidden' }}>
        {offer.isOpportunity && (
          <div style={{ position:'absolute', top:0, right:0, background:'linear-gradient(135deg,#d97706,#f59e0b)', color:'#000', fontSize:10, fontWeight:900, padding:'3px 10px', borderRadius:'0 16px 0 10px' }}>🔥 OPORTUNIDADE</div>
        )}
        <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
          <div style={{ width:40, height:40, borderRadius:10, background:'#0a2540', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Package size={18} color="#10b981" />
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ color:'#f1f5f9', fontWeight:800, fontSize:14, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{offer.productName}</div>
            <div style={{ display:'flex', gap:6, marginTop:5, flexWrap:'wrap', alignItems:'center' }}>
              <span style={{ color:'#10b981', fontWeight:900, fontSize:15 }}>{BRL.format(offer.offerPrice)}/un</span>
              <span style={{ background:'#0a2540', color:'#93c5fd', fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:8 }}>{offer.qty} {offer.unit}</span>
              <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20, background: accepted ? '#14532d' : '#1a3a50', color: accepted ? '#86efac' : '#64748b' }}>
                {accepted ? '✓ Aceita' : '⏳ Aguardando'}
              </span>
            </div>
            {offer.note && <div style={{ color:'#64748b', fontSize:12, marginTop:4, fontStyle:'italic' }}>{offer.note}</div>}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:10 }}>
          <span style={{ color:'#334155', fontSize:10 }}>{fmtDT(offer.publishedAt)}</span>
          <div style={{ flex:1 }} />
          <button onClick={() => setShowWa(true)} style={{ background:'#14532d', color:'#86efac', border:'none', cursor:'pointer', padding:'5px 10px', borderRadius:10, fontSize:12, fontWeight:700, display:'flex', alignItems:'center', gap:4 }}>
            <MessageCircle size={12} />ZAP
          </button>
          {onDelete && (
            <button onClick={() => onDelete(offer.id)} style={{ background:'#1a0a0a', color:'#ef4444', border:'none', cursor:'pointer', padding:'5px 8px', borderRadius:10 }}>
              <Trash2 size={12} />
            </button>
          )}
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
const DEMO_ESTOQUE = [
  { id:'demo1', productName:'Coca-Cola 2L', sku:'7894900011630', qty:120, unit:'UND', cost:5.20, expiryDate:DEMO_DATE(45), receivedAt:today(), updatedAt:new Date().toISOString() },
  { id:'demo2', productName:'Arroz Tio João 5kg', sku:'7896036500572', qty:80, unit:'SC', cost:18.50, expiryDate:DEMO_DATE(365), receivedAt:today(), updatedAt:new Date().toISOString() },
  { id:'demo3', productName:'Óleo de Soja Soya 900ml', sku:'7896036500573', qty:60, unit:'UND', cost:6.80, expiryDate:DEMO_DATE(180), receivedAt:today(), updatedAt:new Date().toISOString() },
  { id:'demo4', productName:'Biscoito Oreo 90g', sku:'7622210651557', qty:200, unit:'UND', cost:2.90, expiryDate:DEMO_DATE(12), receivedAt:today(), updatedAt:new Date().toISOString() },
  { id:'demo5', productName:'Leite Integral Itambé 1L', sku:'7896051190016', qty:144, unit:'CX', cost:4.30, expiryDate:DEMO_DATE(30), receivedAt:today(), updatedAt:new Date().toISOString() },
]
const DEMO_OFFERS = [
  { id:'doff1', supplierId:LOCAL, supplierName:'Distribuidora Demo', supplierPhone:'15999990000', productName:'Biscoito Oreo 90g', sku:'7622210651557', qty:200, unit:'UND', offerPrice:3.49, expiryDate:DEMO_DATE(12), isOpportunity:true, note:'Proximo do vencimento — oportunidade!', status:'pending', publishedAt:new Date().toISOString() },
  { id:'doff2', supplierId:LOCAL, supplierName:'Distribuidora Demo', supplierPhone:'15999990000', productName:'Coca-Cola 2L', sku:'7894900011630', qty:120, unit:'UND', offerPrice:6.90, expiryDate:DEMO_DATE(45), isOpportunity:false, note:'', status:'pending', publishedAt:new Date().toISOString() },
]

/* ── TabInicio ──────────────────────────────────────────────── */
function TabInicio({ estoque, offers, orders, profile, setEstoque, setOffers }) {
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
    await persistKey(ESTOQUE_KEY, DEMO_ESTOQUE)
    await persistKey(OFFERS_KEY, DEMO_OFFERS)
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
function TabReceber({ estoque, setEstoque, onGoToOferta }) {
  const [selected,    setSelected]    = useState(null)
  const [qty,         setQty]         = useState('')
  const [unit,        setUnit]        = useState('CX')
  const [cost,        setCost]        = useState('')
  const [expiryDate,  setExpiryDate]  = useState('')
  const [saving,      setSaving]      = useState(false)
  const [justAdded,   setJustAdded]   = useState(null) // triggers quick-publish banner

  function handleSelect(p) {
    setSelected(p); setQty(''); setCost(p.price ? String(p.price).replace('.', ',') : '')
    setUnit('CX'); setExpiryDate(''); setJustAdded(null)
  }

  async function handleEntrada() {
    if (!selected || !qty) return
    setSaving(true)
    const qtyNum = parseFloat(qty) || 0
    const item   = { id: uid(), productName: selected.name, sku: selected.sku || '', qty: qtyNum, unit, cost: parseNum(cost), expiryDate: expiryDate || null, receivedAt: today(), updatedAt: new Date().toISOString() }
    const idx    = estoque.findIndex(e => e.sku === selected.sku && e.unit === unit)
    const next   = idx >= 0
      ? estoque.map((e, i) => i === idx ? { ...e, qty: e.qty + qtyNum, expiryDate: expiryDate || e.expiryDate, updatedAt: new Date().toISOString() } : e)
      : [...estoque, item]
    setEstoque(next)
    await persistKey(ESTOQUE_KEY, next)
    setJustAdded(next[idx >= 0 ? idx : next.length - 1])
    setSelected(null); setQty(''); setSaving(false)
  }

  async function handleRemove(id) {
    const next = estoque.filter(e => e.id !== id)
    setEstoque(next); await persistKey(ESTOQUE_KEY, next)
  }

  const inputStyle = { display:'block', width:'100%', marginTop:6, background:'#0a1929', border:'1px solid #1e4060', borderRadius:10, padding:12, color:'#e2e8f0', fontSize:15, fontWeight:700, boxSizing:'border-box', outline:'none' }

  return (
    <div style={{ padding:'16px 16px 100px' }}>

      {/* ── Quick-publish banner after entry ── */}
      {justAdded && (
        <div style={{ background:'linear-gradient(135deg,#0d3d27,#0a2a1c)', border:'1px solid #10b981', borderRadius:16, padding:16, marginBottom:16 }}>
          <div style={{ color:'#4ade80', fontWeight:900, fontSize:15, marginBottom:4 }}>
            ✅ {justAdded.qty} {justAdded.unit} de "{justAdded.productName}" adicionados!
          </div>
          <div style={{ color:'#6ee7b7', fontSize:13, marginBottom:14 }}>
            Quer publicar uma oferta para os mercados agora?
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <Btn onClick={() => { onGoToOferta(justAdded); setJustAdded(null) }}>
              <Send size={15} /> Criar Oferta →
            </Btn>
            <Btn secondary onClick={() => setJustAdded(null)}>Só entrar no estoque</Btn>
          </div>
        </div>
      )}

      <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:18, marginBottom:4 }}>Receber Mercadoria</div>
      <div style={{ color:'#475569', fontSize:13, marginBottom:20 }}>Busca o produto que chegou e registra a entrada</div>
      <ProductSearch onSelect={handleSelect} />
      {selected && (
        <div style={{ background:'#0d2137', borderRadius:16, padding:16, marginTop:16, border:'1px solid #10b981' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <div>
              <div style={{ color:'#10b981', fontSize:11, fontWeight:700, textTransform:'uppercase' }}>Produto Selecionado</div>
              <div style={{ color:'#f1f5f9', fontWeight:800, fontSize:16 }}>{selected.name}</div>
              {selected.sku && <div style={{ color:'#475569', fontSize:12, fontFamily:'monospace' }}>{selected.sku}</div>}
            </div>
            <button onClick={() => setSelected(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'#475569' }}><X size={20} /></button>
          </div>

          {/* qty + unit */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 100px', gap:10, marginBottom:12 }}>
            <div>
              <label style={{ color:'#64748b', fontSize:11, fontWeight:700, textTransform:'uppercase' }}>QUANTIDADE</label>
              <input value={qty} onChange={e => setQty(e.target.value)} type="number" placeholder="Ex: 200" style={inputStyle} />
            </div>
            <div>
              <label style={{ color:'#64748b', fontSize:11, fontWeight:700, textTransform:'uppercase' }}>UNID.</label>
              <select value={unit} onChange={e => setUnit(e.target.value)}
                style={{ display:'block', width:'100%', marginTop:6, background:'#0a1929', border:'1px solid #1e4060', borderRadius:10, padding:12, color:'#e2e8f0', fontSize:14, boxSizing:'border-box', outline:'none' }}>
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {/* custo + validade */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
            <div>
              <label style={{ color:'#64748b', fontSize:11, fontWeight:700, textTransform:'uppercase' }}>CUSTO (R$)</label>
              <div style={{ position:'relative', marginTop:6 }}>
                <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#475569', fontWeight:700, fontSize:13 }}>R$</span>
                <input value={cost} onChange={e => setCost(e.target.value)} placeholder="0,00"
                  style={{ width:'100%', background:'#0a1929', border:'1px solid #1e4060', borderRadius:10, padding:'12px 12px 12px 34px', color:'#10b981', fontSize:15, fontWeight:700, boxSizing:'border-box', outline:'none' }}
                />
              </div>
            </div>
            <div>
              <label style={{ color:'#f97316', fontSize:11, fontWeight:700, textTransform:'uppercase' }}>📅 VALIDADE</label>
              <input value={expiryDate} onChange={e => setExpiryDate(e.target.value)} type="date"
                style={{ display:'block', width:'100%', marginTop:6, background:'#0a1929', border:'1px solid #7c2d12', borderRadius:10, padding:12, color:'#fed7aa', fontSize:14, fontWeight:700, boxSizing:'border-box', outline:'none' }}
              />
            </div>
          </div>

          <Btn full disabled={!qty || parseFloat(qty) <= 0 || saving} onClick={handleEntrada}>
            <ArrowDownToLine size={18} />
            {saving ? 'Registrando...' : 'Dar Entrada — ' + (qty || 0) + ' ' + unit}
          </Btn>
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
function TabOfertas({ estoque, offers, setOffers, markets, profile, preSelected, onClearPreSelected }) {
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

  if (waOffer) return <WaOverlay offer={waOffer} markets={markets} supplierName={profile.name} onClose={() => setWaOffer(null)} />

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
      ) : offers.map(o => <OfferCard key={o.id} offer={o} markets={markets} supplierName={profile.name} onDelete={handleDelete} />)}
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

/* ── TabMercados ────────────────────────────────────────────── */
function TabMercados({ markets, setMarkets }) {
  const [adding, setAdding] = useState(false)
  const [mName, setMName]   = useState('')
  const [mPhone, setMPhone] = useState('')

  async function saveMarkets(next) {
    setMarkets(next)
    try { localStorage.setItem(MKTS_KEY, JSON.stringify(next)) } catch {}
    // also persist to server so any device can load
    await persistKey(MKTS_SERVER_KEY, next)
  }

  async function handleAdd() {
    if (!mName.trim()) return
    await saveMarkets([...markets, { id: uid(), name: mName.trim(), phone: mPhone.trim() }])
    setMName(''); setMPhone(''); setAdding(false)
  }

  async function handleDelete(id) {
    await saveMarkets(markets.filter(m => m.id !== id))
  }

  return (
    <div style={{ padding:'16px 16px 100px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:18 }}>Meus Mercados</div>
          <div style={{ color:'#475569', fontSize:12 }}>{markets.length} cadastrados</div>
        </div>
        <Btn sm onClick={() => setAdding(v => !v)}><Plus size={16} /> Adicionar</Btn>
      </div>
      {adding && (
        <div style={{ background:'#0d2137', borderRadius:16, padding:16, marginBottom:16, border:'1px solid #10b981' }}>
          <input value={mName} onChange={e => setMName(e.target.value)} placeholder="Nome do mercado"
            style={{ display:'block', width:'100%', marginBottom:10, background:'#0a1929', border:'1px solid #1e4060', borderRadius:10, padding:12, color:'#e2e8f0', fontSize:14, boxSizing:'border-box', outline:'none' }}
          />
          <input value={mPhone} onChange={e => setMPhone(e.target.value)} placeholder="WhatsApp (15) 99999-9999" type="tel"
            style={{ display:'block', width:'100%', marginBottom:12, background:'#0a1929', border:'1px solid #1e4060', borderRadius:10, padding:12, color:'#e2e8f0', fontSize:14, boxSizing:'border-box', outline:'none' }}
          />
          <div style={{ display:'flex', gap:10 }}>
            <Btn full disabled={!mName.trim()} onClick={handleAdd}><Check size={16} /> Salvar</Btn>
            <Btn secondary full onClick={() => setAdding(false)}>Cancelar</Btn>
          </div>
        </div>
      )}
      {markets.length === 0 ? (
        <div style={{ background:'#0d2137', borderRadius:20, padding:32, textAlign:'center', border:'1px solid #1a3a50' }}>
          <Users size={32} color="#1e4060" style={{ marginBottom:8 }} />
          <div style={{ color:'#475569', fontSize:15 }}>Nenhum mercado ainda</div>
        </div>
      ) : markets.map(m => (
        <div key={m.id} style={{ background:'#0d2137', borderRadius:14, padding:'14px 16px', marginBottom:10, border:'1px solid #1a3a50', display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:40, height:40, borderRadius:10, background:'#0a2540', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <ShoppingCart size={18} color="#10b981" />
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ color:'#e2e8f0', fontWeight:700, fontSize:14, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{m.name}</div>
            <div style={{ color:'#475569', fontSize:12, display:'flex', alignItems:'center', gap:4 }}><Phone size={10} />{m.phone || 'sem numero'}</div>
          </div>
          <button onClick={() => handleDelete(m.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#334155', padding:4 }}><Trash2 size={16} /></button>
        </div>
      ))}
      <div style={{ background:'#0a1929', borderRadius:14, padding:'14px 16px', marginTop:24, border:'1px solid #1e4060' }}>
        <div style={{ color:'#10b981', fontSize:11, fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>Link do Portal (para o mercado)</div>
        <div style={{ color:'#60a5fa', fontSize:13, fontFamily:'monospace', wordBreak:'break-all' }}>https://corta-precos-pdv.netlify.app/ofertas</div>
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
        {tab === 'inicio'   && <TabInicio  estoque={estoque} offers={offers} orders={orders} profile={profile} setEstoque={setEstoque} setOffers={setOffers} />}
        {tab === 'receber'  && <TabReceber estoque={estoque} setEstoque={setEstoque} onGoToOferta={goToOferta} />}
        {tab === 'ofertas'  && <TabOfertas estoque={estoque} offers={offers} setOffers={setOffers} markets={markets} profile={profile} preSelected={preSelectedForOffer} onClearPreSelected={() => setPreSelectedForOffer(null)} />}
        {tab === 'pedidos'  && <TabPedidos orders={orders} setOrders={setOrders} />}
        {tab === 'mercados' && <TabMercados markets={markets} setMarkets={setMarkets} />}
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
