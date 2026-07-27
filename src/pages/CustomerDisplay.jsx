import React, { useState, useEffect, useRef } from 'react'
import { useBroadcastReceive } from '../hooks/useBroadcast.js'

const BRL = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)

function useClock() {
  const [t, setT] = useState(new Date())
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id) }, [])
  return t
}

function useFlash(value) {
  const [flash, setFlash] = useState(false)
  const prev = useRef(value)
  useEffect(() => {
    if (prev.current !== value && value > 0) { setFlash(true); setTimeout(() => setFlash(false), 500) }
    prev.current = value
  }, [value])
  return flash
}

const PROMOS_SCROLL = [
  '🎟️  A cada R$100 em compras ganhe 1 CUPOM PREMIADO!',
  '🏆  Sorteio todo último sábado do mês — R$150 em compras!',
  '🛒  Compras acima de R$100 ganham cupom automático no caixa!',
  '📱  WhatsApp: (15) 99660-4075 · @mercadocortaprecos',
  '🙏  Deus é bom o tempo todo — Obrigado pela preferência!',
]

export default function CustomerDisplay() {
  const [state, setState]       = useState(null)
  const [celebrate, setCelebrate] = useState(null)
  const [promoIdx, setPromoIdx] = useState(0)
  const prevPromos = useRef([])
  const clock = useClock()

  useBroadcastReceive((msg) => {
    if (msg?.type !== 'cart') return
    setState(msg)
    const activeNow  = (msg.promoResults || []).filter(r => r.status === 'active').map(r => r.rule.name)
    const newOnes    = activeNow.filter(n => !prevPromos.current.includes(n))
    if (newOnes.length > 0) { setCelebrate(newOnes[0]); setTimeout(() => setCelebrate(null), 3500) }
    prevPromos.current = activeNow
  })

  // Scroll promotional messages when idle
  useEffect(() => {
    const id = setInterval(() => setPromoIdx(i => (i + 1) % PROMOS_SCROLL.length), 4000)
    return () => clearInterval(id)
  }, [])

  const cart           = state?.cart         || []
  const promoResults   = state?.promoResults || []
  const total          = state?.total        || 0
  const subtotal       = state?.subtotal     || 0
  const totalFlash     = useFlash(total)
  const activePromos   = promoResults.filter(r => r.status === 'active')
  const progressPromos = promoResults.filter(r => r.status === 'progress')
  const promoSaving    = activePromos.reduce((s, r) => s + r.discount, 0)
  const isEmpty        = cart.length === 0

  const timeStr = clock.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateStr = clock.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })

  return (
    <div className="h-screen bg-gray-950 flex flex-col select-none overflow-hidden" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-8 py-3" style={{ background: '#ea580c' }}>
        <div className="flex items-center gap-3">
          <div style={{ fontFamily: "'Courier New', monospace", fontWeight: 900, fontSize: 28, color: '#000', letterSpacing: '-1px' }}>
            ✕ CORTA PREÇO$
          </div>
          <div style={{ fontSize: 11, color: 'rgba(0,0,0,.55)', fontWeight: 600, lineHeight: 1.3, marginTop: 2 }}>
            Economia de verdade<br/>variedades todo dia
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: "'Courier New', monospace", fontSize: 28, fontWeight: 900, color: '#000', letterSpacing: 2 }}>
            {timeStr}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(0,0,0,.55)', fontWeight: 600, textTransform: 'capitalize' }}>
            {dateStr}
          </div>
        </div>
      </div>

      {/* ── Main area ───────────────────────────────────────── */}
      {isEmpty ? (
        /* ── CAIXA LIVRE state ──────────────────────────────── */
        <div className="flex-1 flex flex-col items-center justify-center gap-8 p-10"
             style={{ background: 'radial-gradient(ellipse at center, #0d1a0a 0%, #050a04 100%)' }}>

          {/* LED indicator */}
          <div className="flex items-center gap-4">
            <div style={{
              width: 20, height: 20, borderRadius: '50%',
              background: '#22c55e',
              boxShadow: '0 0 20px 6px #22c55e88',
              animation: 'ledPulse 2s ease-in-out infinite',
            }} />
            <div style={{
              fontFamily: "'Courier New', monospace",
              fontSize: 'clamp(40px, 6vw, 72px)',
              fontWeight: 900,
              color: '#4ade80',
              letterSpacing: '0.15em',
              textShadow: '0 0 40px #4ade8066',
            }}>
              CAIXA LIVRE
            </div>
            <div style={{
              width: 20, height: 20, borderRadius: '50%',
              background: '#22c55e',
              boxShadow: '0 0 20px 6px #22c55e88',
              animation: 'ledPulse 2s ease-in-out infinite',
            }} />
          </div>

          <div style={{ color: '#374151', fontSize: 18, fontWeight: 600, letterSpacing: 2 }}>
            CAIXA 01  ·  AGUARDANDO PRÓXIMO CLIENTE
          </div>

          {/* scrolling promo message */}
          <div style={{
            background: '#0f1f0a',
            border: '1px solid #166534',
            borderRadius: 16,
            padding: '16px 32px',
            maxWidth: 700,
            textAlign: 'center',
          }}>
            <div key={promoIdx} style={{
              color: '#86efac',
              fontSize: 18,
              fontWeight: 700,
              animation: 'fadeInMsg .5s ease',
            }}>
              {PROMOS_SCROLL[promoIdx]}
            </div>
          </div>

          <div style={{ color: '#1f2937', fontSize: 13, fontWeight: 700, letterSpacing: 3 }}>
            🙏 DEUS É BOM O TEMPO TODO
          </div>
        </div>

      ) : (
        /* ── EM ATENDIMENTO state ───────────────────────────── */
        <div className="flex-1 flex overflow-hidden">

          {/* LEFT: item list */}
          <div className="flex-1 overflow-y-auto p-5 space-y-2"
               style={{ background: '#030712' }}>
            <div style={{ color: '#374151', fontSize: 11, fontWeight: 700, letterSpacing: 3, marginBottom: 8 }}>
              ITENS DA COMPRA
            </div>
            {cart.map((item, i) => (
              <CartItemRow key={item.productId + '-' + item.qty} item={item} index={i} />
            ))}
          </div>

          {/* RIGHT: totals + promos */}
          <div className="flex flex-col flex-shrink-0" style={{ width: 340, background: '#0a0a0a', borderLeft: '1px solid #1f2937' }}>

            {/* promos in progress */}
            {progressPromos.length > 0 && (
              <div className="p-4 space-y-2" style={{ borderBottom: '1px solid #1f2937' }}>
                {progressPromos.map(r => (
                  <div key={r.rule.id} style={{ background: '#1c1400', border: '1px solid #7830063d', borderRadius: 12, padding: '10px 14px' }}>
                    <div style={{ color: '#fbbf24', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                      🎯 FALTAM {r.needed} PARA PROMO!
                    </div>
                    <div style={{ color: '#fde68a', fontSize: 13, fontWeight: 600 }}>{r.rule.name}</div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                      {Array.from({ length: r.rule.qty }).map((_, i) => (
                        <div key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: i < r.current ? '#f59e0b' : '#292524' }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* active promos */}
            {activePromos.length > 0 && (
              <div className="p-4 space-y-2" style={{ borderBottom: '1px solid #1f2937' }}>
                {activePromos.map(r => (
                  <div key={r.rule.id} style={{ background: '#052e16', border: '1px solid #16a34a44', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>✅</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: '#4ade80', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>PROMOÇÃO ATIVA</div>
                      <div style={{ color: '#bbf7d0', fontSize: 12, fontWeight: 600 }}>{r.rule.name}</div>
                    </div>
                    <div style={{ color: '#4ade80', fontWeight: 900, fontSize: 15, whiteSpace: 'nowrap' }}>−{BRL(r.discount)}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ flex: 1 }} />

            {/* subtotal + discount breakdown */}
            {promoSaving > 0 && (
              <div className="px-6 py-3" style={{ borderTop: '1px solid #1f2937' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#4b5563', marginBottom: 4 }}>
                  <span>Subtotal</span><span>{BRL(subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#4ade80', fontWeight: 700 }}>
                  <span>💰 Economia</span><span>−{BRL(promoSaving)}</span>
                </div>
              </div>
            )}

            {/* TOTAL — the big number */}
            <div className="p-6" style={{ borderTop: '1px solid #1f2937', background: '#050505' }}>
              <div style={{ color: '#374151', fontSize: 11, fontWeight: 700, letterSpacing: 4, marginBottom: 6 }}>TOTAL A PAGAR</div>
              <div style={{
                fontFamily: "'Courier New', monospace",
                fontSize: 'clamp(36px, 4vw, 56px)',
                fontWeight: 900,
                color: totalFlash ? '#ea580c' : '#f9fafb',
                textShadow: totalFlash ? '0 0 30px #ea580c99' : 'none',
                transition: 'color .3s, text-shadow .3s',
                letterSpacing: -1,
                lineHeight: 1,
              }}>
                {BRL(total)}
              </div>
              {promoSaving > 0 && (
                <div style={{ color: '#4ade80', fontSize: 13, fontWeight: 700, marginTop: 8 }}>
                  🎉 Você economizou {BRL(promoSaving)}!
                </div>
              )}
              <div style={{ color: '#1f2937', fontSize: 11, fontWeight: 700, letterSpacing: 3, marginTop: 12 }}>
                🙏 DEUS É BOM O TEMPO TODO
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Promo celebration overlay ────────────────────────── */}
      {celebrate && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.7)', pointerEvents: 'none' }}>
          <div className="animate-pop" style={{ background: '#16a34a', borderRadius: 28, padding: '40px 60px', textAlign: 'center', boxShadow: '0 0 80px 20px #16a34a66' }}>
            <div style={{ fontSize: 60, marginBottom: 12 }}>🎉</div>
            <div style={{ color: '#fff', fontWeight: 900, fontSize: 32, letterSpacing: 1 }}>PROMOÇÃO ATIVADA!</div>
            <div style={{ color: '#bbf7d0', fontSize: 20, fontWeight: 600, marginTop: 8 }}>{celebrate}</div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes ledPulse {
          0%,100%{opacity:1;box-shadow:0 0 20px 6px #22c55e88;}
          50%{opacity:.3;box-shadow:0 0 6px 2px #22c55e44;}
        }
        @keyframes fadeInMsg {
          from{opacity:0;transform:translateY(8px);}
          to{opacity:1;transform:none;}
        }
        @keyframes slideInItem {
          from{opacity:0;transform:translateX(20px);}
          to{opacity:1;transform:none;}
        }
      `}</style>
    </div>
  )
}

function CartItemRow({ item, index }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => { const t = setTimeout(() => setVisible(true), index * 30); return () => clearTimeout(t) }, [index])

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      background: '#0d1117', borderRadius: 12,
      padding: '12px 16px', border: '1px solid #1f2937',
      opacity: visible ? 1 : 0,
      transform: visible ? 'none' : 'translateX(16px)',
      transition: 'opacity .25s, transform .25s',
    }}>
      <div style={{
        flexShrink: 0, width: 36, height: 36,
        background: '#ea580c', borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 900, fontSize: 16, color: '#000',
      }}>
        {item.qty}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#f9fafb', fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.name}
        </div>
        <div style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>
          {BRL(item.price)} × {item.qty}
        </div>
      </div>
      <div style={{ color: '#f9fafb', fontWeight: 900, fontSize: 16, flexShrink: 0 }}>
        {BRL(item.price * item.qty)}
      </div>
    </div>
  )
}
