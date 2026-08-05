/**
 * /loja/:storeSlug — Vitrine Digital pública por mercado
 *
 * Página pública (zero auth) que mostra as ofertas do distribuidor
 * personalizadas para um mercado específico. O dono do mercado pode
 * colar o QR code no balcão — os clientes finais veem os produtos e
 * preços, e o contato WhatsApp para pedidos diretos.
 */
import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import ZatendeStockLogo from '../components/ZatendeStockLogo.jsx'

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function slug(name = '') {
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

const CATEGORY_EMOJI = {
  bebida: '🥤', cerveja: '🍺', refrigerante: '🥤', leite: '🥛',
  biscoito: '🍪', bolacha: '🍪', chocolate: '🍫', panetone: '🎄',
  arroz: '🍚', feijao: '🫘', oleo: '🫙', cafe: '☕',
  agua: '💧', suco: '🧃', vinho: '🍷',
  default: '📦',
}

function productEmoji(name = '') {
  const n = name.toLowerCase()
  for (const [k, v] of Object.entries(CATEGORY_EMOJI)) {
    if (n.includes(k)) return v
  }
  return CATEGORY_EMOJI.default
}

function readLocal(key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null } catch { return null }
}

export default function VitrinaDigital() {
  const { storeSlug } = useParams()
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    function resolve(d) {
      const offers  = d?.cp_supplier_offers       ? JSON.parse(d.cp_supplier_offers)       : (readLocal('cp_supplier_offers')       || [])
      const markets = d?.cp_distribuidor_markets  ? JSON.parse(d.cp_distribuidor_markets)  : (readLocal('cp_distribuidor_markets')  || [])
      const profile = d?.cp_forn_profile_v1       ? JSON.parse(d.cp_forn_profile_v1)       : (readLocal('cp_forn_profile_v1')       || {})
      const market  = markets.find(m => slug(m.name) === storeSlug || m.id === storeSlug)
      const activeOffers = offers.filter(o => o.qty > 0 && o.status !== 'delivered')
      setData({ market: market || null, offers: activeOffers, profile })
    }

    fetch('/api/restore')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(({ data: d }) => resolve(d || {}))
      .catch(() => {
        // server unavailable — try localStorage directly (same-origin)
        resolve({})
      })
      .finally(() => setLoading(false))
  }, [storeSlug])

  if (loading) return (
    <div style={{ minHeight:'100dvh', background:'#050f1a', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
      <div style={{ width:36, height:36, border:'3px solid #1e4060', borderTopColor:'#f97316', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <div style={{ color:'#475569', fontSize:14 }}>Carregando vitrine…</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (error) return (
    <div style={{ minHeight:'100dvh', background:'#050f1a', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ color:'#ef4444', fontSize:16, textAlign:'center' }}>Vitrine não encontrada. Verifique o link.</div>
    </div>
  )

  const { market, offers, profile } = data
  const supplierName  = profile?.name  || 'Mega Tudo Barato'
  const supplierPhone = profile?.phone || ''
  const pageUrl = window.location.href
  const mktName    = market?.name    || storeSlug?.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Meu Mercado'
  const mktLogo    = market?.logoUrl || ''
  const mktInitial = mktName.charAt(0).toUpperCase()

  function buildOrderMsg() {
    const lines = offers.slice(0, 5).map(o => `• ${o.productName} — ${BRL.format(o.offerPrice)}/un`)
    return `Olá! Vi os produtos na vitrine da ${supplierName} e quero fazer um pedido:\n\n${lines.join('\n')}\n\nPode me ajudar?`
  }

  return (
    <div style={{ minHeight:'100dvh', background:'#050f1a', fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <style>{`
        @keyframes spin    { to { transform: rotate(360deg) } }
        @keyframes fadeIn  { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:none } }
        @keyframes popIn   { from { opacity:0; transform:scale(.85) } to { opacity:1; transform:scale(1) } }
      `}</style>

      {/* ── Hero do mercado ─────────────────────────── */}
      <div style={{
        background: 'linear-gradient(160deg,#0a1929 0%,#0d2137 60%,#0a2540 100%)',
        borderBottom: '1px solid #1a3a50',
        padding: '28px 20px 24px',
        textAlign: 'center',
      }}>
        {/* Logo do mercado */}
        <div style={{
          width: 88, height: 88, borderRadius: 24,
          background: mktLogo ? 'transparent' : 'linear-gradient(135deg,#1e40af,#0f3460)',
          border: '3px solid #1e4060',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 14px', overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          animation: 'popIn .5s cubic-bezier(.22,1,.36,1) both',
        }}>
          {mktLogo
            ? <img src={mktLogo} alt={mktName} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            : <span style={{ color:'#93c5fd', fontSize:38, fontWeight:900 }}>{mktInitial}</span>
          }
        </div>

        {/* Nome do mercado */}
        <div style={{ color:'#f1f5f9', fontWeight:900, fontSize:22, lineHeight:1.2, animation:'fadeIn .4s ease .1s both' }}>
          {mktName}
        </div>
        {market?.address && (
          <div style={{ color:'#475569', fontSize:12, marginTop:4, animation:'fadeIn .4s ease .15s both' }}>
            📍 {market.address}
          </div>
        )}

        {/* Powered by */}
        <div style={{
          marginTop: 14,
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(15,25,40,0.7)', borderRadius: 20, padding: '6px 14px',
          border: '1px solid #1a3a50',
          animation: 'fadeIn .4s ease .2s both',
        }}>
          <span style={{ color:'#475569', fontSize:11 }}>ofertas de</span>
          <span style={{ color:'#f97316', fontWeight:900, fontSize:13 }}>{supplierName}</span>
        </div>
      </div>

      {/* Offer grid */}
      <div style={{ padding:'20px 16px 40px', maxWidth:600, margin:'0 auto' }}>

        {offers.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 20px' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>📦</div>
            <div style={{ color:'#64748b', fontSize:16 }}>Nenhuma oferta disponível agora</div>
          </div>
        ) : (
          <>
            <div style={{ color:'#f1f5f9', fontWeight:800, fontSize:15, marginBottom:16 }}>
              {offers.length} produto{offers.length !== 1 ? 's' : ''} disponível{offers.length !== 1 ? 'is' : ''}
            </div>

            {offers.map((offer, i) => (
              <div key={offer.id} style={{
                background:'#0d2137', borderRadius:16, marginBottom:12, border:'1px solid #1a3a50', overflow:'hidden',
                animation:`fadeIn 0.3s ease ${i * 0.05}s both`,
              }}>
                {offer.isOpportunity && (
                  <div style={{ background:'linear-gradient(90deg,#92400e,#d97706)', padding:'4px 14px' }}>
                    <span style={{ color:'#fef3c7', fontSize:11, fontWeight:900 }}>🔥 OPORTUNIDADE — Estoque limitado!</span>
                  </div>
                )}
                <div style={{ padding:'14px 16px', display:'flex', gap:12, alignItems:'center' }}>
                  <div style={{ width:52, height:52, borderRadius:14, background:'#0a1929', border:'1px solid #1a3a50', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, flexShrink:0 }}>
                    {productEmoji(offer.productName)}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ color:'#f1f5f9', fontWeight:800, fontSize:15 }}>{offer.productName}</div>
                    {offer.sku && <div style={{ color:'#334155', fontSize:11, fontFamily:'monospace' }}>{offer.sku}</div>}
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4, flexWrap:'wrap' }}>
                      <span style={{ color:'#10b981', fontWeight:900, fontSize:18 }}>{BRL.format(offer.offerPrice)}</span>
                      <span style={{ color:'#475569', fontSize:12 }}>/un</span>
                      <span style={{ background:'#0a2540', color:'#93c5fd', fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:8 }}>
                        {offer.qty} {offer.unit} disponíveis
                      </span>
                    </div>
                    {offer.note && (
                      <div style={{ color:'#64748b', fontSize:11, marginTop:4, fontStyle:'italic' }}>"{offer.note}"</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* WhatsApp CTA */}
        {supplierPhone && (
          <div style={{ background:'#0d2137', borderRadius:20, padding:20, textAlign:'center', border:'1px solid #14532d', marginTop:24 }}>
            <div style={{ fontSize:28, marginBottom:8 }}>📱</div>
            <div style={{ color:'#f1f5f9', fontWeight:800, fontSize:15, marginBottom:4 }}>Quer fazer um pedido?</div>
            <div style={{ color:'#64748b', fontSize:12, marginBottom:16 }}>Fale direto pelo WhatsApp com {supplierName}</div>
            <a
              href={`https://wa.me/55${supplierPhone.replace(/\D/g,'')}?text=${encodeURIComponent(buildOrderMsg())}`}
              target="_blank" rel="noreferrer"
              style={{ display:'inline-flex', alignItems:'center', gap:8, background:'#16a34a', color:'#fff', fontWeight:900, fontSize:15, padding:'14px 28px', borderRadius:14, textDecoration:'none', boxShadow:'0 4px 16px rgba(22,163,74,0.35)' }}>
              💬 Pedir pelo WhatsApp
            </a>
          </div>
        )}

        {/* QR code for sharing — only shown on desktop */}
        <div style={{ marginTop:32, textAlign:'center' }}>
          <div style={{ color:'#334155', fontSize:11, marginBottom:10 }}>Compartilhar esta vitrine</div>
          <div style={{ display:'inline-block', background:'#fff', borderRadius:16, padding:12 }}>
            <QRCodeSVG value={pageUrl} size={120} />
          </div>
          <div style={{ color:'#334155', fontSize:10, marginTop:6 }}>Aponte a câmera para acessar</div>
        </div>

      </div>

      {/* Footer */}
      <div style={{ textAlign:'center', padding:'16px 20px 32px', borderTop:'1px solid #0d2137' }}>
        <div style={{ color:'#1e4060', fontSize:11 }}>Vitrine powered by ZatendeStock · Portal B2B</div>
      </div>
    </div>
  )
}
