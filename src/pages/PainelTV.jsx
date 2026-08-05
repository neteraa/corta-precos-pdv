/**
 * /tv — Painel de Vendas TV (Big Screen Dashboard)
 * Sem login. Auto-refresh 15s. Landscape. Para tela grande no escritório.
 */
import { useState, useEffect, useRef } from 'react'

const API = '/api/restore'
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const BRAND_COLOR  = '#f97316'
const GREEN        = '#10b981'
const AMBER        = '#f59e0b'
const BLUE         = '#3b82f6'
const PURPLE       = '#8b5cf6'

/* ── helpers ── */
const fmtTime = (iso) => {
  if (!iso) return ''
  const diff = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (diff < 1)  return 'agora'
  if (diff < 60) return `${diff}min`
  if (diff < 1440) return `${Math.floor(diff / 60)}h`
  return `${Math.floor(diff / 1440)}d`
}

const clock = () =>
  new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

const today = () => new Date().toISOString().slice(0, 10)

/* avatar color determinístico por nome */
const aColor = (name = '') => {
  const palette = [BLUE, GREEN, BRAND_COLOR, PURPLE, AMBER, '#06b6d4', '#ec4899']
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return palette[Math.abs(h) % palette.length]
}

/* ── Pulse dot ── */
function Dot({ color = GREEN, size = 10 }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size, borderRadius: '50%',
      background: color, marginRight: 6, flexShrink: 0,
      animation: 'tvPulse 2s ease-in-out infinite',
    }} />
  )
}

/* ── KPI Card ── */
function KPI({ label, value, sub, color, icon, flash }) {
  return (
    <div style={{
      background: '#0d2137', borderRadius: 20, padding: '20px 24px',
      border: `1px solid ${color}33`, flex: 1,
      animation: flash ? 'tvFlash 0.6s ease' : 'none',
    }}>
      <div style={{ color: '#475569', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{icon} {label}</div>
      <div style={{ color, fontWeight: 900, fontSize: 38, lineHeight: 1, letterSpacing: '-1px' }}>{value}</div>
      {sub && <div style={{ color: '#334155', fontSize: 12, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

/* ── Bar ── */
function Bar({ pct, color }) {
  return (
    <div style={{ flex: 1, height: 8, background: '#0a2540', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{
        width: `${pct}%`, height: '100%', background: color,
        borderRadius: 4, transition: 'width 1s ease',
      }} />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════ */
export default function PainelTV() {
  const [data,    setData]    = useState(null)
  const [timeStr, setTimeStr] = useState(clock())
  const [flashKpis, setFlashKpis] = useState(false)
  const prevEvLen = useRef(0)

  /* ── Fetch data every 15s ── */
  useEffect(() => {
    async function load() {
      try {
        const r = await fetch(API)
        if (!r.ok) return
        const { data: d } = await r.json()
        const events  = d?.cp_sellout_events  ? JSON.parse(d.cp_sellout_events)  : []
        const orders  = d?.cp_supplier_orders ? JSON.parse(d.cp_supplier_orders) : []
        const markets = d?.cp_distribuidor_markets ? JSON.parse(d.cp_distribuidor_markets) : []
        const profile = d?.cp_forn_profile_v1 ? JSON.parse(d.cp_forn_profile_v1) : null

        if (events.length !== prevEvLen.current) {
          setFlashKpis(true)
          setTimeout(() => setFlashKpis(false), 700)
          prevEvLen.current = events.length
        }
        setData({ events, orders, markets, profile })
      } catch {}
    }
    load()
    const t = setInterval(load, 15_000)
    return () => clearInterval(t)
  }, [])

  /* ── Clock ── */
  useEffect(() => {
    const t = setInterval(() => setTimeStr(clock()), 1000)
    return () => clearInterval(t)
  }, [])

  if (!data) return (
    <div style={{ minHeight:'100dvh', background:'#050f1a', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
      <div style={{ width:48, height:48, border:`4px solid ${BRAND_COLOR}`, borderTopColor:'transparent', borderRadius:'50%', animation:'tvSpin 1s linear infinite' }} />
      <div style={{ color:'#334155', fontSize:14 }}>Conectando ao servidor...</div>
      <style>{CSS}</style>
    </div>
  )

  const { events, orders, markets, profile } = data
  const tdStr  = today()
  const evToday = events.filter(e => e.soldAt?.startsWith(tdStr))
  const revToday = evToday.reduce((s, e) => s + (e.totalRevenue || 0), 0)
  const unitsToday = evToday.reduce((s, e) => s + (e.qtySold || 0), 0)

  const pendingOrders   = orders.filter(o => o.status === 'pending').length
  const confirmedOrders = orders.filter(o => o.status === 'confirmed').length
  const deliveredOrders = orders.filter(o => o.status === 'delivered').length

  /* top products from sell-out events */
  const prodMap = {}
  for (const e of events) {
    const k = e.productName
    if (!prodMap[k]) prodMap[k] = { name: k, units: 0, rev: 0 }
    prodMap[k].units += e.qtySold || 0
    prodMap[k].rev   += e.totalRevenue || 0
  }
  const topProds = Object.values(prodMap).sort((a, b) => b.units - a.units).slice(0, 6)
  const maxUnits = topProds[0]?.units || 1

  /* active markets (had any sell-out event) */
  const activeMktNames = new Set(events.map(e => e.storeName).filter(Boolean))
  const mktList = markets.length
    ? markets.map(m => ({ ...m, active: activeMktNames.has(m.name) }))
    : [...activeMktNames].map(n => ({ name: n, active: true }))

  /* last event for feed */
  const feed = [...events].sort((a, b) => new Date(b.soldAt) - new Date(a.soldAt)).slice(0, 12)

  const companyName = profile?.name || 'Mega Tudo Barato'

  return (
    <div style={{
      minHeight: '100dvh', background: '#050f1a', color: '#f1f5f9',
      fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      display: 'flex', flexDirection: 'column', padding: '16px 20px', gap: 14,
      boxSizing: 'border-box',
    }}>
      <style>{CSS}</style>

      {/* ── Header ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: `linear-gradient(135deg,${BRAND_COLOR},#c2410c)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: 22, color: '#fff',
          }}>{companyName[0]}</div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 20, letterSpacing: '-0.5px' }}>{companyName}</div>
            <div style={{ color: '#334155', fontSize: 12 }}>Portal do Distribuidor · Sell-Out ao vivo</div>
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, background:'#0d2137', border:`1px solid ${GREEN}44`, borderRadius:12, padding:'6px 14px' }}>
            <Dot color={GREEN} size={8} />
            <span style={{ color:GREEN, fontWeight:800, fontSize:13 }}>AO VIVO</span>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:22, fontVariantNumeric:'tabular-nums', letterSpacing:1 }}>{timeStr}</div>
            <div style={{ color:'#334155', fontSize:11 }}>{new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long' })}</div>
          </div>
        </div>
      </div>

      {/* ── KPI row ── */}
      <div style={{ display:'flex', gap:12, flexShrink:0 }}>
        <KPI label="Faturado Hoje"   value={BRL.format(revToday)}     sub={`${evToday.length} eventos`}            color={GREEN}       icon="💰" flash={flashKpis} />
        <KPI label="Unidades Hoje"   value={unitsToday || '—'}         sub="sell-out confirmado"                   color={BLUE}        icon="📦" flash={flashKpis} />
        <KPI label="Pedidos Abertos" value={pendingOrders + confirmedOrders} sub={`${deliveredOrders} entregues`}  color={AMBER}       icon="📋" />
        <KPI label="Mercados Ativos" value={activeMktNames.size || mktList.length} sub={`de ${mktList.length} cadastrados`} color={PURPLE} icon="🏪" />
      </div>

      {/* ── Main content ── */}
      <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, minHeight:0 }}>

        {/* LEFT — Live feed */}
        <div style={{ background:'#0a1929', borderRadius:18, border:'1px solid #1a3a50', display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ padding:'14px 18px', borderBottom:'1px solid #0d2137', display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
            <Dot color={GREEN} size={10} />
            <span style={{ fontWeight:900, fontSize:15 }}>Sell-Out ao Vivo</span>
            {events.length > 0 && (
              <span style={{ marginLeft:'auto', background:'#10b98122', border:'1px solid #10b98144', color:GREEN, fontSize:11, fontWeight:700, padding:'2px 10px', borderRadius:20 }}>
                {events.length} total
              </span>
            )}
          </div>

          {feed.length === 0 ? (
            <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10, padding:24 }}>
              <div style={{ fontSize:40 }}>📲</div>
              <div style={{ color:'#475569', fontSize:14, fontWeight:700, textAlign:'center' }}>Aguardando sell-out dos mercados</div>
              <div style={{ color:'#334155', fontSize:12, textAlign:'center', maxWidth:260, lineHeight:1.5 }}>
                Quando o Corta Preço PDV registrar uma venda, aparece aqui em tempo real
              </div>
            </div>
          ) : (
            <div style={{ flex:1, overflowY:'auto', padding:'6px 0' }}>
              {feed.map((e, i) => {
                const ac = aColor(e.storeName)
                const init = (e.storeName || 'M').split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()
                return (
                  <div key={e.id || i} className="tvFeedItem" style={{
                    display:'flex', alignItems:'center', gap:12, padding:'10px 18px',
                    borderBottom:'1px solid #0d2137',
                    animation: i === 0 ? 'tvSlideIn 0.4s ease' : 'none',
                  }}>
                    <div style={{
                      width:38, height:38, borderRadius:10, flexShrink:0,
                      background:`linear-gradient(135deg,${ac},${ac}88)`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontWeight:900, fontSize:14, color:'#fff',
                    }}>{init}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:800, fontSize:14, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {e.storeName || 'Mercado'}
                      </div>
                      <div style={{ color:'#64748b', fontSize:12, marginTop:1 }}>
                        {e.qtySold} un · {e.productName}
                      </div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ color:GREEN, fontWeight:900, fontSize:14 }}>{BRL.format(e.totalRevenue||0)}</div>
                      <div style={{ color:'#334155', fontSize:11, marginTop:1 }}>{fmtTime(e.soldAt)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* RIGHT — Top products + markets */}
        <div style={{ display:'flex', flexDirection:'column', gap:12, minHeight:0 }}>

          {/* Top products */}
          <div style={{ background:'#0a1929', borderRadius:18, border:'1px solid #1a3a50', flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div style={{ padding:'14px 18px', borderBottom:'1px solid #0d2137', fontWeight:900, fontSize:15, flexShrink:0 }}>
              🏆 Top Produtos
            </div>
            {topProds.length === 0 ? (
              <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#334155', fontSize:13 }}>
                Sem dados ainda
              </div>
            ) : (
              <div style={{ flex:1, padding:'10px 18px', display:'flex', flexDirection:'column', justifyContent:'space-around' }}>
                {topProds.map((p, i) => (
                  <div key={p.name} style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ color: i < 3 ? [BRAND_COLOR, AMBER, BLUE][i] : '#334155', fontWeight:900, fontSize:16, width:24, flexShrink:0 }}>
                      {i < 3 ? ['🥇','🥈','🥉'][i] : `${i+1}.`}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ color:'#e2e8f0', fontWeight:700, fontSize:13, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginBottom:4 }}>
                        {p.name}
                      </div>
                      <Bar pct={Math.round(p.units / maxUnits * 100)} color={i < 3 ? [BRAND_COLOR, AMBER, BLUE][i] : '#3b82f6'} />
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0, minWidth:60 }}>
                      <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:13 }}>{p.units} un</div>
                      <div style={{ color:'#334155', fontSize:10 }}>{BRL.format(p.rev)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Markets grid */}
          <div style={{ background:'#0a1929', borderRadius:18, border:'1px solid #1a3a50', padding:'14px 18px' }}>
            <div style={{ fontWeight:900, fontSize:15, marginBottom:12 }}>🏪 Mercados</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {mktList.map((m, i) => {
                const ac = aColor(m.name)
                const init = (m.name||'?').split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()
                const lastEv = events.filter(e=>e.storeName===m.name).sort((a,b)=>new Date(b.soldAt)-new Date(a.soldAt))[0]
                return (
                  <div key={m.id || i} style={{
                    background: m.active ? `${ac}18` : '#0d2137',
                    border:`1px solid ${m.active ? ac+'66' : '#1a3a50'}`,
                    borderRadius:12, padding:'8px 12px',
                    display:'flex', alignItems:'center', gap:8, minWidth:0,
                    flex:'1 1 140px', maxWidth:200,
                  }}>
                    <div style={{
                      width:30, height:30, borderRadius:8, flexShrink:0,
                      background:`linear-gradient(135deg,${ac},${ac}88)`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontWeight:900, fontSize:12, color:'#fff',
                    }}>{init}</div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ color:'#f1f5f9', fontWeight:700, fontSize:12, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {m.name?.split(' ').slice(0,2).join(' ')}
                      </div>
                      <div style={{ fontSize:10, marginTop:1 }}>
                        {m.active
                          ? <span style={{ color:GREEN }}>● {lastEv ? fmtTime(lastEv.soldAt) : 'ativo'}</span>
                          : <span style={{ color:'#334155' }}>○ inativo</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Order pipeline ── */}
      <div style={{ background:'#0d2137', borderRadius:16, padding:'12px 20px', border:'1px solid #1a3a50', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:24, justifyContent:'space-between' }}>
          <div style={{ color:'#475569', fontSize:12, fontWeight:700, flexShrink:0 }}>PIPELINE DE PEDIDOS</div>
          <div style={{ flex:1, display:'flex', alignItems:'center', gap:8 }}>
            {[
              { label:'Aguardando', count: pendingOrders,   color: AMBER  },
              { label:'Confirmado', count: confirmedOrders, color: BLUE   },
              { label:'Entregue',   count: deliveredOrders, color: GREEN  },
            ].map((s, i) => (
              <div key={s.label} style={{ display:'flex', alignItems:'center', gap:8, flex:1 }}>
                {i > 0 && <div style={{ color:'#1e4060', fontSize:18 }}>›</div>}
                <div style={{ display:'flex', alignItems:'center', gap:6, flex:1 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius:10, flexShrink:0,
                    background:`${s.color}22`, border:`1px solid ${s.color}44`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    color:s.color, fontWeight:900, fontSize:16,
                  }}>{s.count}</div>
                  <span style={{ color:'#475569', fontSize:12 }}>{s.label}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ color:'#1e4060', fontSize:12, flexShrink:0 }}>
            ↻ atualiza a cada 15s
          </div>
        </div>
      </div>

    </div>
  )
}

/* ── CSS keyframes ── */
const CSS = `
  @keyframes tvPulse {
    0%,100% { opacity:1; transform:scale(1) }
    50%      { opacity:0.5; transform:scale(0.85) }
  }
  @keyframes tvFlash {
    0%   { background:#10b98122 }
    50%  { background:#10b98144 }
    100% { background:#0d2137   }
  }
  @keyframes tvSlideIn {
    from { opacity:0; transform:translateY(-8px) }
    to   { opacity:1; transform:translateY(0)    }
  }
  @keyframes tvSpin {
    from { transform:rotate(0deg) }
    to   { transform:rotate(360deg) }
  }
`
