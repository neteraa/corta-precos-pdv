import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, MessageCircle, ChevronDown, CheckCircle2, AlertTriangle, TrendingUp, ClipboardList, BarChart3, Truck, Smartphone, ShieldCheck } from 'lucide-react'
import ZatendeStokLogo from '../components/ZatendeStokLogo.jsx'
import { isLoggedIn } from '../utils/auth.js'

const ZAP     = '5515997969303'
const ZAP_MSG = 'Olá! Quero conhecer o ZatendeStok para meu mercado.'
const openWpp = (msg) => window.open(`https://wa.me/${ZAP}?text=${encodeURIComponent(msg || ZAP_MSG)}`, '_blank')

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700;800;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body { font-family: 'Inter', sans-serif; background: #fff; }
  @keyframes fadeUp  { from{opacity:0;transform:translateY(32px)} to{opacity:1;transform:translateY(0)} }
  @keyframes pulse   { 0%,100%{opacity:.6} 50%{opacity:1} }
  @keyframes ticker  { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
  @keyframes bob     { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(7px)} }
  @keyframes float   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
  .fade-in { animation: fadeUp .8s ease both; }
  .d1 { animation-delay: .1s; }
  .d2 { animation-delay: .22s; }
  .d3 { animation-delay: .34s; }
  .d4 { animation-delay: .46s; }
  .hover-lift { transition: transform .2s, box-shadow .2s; }
  .hover-lift:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(0,0,0,.12) !important; }
  .btn-wpp { transition: all .2s; }
  .btn-wpp:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(34,197,94,.4) !important; }
  .btn-outline:hover { background: #0f172a !important; color: #fff !important; }
  nav a, nav button { text-decoration: none; }
`

/* ─── DIFERENCIAIS ─── */
const DIFS = [
  {
    icon: AlertTriangle,
    color: '#f59e0b',
    bg: '#fffbeb',
    border: '#fde68a',
    tag: 'Ruptura zero',
    title: 'Saiba antes de faltar, não depois.',
    body: 'O sistema monitora o giro de cada produto e dispara um alerta quando está chegando na hora de repor — com base no seu histórico real de vendas, não em chute. Acaba a falta de arroz na sexta à tarde.',
  },
  {
    icon: ClipboardList,
    color: '#5462D8',
    bg: '#eef2ff',
    border: '#c7d2fe',
    tag: 'FIFO Automático',
    title: 'Primeiro que entra, primeiro que sai.',
    body: 'O ZatendeStok organiza seu estoque no padrão FIFO: os lotes mais antigos aparecem na frente para venda. Menos produto vencendo, menos prejuízo. Funciona para frios, secos, limpeza — qualquer categoria.',
  },
  {
    icon: AlertTriangle,
    color: '#ef4444',
    bg: '#fef2f2',
    border: '#fecaca',
    tag: 'Controle de validade',
    title: 'Produto vencendo é dinheiro jogado fora.',
    body: 'Receba alertas automáticos quando um produto está a 7, 15 ou 30 dias do vencimento. Aja a tempo: promoção, devolução ou retirada. Chega de encontrar caixa de produto vencido no fundo do estoque.',
  },
  {
    icon: Truck,
    color: '#22c55e',
    bg: '#f0fdf4',
    border: '#bbf7d0',
    tag: 'Pedido automático',
    title: 'Reposição com um clique, sem ligação.',
    body: 'Conecte seu mercado ao distribuidor parceiro e faça pedidos diretamente pelo sistema — sem ligar, sem mandar áudio, sem WhatsApp manual. O pedido vai formatado, com quantidade certa e histórico de compras.',
  },
  {
    icon: BarChart3,
    color: '#8b5cf6',
    bg: '#f5f3ff',
    border: '#ddd6fe',
    tag: 'PDV integrado',
    title: 'Frente de caixa que atualiza o estoque na hora.',
    body: 'Cada venda no PDV já abate do estoque em tempo real. Sem lançamento manual, sem conferência de planilha no fim do dia. Você sabe exatamente quanto tem de cada produto agora — não ontem.',
  },
  {
    icon: Smartphone,
    color: '#0ea5e9',
    bg: '#f0f9ff',
    border: '#bae6fd',
    tag: '100% no celular',
    title: 'Gerencia o mercado de qualquer lugar.',
    body: 'Está em casa, no banco ou viajando? Acessa o estoque, aprova pedidos e vê o movimento do caixa direto no celular. Sem instalar app, sem versão diferente — a mesma tela do computador no seu smartphone.',
  },
]

/* ─── PERSONAS ─── */
const PERSONAS = [
  {
    emoji: '🏘️',
    tipo: 'Mercearia de bairro',
    desc: 'Você conhece cada cliente pelo nome, mas não tem como lembrar de tudo que entra e sai. O ZatendeStok faz esse controle por você — sem complicação, sem treinamento longo.',
    items: ['Controle de fiado digital', 'Alertas de estoque mínimo', 'PDV simples para funcionários', 'Relatório de produtos mais vendidos'],
  },
  {
    emoji: '🏪',
    tipo: 'Mercado de médio porte',
    desc: 'Você já tem movimento, já tem funcionários — e precisa de visibilidade real sobre o estoque antes que a ruptura vire rotina. FIFO, validade e reposição automática resolvem isso.',
    items: ['FIFO por lote e data de validade', 'Multi-caixa com PDV em rede', 'Pedido automático ao distribuidor', 'Painel gerencial com métricas'],
  },
  {
    emoji: '🏗️',
    tipo: 'Atacarejo e armazém',
    desc: 'Volume grande, margem apertada, giro alto. Qualquer produto encalhado ou vencimento perdido sangra o resultado. O sistema foi feito para quem não pode se dar ao luxo de perder.',
    items: ['Gestão de grandes volumes FIFO', 'Múltiplos distribuidores conectados', 'Alertas de validade em lote', 'Relatórios de giro por categoria'],
  },
]

/* ─── COMO FUNCIONA ─── */
const STEPS = [
  { n:'01', color:'#5462D8', title:'Solicita o acesso', desc:'Preenche o formulário com o nome do seu mercado. Nossa equipe recebe e configura tudo.' },
  { n:'02', color:'#22c55e', title:'Recebe as credenciais', desc:'Em até 2 horas você tem usuário e senha. Sem instalação, abre no navegador do celular.' },
  { n:'03', color:'#f59e0b', title:'Começa a gerenciar', desc:'Cadastra os produtos, conecta o distribuidor e o estoque começa a trabalhar por você.' },
]

/* ══════════════════════════════════════════════════════════ */
export default function Landing() {
  const navigate = useNavigate()
  const [vis, setVis] = useState(false)

  useEffect(() => {
    if (isLoggedIn()) { navigate('/dashboard', { replace: true }); return }
    const t = setTimeout(() => setVis(true), 60)
    return () => clearTimeout(t)
  }, [])

  return (
    <div style={{ fontFamily:"'Inter',sans-serif", background:'#fff', color:'#0f172a' }}>
      <style>{CSS}</style>

      {/* ══ NAV ══════════════════════════════════════════════ */}
      <nav style={{ position:'sticky', top:0, zIndex:50, background:'rgba(255,255,255,.92)', backdropFilter:'blur(12px)', borderBottom:'1px solid #f1f5f9', padding:'0 32px', height:64, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <ZatendeStokLogo variant="wordmark" />
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <a href="/guia" style={{ color:'#64748b', fontSize:13, fontWeight:600, padding:'8px 14px', borderRadius:8 }}>Guia</a>
          <button onClick={() => navigate('/login')} style={{ padding:'9px 20px', borderRadius:9, border:'1px solid #e2e8f0', background:'#fff', color:'#0f172a', fontSize:13, fontWeight:700, cursor:'pointer' }} className="btn-outline">
            Entrar
          </button>
          <button onClick={() => navigate('/login?tab=cadastro')} style={{ padding:'9px 20px', borderRadius:9, border:'none', background:'#5462D8', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', boxShadow:'0 2px 10px rgba(84,98,216,.3)' }}>
            Quero participar
          </button>
        </div>
      </nav>

      {/* ══ HERO ═════════════════════════════════════════════ */}
      <section style={{ background:'linear-gradient(160deg,#0f172a 0%,#1e1b4b 55%,#1e3a8a 100%)', minHeight:'100dvh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 24px 60px', textAlign:'center', position:'relative', overflow:'hidden' }}>
        {/* decorative blobs */}
        <div aria-hidden style={{ position:'absolute', top:'-10%', right:'-5%', width:500, height:500, borderRadius:'50%', background:'rgba(84,98,216,.2)', filter:'blur(80px)', pointerEvents:'none' }} />
        <div aria-hidden style={{ position:'absolute', bottom:'-5%', left:'-5%', width:400, height:400, borderRadius:'50%', background:'rgba(34,197,94,.12)', filter:'blur(70px)', pointerEvents:'none' }} />
        <div aria-hidden style={{ position:'absolute', inset:0, backgroundImage:'radial-gradient(circle,rgba(255,255,255,.03) 1px,transparent 1px)', backgroundSize:'32px 32px', pointerEvents:'none' }} />

        <div style={{ position:'relative', maxWidth:780 }}>
          {/* badge */}
          <div className={`fade-in d1 ${vis?'':'opacity-0'}`} style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(84,98,216,.2)', border:'1px solid rgba(84,98,216,.4)', borderRadius:999, padding:'6px 16px', marginBottom:36 }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:'#4ade80', display:'inline-block', animation:'pulse 2s ease infinite' }} />
            <span style={{ color:'rgba(255,255,255,.7)', fontSize:12, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase' }}>Para mercearias · armazéns · supermercados</span>
          </div>

          <h1 className={`fade-in d2 ${vis?'':'opacity-0'}`} style={{ fontFamily:"'Anton',sans-serif", fontSize:'clamp(52px,9vw,110px)', lineHeight:.92, letterSpacing:'-.01em', marginBottom:28, color:'#fff' }}>
            <span style={{ display:'block' }}>GESTÃO QUE</span>
            <span style={{ display:'block', background:'linear-gradient(135deg,#5462D8,#4ade80)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>SEU MERCADO</span>
            <span style={{ display:'block', color:'rgba(255,255,255,.9)' }}>PRECISAVA.</span>
          </h1>

          <p className={`fade-in d3 ${vis?'':'opacity-0'}`} style={{ fontSize:'clamp(16px,2vw,19px)', color:'rgba(255,255,255,.6)', lineHeight:1.7, maxWidth:560, margin:'0 auto 40px' }}>
            Controle de estoque com FIFO, alertas de validade, pedidos automáticos ao distribuidor e frente de caixa — tudo conectado, tudo no celular.
          </p>

          <div className={`fade-in d4 ${vis?'':'opacity-0'}`} style={{ display:'flex', gap:14, justifyContent:'center', flexWrap:'wrap' }}>
            <button className="btn-wpp" onClick={() => openWpp()}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'16px 32px', borderRadius:13, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#22c55e,#16a34a)', color:'#fff', fontSize:16, fontWeight:900, boxShadow:'0 4px 24px rgba(34,197,94,.35)' }}>
              <MessageCircle size={20} /> Quero meu mercado aqui
            </button>
            <button onClick={() => navigate('/login')}
              style={{ display:'flex', alignItems:'center', gap:8, padding:'16px 26px', borderRadius:13, border:'1px solid rgba(255,255,255,.15)', background:'rgba(255,255,255,.06)', color:'rgba(255,255,255,.8)', fontSize:15, fontWeight:700, cursor:'pointer' }}>
              Já tenho acesso <ArrowRight size={16} />
            </button>
          </div>
        </div>

        {/* scroll hint */}
        <div style={{ position:'absolute', bottom:28, left:'50%', animation:'bob 2s ease infinite', opacity:.3 }}><ChevronDown size={22} color="#fff" /></div>
      </section>

      {/* ══ TICKER ═══════════════════════════════════════════ */}
      <div style={{ background:'#f8fafc', borderTop:'1px solid #e2e8f0', borderBottom:'1px solid #e2e8f0', overflow:'hidden', padding:'14px 0' }}>
        <div style={{ display:'flex', animation:'ticker 28s linear infinite', whiteSpace:'nowrap', width:'max-content' }}>
          {[...Array(2)].map((_,i) => (
            <span key={i} style={{ display:'inline-flex', alignItems:'center' }}>
              {['Controle FIFO','Alertas de validade','Ruptura zero','Pedido ao distribuidor','PDV integrado','Funciona no celular','Sem instalar app','Suporte pelo WhatsApp','Gestão profissional','Estoque em tempo real'].map(t => (
                <span key={t} style={{ display:'inline-flex', alignItems:'center', gap:20, paddingRight:48 }}>
                  <span style={{ color:'#c7d2fe', fontSize:14 }}>✦</span>
                  <span style={{ color:'#64748b', fontSize:12, fontWeight:600, letterSpacing:'.08em', textTransform:'uppercase' }}>{t}</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* ══ DIFERENCIAIS ══════════════════════════════════════ */}
      <section style={{ padding:'100px 24px', maxWidth:1140, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:64 }}>
          <div style={{ display:'inline-block', background:'#eef2ff', border:'1px solid #c7d2fe', borderRadius:999, padding:'5px 16px', marginBottom:16 }}>
            <span style={{ color:'#5462D8', fontSize:12, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase' }}>Diferenciais reais</span>
          </div>
          <h2 style={{ fontFamily:"'Anton',sans-serif", fontSize:'clamp(36px,5vw,62px)', lineHeight:1, color:'#0f172a', marginBottom:16 }}>
            TUDO QUE DRENA SEU<br/>RESULTADO — RESOLVIDO.
          </h2>
          <p style={{ color:'#64748b', fontSize:17, maxWidth:520, margin:'0 auto' }}>
            Cada funcionalidade foi pensada para o dia a dia de quem trabalha com produto físico, giro rápido e margem apertada.
          </p>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))', gap:24 }}>
          {DIFS.map(({ icon:Icon, color, bg, border, tag, title, body }) => (
            <div key={tag} className="hover-lift"
              style={{ background:bg, border:`1px solid ${border}`, borderRadius:20, padding:'32px 28px', boxShadow:'0 2px 12px rgba(0,0,0,.04)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
                <div style={{ width:40, height:40, borderRadius:11, background:'rgba(255,255,255,.8)', border:`1px solid ${border}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <Icon size={20} color={color} />
                </div>
                <span style={{ fontSize:11, fontWeight:800, color:color, letterSpacing:'.08em', textTransform:'uppercase' }}>{tag}</span>
              </div>
              <h3 style={{ fontSize:18, fontWeight:900, color:'#0f172a', marginBottom:10, lineHeight:1.3 }}>{title}</h3>
              <p style={{ color:'#475569', fontSize:14, lineHeight:1.75 }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══ FIFO DESTAQUE ════════════════════════════════════ */}
      <section style={{ background:'linear-gradient(135deg,#1e1b4b,#312e81)', padding:'100px 24px', position:'relative', overflow:'hidden' }}>
        <div aria-hidden style={{ position:'absolute', top:'-20%', right:'-10%', width:500, height:500, borderRadius:'50%', background:'rgba(74,222,128,.1)', filter:'blur(80px)', pointerEvents:'none' }} />
        <div style={{ maxWidth:1060, margin:'0 auto', display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:60, alignItems:'center' }}>
          <div>
            <div style={{ display:'inline-block', background:'rgba(84,98,216,.3)', border:'1px solid rgba(84,98,216,.5)', borderRadius:999, padding:'5px 16px', marginBottom:20 }}>
              <span style={{ color:'#a5b4fc', fontSize:12, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase' }}>FIFO Automático</span>
            </div>
            <h2 style={{ fontFamily:"'Anton',sans-serif", fontSize:'clamp(36px,5vw,58px)', lineHeight:1, color:'#fff', marginBottom:20 }}>
              O PRODUTO MAIS<br/>VELHO VENDE<br/>PRIMEIRO.<br/>SEMPRE.
            </h2>
            <p style={{ color:'rgba(255,255,255,.6)', fontSize:16, lineHeight:1.8, marginBottom:28 }}>
              FIFO significa <strong style={{ color:'rgba(255,255,255,.9)' }}>First In, First Out</strong> — o padrão ouro para qualquer negócio com produto de validade. Quem chega primeiro, sai primeiro. Menos desperdício, menos vencimento, mais margem.
            </p>
            <p style={{ color:'rgba(255,255,255,.6)', fontSize:16, lineHeight:1.8 }}>
              O ZatendeStok registra cada entrada com data de fabricação e vencimento, e <strong style={{ color:'#4ade80' }}>sugere automaticamente qual lote vender primeiro</strong>. Funciona para frios, laticínios, hortifrúti, padaria, bebidas, limpeza — qualquer categoria com validade.
            </p>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {[
              { n:'01', cor:'#4ade80', titulo:'Entrada registrada', desc:'Produto entra no estoque com lote, quantidade e data de vencimento.' },
              { n:'02', cor:'#a5b4fc', titulo:'Ordenação automática', desc:'Sistema coloca o lote mais antigo na frente da fila de venda.' },
              { n:'03', cor:'#fbbf24', titulo:'Alerta de validade', desc:'7 dias antes de vencer: alerta, promoção sugerida ou devolução.' },
              { n:'04', cor:'#f87171', titulo:'Ruptura evitada', desc:'Quando o lote vai acabar, o pedido ao distribuidor já é preparado.' },
            ].map(({ n, cor, titulo, desc }) => (
              <div key={n} style={{ display:'flex', gap:16, padding:'20px', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.08)', borderRadius:16 }}>
                <div style={{ width:40, height:40, borderRadius:10, background:cor+'20', border:`1px solid ${cor}40`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <span style={{ color:cor, fontWeight:900, fontSize:13, fontFamily:"'Anton',sans-serif" }}>{n}</span>
                </div>
                <div>
                  <div style={{ color:'#fff', fontWeight:800, fontSize:15, marginBottom:4 }}>{titulo}</div>
                  <div style={{ color:'rgba(255,255,255,.5)', fontSize:13, lineHeight:1.6 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ PARA QUEM É ══════════════════════════════════════ */}
      <section style={{ padding:'100px 24px', background:'#f8fafc' }}>
        <div style={{ maxWidth:1060, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:64 }}>
            <div style={{ display:'inline-block', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:999, padding:'5px 16px', marginBottom:16 }}>
              <span style={{ color:'#16a34a', fontSize:12, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase' }}>Para quem é</span>
            </div>
            <h2 style={{ fontFamily:"'Anton',sans-serif", fontSize:'clamp(36px,5vw,58px)', lineHeight:1, color:'#0f172a', marginBottom:16 }}>
              SEU TIPO DE<br/>NEGÓCIO ESTÁ AQUI.
            </h2>
            <p style={{ color:'#64748b', fontSize:17, maxWidth:480, margin:'0 auto' }}>Desenvolvido para a realidade do comércio brasileiro, do menor ao médio porte.</p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:24 }}>
            {PERSONAS.map(({ emoji, tipo, desc, items }) => (
              <div key={tipo} className="hover-lift"
                style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:22, padding:'36px 30px', boxShadow:'0 2px 16px rgba(0,0,0,.06)' }}>
                <div style={{ fontSize:44, marginBottom:18 }}>{emoji}</div>
                <h3 style={{ fontSize:21, fontWeight:900, color:'#0f172a', marginBottom:12 }}>{tipo}</h3>
                <p style={{ color:'#64748b', fontSize:14, lineHeight:1.75, marginBottom:22 }}>{desc}</p>
                <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
                  {items.map(item => (
                    <div key={item} style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <CheckCircle2 size={15} color="#22c55e" style={{ flexShrink:0 }} />
                      <span style={{ color:'#334155', fontSize:13, fontWeight:600 }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ COMO FUNCIONA ════════════════════════════════════ */}
      <section style={{ padding:'100px 24px' }}>
        <div style={{ maxWidth:860, margin:'0 auto', textAlign:'center' }}>
          <div style={{ display:'inline-block', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:999, padding:'5px 16px', marginBottom:16 }}>
            <span style={{ color:'#d97706', fontSize:12, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase' }}>Simples de começar</span>
          </div>
          <h2 style={{ fontFamily:"'Anton',sans-serif", fontSize:'clamp(36px,5vw,56px)', lineHeight:1, color:'#0f172a', marginBottom:56 }}>
            COMEÇA HOJE,<br/>SEM COMPLICAÇÃO.
          </h2>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:32 }}>
            {STEPS.map(({ n, color, title, desc }, i) => (
              <div key={n} style={{ position:'relative' }}>
                {i < STEPS.length-1 && (
                  <div aria-hidden style={{ display:'none', position:'absolute', top:28, left:'calc(50% + 40px)', right:'calc(-50% + 40px)', height:2, background:'#e2e8f0' }} />
                )}
                <div style={{ width:56, height:56, borderRadius:16, background:color+'15', border:`2px solid ${color}`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', fontFamily:"'Anton',sans-serif", fontSize:20, color:color }}>{n}</div>
                <h3 style={{ fontSize:18, fontWeight:800, color:'#0f172a', marginBottom:10 }}>{title}</h3>
                <p style={{ color:'#64748b', fontSize:14, lineHeight:1.7 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ PLANOS & PREÇOS ══════════════════════════════════ */}
      <section style={{ padding:'100px 24px', background:'#f8fafc' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:56 }}>
            <div style={{ display:'inline-block', background:'#f0fdf4', border:'1px solid #86efac', borderRadius:999, padding:'5px 16px', marginBottom:16 }}>
              <span style={{ color:'#16a34a', fontSize:12, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase' }}>Planos simples e transparentes</span>
            </div>
            <h2 style={{ fontFamily:"'Anton',sans-serif", fontSize:'clamp(36px,5vw,56px)', lineHeight:1, color:'#0f172a', marginBottom:16 }}>
              INVISTA EM CONTROLE,<br/>ECONOMIZE EM PREJUÍZO.
            </h2>
            <p style={{ color:'#64748b', fontSize:16, maxWidth:500, margin:'0 auto' }}>
              Sem contrato, sem taxa de instalação. Cancele quando quiser.
            </p>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(290px,1fr))', gap:24, alignItems:'stretch' }}>
            {/* ESSENCIAL */}
            <div style={{ background:'#fff', borderRadius:24, padding:'36px 32px', border:'1px solid #e2e8f0', display:'flex', flexDirection:'column' }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#64748b', letterSpacing:'.05em', textTransform:'uppercase', marginBottom:12 }}>Essencial</div>
              <div style={{ display:'flex', alignItems:'flex-end', gap:4, marginBottom:4 }}>
                <span style={{ fontSize:13, fontWeight:700, color:'#94a3b8', alignSelf:'flex-start', marginTop:10 }}>R$</span>
                <span style={{ fontFamily:"'Anton',sans-serif", fontSize:60, lineHeight:1, color:'#0f172a' }}>297</span>
                <span style={{ fontSize:14, color:'#94a3b8', marginBottom:8 }}>/mês</span>
              </div>
              <div style={{ fontSize:11, color:'#22c55e', fontWeight:800, marginBottom:16 }}>menos de R$10 por dia ✅</div>
              <p style={{ color:'#64748b', fontSize:13, marginBottom:28, lineHeight:1.6 }}>Ideal para mercadinhos que estão saindo do papel e do caderno.</p>
              <ul style={{ listStyle:'none', padding:0, margin:'0 0 28px', flex:1, display:'flex', flexDirection:'column', gap:10 }}>
                {['✅ 1 terminal PDV / Caixa','✅ Estoque + controle de validade','✅ Fiado digital','✅ Relatórios de vendas','✅ Impressora térmica','✅ Funciona offline','❌ Bot WhatsApp de atendimento','❌ Programa de fidelidade','❌ Campanhas WhatsApp'].map(f => (
                  <li key={f} style={{ fontSize:13, color: f.startsWith('❌') ? '#cbd5e1' : '#334155', display:'flex', gap:8 }}>{f}</li>
                ))}
              </ul>
              <button onClick={() => openWpp('Quero o plano Essencial (R$297/mês)')} style={{ padding:'14px', borderRadius:14, border:'2px solid #0f172a', background:'transparent', color:'#0f172a', fontWeight:900, fontSize:15, cursor:'pointer', transition:'all .2s' }}
                onMouseOver={e=>{ e.currentTarget.style.background='#0f172a'; e.currentTarget.style.color='#fff' }}
                onMouseOut={e=>{ e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#0f172a' }}>
                Começar com Essencial
              </button>
            </div>

            {/* PROFISSIONAL — destaque */}
            <div style={{ background:'linear-gradient(160deg,#0f172a,#1e1b4b)', borderRadius:24, padding:'36px 32px', border:'2px solid #6366f1', display:'flex', flexDirection:'column', position:'relative', boxShadow:'0 20px 60px rgba(99,102,241,.25)' }}>
              <div style={{ position:'absolute', top:-14, left:'50%', transform:'translateX(-50%)', background:'linear-gradient(135deg,#6366f1,#8b5cf6)', color:'#fff', fontSize:11, fontWeight:900, padding:'4px 16px', borderRadius:999, letterSpacing:'.06em', textTransform:'uppercase', whiteSpace:'nowrap' }}>⭐ Mais popular</div>
              <div style={{ fontSize:13, fontWeight:700, color:'#a5b4fc', letterSpacing:'.05em', textTransform:'uppercase', marginBottom:12 }}>Profissional</div>
              <div style={{ display:'flex', alignItems:'flex-end', gap:4, marginBottom:4 }}>
                <span style={{ fontSize:13, fontWeight:700, color:'#818cf8', alignSelf:'flex-start', marginTop:10 }}>R$</span>
                <span style={{ fontFamily:"'Anton',sans-serif", fontSize:60, lineHeight:1, color:'#fff' }}>497</span>
                <span style={{ fontSize:14, color:'#818cf8', marginBottom:8 }}>/mês</span>
              </div>
              <div style={{ fontSize:11, color:'#86efac', fontWeight:800, marginBottom:16 }}>menos de R$17 por dia — até 3 caixas 🚀</div>
              <p style={{ color:'#94a3b8', fontSize:13, marginBottom:28, lineHeight:1.6 }}>Para quem quer atender melhor, fidelizar clientes e vender mais pelo WhatsApp.</p>
              <ul style={{ listStyle:'none', padding:0, margin:'0 0 28px', flex:1, display:'flex', flexDirection:'column', gap:10 }}>
                {['✅ Até 3 terminais PDV / Caixa','✅ Tudo do plano Essencial','✅ Bot WhatsApp com IA 🤖','✅ Respostas automáticas de promoções','✅ Programa de fidelidade (QR + WhatsApp)','✅ Campanhas de promoção via WhatsApp','✅ Etiquetas de preço automáticas','✅ Multi-caixa em rede'].map(f => (
                  <li key={f} style={{ fontSize:13, color:'#e2e8f0', display:'flex', gap:8 }}>{f}</li>
                ))}
              </ul>
              <button onClick={() => openWpp('Quero o plano Profissional (R$497/mês)')} style={{ padding:'14px', borderRadius:14, border:'none', background:'linear-gradient(135deg,#6366f1,#8b5cf6)', color:'#fff', fontWeight:900, fontSize:15, cursor:'pointer', boxShadow:'0 4px 20px rgba(99,102,241,.4)' }}>
                Quero o Profissional →
              </button>
            </div>

            {/* PERSONALIZADO */}
            <div style={{ background:'#fff', borderRadius:24, padding:'36px 32px', border:'1px solid #e2e8f0', display:'flex', flexDirection:'column' }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#64748b', letterSpacing:'.05em', textTransform:'uppercase', marginBottom:12 }}>Rede / Enterprise</div>
              <div style={{ display:'flex', alignItems:'flex-end', gap:4, marginBottom:4 }}>
                <span style={{ fontFamily:"'Anton',sans-serif", fontSize:42, lineHeight:1, color:'#0f172a' }}>Personalizado</span>
              </div>
              <div style={{ fontSize:11, color:'#f97316', fontWeight:800, marginBottom:16 }}>cotação sob medida para sua operação 🏆</div>
              <p style={{ color:'#64748b', fontSize:13, marginBottom:28, lineHeight:1.6 }}>Para redes com múltiplas lojas, mercados grandes e quem quer escalar sem limite.</p>
              <ul style={{ listStyle:'none', padding:0, margin:'0 0 28px', flex:1, display:'flex', flexDirection:'column', gap:10 }}>
                {['✅ Terminais PDV ilimitados','✅ Tudo do plano Profissional','✅ Suporte prioritário (resposta em <1h)','✅ Onboarding dedicado com sua equipe','✅ Treinamento presencial ou remoto','✅ Bot WhatsApp com nome e logo do seu mercado','✅ Relatórios avançados e exportação'].map(f => (
                  <li key={f} style={{ fontSize:13, color:'#334155', display:'flex', gap:8 }}>{f}</li>
                ))}
              </ul>
              <button onClick={() => openWpp('Quero uma cotação para o plano Enterprise')} style={{ padding:'14px', borderRadius:14, border:'2px solid #f97316', background:'transparent', color:'#f97316', fontWeight:900, fontSize:15, cursor:'pointer', transition:'all .2s' }}
                onMouseOver={e=>{ e.currentTarget.style.background='#f97316'; e.currentTarget.style.color='#fff' }}
                onMouseOut={e=>{ e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#f97316' }}>
                Falar sobre cotação →
              </button>
            </div>
          </div>

          <p style={{ textAlign:'center', color:'#94a3b8', fontSize:12, marginTop:32 }}>
            🔒 Sem contrato de fidelidade · Cancele a qualquer momento · Ativação no mesmo dia · Suporte via WhatsApp
          </p>
        </div>
      </section>

      {/* ══ CTA FINAL ════════════════════════════════════════ */}
      <section style={{ padding:'0 24px 100px' }}>
        <div style={{ maxWidth:760, margin:'0 auto', background:'linear-gradient(135deg,#0f172a,#1e1b4b)', borderRadius:28, padding:'64px 48px', textAlign:'center', position:'relative', overflow:'hidden' }}>
          <div aria-hidden style={{ position:'absolute', top:'-30%', left:'50%', transform:'translateX(-50%)', width:400, height:400, borderRadius:'50%', background:'rgba(84,98,216,.2)', filter:'blur(60px)', pointerEvents:'none' }} />
          <div style={{ position:'relative' }}>
            <h2 style={{ fontFamily:"'Anton',sans-serif", fontSize:'clamp(40px,7vw,70px)', lineHeight:.95, color:'#fff', marginBottom:20 }}>
              CHEGA DE<br/>PREJUÍZO COM<br/>ESTOQUE.
            </h2>
            <p style={{ color:'rgba(255,255,255,.55)', fontSize:16, lineHeight:1.7, marginBottom:36, maxWidth:440, margin:'0 auto 36px' }}>
              Fale com a gente e receba acesso ao ZatendeStok em até 2 horas. Sem contrato, sem mensalidade surpresa.
            </p>
            <button className="btn-wpp" onClick={() => openWpp()}
              style={{ display:'inline-flex', alignItems:'center', gap:12, padding:'18px 40px', borderRadius:16, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#22c55e,#16a34a)', color:'#fff', fontSize:18, fontWeight:900, boxShadow:'0 4px 24px rgba(34,197,94,.35)' }}>
              <MessageCircle size={22} /> Quero começar agora
            </button>
            <div style={{ marginTop:20, color:'rgba(255,255,255,.2)', fontSize:12 }}>Sem contrato · Acesso em 2h · Suporte direto</div>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ═══════════════════════════════════════════ */}
      <footer style={{ borderTop:'1px solid #f1f5f9', padding:'28px 32px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:16 }}>
        <ZatendeStokLogo variant="wordmark" />
        <div style={{ display:'flex', gap:24, alignItems:'center', flexWrap:'wrap' }}>
          <a href="/guia" style={{ color:'#94a3b8', fontSize:12, fontWeight:600, textDecoration:'none' }}>Guia</a>
          <button onClick={() => navigate('/login')} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:12, fontWeight:600 }}>Entrar</button>
          <span style={{ color:'#e2e8f0', fontSize:11 }}>zatendestok.com.br</span>
        </div>
      </footer>
    </div>
  )
}
