import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, MessageCircle, TrendingUp, ShieldCheck, Zap, Package, Bell, BarChart3, ChevronDown } from 'lucide-react'
import ZatendeStockLogo from '../components/ZatendeStockLogo.jsx'
import { isLoggedIn } from '../utils/auth.js'

const ZAP         = '5511985950956'
const ZAP_MSG     = 'Olá! Quero cadastrar meu mercado na ZatendeStock 🛒'
const openWpp     = () => window.open(`https://wa.me/${ZAP}?text=${encodeURIComponent(ZAP_MSG)}`, '_blank')

/* ── rotating words in headline ─────────────────────────── */
const WORDS = ['estoque.', 'validade.', 'pedido.', 'lucro.']

/* ── feature cards ──────────────────────────────────────── */
const FEATURES = [
  {
    icon: Bell,
    color: '#f97316',
    glow: 'rgba(249,115,22,.2)',
    title: 'Alerta antes de acabar',
    desc:  'O sistema avisa quando um produto está acabando — você repõe antes de perder a venda.',
  },
  {
    icon: MessageCircle,
    color: '#4ade80',
    glow: 'rgba(74,222,128,.2)',
    title: 'Pedido direto no WhatsApp',
    desc:  'Conecte seu mercado ao distribuidor e faça pedidos automáticos com um toque.',
  },
  {
    icon: BarChart3,
    color: '#5462D8',
    glow: 'rgba(84,98,216,.2)',
    title: 'Controle total na palma da mão',
    desc:  'Relatórios, validades, vendas e estoque — tudo no celular, sem planilha.',
  },
]

const STATS = [
  { n: '24h',   label: 'funcionando sem parar' },
  { n: '100%',  label: 'no celular, sem instalar' },
  { n: '0',     label: 'planilhas necessárias' },
]

/* ══════════════════════════════════════════════════════════ */
export default function Landing() {
  const navigate        = useNavigate()
  const [word, setWord] = useState(0)
  const [vis,  setVis]  = useState(false)
  const statsRef        = useRef(null)

  /* redirect authenticated users straight to dashboard */
  useEffect(() => {
    if (isLoggedIn()) navigate('/dashboard', { replace: true })
  }, [])

  /* word rotator */
  useEffect(() => {
    const t = setInterval(() => setWord(w => (w + 1) % WORDS.length), 2200)
    return () => clearInterval(t)
  }, [])

  /* entrance animation */
  useEffect(() => {
    const t = setTimeout(() => setVis(true), 80)
    return () => clearTimeout(t)
  }, [])

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700;900&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }

    @keyframes float1  { 0%,100%{transform:translate(0,0) scale(1)}   50%{transform:translate(30px,-40px) scale(1.05)} }
    @keyframes float2  { 0%,100%{transform:translate(0,0) scale(1.02)} 50%{transform:translate(-25px,35px) scale(.98)} }
    @keyframes float3  { 0%,100%{transform:translate(0,0)}             50%{transform:translate(20px,20px)} }
    @keyframes ticker  { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
    @keyframes wordIn  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    @keyframes wordOut { from{opacity:1;transform:translateY(0)} to{opacity:0;transform:translateY(-10px)} }
    @keyframes pulse   { 0%,100%{opacity:.6} 50%{opacity:1} }
    @keyframes fadeUp  { from{opacity:0;transform:translateY(40px)} to{opacity:1;transform:translateY(0)} }
    @keyframes scanline { 0%{background-position:0 0} 100%{background-position:0 100%} }
    @keyframes spin    { to{transform:rotate(360deg)} }
    @keyframes bob     { 0%,100%{transform:translateY(0)} 50%{transform:translateY(8px)} }

    .land-hero   { animation: fadeUp .9s ease both }
    .land-word   { animation: wordIn .35s ease both }
    .land-feat   { transition: transform .25s, box-shadow .25s }
    .land-feat:hover { transform: translateY(-4px); box-shadow: var(--feat-glow) !important }
    .land-btn-primary { transition: all .2s }
    .land-btn-primary:hover { transform: scale(1.04); box-shadow: 0 8px 32px rgba(84,98,216,.5) !important }
    .land-btn-wpp:hover { transform: scale(1.04); box-shadow: 0 8px 32px rgba(74,222,128,.4) !important }
    .land-nav-enter:hover { color: #fff !important }
  `

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: '#000', color: '#fff', minHeight: '100dvh', overflow: 'hidden' }}>
      <style>{css}</style>

      {/* ── background orbs ───────────────────────────────── */}
      <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '-15%', left: '60%', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(84,98,216,.22) 0%, transparent 70%)', animation: 'float1 14s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', top: '40%', left: '-10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(74,222,128,.12) 0%, transparent 70%)', animation: 'float2 18s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', bottom: '-5%', right: '5%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(249,115,22,.14) 0%, transparent 70%)', animation: 'float3 12s ease-in-out infinite' }} />
        {/* dot grid */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, #ffffff08 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        {/* edge vignette */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 50%, transparent 40%, #000 100%)' }} />
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* NAV                                                */}
      {/* ═══════════════════════════════════════════════════ */}
      <nav style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px', borderBottom: '1px solid #ffffff08' }}>
        <ZatendeStockLogo variant="wordmark" />
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <a href="/guia" style={{ color: '#475569', fontSize: 13, fontWeight: 600, textDecoration: 'none', padding: '8px 14px', transition: 'color .2s' }} className="land-nav-enter">
            Guia
          </a>
          <button onClick={() => navigate('/login')}
            style={{ padding: '10px 22px', borderRadius: 10, border: '1px solid #1e2d47', background: 'rgba(255,255,255,.04)', color: '#94a3b8', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all .2s' }}
            onMouseEnter={e => { e.target.style.background = 'rgba(255,255,255,.1)'; e.target.style.color = '#fff' }}
            onMouseLeave={e => { e.target.style.background = 'rgba(255,255,255,.04)'; e.target.style.color = '#94a3b8' }}>
            Entrar
          </button>
        </div>
      </nav>

      {/* ═══════════════════════════════════════════════════ */}
      {/* HERO                                               */}
      {/* ═══════════════════════════════════════════════════ */}
      <section style={{ position: 'relative', zIndex: 1, minHeight: 'calc(100dvh - 65px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px 40px', textAlign: 'center' }}>

        {/* badge */}
        <div className="land-hero" style={{ animationDelay: '0ms', display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(84,98,216,.12)', border: '1px solid rgba(84,98,216,.3)', borderRadius: 999, padding: '7px 16px', marginBottom: 40 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80', display: 'inline-block', animation: 'pulse 2s ease infinite' }} />
          <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>Sistema ativo 24h · mercados conectados</span>
        </div>

        {/* headline */}
        <div className="land-hero" style={{ animationDelay: '120ms' }}>
          <h1 style={{
            fontFamily: "'Anton', sans-serif",
            fontSize: 'clamp(60px, 12vw, 130px)',
            lineHeight: .92,
            letterSpacing: '-0.01em',
            marginBottom: 20,
          }}>
            <span style={{ display: 'block', background: 'linear-gradient(135deg, #ffffff 30%, #c7cbf5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>CHEGA DE</span>
            <span style={{ display: 'block', background: 'linear-gradient(135deg, #ffffff 30%, #c7cbf5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>FALTA NO</span>
            {/* rotating word */}
            <span style={{ display: 'block', position: 'relative', height: 'clamp(68px, 13.5vw, 148px)' }}>
              <span
                key={word}
                className="land-word"
                style={{
                  position: 'absolute', left: 0, right: 0,
                  background: 'linear-gradient(135deg, #5462D8, #4ade80)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>
                {WORDS[word].toUpperCase()}
              </span>
            </span>
          </h1>
        </div>

        {/* sub */}
        <p className="land-hero" style={{ animationDelay: '240ms', maxWidth: 540, color: '#64748b', fontSize: 'clamp(15px, 2vw, 18px)', lineHeight: 1.7, marginBottom: 44 }}>
          Conecte seu mercado ao distribuidor, receba alertas de estoque e faça pedidos automáticos — tudo no celular, sem planilha.
        </p>

        {/* CTAs */}
        <div className="land-hero" style={{ animationDelay: '360ms', display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button onClick={openWpp} className="land-btn-wpp"
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 32px', borderRadius: 14, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', fontSize: 16, fontWeight: 900, boxShadow: '0 4px 24px rgba(34,197,94,.3)' }}>
            <MessageCircle size={20} />
            Quero meu mercado aqui
          </button>
          <button onClick={() => navigate('/login')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 28px', borderRadius: 14, border: '1px solid #1e2d47', cursor: 'pointer', background: 'rgba(255,255,255,.04)', color: '#94a3b8', fontSize: 16, fontWeight: 700 }}
            onMouseEnter={e => e.currentTarget.style.color = '#fff'}
            onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}>
            Já tenho acesso <ArrowRight size={16} />
          </button>
        </div>

        {/* scroll hint */}
        <div style={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)', animation: 'bob 2s ease infinite', opacity: .3 }}>
          <ChevronDown size={22} color="#fff" />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════ */}
      {/* TICKER                                             */}
      {/* ═══════════════════════════════════════════════════ */}
      <div style={{ position: 'relative', zIndex: 1, borderTop: '1px solid #0f1a2e', borderBottom: '1px solid #0f1a2e', background: '#02050d', overflow: 'hidden', padding: '16px 0' }}>
        <div style={{ display: 'flex', animation: 'ticker 22s linear infinite', whiteSpace: 'nowrap', width: 'max-content' }}>
          {[...Array(2)].map((_, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 0 }}>
              {['Controle de estoque', 'Alertas de validade', 'Pedidos automáticos', 'Conexão com distribuidor', 'Sem instalar app', 'Funciona no celular', 'Gestão profissional', 'Suporte via WhatsApp'].map(t => (
                <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 20, paddingRight: 40 }}>
                  <span style={{ color: '#1e2d47', fontSize: 16 }}>✦</span>
                  <span style={{ color: '#334155', fontSize: 13, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase' }}>{t}</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* STATS                                              */}
      {/* ═══════════════════════════════════════════════════ */}
      <section style={{ position: 'relative', zIndex: 1, padding: '80px 24px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 700, width: '100%', border: '1px solid #0f1a2e', borderRadius: 24, overflow: 'hidden', background: '#02050d' }}>
          {STATS.map(({ n, label }, i) => (
            <div key={n} style={{ flex: '1 1 180px', padding: '36px 28px', textAlign: 'center', borderRight: i < STATS.length - 1 ? '1px solid #0f1a2e' : 'none' }}>
              <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 'clamp(40px, 6vw, 64px)', lineHeight: 1, background: 'linear-gradient(135deg,#5462D8,#4ade80)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 8 }}>{n}</div>
              <div style={{ color: '#334155', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════ */}
      {/* FEATURES                                           */}
      {/* ═══════════════════════════════════════════════════ */}
      <section style={{ position: 'relative', zIndex: 1, padding: '0 24px 100px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <h2 style={{ fontFamily: "'Anton', sans-serif", fontSize: 'clamp(36px, 6vw, 64px)', lineHeight: 1, background: 'linear-gradient(135deg,#fff 40%,#475569)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 16 }}>
            TUDO QUE SEU<br/>MERCADO PRECISA
          </h2>
          <p style={{ color: '#475569', fontSize: 16, maxWidth: 480, margin: '0 auto' }}>
            Desenvolvido para donos de mercado que querem vender mais e trabalhar menos.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {FEATURES.map(({ icon: Icon, color, glow, title, desc }) => (
            <div key={title} className="land-feat"
              style={{ '--feat-glow': `0 8px 40px ${glow}`, background: '#02050d', border: '1px solid #0f1a2e', borderRadius: 20, padding: '32px 28px', boxShadow: `0 2px 16px ${glow}` }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: `${glow}`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <Icon size={24} color={color} />
              </div>
              <h3 style={{ color: '#f1f5f9', fontWeight: 800, fontSize: 18, marginBottom: 10, lineHeight: 1.3 }}>{title}</h3>
              <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.7 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════ */}
      {/* FINAL CTA                                          */}
      {/* ═══════════════════════════════════════════════════ */}
      <section style={{ position: 'relative', zIndex: 1, padding: '0 24px 100px' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center', background: 'linear-gradient(135deg, #05091a, #080d20)', border: '1px solid #1a2744', borderRadius: 28, padding: '60px 40px', position: 'relative', overflow: 'hidden' }}>
          {/* glow inside card */}
          <div aria-hidden style={{ position: 'absolute', top: '-40%', left: '50%', transform: 'translateX(-50%)', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(84,98,216,.18) 0%, transparent 70%)', pointerEvents: 'none' }} />

          <div style={{ position: 'relative' }}>
            <h2 style={{ fontFamily: "'Anton', sans-serif", fontSize: 'clamp(40px, 7vw, 72px)', lineHeight: 1, background: 'linear-gradient(135deg,#fff 30%,#7b82c8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 20 }}>
              SEU MERCADO<br/>MERECE ISSO.
            </h2>
            <p style={{ color: '#475569', fontSize: 16, lineHeight: 1.7, marginBottom: 36, maxWidth: 460, margin: '0 auto 36px' }}>
              Fale com a gente pelo WhatsApp e receba o acesso ao sistema em até 2 horas.
            </p>
            <button onClick={openWpp} className="land-btn-wpp"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 12, padding: '18px 40px', borderRadius: 16, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', fontSize: 18, fontWeight: 900, boxShadow: '0 4px 24px rgba(34,197,94,.3)' }}>
              <MessageCircle size={22} /> Falar com a equipe
            </button>
            <div style={{ marginTop: 20, color: '#1e2d47', fontSize: 13 }}>
              Sem contrato · Acesso em 2h · Suporte por WhatsApp
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════ */}
      {/* FOOTER                                             */}
      {/* ═══════════════════════════════════════════════════ */}
      <footer style={{ position: 'relative', zIndex: 1, borderTop: '1px solid #0a1020', padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <ZatendeStockLogo variant="wordmark" />
        <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
          <a href="/guia" style={{ color: '#1e2d47', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>Guia</a>
          <button onClick={() => navigate('/login')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1e2d47', fontSize: 12, fontWeight: 600 }}>Entrar</button>
          <span style={{ color: '#0f1a2e', fontSize: 11 }}>zatendestok.com.br · by etc!</span>
        </div>
      </footer>
    </div>
  )
}
