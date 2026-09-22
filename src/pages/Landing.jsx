import React, { useEffect, useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  ArrowRight, MessageCircle, CheckCircle2, TrendingUp, BarChart3,
  Smartphone, Zap, Users, Star, Package, Receipt, Tag, Clock,
  BadgePercent, FileText, ChevronRight, Play, DollarSign, Percent,
  Shield, Award, Repeat, ChevronDown
} from 'lucide-react'
import ZatendeStokLogo, { ZSMark } from '../components/ZatendeStokLogo.jsx'
import { isLoggedIn } from '../utils/auth.js'

const ZAP     = '5515997969303'
const ZAP_MSG = 'Olá! Quero conhecer o ZatendeStok para meu negócio.'
const openWpp = (msg) => window.open(`https://wa.me/${ZAP}?text=${encodeURIComponent(msg || ZAP_MSG)}`, '_blank')

/* ─── data ─────────────────────────────────────────────────── */
const NICHOS = [
  { slug:'mercado',       emoji:'🏪', label:'Mercado',       color:'#f97316', features:['PDV multi-caixa','Estoque FIFO','Promoção 3x2 auto','Fiado digital'] },
  { slug:'padaria',       emoji:'🥖', label:'Padaria',       color:'#d97706', features:['5 pães por R$5,90 auto','Venda por peso','Comanda por mesa','Fiado do cliente'] },
  { slug:'acougue',       emoji:'🥩', label:'Açougue',       color:'#dc2626', features:['Venda por kg balança','Corte especial','Cardápio WhatsApp','Controle de lote'] },
  { slug:'restaurante',   emoji:'🍽️', label:'Restaurante',   color:'#0891b2', features:['Comanda por mesa','Cardápio QR Code','Delivery integrado','Caixa em tempo real'] },
  { slug:'lanchonete',    emoji:'🌯', label:'Lanchonete',    color:'#16a34a', features:['Adicionais automáticos','Fila de pedidos live','Combo desconto auto','WhatsApp pedidos'] },
  { slug:'distribuidora', emoji:'🚚', label:'Distribuidora', color:'#1d4ed8', features:['Venda por caixa/grade','Crédito por cliente','Rota de entrega','Faturamento cliente'] },
]

const FEATURES = [
  { Icon: Package,      label:'PDV / Caixa',       desc:'Venda com leitor de câmera, impressora e multi-caixa'       },
  { Icon: BarChart3,    label:'Estoque FIFO',       desc:'Primeiro a entrar, primeiro a sair — alertas automáticos'   },
  { Icon: Receipt,      label:'Relatórios',         desc:'Faturamento, ticket médio, produtos campeões em PDF/Excel'  },
  { Icon: Clock,        label:'Validade',           desc:'Alerta 7/15/30 dias antes do vencimento por WhatsApp'       },
  { Icon: Users,        label:'Clientes + Fiado',   desc:'Cadastro, histórico, crediário com cobrança automática'     },
  { Icon: Star,         label:'Fidelidade',         desc:'Pontuação, cashback e resgates automáticos via WhatsApp'    },
  { Icon: BadgePercent, label:'Promoções',          desc:'Combo, leve X pague Y, desconto progressivo e relâmpago'    },
  { Icon: MessageCircle,label:'Bot WhatsApp IA',    desc:'Zara — vendedora 24h com memória e fechamento automático'   },
  { Icon: Tag,          label:'Etiquetas',          desc:'Imprime preço com código de barras em lote, sem driver'     },
  { Icon: TrendingUp,   label:'Campanhas',          desc:'Disparo em massa no WhatsApp segmentado por histórico'      },
  { Icon: Smartphone,   label:'100% no celular',    desc:'Sem instalar nada — abre no navegador do seu smartphone'   },
  { Icon: Zap,          label:'Multi-loja',         desc:'Vários PDVs e filiais numa única conta, dados unificados'   },
]

const PLANOS = [
  {
    name:'Essencial', price:'297', period:'/mês', tag:null,
    desc:'Pra sair do papel e ter controle de verdade.',
    items:['1 PDV / caixa','Estoque + FIFO','Validade + alertas','Fiado digital','Relatórios básicos','Suporte WhatsApp'],
    cta:'Começar agora', color:'#f97316',
  },
  {
    name:'Profissional', price:'497', period:'/mês', tag:'MAIS POPULAR ⭐', highlight:true,
    desc:'Pra vender mais, fidelizar cliente e não precisar de funcionário extra.',
    items:['Até 3 PDVs / caixas','Tudo do Essencial','Bot Zara WhatsApp IA','Fidelidade + cashback','Campanhas WhatsApp','Etiquetas em lote','Validade avançada','Suporte prioritário'],
    cta:'Quero o Profissional', color:'#f97316',
  },
  {
    name:'Personalizado', price:'?', period:'', tag:'REDES E ATACADO',
    desc:'PDVs ilimitados, onboarding dedicado e tudo customizado.',
    items:['PDVs e filiais ilimitados','Tudo do Profissional','Onboarding + treinamento','SLA e suporte dedicado','Integrações customizadas','Relatório gerencial avançado'],
    cta:'Falar com consultor', color:'#0891b2',
  },
]

const AFIL_STEPS = [
  { n:'01', color:'#f97316', title:'Cadastra como afiliado',  desc:'Preenche o form em zatendestok.com.br/afiliado — aprovação em até 1 hora.' },
  { n:'02', color:'#fbbf24', title:'Indica e apresenta demo', desc:'Manda o link /demo para o cliente — ele já vê o sistema funcionando na hora.' },
  { n:'03', color:'#22c55e', title:'Cliente fecha, você ganha',desc:'Comissão de R$150 (Essencial) ou R$250 (Profissional) cai no seu PIX.' },
]

const FAQ = [
  { q:'Precisa instalar alguma coisa?', a:'Não. Abre no navegador do celular ou computador. Zero instalação, zero driver, zero configuração.' },
  { q:'Funciona offline?', a:'Sim. O PDV funciona sem internet. Quando a conexão volta, sincroniza automaticamente.' },
  { q:'Posso cancelar quando quiser?', a:'Pode. Não tem contrato, não tem multa. Cancela com um WhatsApp e acabou.' },
  { q:'Quanto tempo demora pra começar?', a:'Em até 2 horas do cadastro você já tem usuário e senha. Ativação no mesmo dia.' },
  { q:'O bot WhatsApp funciona com meu número?', a:'Funciona com qualquer número WhatsApp Business. A gente configura tudo na ativação.' },
]

const TICKER_ITEMS = ['PDV OFFLINE', 'BOT WHATSAPP 24H', 'FIFO AUTOMÁTICO', 'VALIDADE COM ALERTA', 'FIADO DIGITAL', 'FIDELIDADE', 'CAMPANHAS WHATSAPP', 'ETIQUETAS SEM DRIVER', 'MULTI-CAIXA', 'RELATÓRIO PDF', 'ESTOQUE EM TEMPO REAL', 'CANCELA SEM CONTRATO']

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,400;12..96,75..100,700;12..96,75..100,800&family=Inter:wght@400;500;600;700;800;900&display=swap');
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  html { scroll-behavior:smooth; }
  body { font-family:'Inter',sans-serif; background:#09090b; color:#fff; overflow-x:hidden; }

  @keyframes ticker   { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
  @keyframes fadeUp   { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  @keyframes pulse2   { 0%,100%{opacity:.5} 50%{opacity:1} }
  @keyframes bobArrow { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(6px)} }
  @keyframes phoneFloat { 0%,100%{transform:translateY(0) rotate(2deg)} 50%{transform:translateY(-14px) rotate(2deg)} }
  @keyframes revealUp { from{opacity:0;transform:translateY(36px)} to{opacity:1;transform:translateY(0)} }
  @keyframes countIn  { from{opacity:0;transform:scale(.7)} to{opacity:1;transform:scale(1)} }
  @keyframes borderPulse { 0%,100%{border-color:rgba(249,115,22,.15)} 50%{border-color:rgba(249,115,22,.4)} }

  .fu{animation:fadeUp .65s cubic-bezier(.16,1,.3,1) both}
  .d1{animation-delay:.06s}.d2{animation-delay:.14s}.d3{animation-delay:.24s}.d4{animation-delay:.34s}.d5{animation-delay:.44s}
  .ticker-inner{display:flex;width:max-content;animation:ticker 28s linear infinite}
  .hl{transition:transform .2s,opacity .2s}
  .hl:hover{transform:translateY(-3px) !important;opacity:.88}

  .rv { opacity:0; transform:translateY(32px); transition:opacity .7s cubic-bezier(.16,1,.3,1), transform .7s cubic-bezier(.16,1,.3,1); }
  .rv.in { opacity:1; transform:translateY(0); }
  .rv-d1{ transition-delay:.08s }.rv-d2{ transition-delay:.18s }.rv-d3{ transition-delay:.28s }
  .rv-d4{ transition-delay:.38s }.rv-d5{ transition-delay:.48s }.rv-d6{ transition-delay:.58s }

  /* ── Responsive layout ─────────────────────────────── */
  .nav-links   { display:none; }
  .afil-grid   { display:grid; grid-template-columns:1fr; gap:40px; }
  .steps-grid  { display:grid; grid-template-columns:1fr; gap:14px; }
  .hero-cta    { display:flex; flex-direction:column; align-items:stretch; gap:12px; margin-bottom:36px; }
  .section-pad { padding:64px 20px; }
  .footer-row  { flex-direction:column; align-items:flex-start; gap:18px; }
  .feat-list      { display:grid; grid-template-columns:1fr; gap:0; max-width:800px; margin:0 auto; }
  .hero-inner     { text-align:center; flex:1; }
  .hero-label     { justify-content:center; }
  .hero-pills     { justify-content:center; }
  .stats-row      { display:flex; flex-wrap:wrap; justify-content:center; gap:32px 48px; }
  .hero-layout    { display:flex; flex-direction:column; width:100%; max-width:1100px; gap:48px; }
  .hero-col-visual{ display:none; }

  @media(min-width:560px){
    .hero-cta   { flex-direction:row; align-items:center; justify-content:flex-start; }
    .steps-grid { grid-template-columns:repeat(3,1fr); }
    .feat-list  { grid-template-columns:1fr 1fr; column-gap:48px; }
  }
  @media(min-width:700px){
    .hero-inner     { text-align:left; }
    .hero-label     { justify-content:flex-start; }
    .hero-pills     { justify-content:flex-start; }
    .hero-layout    { flex-direction:row; align-items:center; }
    .hero-col-visual{ display:flex; flex-direction:column; align-items:center; flex-shrink:0; }
  }
  @media(min-width:768px){
    .nav-links  { display:flex; }
    .afil-grid  { grid-template-columns:1fr 1fr; gap:60px; }
    .section-pad{ padding:100px 24px; }
    .footer-row { flex-direction:row; align-items:center; }
  }
`

/* ─── PDV Mockup ──────────────────────────────────────────── */
const PDVMock = () => (
  <div style={{ width:234, background:'#0f0f0f', borderRadius:36, border:'5px solid #1c1c1c', boxShadow:'0 40px 80px rgba(0,0,0,.75), 0 0 0 1px rgba(255,255,255,.04)', padding:'14px 12px 18px', userSelect:'none' }}>
    <div style={{ width:48, height:4, borderRadius:2, background:'#2a2a2a', margin:'0 auto 12px' }}/>
    {/* app bar */}
    <div style={{ background:'#f97316', borderRadius:10, padding:'8px 10px', marginBottom:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
      <div>
        <div style={{ fontSize:10, fontWeight:900, color:'#fff' }}>🏪 Mercado Teste</div>
        <div style={{ fontSize:7.5, color:'rgba(255,255,255,.75)', marginTop:1 }}>Caixa 01 · Aberto</div>
      </div>
      <div style={{ fontSize:8, background:'rgba(0,0,0,.2)', borderRadius:5, padding:'3px 6px', color:'#fff', fontWeight:700 }}>PDV</div>
    </div>
    {/* search bar */}
    <div style={{ background:'#1a1a1a', borderRadius:7, padding:'6px 8px', marginBottom:8, fontSize:8.5, color:'rgba(255,255,255,.2)', display:'flex', alignItems:'center', gap:5 }}>
      <span>🔍</span> Buscar produto...
    </div>
    {/* items */}
    {[
      { n:'Arroz 5kg',   q:'×1', v:'R$28,90' },
      { n:'Feijão 1kg',  q:'×2', v:'R$9,90'  },
      { n:'Leite caixa', q:'×3', v:'R$4,50'  },
      { n:'Óleo 900ml',  q:'×1', v:'R$7,40'  },
    ].map(i => (
      <div key={i.n} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 4px', borderBottom:'1px solid rgba(255,255,255,.05)' }}>
        <div>
          <div style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,.82)' }}>{i.n}</div>
          <div style={{ fontSize:7.5, color:'rgba(255,255,255,.25)' }}>{i.q}</div>
        </div>
        <div style={{ fontSize:9.5, fontWeight:800, color:'#f97316' }}>{i.v}</div>
      </div>
    ))}
    {/* total */}
    <div style={{ margin:'8px 4px 0', paddingTop:8, borderTop:'1px solid rgba(249,115,22,.2)', display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
      <div>
        <div style={{ fontSize:7.5, color:'rgba(255,255,255,.28)', fontWeight:700, letterSpacing:'.08em' }}>TOTAL</div>
        <div style={{ fontSize:22, fontWeight:900, color:'#fff', lineHeight:1.1 }}>R$50,70</div>
      </div>
      <div style={{ textAlign:'right' }}>
        <div style={{ fontSize:7.5, color:'rgba(255,255,255,.28)', fontWeight:600 }}>4 itens</div>
        <div style={{ fontSize:7.5, color:'rgba(249,115,22,.6)', fontWeight:700, marginTop:1 }}>● OFFLINE OK</div>
      </div>
    </div>
    {/* CTA */}
    <div style={{ margin:'8px 4px 0', background:'#f97316', borderRadius:8, padding:'10px 0', textAlign:'center', cursor:'pointer' }}>
      <div style={{ fontSize:9.5, fontWeight:900, color:'#fff', letterSpacing:'.06em' }}>FINALIZAR VENDA</div>
    </div>
    {/* home indicator */}
    <div style={{ width:52, height:3, borderRadius:2, background:'rgba(255,255,255,.15)', margin:'12px auto 0' }}/>
  </div>
)

/* ══════════════════════════════════════════════════════════ */
export default function Landing() {
  const navigate = useNavigate()
  const [vis, setVis]       = useState(false)
  const [openFaq, setOpenFaq] = useState(null)
  const [afil, setAfil]     = useState(4)
  const comissao             = afil * 200

  useEffect(() => {
    if (isLoggedIn()) { navigate('/dashboard', { replace: true }); return }
    const t = setTimeout(() => setVis(true), 60)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const io = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in') }),
      { threshold: 0.12 }
    )
    document.querySelectorAll('.rv').forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <div style={{ fontFamily:"'Inter',sans-serif", background:'#09090b', color:'#fff', overflowX:'hidden' }}>
      <style>{CSS}</style>

      {/* ══ NAV ═══════════════════════════════════════════ */}
      <nav style={{ position:'sticky', top:0, zIndex:50, background:'rgba(9,9,11,0.9)', backdropFilter:'blur(16px)', borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'0 24px', height:60, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <ZatendeStokLogo variant="wordmark" />
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <div className="nav-links" style={{ gap:8, alignItems:'center' }}>
            <Link to="/demo"     style={{ color:'rgba(255,255,255,.5)', fontSize:13, fontWeight:600, padding:'7px 12px', borderRadius:8, textDecoration:'none' }}>Demos</Link>
            <Link to="/afiliado" style={{ color:'rgba(255,255,255,.5)', fontSize:13, fontWeight:600, padding:'7px 12px', borderRadius:8, textDecoration:'none' }}>Afiliados</Link>
            <button onClick={() => navigate('/login')} style={{ padding:'8px 18px', borderRadius:8, border:'1px solid rgba(255,255,255,.1)', background:'rgba(255,255,255,.04)', color:'rgba(255,255,255,.7)', fontSize:13, fontWeight:700, cursor:'pointer' }}>Entrar</button>
          </div>
          <button onClick={() => openWpp()} style={{ padding:'8px 16px', borderRadius:8, border:'none', background:'#f97316', color:'#fff', fontSize:13, fontWeight:800, cursor:'pointer', boxShadow:'0 2px 12px rgba(249,115,22,.4)', whiteSpace:'nowrap' }}>
            <span className="nav-links" style={{ gap:0 }}>Falar no </span>WhatsApp
          </button>
        </div>
      </nav>

      {/* ══ HERO ══════════════════════════════════════════ */}
      <section style={{ minHeight:'100dvh', display:'flex', alignItems:'flex-start', padding:'max(110px,14vh) 24px 80px', position:'relative', overflow:'hidden' }}>

        <div className="hero-layout">
          {/* ── coluna texto ── */}
          <div className="hero-inner">
            <div className={`fu d1 hero-label ${vis?'':'opacity-0'}`} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:24 }}>
              <div style={{ width:28, height:2, background:'#f97316', borderRadius:1, flexShrink:0 }}/>
              <span style={{ fontSize:11, fontWeight:700, letterSpacing:'.13em', textTransform:'uppercase', color:'rgba(255,255,255,.32)' }}>PDV · Estoque · Bot WhatsApp · Fidelidade</span>
            </div>

            <h1 className={`fu d2 ${vis?'':'opacity-0'}`} style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:'clamp(46px,7vw,88px)', fontWeight:800, lineHeight:.92, letterSpacing:'-.02em', marginBottom:24 }}>
              <span style={{ display:'block', color:'#fff' }}>Gestão que</span>
              <span style={{ display:'block', color:'#f97316' }}>qualquer negócio</span>
              <span style={{ display:'block', color:'rgba(255,255,255,.6)' }}>pode pagar.</span>
            </h1>

            <p className={`fu d3 ${vis?'':'opacity-0'}`} style={{ fontSize:15.5, color:'rgba(255,255,255,.4)', lineHeight:1.75, maxWidth:420, marginBottom:32 }}>
              Do caixa ao WhatsApp, tudo numa tela — no celular, sem instalar nada.
              A partir de <strong style={{ color:'#f97316', fontWeight:800 }}>R$297/mês</strong>, sem contrato.
            </p>

            <div className={`fu d4 hero-cta ${vis?'':'opacity-0'}`}>
              <button onClick={() => openWpp()} style={{ display:'flex', alignItems:'center', gap:9, padding:'13px 26px', borderRadius:9, border:'none', cursor:'pointer', background:'#f97316', color:'#fff', fontSize:14.5, fontWeight:800, letterSpacing:'-.01em' }}>
                <MessageCircle size={16}/> Falar no WhatsApp
              </button>
              <Link to="/demo" style={{ display:'flex', alignItems:'center', padding:'13px 20px', borderRadius:9, border:'1px solid rgba(255,255,255,.12)', color:'rgba(255,255,255,.6)', fontSize:14, fontWeight:700, textDecoration:'none', transition:'border-color .2s,color .2s' }}>
                Ver o sistema →
              </Link>
            </div>

            <div className={`fu d5 hero-pills ${vis?'':'opacity-0'}`} style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {NICHOS.map(n => (
                <Link key={n.slug} to={`/demo/${n.slug}`} className="hl"
                  style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 11px', borderRadius:999, border:`1px solid ${n.color}25`, background:`${n.color}0b`, color:n.color, fontSize:11.5, fontWeight:700, textDecoration:'none' }}>
                  {n.emoji} {n.label}
                </Link>
              ))}
            </div>
          </div>

          {/* ── coluna visual (desktop) ── */}
          <div className="hero-col-visual">
            <div style={{ animation:'phoneFloat 4.5s ease-in-out infinite', filter:'drop-shadow(0 32px 48px rgba(249,115,22,.18))' }}>
              <PDVMock />
            </div>
          </div>
        </div>

        <div style={{ position:'absolute', bottom:20, left:'50%', animation:'bobArrow 2.2s ease infinite', opacity:.18 }}><ChevronDown size={20} color="#fff"/></div>
      </section>

      {/* ══ TICKER ════════════════════════════════════════ */}
      <div style={{ background:'#f97316', padding:'12px 0', overflow:'hidden' }}>
        <div className="ticker-inner">
          {[...TICKER_ITEMS,...TICKER_ITEMS].map((t,i) => (
            <span key={i} style={{ whiteSpace:'nowrap', padding:'0 24px', fontSize:11.5, fontWeight:900, letterSpacing:'.15em', color:'rgba(255,255,255,.9)', display:'inline-flex', alignItems:'center', gap:10 }}>
              <span>✦</span> {t}
            </span>
          ))}
        </div>
      </div>

      {/* ══ NÚMEROS ═══════════════════════════════════════ */}
      <section style={{ padding:'52px 24px', borderBottom:'1px solid rgba(255,255,255,.06)' }}>
        <div className="stats-row" style={{ maxWidth:900, margin:'0 auto' }}>
          {[
            { n:'6',      l:'segmentos atendidos', d:'rv rv-d1' },
            { n:'12',     l:'módulos integrados',  d:'rv rv-d2' },
            { n:'R$297',  l:'por mês, sem contrato', d:'rv rv-d3' },
            { n:'2h',     l:'pra ativar e começar',  d:'rv rv-d4' },
          ].map(s => (
            <div key={s.l} className={s.d} style={{ textAlign:'center' }}>
              <div style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:40, fontWeight:800, color:'#f97316', lineHeight:1, letterSpacing:'-.02em' }}>{s.n}</div>
              <div style={{ fontSize:11.5, color:'rgba(255,255,255,.35)', marginTop:6, fontWeight:600, textTransform:'uppercase', letterSpacing:'.07em' }}>{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ DEMOS POR NICHO ═══════════════════════════════ */}
      <section style={{ padding:'100px 24px', maxWidth:1100, margin:'0 auto' }}>
        <div className="rv" style={{ textAlign:'center', marginBottom:52 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:18 }}>
            <div style={{ width:24, height:2, background:'#f97316', borderRadius:1 }}/>
            <span style={{ fontSize:11, fontWeight:700, letterSpacing:'.14em', textTransform:'uppercase', color:'rgba(255,255,255,.3)' }}>Demos ao vivo</span>
            <div style={{ width:24, height:2, background:'#f97316', borderRadius:1 }}/>
          </div>
          <h2 style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:'clamp(30px,5vw,50px)', fontWeight:800, letterSpacing:'-.02em', lineHeight:1.05, marginBottom:14 }}>
            Clica e vê como fica<br/><span style={{ color:'#f97316' }}>pro seu negócio.</span>
          </h2>
          <p style={{ color:'rgba(255,255,255,.32)', fontSize:15, maxWidth:480, margin:'0 auto' }}>PDV funcionando, promoção automática, checkout. Sem login, sem cadastro.</p>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:16 }}>
          {NICHOS.map((n, i) => (
            <Link key={n.slug} to={`/demo/${n.slug}`} className={`hl rv rv-d${Math.min(i+1,6)}`}
              style={{ display:'block', background:'rgba(255,255,255,0.03)', border:`1px solid ${n.color}22`, borderRadius:20, padding:24, textDecoration:'none', position:'relative', overflow:'hidden' }}>
              <div style={{ fontSize:38, marginBottom:12, lineHeight:1 }}>{n.emoji}</div>
              <div style={{ fontWeight:900, fontSize:17, color:'#fff', marginBottom:3 }}>{n.label}</div>
              <div style={{ fontSize:10, fontWeight:700, color:n.color, marginBottom:14, textTransform:'uppercase', letterSpacing:'.08em' }}>DEMO GRATUITO</div>
              <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:16 }}>
                {n.features.map((f,i) => (
                  <div key={i} style={{ fontSize:12, color:'rgba(255,255,255,.45)', display:'flex', alignItems:'center', gap:6 }}>
                    <CheckCircle2 size={11} color={n.color}/> {f}
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:13, fontWeight:700, color:n.color }}>Abrir demo <ArrowRight size={13}/></div>
              <div style={{ position:'absolute', bottom:0, left:0, right:0, height:2, background:n.color, opacity:.35 }}/>
            </Link>
          ))}
        </div>
      </section>

      {/* ══ FEATURES ══════════════════════════════════════ */}
      <section style={{ padding:'80px 24px', background:'rgba(255,255,255,0.018)', borderTop:'1px solid rgba(255,255,255,0.05)', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:48 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:18 }}>
              <div style={{ width:24, height:2, background:'#f97316', borderRadius:1 }}/>
              <span style={{ fontSize:11, fontWeight:800, letterSpacing:'.14em', textTransform:'uppercase', color:'rgba(255,255,255,.35)' }}>O que vem incluso</span>
              <div style={{ width:24, height:2, background:'#f97316', borderRadius:1 }}/>
            </div>
            <h2 style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:'clamp(26px,4vw,46px)', fontWeight:800, letterSpacing:'-.02em', marginBottom:10 }}>
              Do R$297 vem <span style={{ color:'#f97316' }}>tudo isso.</span>
            </h2>
            <p style={{ color:'rgba(255,255,255,.35)', fontSize:14 }}>12 módulos. Uma mensalidade. Cancela quando quiser.</p>
          </div>
          <div className="feat-list">
            {FEATURES.map(({ label, desc }) => (
              <div key={label} style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'14px 0', borderBottom:'1px solid rgba(255,255,255,.05)' }}>
                <div style={{ width:20, height:20, borderRadius:5, background:'rgba(249,115,22,.1)', border:'1px solid rgba(249,115,22,.22)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:2 }}>
                  <svg width="10" height="8" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="#f97316" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <div>
                  <div style={{ fontWeight:800, fontSize:14, color:'rgba(255,255,255,.85)', lineHeight:1.3 }}>{label}</div>
                  <div style={{ fontSize:12, color:'rgba(255,255,255,.3)', marginTop:2, lineHeight:1.5 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ PLANOS ════════════════════════════════════════ */}
      <section style={{ padding:'100px 24px', maxWidth:1000, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:52 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:18 }}>
            <div style={{ width:24, height:2, background:'#f97316', borderRadius:1 }}/>
            <span style={{ fontSize:11, fontWeight:800, letterSpacing:'.14em', textTransform:'uppercase', color:'rgba(255,255,255,.35)' }}>Planos e preços</span>
            <div style={{ width:24, height:2, background:'#f97316', borderRadius:1 }}/>
          </div>
                      <h2 style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:'clamp(28px,4.5vw,50px)', fontWeight:800, letterSpacing:'-.02em', marginBottom:10 }}>
            Sem enrolação.<br/><span style={{ color:'#f97316' }}>Escolhe e começa hoje.</span>
          </h2>
          <p style={{ color:'rgba(255,255,255,.35)', fontSize:15 }}>Sem contrato. Sem taxa de adesão. Sem pegadinha.</p>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:20, alignItems:'start' }}>
          {PLANOS.map(p => (
            <div key={p.name} style={{ background:p.highlight ? 'linear-gradient(160deg,rgba(249,115,22,.12),rgba(249,115,22,.03))' : 'rgba(255,255,255,0.03)', border:`1px solid ${p.highlight ? 'rgba(249,115,22,.4)' : 'rgba(255,255,255,.07)'}`, borderRadius:24, padding:'30px 26px', position:'relative', overflow:'hidden' }}>
              {p.highlight && <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'linear-gradient(90deg,#f97316,#fbbf24)' }}/>}
              {p.tag && <div style={{ display:'inline-block', background:`${p.color}1a`, border:`1px solid ${p.color}40`, borderRadius:999, padding:'3px 10px', fontSize:10, fontWeight:800, letterSpacing:'.08em', color:p.color, marginBottom:14 }}>{p.tag}</div>}
              <div style={{ fontWeight:900, fontSize:20, color:'#fff', marginBottom:6 }}>{p.name}</div>
              <div style={{ display:'flex', alignItems:'baseline', gap:4, marginBottom:8 }}>
                {p.price !== '?' ? <><span style={{ fontSize:12, color:'rgba(255,255,255,.3)', fontWeight:700 }}>R$</span><span style={{ fontSize:46, fontWeight:900, color:'#fff', lineHeight:1 }}>{p.price}</span><span style={{ color:'rgba(255,255,255,.35)', fontSize:13 }}>{p.period}</span></> : <span style={{ fontSize:26, fontWeight:900, color:'#fff' }}>Sob consulta</span>}
              </div>
              <div style={{ fontSize:13, color:'rgba(255,255,255,.38)', marginBottom:22, lineHeight:1.55 }}>{p.desc}</div>
              <div style={{ display:'flex', flexDirection:'column', gap:9, marginBottom:26 }}>
                {p.items.map(item => (
                  <div key={item} style={{ display:'flex', gap:9, alignItems:'flex-start', fontSize:13, color:'rgba(255,255,255,.7)' }}>
                    <CheckCircle2 size={13} color={p.color} style={{ marginTop:1, flexShrink:0 }}/> {item}
                  </div>
                ))}
              </div>
              <button onClick={() => openWpp(`Olá! Tenho interesse no plano ${p.name} do ZatendeStok.`)}
                style={{ width:'100%', padding:'13px', borderRadius:12, border:'none', cursor:'pointer', background:p.color, color:'#fff', fontSize:14, fontWeight:800, boxShadow:`0 4px 14px ${p.color}40` }}>
                {p.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ══ AFILIADOS ═════════════════════════════════════ */}
      <section style={{ padding:'100px 24px', background:'linear-gradient(160deg,rgba(124,58,237,.07),rgba(249,115,22,.04))', borderTop:'1px solid rgba(255,255,255,0.05)', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
        <div className="afil-grid" style={{ maxWidth:1000, margin:'0 auto', alignItems:'start' }}>
          <div>
            <span style={{ display:'inline-block', background:'rgba(124,58,237,.12)', border:'1px solid rgba(124,58,237,.25)', borderRadius:999, padding:'4px 14px', fontSize:11, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:'#a78bfa', marginBottom:20 }}>PROGRAMA DE AFILIADOS</span>
            <h2 style={{ fontSize:'clamp(28px,4vw,46px)', fontWeight:900, letterSpacing:'-.03em', lineHeight:1.08, marginBottom:18 }}>
              Venda o ZatendeStok.<br/><span style={{ background:'linear-gradient(90deg,#f97316,#fbbf24)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Fature por fora.</span>
            </h2>
            <p style={{ color:'rgba(255,255,255,.45)', fontSize:15, lineHeight:1.8, marginBottom:28 }}>
              Indica um cliente, ele assina, você ganha.<br/>
              <strong style={{ color:'#fff' }}>R$150</strong> por Essencial ou <strong style={{ color:'#f97316' }}>R$250</strong> por Profissional.<br/>
              PIX na hora. Sem limite de indicações.
            </p>
            <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:18, padding:'22px 24px', marginBottom:24 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,.4)', marginBottom:12, letterSpacing:'.06em' }}>SIMULADOR DE GANHOS</div>
              <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:14 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,.35)', marginBottom:6 }}>Vendas por mês: <strong style={{ color:'#fff' }}>{afil}</strong></div>
                  <input type="range" min={1} max={20} value={afil} onChange={e => setAfil(+e.target.value)} style={{ width:'100%', accentColor:'#f97316', cursor:'pointer' }}/>
                </div>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'rgba(249,115,22,0.1)', border:'1px solid rgba(249,115,22,0.15)', borderRadius:12, padding:'14px 18px' }}>
                <span style={{ fontSize:13, color:'rgba(255,255,255,.55)', fontWeight:600 }}>Comissão estimada/mês</span>
                <span style={{ fontSize:26, fontWeight:900, color:'#f97316' }}>R${comissao.toLocaleString('pt-BR')}</span>
              </div>
            </div>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              <Link to="/afiliado" style={{ display:'flex', alignItems:'center', gap:8, padding:'13px 22px', borderRadius:11, border:'none', cursor:'pointer', background:'#f97316', color:'#fff', fontSize:14, fontWeight:800, textDecoration:'none', boxShadow:'0 4px 18px rgba(249,115,22,.4)' }}>
                Quero ser afiliado <ArrowRight size={14}/>
              </Link>
              <button onClick={() => openWpp('Oi! Quero saber mais sobre o programa de afiliados do ZatendeStok.')} style={{ display:'flex', alignItems:'center', gap:7, padding:'13px 18px', borderRadius:11, border:'1px solid rgba(255,255,255,.1)', background:'rgba(255,255,255,.04)', color:'rgba(255,255,255,.65)', fontSize:14, fontWeight:700, cursor:'pointer' }}>
                <MessageCircle size={14}/> Tirar dúvidas
              </button>
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,.3)', letterSpacing:'.1em', textTransform:'uppercase', marginBottom:4 }}>COMO FUNCIONA</div>
            {AFIL_STEPS.map(s => (
              <div key={s.n} style={{ display:'flex', gap:16, padding:'20px 20px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:18 }}>
                <div style={{ fontWeight:900, fontSize:30, color:s.color, lineHeight:1, flexShrink:0, opacity:.65 }}>{s.n}</div>
                <div>
                  <div style={{ fontWeight:800, fontSize:14, color:'#fff', marginBottom:4 }}>{s.title}</div>
                  <div style={{ fontSize:12.5, color:'rgba(255,255,255,.4)', lineHeight:1.6 }}>{s.desc}</div>
                </div>
              </div>
            ))}
            <div style={{ display:'flex', gap:14, padding:'16px 20px', background:'rgba(34,197,94,0.07)', border:'1px solid rgba(34,197,94,0.18)', borderRadius:16 }}>
              <Shield size={20} color="#22c55e" style={{ flexShrink:0, marginTop:2 }}/>
              <div style={{ fontSize:12.5, color:'rgba(255,255,255,.5)', lineHeight:1.65 }}>
                <strong style={{ color:'#22c55e' }}>Sem risco.</strong> Você só indica — a gente fecha, cobra, dá suporte e paga sua comissão no PIX.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ COMO COMEÇA ═══════════════════════════════════ */}
      <section style={{ padding:'90px 24px', maxWidth:860, margin:'0 auto', textAlign:'center' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:18 }}>
          <div style={{ width:24, height:2, background:'#f97316', borderRadius:1 }}/>
          <span style={{ fontSize:11, fontWeight:800, letterSpacing:'.14em', textTransform:'uppercase', color:'rgba(255,255,255,.35)' }}>Como começa</span>
          <div style={{ width:24, height:2, background:'#f97316', borderRadius:1 }}/>
        </div>
        <h2 style={{ fontSize:'clamp(26px,4vw,44px)', fontWeight:900, letterSpacing:'-.03em', marginBottom:10 }}>
          Ativa hoje, tá rodando <span style={{ color:'#f97316' }}>em 2 horas.</span>
        </h2>
        <p style={{ color:'rgba(255,255,255,.35)', fontSize:15, marginBottom:48 }}>Zero instalação. Zero técnico. Zero dor de cabeça.</p>
        <div className="steps-grid">
          {[
            { n:'01', color:'#f97316', title:'Solicita acesso',    desc:'Preenche o form ou manda WhatsApp — aprovamos em até 2h.' },
            { n:'02', color:'#fbbf24', title:'Recebe as credenciais', desc:'Usuário e senha. Abre no celular, sem instalar nada.' },
            { n:'03', color:'#22c55e', title:'Começa a vender',    desc:'Cadastra os produtos e o estoque começa a trabalhar por você.' },
          ].map(s => (
            <div key={s.n} style={{ padding:'26px 22px', background:'rgba(255,255,255,0.028)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:20 }}>
              <div style={{ fontSize:40, fontWeight:900, color:s.color, opacity:.5, marginBottom:14, lineHeight:1 }}>{s.n}</div>
              <div style={{ fontWeight:800, fontSize:15, color:'#fff', marginBottom:7 }}>{s.title}</div>
              <div style={{ fontSize:13, color:'rgba(255,255,255,.38)', lineHeight:1.6 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ FAQ ═══════════════════════════════════════════ */}
      <section style={{ padding:'72px 24px', maxWidth:680, margin:'0 auto' }}>
        <h2 style={{ fontSize:34, fontWeight:900, letterSpacing:'-.02em', textAlign:'center', marginBottom:36 }}>
          Perguntas <span style={{ color:'#f97316' }}>frequentes</span>
        </h2>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {FAQ.map((f,i) => (
            <div key={i} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, overflow:'hidden' }}>
              <button onClick={() => setOpenFaq(openFaq===i ? null : i)}
                style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 20px', background:'none', border:'none', cursor:'pointer', color:'#fff', fontSize:14, fontWeight:700, textAlign:'left', gap:12 }}>
                {f.q}
                <ChevronDown size={15} color="rgba(255,255,255,.4)" style={{ flexShrink:0, transform:openFaq===i?'rotate(180deg)':'none', transition:'transform .2s' }}/>
              </button>
              {openFaq===i && <div style={{ padding:'0 20px 16px', fontSize:13.5, color:'rgba(255,255,255,.45)', lineHeight:1.7 }}>{f.a}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* ══ CTA FINAL ═════════════════════════════════════ */}
      <section style={{ padding:'80px 24px 100px', textAlign:'center' }}>
        <div style={{ maxWidth:580, margin:'0 auto' }}>
          <div style={{ display:'flex', justifyContent:'center', marginBottom:22 }}><ZSMark size={54}/></div>
          <h2 style={{ fontSize:'clamp(26px,4.5vw,46px)', fontWeight:900, letterSpacing:'-.03em', marginBottom:14 }}>
            Chega de controle no papel.<br/><span style={{ color:'#f97316' }}>Começa hoje.</span>
          </h2>
          <p style={{ color:'rgba(255,255,255,.38)', fontSize:15, marginBottom:32 }}>A Zara responde em segundos — 24h por dia, 7 dias por semana.</p>
          <button onClick={() => openWpp()} style={{ display:'inline-flex', alignItems:'center', gap:12, padding:'17px 34px', borderRadius:14, border:'none', cursor:'pointer', background:'#f97316', color:'#fff', fontSize:17, fontWeight:900, animation:'glow 3s ease infinite' }}>
            <MessageCircle size={22}/> Falar com a Zara no WhatsApp
          </button>
          <div style={{ marginTop:14, fontSize:11.5, color:'rgba(255,255,255,.2)' }}>Resposta em menos de 30 segundos · 24 horas por dia</div>
        </div>
      </section>

      {/* ══ FOOTER ════════════════════════════════════════ */}
      <footer className="footer-row" style={{ borderTop:'1px solid rgba(255,255,255,0.06)', padding:'26px 24px', display:'flex', justifyContent:'space-between' }}>
        <ZatendeStokLogo variant="wordmark"/>
        <div style={{ display:'flex', gap:18, alignItems:'center' }}>
          <Link to="/demo"     style={{ color:'rgba(255,255,255,.3)', fontSize:12, fontWeight:600, textDecoration:'none' }}>Demos</Link>
          <Link to="/afiliado" style={{ color:'rgba(255,255,255,.3)', fontSize:12, fontWeight:600, textDecoration:'none' }}>Afiliados</Link>
          <Link to="/guia"     style={{ color:'rgba(255,255,255,.3)', fontSize:12, fontWeight:600, textDecoration:'none' }}>Guia</Link>
          <button onClick={() => navigate('/login')} style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,.3)', fontSize:12, fontWeight:600 }}>Entrar</button>
        </div>
        <span style={{ color:'rgba(255,255,255,.18)', fontSize:11 }}>zatendestok.com.br</span>
      </footer>
    </div>
  )
}

