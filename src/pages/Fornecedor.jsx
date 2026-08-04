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
const API_PERSIST = '/api/persist'
const API_RESTORE = '/api/restore'
const UNITS       = ['CX', 'UND', 'FD', 'KG', 'LT', 'PC', 'DZ', 'SC']

const PAYMENT_INFO = {
  pix:      { emoji: '\u26a1', label: 'PIX',       color: '#10b981' },
  dinheiro: { emoji: '\ud83d\udcb5', label: 'Dinheiro',  color: '#3b82f6' },
  boleto:   { emoji: '\ud83d\udcc4', label: 'Boleto',    color: '#f59e0b' },
  prazo30:  { emoji: '\ud83d\udcc5', label: 'Prazo 30d', color: '#8b5cf6' },
  prazo60:  { emoji: '\ud83d\udcc5', label: 'Prazo 60d', color: '#ec4899' },
  cartao:   { emoji: '\ud83d\udcb3', label: 'Cartao',    color: '#06b6d4' },
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
      estoque: data?.[ESTOQUE_KEY] ? JSON.parse(data[ESTOQUE_KEY]) : [],
      offers:  data?.[OFFERS_KEY]  ? JSON.parse(data[OFFERS_KEY])  : [],
      orders:  data?.[ORDERS_KEY]  ? JSON.parse(data[ORDERS_KEY])  : [],
    }
  } catch { return { estoque: [], offers: [], orders: [] } }
}

function buildOfferMsg(offer, supplierName) {
  const lines = [
    '\ud83d\ude9a *NOVA OFERTA - ' + supplierName + '*',
    '',
    '\ud83d\udce6 *' + offer.productName + '*',
    offer.sku ? '   Cod: ' + offer.sku : '',
    '   ' + offer.qty + ' ' + offer.unit + '  .  ' + BRL.format(offer.offerPrice) + '/un',
    offer.expiryDate ? '\ud83d\udcc5 Vence: ' + fmtDate(offer.expiryDate) : '',
    offer.isOpportunity ? '\ud83d\udd25 *OPORTUNIDADE - estoque limitado!*' : '',
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
          <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:20 }}>Oferta Publicada! \ud83c\udf89</div>
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
        <div style={{ marginTop:8 }}><Btn full onClick={onClose}>\u2713 Pronto, fechar</Btn></div>
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
          <div style={{ position:'absolute', top:0, right:0, background:'linear-gradient(135deg,#d97706,#f59e0b)', color:'#000', fontSize:10, fontWeight:900, padding:'3px 10px', borderRadius:'0 16px 0 10px' }}>\ud83d\udd25 OPORTUNIDADE</div>
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
                {accepted ? '\u2713 Aceita' : '\u23f3 Aguardando'}
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
  const [name, setName]   = useState('')
  const [phone, setPhone] = useState('')
  return (
    <div style={{ minHeight:'100dvh', background:'#050f1a', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ textAlign:'center', marginBottom:24 }}>
        <div style={{ width:72, height:72, borderRadius:22, background:'linear-gradient(135deg,#10b981,#059669)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
          <Truck size={36} color="#fff" />
        </div>
        <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:28 }}>FORNECEDOR</div>
        <div style={{ color:'#10b981', fontSize:14, marginTop:4 }}>Portal de ofertas para mercados</div>
      </div>
      <div style={{ background:'#0d2137', borderRadius:20, padding:24, width:'100%', maxWidth:360, border:'1px solid #1e4060' }}>
        <div style={{ color:'#f1f5f9', fontWeight:800, fontSize:16, marginBottom:20 }}>Identifique-se</div>
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
      <div style={{ color:'#1e4060', fontSize:12, marginTop:24 }}>Corta Precos PDV · Plataforma Fornecedor v2.0</div>
    </div>
  )
}

/* ── TabInicio ──────────────────────────────────────────────── */
function TabInicio({ estoque, offers, orders, profile }) {
  const stats = useMemo(() => ({
    itens:    estoque.filter(e => e.qty > 0).length,
    qtdTotal: estoque.reduce((s, e) => s + (e.qty || 0), 0),
    ativas:   offers.filter(o => o.status === 'pending').length,
    pedidos:  orders.filter(o => o.status === 'pending').length,
    receita:  orders.reduce((s, o) => s + (o.totalPrice || 0), 0),
  }), [estoque, offers, orders])

  return (
    <div style={{ padding:'16px 16px 100px' }}>
      <div style={{ marginBottom:20 }}>
        <div style={{ color:'#10b981', fontSize:13, fontWeight:700 }}>Bom dia! \ud83d\udc4b</div>
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
          <div style={{ color:'#334155', fontSize:12, marginTop:4 }}>Use a aba Receber para dar entrada</div>
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
function TabReceber({ estoque, setEstoque }) {
  const [selected, setSelected] = useState(null)
  const [qty,  setQty]  = useState('')
  const [unit, setUnit] = useState('CX')
  const [cost, setCost] = useState('')
  const [saving, setSaving] = useState(false)
  const [flash, setFlash]   = useState(null)

  function handleSelect(p) { setSelected(p); setQty(''); setCost(p.price ? String(p.price).replace('.', ',') : ''); setUnit('CX') }

  async function handleEntrada() {
    if (!selected || !qty) return
    setSaving(true)
    const qtyNum = parseFloat(qty) || 0
    const idx    = estoque.findIndex(e => e.sku === selected.sku && e.unit === unit)
    const next   = idx >= 0
      ? estoque.map((e, i) => i === idx ? { ...e, qty: e.qty + qtyNum, updatedAt: new Date().toISOString() } : e)
      : [...estoque, { id: uid(), productName: selected.name, sku: selected.sku || '', qty: qtyNum, unit, cost: parseNum(cost), receivedAt: today(), updatedAt: new Date().toISOString() }]
    setEstoque(next)
    await persistKey(ESTOQUE_KEY, next)
    setFlash('\u2713 ' + qtyNum + ' ' + unit + ' de "' + selected.name + '" adicionados!')
    setTimeout(() => setFlash(null), 3000)
    setSelected(null); setQty(''); setSaving(false)
  }

  async function handleRemove(id) {
    const next = estoque.filter(e => e.id !== id)
    setEstoque(next); await persistKey(ESTOQUE_KEY, next)
  }

  return (
    <div style={{ padding:'16px 16px 100px' }}>
      {flash && <div style={{ background:'#14532d', color:'#86efac', borderRadius:12, padding:'12px 16px', marginBottom:16, fontWeight:700, fontSize:14 }}>{flash}</div>}
      <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:18, marginBottom:4 }}>Receber Mercadoria</div>
      <div style={{ color:'#475569', fontSize:13, marginBottom:20 }}>Escaneia ou busca o produto que chegou na carreta</div>
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
          <div style={{ display:'grid', gridTemplateColumns:'1fr 100px', gap:10, marginBottom:12 }}>
            <div>
              <label style={{ color:'#64748b', fontSize:11, fontWeight:700, textTransform:'uppercase' }}>QUANTIDADE</label>
              <input value={qty} onChange={e => setQty(e.target.value)} type="number" placeholder="Ex: 200"
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
          <div style={{ marginBottom:16 }}>
            <label style={{ color:'#64748b', fontSize:11, fontWeight:700, textTransform:'uppercase' }}>CUSTO (opcional)</label>
            <div style={{ position:'relative', marginTop:6 }}>
              <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#475569', fontWeight:700 }}>R$</span>
              <input value={cost} onChange={e => setCost(e.target.value)} placeholder="0,00"
                style={{ width:'100%', background:'#0a1929', border:'1px solid #1e4060', borderRadius:10, padding:'12px 12px 12px 36px', color:'#10b981', fontSize:16, fontWeight:700, boxSizing:'border-box', outline:'none' }}
              />
            </div>
          </div>
          <Btn full disabled={!qty || parseFloat(qty) <= 0 || saving} onClick={handleEntrada}>
            <ArrowDownToLine size={18} />
            {saving ? 'Registrando...' : 'Dar Entrada - ' + (qty || 0) + ' ' + unit}
          </Btn>
        </div>
      )}
      {estoque.length > 0 && (
        <>
          <div style={{ color:'#64748b', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', margin:'24px 0 10px' }}>
            Estoque Atual ({estoque.length} itens)
          </div>
          {estoque.map(item => (
            <div key={item.id} style={{ background:'#0d2137', borderRadius:14, padding:'12px 16px', marginBottom:8, border:'1px solid ' + (item.qty <= 0 ? '#7f1d1d' : '#1a3a50'), display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ color:'#e2e8f0', fontWeight:700, fontSize:14, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.productName}</div>
                <div style={{ color:'#334155', fontSize:11, fontFamily:'monospace' }}>{item.sku}</div>
              </div>
              <div style={{ textAlign:'center', flexShrink:0 }}>
                <div style={{ color: item.qty > 0 ? '#10b981' : '#ef4444', fontWeight:900, fontSize:22, lineHeight:1 }}>{item.qty}</div>
                <div style={{ color:'#475569', fontSize:11 }}>{item.unit}</div>
              </div>
              <button onClick={() => handleRemove(item.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#334155', padding:4 }}><Trash2 size={16} /></button>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

/* ── TabOfertas ─────────────────────────────────────────────── */
function TabOfertas({ estoque, offers, setOffers, markets, profile }) {
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

  function reset() { setSelected(null); setFromStock(null); setQty(''); setPrice(''); setExpiry(''); setIsOpp(false); setNote(''); setMode('list') }
  function pickFromStock(item) {
    setFromStock(item); setSelected({ name: item.productName, sku: item.sku })
    setUnit(item.unit); setQty(String(item.qty)); setPrice(item.cost ? String(item.cost).replace('.', ',') : '')
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
            <div style={{ color: isOpp ? '#fcd34d' : '#94a3b8', fontWeight:800, fontSize:14 }}>{isOpp ? '\ud83d\udd25' : '\u2b50'} Marcar como Oportunidade</div>
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
  const payInfo = id => PAYMENT_INFO[id] || { emoji: '\ud83d\udcb0', label: id || 'N/A', color: '#94a3b8' }

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
  const sLbl = s => s === 'delivered' ? '\u2713 Entregue' : s === 'confirmed' ? '\u2713 Confirmado' : '\ud83d\udce6 Pendente'

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
                  \u2713 Confirmar Pedido
                </button>
              )}
              {order.status === 'confirmed' && (
                <button onClick={() => updateStatus(order.id, 'delivered')}
                  style={{ flex:1, background:'linear-gradient(135deg,#3b82f6,#2563eb)', color:'#fff', border:'none', borderRadius:12, padding:10, fontWeight:800, fontSize:13, cursor:'pointer' }}>
                  \ud83d\ude9a Marcar Entregue
                </button>
              )}
              {order.status === 'delivered' && (
                <div style={{ flex:1, textAlign:'center', color:'#86efac', fontSize:13, fontWeight:700, padding:10 }}>\u2713 Entregue</div>
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

  function handleAdd() {
    if (!mName.trim()) return
    const next = [...markets, { id: uid(), name: mName.trim(), phone: mPhone.trim() }]
    setMarkets(next)
    try { localStorage.setItem(MKTS_KEY, JSON.stringify(next)) } catch {}
    setMName(''); setMPhone(''); setAdding(false)
  }

  function handleDelete(id) {
    const next = markets.filter(m => m.id !== id)
    setMarkets(next)
    try { localStorage.setItem(MKTS_KEY, JSON.stringify(next)) } catch {}
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
export default function Fornecedor() {
  const [profile,  setProfile]  = useState(() => { try { return JSON.parse(localStorage.getItem(LOCAL)) } catch { return null } })
  const [markets,  setMarkets]  = useState(() => { try { return JSON.parse(localStorage.getItem(MKTS_KEY)) || [] } catch { return [] } })
  const [estoque,  setEstoque]  = useState([])
  const [offers,   setOffers]   = useState([])
  const [orders,   setOrders]   = useState([])
  const [tab,      setTab]      = useState('inicio')
  const [syncing,  setSyncing]  = useState(false)

  const sync = useCallback(async () => {
    setSyncing(true)
    const { estoque: e, offers: o, orders: ord } = await fetchAll()
    setEstoque(e)
    setOffers(o.filter(of => of.supplierId === LOCAL || !of.supplierId))
    setOrders(ord)
    setSyncing(false)
  }, [])

  useEffect(() => { if (profile) sync() }, [profile, sync])

  function handleSetup(data) {
    setProfile(data)
    try { localStorage.setItem(LOCAL, JSON.stringify(data)) } catch {}
  }

  if (!profile) return <SetupScreen onDone={handleSetup} />

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
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px 10px', background:'#060e1a', borderBottom:'1px solid #0f2035', position:'sticky', top:0, zIndex:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#10b981,#059669)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Truck size={18} color="#fff" />
          </div>
          <div>
            <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:15, lineHeight:1 }}>{profile.name}</div>
            <div style={{ color:'#10b981', fontSize:11, fontWeight:600 }}>Portal do Fornecedor</div>
          </div>
        </div>
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
        {tab === 'inicio'   && <TabInicio  estoque={estoque} offers={offers} orders={orders} profile={profile} />}
        {tab === 'receber'  && <TabReceber estoque={estoque} setEstoque={setEstoque} />}
        {tab === 'ofertas'  && <TabOfertas estoque={estoque} offers={offers} setOffers={setOffers} markets={markets} profile={profile} />}
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
