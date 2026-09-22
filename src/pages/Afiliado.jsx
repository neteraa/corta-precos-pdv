import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2, CheckCircle2, Link2, ChevronDown, ChevronUp } from 'lucide-react'
import ZatendeStokLogo from '../components/ZatendeStokLogo.jsx'

const BASE_URL  = 'https://zatendestok.com.br'
const ZAP_PEDRO = '5515997969303'
const wppOpen   = (msg) => window.open(`https://wa.me/${ZAP_PEDRO}?text=${encodeURIComponent(msg)}`, '_blank')

/* ── helpers ──────────────────────────────────────────────── */
function Btn({ children, onClick, color = '#f97316', style = {} }) {
  return (
    <button onClick={onClick} style={{
      display:'flex', alignItems:'center', justifyContent:'center', gap:8,
      width:'100%', padding:'16px', border:'none', borderRadius:14,
      background:color, color:'#fff', fontWeight:900, fontSize:16,
      cursor:'pointer', transition:'filter .15s', ...style }}
      onMouseOver={e=>e.currentTarget.style.filter='brightness(1.1)'}
      onMouseOut={e=>e.currentTarget.style.filter='brightness(1)'}>
      {children}
    </button>
  )
}

function CopyBtn({ value, label, full }) {
  const [ok, setOk] = useState(false)
  const go = () => navigator.clipboard.writeText(value).then(() => { setOk(true); setTimeout(()=>setOk(false),2000) })
  return (
    <button onClick={go} style={{
      display:'flex', alignItems:'center', justifyContent:'center', gap:6,
      padding:'10px 16px', border:`1.5px solid ${ok?'#22c55e':'#e2e8f0'}`, borderRadius:10,
      background:ok?'#f0fdf4':'#fff', cursor:'pointer', color:ok?'#16a34a':'#0f172a',
      fontSize:13, fontWeight:700, width:full?'100%':'auto', transition:'all .2s' }}>
      <CheckCircle2 size={14} color={ok?'#22c55e':'#94a3b8'}/>
      {ok ? 'Copiado!' : label}
    </button>
  )
}

/* ── conteúdo de vendas ───────────────────────────────────── */
const SCRIPTS = [
  { nicho:'Mercado / Mercearia',  emoji:'\u{1F3EA}',
    texto:'Oi [Nome]! Vi que você tem um mercadinho aqui na região. Tenho uma solução que tá ajudando vários mercados da cidade a controlar estoque, emitir fiado e mandar promoção automática no WhatsApp dos clientes. Posso te explicar rapidinho?',
    dica:'Foca no fiado digital e no controle de validade \u2014 essas são as duas maiores dores de mercado.' },
  { nicho:'Padaria / Confeitaria', emoji:'\u{1F956}',
    texto:'Oi [Nome]! Você tem a padaria aqui né? Trabalho com um sistema que ajuda padarias a controlar insumos, emitir fiado e divulgar promoções do dia via WhatsApp. Posso te mostrar?',
    dica:'Foca no controle de insumos e campanhas de fim de dia \u2014 pão que sobrou vira promoção automática.' },
  { nicho:'Açougue / Frigorífico', emoji:'\u{1F969}',
    texto:'Oi [Nome]! Trabalho com um sistema pra açougue que controla o vencimento da carne por lote, organiza o fiado e manda oferta da semana no WhatsApp dos clientes. Tem interesse?',
    dica:'Foca na validade por lote (dor enorme) e no fiado digitalizado \u2014 muitos açougues ainda usam caderno.' },
  { nicho:'Restaurante / Lanchonete', emoji:'\u{1F37D}\uFE0F',
    texto:'Oi [Nome]! Vi seu restaurante aqui na região. Tenho um sistema que controla estoque de insumos, faz o caixa do dia e capta clientes via WhatsApp automaticamente. Posso te mostrar?',
    dica:'Foca no caixa do dia e controle de insumos \u2014 restaurante sangra dinheiro sem controlar o que entra e sai.' },
]

const OBJECOES = [
  { q:'"Já tenho sistema"',
    a:'Qual você usa? Pergunto porque a maioria dos nossos clientes veio de outro sistema. O que te incomoda mais no atual? Às vezes a gente resolve exatamente isso.' },
  { q:'"Tá caro"',
    a:'Entendo! São R$9,90 por dia \u2014 menos que um café por funcionário. A maioria dos clientes recupera o investimento no primeiro mês só com a redução de perda por vencimento.' },
  { q:'"Não sei mexer com tecnologia"',
    a:'É tudo pelo celular, igual usar WhatsApp. Em 10 minutos tá funcionando. Nossa equipe faz o onboarding junto com você, sem pressão.' },
  { q:'"Vou pensar"',
    a:'Claro! Só me fala: tem alguma dúvida específica? Às vezes é uma coisa simples que a gente resolve agora e fica muito mais fácil de decidir.' },
  { q:'"Preciso falar com meu sócio"',
    a:'Faz sentido! Quer que eu te mande um resuminho com o sistema e preço pra você mostrar pra ele? Fica muito mais fácil de apresentar assim.' },
]

/* ════════════════════════════════════════════════════════════ */
export default function Afiliado() {
  const [params]  = useSearchParams()
  const [input,   setInput]   = useState(params.get('code') || '')
  const [aff,     setAff]     = useState(null)
  const [loading, setLoading] = useState(!!params.get('code'))
  const [error,   setError]   = useState('')
  const [clients, setClients] = useState(5)
  const [tabKit,  setTabKit]  = useState(0)
  const [openObj, setOpenObj] = useState(null)

  const load = async (c) => {
    if (!c) return
    setLoading(true); setError(''); setAff(null)
    try {
      const res = await fetch(`/api/affiliates?code=${encodeURIComponent(c.toLowerCase())}`)
      const d   = await res.json()
      if (d.ok) setAff(d.affiliate)
      else setError('Código não encontrado. Confira e tente novamente.')
    } catch { setError('Erro de conexão. Tente novamente.') }
    setLoading(false)
  }

  useEffect(() => { if (params.get('code')) load(params.get('code')) }, [])

  const totalComissao = aff?.vendas?.reduce((s,v) => s+(v.comissao||0), 0) ?? 0
  const totalVendas   = aff?.vendas?.length ?? 0
  const pct           = aff ? Math.round((aff.comissaoPct||0.20)*100) : 20
  const link          = aff ? `${BASE_URL}/login?ref=${aff.codigo}` : ''
  const calcRenda     = clients * 89

  const MSG_RECRUTA = 'Olá Pedro! Vi o programa de afiliados do ZatendeStok e quero me cadastrar como vendedor. Como funciona?'

  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Inter',system-ui,sans-serif;background:#090807}
    @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
    @keyframes glow{0%,100%{opacity:.55}50%{opacity:1}}
    .aff-tab{cursor:pointer;transition:all .2s}
    .aff-tab:hover{opacity:.8}
    .script-card{transition:transform .15s,box-shadow .15s}
    .script-card:hover{transform:translateY(-2px)}
    input:focus{outline:2px solid #f97316!important;border-color:transparent!important}
    input::placeholder{color:#5a5040}
    .slider{-webkit-appearance:none;appearance:none;width:100%;height:6px;border-radius:3px;background:linear-gradient(90deg,#f97316 var(--val,50%),#1e1509 var(--val,50%));outline:none;cursor:pointer}
    .slider::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:#f97316;cursor:pointer;box-shadow:0 0 0 4px rgba(249,115,22,.22)}
    body{overflow-x:hidden}
    .af-pillars{display:grid;grid-template-columns:1fr;gap:10px;margin-bottom:32px}
    .af-niches {display:grid;grid-template-columns:1fr;gap:8px}
    .af-stats  {display:grid;grid-template-columns:1fr;gap:12px;margin-bottom:14px}
    @media(min-width:420px){
      .af-pillars{grid-template-columns:repeat(3,1fr)}
      .af-niches {grid-template-columns:1fr 1fr}
      .af-stats  {grid-template-columns:1fr 1fr}
    }
  `

  return (
    <div style={{ minHeight:'100vh', background:'#090807', fontFamily:"'Inter',system-ui,sans-serif", color:'#fff' }}>
      <style>{CSS}</style>

      {/* ── HERO ──────────────────────────────────── */}
      <div style={{ background:'linear-gradient(150deg,#0e0c09 0%,#1e1005 45%,#0e0c09 100%)', padding:'28px 20px 52px', position:'relative', overflow:'hidden', borderBottom:'1px solid #221507' }}>
        <div aria-hidden style={{ position:'absolute',top:-80,left:-80,width:340,height:340,borderRadius:'50%',background:'rgba(249,115,22,.07)',filter:'blur(90px)',pointerEvents:'none' }}/>
        <div aria-hidden style={{ position:'absolute',bottom:-60,right:-40,width:280,height:280,borderRadius:'50%',background:'rgba(251,191,36,.04)',filter:'blur(75px)',pointerEvents:'none' }}/>

        <div style={{ maxWidth:520, margin:'0 auto', position:'relative', zIndex:1 }}>

          {/* nav */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:44 }}>
            <ZatendeStokLogo variant="wordmark" />
            {!aff && (
              <a href="#portal" style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,.38)', textDecoration:'none', borderBottom:'1px dashed rgba(255,255,255,.18)', paddingBottom:2 }}>
                Área do vendedor →
              </a>
            )}
          </div>

          {!aff && (
            <div style={{ animation:'fadeUp .4s ease' }}>
              {/* badge */}
              <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'6px 14px', background:'rgba(249,115,22,.1)', border:'1px solid rgba(249,115,22,.28)', borderRadius:999, fontSize:12, fontWeight:700, color:'#fb923c', marginBottom:20 }}>
                <span style={{ width:7,height:7,borderRadius:'50%',background:'#f97316',display:'inline-block',animation:'glow 2s ease infinite' }}/>
                Programa de afiliados ativo — vagas abertas
              </div>

              <h1 style={{ fontSize:36, fontWeight:900, lineHeight:1.06, letterSpacing:'-.03em', marginBottom:16 }}>
                Indique.{' '}
                <span style={{ color:'#f97316', display:'block' }}>Feche. Receba.</span>
                <span style={{ color:'rgba(255,255,255,.42)', fontSize:22, fontWeight:700, letterSpacing:'-.01em' }}>Todo mês, pra sempre.</span>
              </h1>

              <p style={{ color:'rgba(255,255,255,.5)', fontSize:15, lineHeight:1.7, marginBottom:30 }}>
                Cada negócio que você indicar gera uma comissão <strong style={{color:'#fb923c'}}>recorrente</strong> pra você.
                Não é bônus único — é renda mensal enquanto o cliente ficar ativo.
              </p>

              {/* 3 pilares */}
              <div className="af-pillars">
                {[
                  { n:'20%', c:'#f97316', s:'de comissão', d:'recorrente' },
                  { n:'R$89', c:'#4ade80', s:'média/cliente', d:'por mês' },
                  { n:'∞',   c:'#fbbf24', s:'sem teto', d:'de indicações' },
                ].map(p => (
                  <div key={p.n} style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.07)', borderRadius:14, padding:'16px 10px', textAlign:'center' }}>
                    <p style={{ fontSize:26, fontWeight:900, color:p.c, margin:'0 0 2px' }}>{p.n}</p>
                    <p style={{ fontSize:11, fontWeight:800, color:'#fff', margin:'0 0 2px' }}>{p.s}</p>
                    <p style={{ fontSize:10, color:'rgba(255,255,255,.3)' }}>{p.d}</p>
                  </div>
                ))}
              </div>

              {/* calculadora */}
              <div style={{ background:'rgba(255,255,255,.035)', border:'1px solid rgba(255,255,255,.08)', borderRadius:18, padding:'22px 20px', marginBottom:28 }}>
                <p style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,.38)', textTransform:'uppercase', letterSpacing:'.09em', marginBottom:12 }}>Simule sua renda</p>
                <div style={{ display:'flex', alignItems:'baseline', gap:6, marginBottom:6 }}>
                  <span style={{ fontSize:52, fontWeight:900, color:'#f97316', lineHeight:1 }}>R${calcRenda}</span>
                  <span style={{ fontSize:18, fontWeight:700, color:'rgba(255,255,255,.4)' }}>/mês</span>
                </div>
                <p style={{ fontSize:13, color:'rgba(255,255,255,.38)', marginBottom:18 }}>com <strong style={{color:'#fff'}}>{clients} cliente{clients>1?'s':''} ativo{clients>1?'s':''}</strong></p>
                <input type="range" min="1" max="20" value={clients}
                  onChange={e=>setClients(Number(e.target.value))}
                  className="slider"
                  style={{'--val': `${((clients-1)/19)*100}%`}}/>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'rgba(255,255,255,.22)', marginTop:6 }}>
                  <span>1 cliente</span><span>10 clientes</span><span>20 clientes</span>
                </div>
              </div>

              <Btn onClick={() => wppOpen(MSG_RECRUTA)}
                style={{ boxShadow:'0 4px 28px rgba(249,115,22,.35)', marginBottom:12, fontSize:17, padding:'18px' }}>
                📲 Quero ser afiliado — falar com Pedro agora
              </Btn>
              <p style={{ textAlign:'center', fontSize:12, color:'rgba(255,255,255,.28)' }}>Grátis · Sem contrato · Comece hoje</p>
            </div>
          )}

          {aff && (
            <div style={{ animation:'fadeUp .3s ease' }}>
              <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'5px 12px', background:'rgba(249,115,22,.1)', border:'1px solid rgba(249,115,22,.28)', borderRadius:999, fontSize:11, fontWeight:700, color:'#fb923c', marginBottom:16 }}>
                <span style={{ width:7,height:7,borderRadius:'50%',background:'#f97316',display:'inline-block',animation:'glow 2s ease infinite' }}/>
                Vendedor ativo · {pct}% comissão
              </div>
              <h1 style={{ fontSize:26, fontWeight:900 }}>Olá, {aff.nome.split(' ')[0]}! 👋</h1>
              <p style={{ color:'rgba(255,255,255,.38)', fontSize:13, marginTop:6 }}>Código: <span style={{ fontFamily:'monospace', color:'#fb923c', fontWeight:800 }}>{aff.codigo}</span></p>
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth:520, margin:'0 auto', padding:'24px 16px 56px' }}>

        {/* ── SEM LOGIN ───────────────────────────── */}
        {!aff && (
          <>
            {/* login card */}
            <div id="portal" style={{ background:'#100e08', border:'1px solid #2c1f0c', borderRadius:18, padding:'22px 20px', marginBottom:16 }}>
              <h3 style={{ fontSize:16, fontWeight:900, color:'#fff', marginBottom:4 }}>Já é vendedor?</h3>
              <p style={{ fontSize:13, color:'rgba(255,255,255,.38)', marginBottom:16 }}>Entre com seu código e acesse seu painel completo.</p>
              <div style={{ display:'flex', gap:10 }}>
                <input value={input} onChange={e=>setInput(e.target.value.toLowerCase())}
                  onKeyDown={e=>e.key==='Enter'&&load(input)}
                  placeholder="seu código (ex: pedro)"
                  style={{ flex:1, padding:'13px 14px', border:'1.5px solid #2c1f0c', borderRadius:10, fontSize:15, color:'#fff', fontFamily:'inherit', background:'#0d0b07' }}/>
                <button onClick={()=>load(input)} disabled={loading||!input.trim()}
                  style={{ padding:'13px 22px', background:'#f97316', border:'none', borderRadius:10, color:'#fff', fontWeight:800, fontSize:14, cursor:'pointer', opacity:loading||!input.trim()?0.5:1 }}>
                  {loading ? <Loader2 size={16} style={{animation:'spin 1s linear infinite'}}/> : 'Entrar'}
                </button>
              </div>
              {error && <p style={{ color:'#f87171', fontSize:12, marginTop:8 }}>⚠ {error}</p>}
            </div>

            {/* por que ser afiliado */}
            <div style={{ background:'linear-gradient(135deg,#180f02,#0f0900)', border:'1px solid rgba(249,115,22,.14)', borderRadius:18, padding:'22px 20px', marginBottom:16 }}>
              <p style={{ fontSize:11, fontWeight:800, color:'#fb923c', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:14 }}>Por que ser afiliado?</p>
              {[
                { e:'💰', t:'Renda 100% recorrente', d:'Diferente de comissão única, você recebe todo mês enquanto o cliente usar o sistema.' },
                { e:'📱', t:'Vende só pelo celular', d:'Seu link chega em qualquer lugar. WhatsApp, Instagram, pessoalmente — sem visita técnica.' },
                { e:'⚡', t:'Ativação em 2 horas', d:'Cliente solicita pelo seu link, nossa equipe ativa em até 2 horas. Sem burocracia.' },
                { e:'📊', t:'Painel em tempo real', d:'Veja suas conversões, comissão acumulada e link de indicação a qualquer hora.' },
              ].map((b,i) => (
                <div key={i} style={{ display:'flex', gap:14, marginBottom:i<3?16:0 }}>
                  <div style={{ width:38,height:38,borderRadius:10,background:'rgba(249,115,22,.1)',border:'1px solid rgba(249,115,22,.18)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0 }}>{b.e}</div>
                  <div>
                    <p style={{ fontSize:13, fontWeight:800, color:'#fff', margin:'3px 0 3px' }}>{b.t}</p>
                    <p style={{ fontSize:12, color:'rgba(255,255,255,.38)', margin:0, lineHeight:1.5 }}>{b.d}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* como funciona */}
            <div style={{ background:'#100e08', border:'1px solid #2c1f0c', borderRadius:18, padding:'22px 20px', marginBottom:16 }}>
              <p style={{ fontSize:11, fontWeight:800, color:'rgba(255,255,255,.38)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:18 }}>Como funciona</p>
              {[
                { n:'01', t:'Pedro te cadastra', d:'Você chama, ele cria seu código e manda seu link único. Leva 5 minutos.' },
                { n:'02', t:'Você indica pelo celular', d:'Manda seu link pra qualquer comerciante da região. O cliente acessa e solicita o acesso.' },
                { n:'03', t:'A gente ativa o cliente', d:'Nossa equipe ativa o sistema em até 2 horas. Cliente começa a usar na mesma hora.' },
                { n:'04', t:'Recebe todo mês', d:'20% do plano cai na sua conta. Todo mês enquanto o cliente ficar ativo. Para sempre.' },
              ].map((s,i) => (
                <div key={i} style={{ display:'flex', gap:16, marginBottom:i<3?18:0 }}>
                  <div style={{ minWidth:36, height:36, borderRadius:10, background:'rgba(249,115,22,.1)', border:'1px solid rgba(249,115,22,.2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <span style={{ fontSize:11, fontWeight:900, color:'#fb923c', fontFamily:'monospace' }}>{s.n}</span>
                  </div>
                  <div style={{ paddingTop:2 }}>
                    <p style={{ fontSize:13, fontWeight:800, color:'#fff', margin:'0 0 3px' }}>{s.t}</p>
                    <p style={{ fontSize:12, color:'rgba(255,255,255,.38)', margin:0, lineHeight:1.5 }}>{s.d}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* quem pode indicar */}
            <div style={{ background:'#100e08', border:'1px solid #2c1f0c', borderRadius:18, padding:'22px 20px', marginBottom:20 }}>
              <p style={{ fontSize:11, fontWeight:800, color:'rgba(255,255,255,.38)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:14 }}>Quem você pode indicar</p>
              <div className="af-niches">
                {[['🏪','Mercados'],['🥖','Padarias'],['🥩','Açougues'],['🍽️','Restaurantes'],['🌯','Lanchonetes'],['🚚','Distribuidoras']].map(([e,t]) => (
                  <div key={t} style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 13px', background:'rgba(255,255,255,.03)', border:'1px solid #2c1f0c', borderRadius:10 }}>
                    <span style={{ fontSize:20 }}>{e}</span>
                    <div>
                      <p style={{ fontSize:13, fontWeight:700, color:'#fff', margin:0 }}>{t}</p>
                      <p style={{ fontSize:10, color:'#f97316', fontWeight:700, margin:0 }}>R$59–R$99/cliente</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Btn onClick={()=>wppOpen(MSG_RECRUTA)}
              style={{ boxShadow:'0 4px 24px rgba(249,115,22,.3)', marginBottom:10, fontSize:17, padding:'18px' }}>
              📲 Quero ser afiliado agora
            </Btn>
            <p style={{ textAlign:'center', fontSize:12, color:'rgba(255,255,255,.22)', marginBottom:4 }}>Grátis · Sem contrato · 20% de comissão recorrente</p>
          </>
        )}

        {/* ── DASHBOARD ───────────────────────────── */}
        {aff && (
          <div style={{ animation:'fadeUp .3s ease' }}>

            {/* stats */}
            <div className="af-stats">
              {[
                { e:'🏆', l:'Conversões', v: String(totalVendas), s:`${totalVendas} cliente${totalVendas!==1?'s':''} ativo${totalVendas!==1?'s':''}`, c:'#f97316' },
                { e:'💰', l:'Comissão total', v:`R$${totalComissao.toFixed(2).replace('.',',')}`, s:'a receber do Pedro', c:'#22c55e' },
              ].map(c => (
                <div key={c.l} style={{ background:'#100e08', border:'1px solid #2c1f0c', borderRadius:16, padding:'16px 18px' }}>
                  <div style={{ fontSize:22, marginBottom:6 }}>{c.e}</div>
                  <p style={{ fontSize:26, fontWeight:900, color:c.c, margin:'0 0 2px' }}>{c.v}</p>
                  <p style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,.38)', margin:'0 0 2px', textTransform:'uppercase', letterSpacing:'.06em' }}>{c.l}</p>
                  {c.s && <p style={{ fontSize:11, color:'rgba(255,255,255,.28)', margin:0 }}>{c.s}</p>}
                </div>
              ))}
            </div>

            {/* projeção */}
            {totalVendas > 0 && (
              <div style={{ background:'linear-gradient(135deg,#180f02,#0f0900)', border:'1px solid rgba(249,115,22,.18)', borderRadius:14, padding:'16px 18px', marginBottom:14, display:'flex', alignItems:'center', gap:14 }}>
                <span style={{ fontSize:26 }}>📈</span>
                <div>
                  <p style={{ color:'rgba(255,255,255,.38)', fontSize:11, fontWeight:800, margin:'0 0 3px', textTransform:'uppercase', letterSpacing:'.06em' }}>Projeção</p>
                  <p style={{ color:'#fff', fontSize:15, fontWeight:900, margin:0 }}>
                    {'Mais '}{Math.max(1,5-totalVendas)}{' indicação'}{5-totalVendas!==1?'s':''}{' e você chega a '}
                    <span style={{ color:'#4ade80' }}>{'R$'}{Math.round(totalComissao + Math.max(1,5-totalVendas)*89)}{'/mês'}</span>
                  </p>
                </div>
              </div>
            )}

            {/* link */}
            <div style={{ background:'#100e08', border:'1px solid #2c1f0c', borderRadius:16, padding:'18px 20px', marginBottom:14 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                <Link2 size={15} color="#fb923c"/>
                <span style={{ fontSize:13, fontWeight:800, color:'#fff' }}>Seu link de indicação</span>
              </div>
              <div style={{ background:'#0d0b07', border:'1px solid #2c1f0c', borderRadius:8, padding:'10px 12px', fontSize:12, color:'#fb923c', wordBreak:'break-all', marginBottom:12, fontFamily:'monospace', fontWeight:600 }}>
                {link}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <CopyBtn value={link} label="Copiar link"/>
                <button onClick={()=>window.open(`https://wa.me/?text=${encodeURIComponent('Ei! Conheça o ZatendeStok — sistema de gestão pra negócios de alimentação. Acesse pelo meu link: '+link)}`, '_blank')}
                  style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'11px', border:'none', borderRadius:10, background:'#f97316', cursor:'pointer', color:'#fff', fontSize:13, fontWeight:800 }}>
                  📲 Compartilhar
                </button>
              </div>
            </div>

            {/* kit do vendedor */}
            <div style={{ background:'#100e08', border:'1px solid #2c1f0c', borderRadius:16, overflow:'hidden', marginBottom:14 }}>
              <div style={{ padding:'14px 18px', borderBottom:'1px solid #2c1f0c' }}>
                <p style={{ fontSize:13, fontWeight:800, color:'#fff', margin:'0 0 2px' }}>Kit do Vendedor</p>
                <p style={{ fontSize:11, color:'rgba(255,255,255,.28)', margin:0 }}>Scripts, objeções e mensagens prontas</p>
              </div>

              <div style={{ display:'flex', borderBottom:'1px solid #2c1f0c', padding:'0 18px', gap:4 }}>
                {['Scripts de abordagem','Objeções','Mensagens WA'].map((t,i) => (
                  <button key={t} onClick={()=>setTabKit(i)} className="aff-tab"
                    style={{ padding:'10px 0', marginRight:14, background:'none', border:'none', color: tabKit===i?'#fb923c':'rgba(255,255,255,.32)',
                      fontWeight: tabKit===i?800:600, fontSize:11.5, cursor:'pointer',
                      borderBottom: tabKit===i?'2px solid #f97316':'2px solid transparent' }}>
                    {t}
                  </button>
                ))}
              </div>

              <div style={{ padding:'18px 16px' }}>

                {tabKit===0 && (
                  <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                    <p style={{ fontSize:12, color:'rgba(255,255,255,.32)' }}>Copie, adapte o nome e mande. Funciona por WA e pessoalmente.</p>
                    {SCRIPTS.map(s => (
                      <div key={s.nicho} className="script-card" style={{ background:'rgba(255,255,255,.025)', border:'1px solid #2c1f0c', borderRadius:12, padding:'14px' }}>
                        <p style={{ fontSize:12, fontWeight:800, color:'#fb923c', marginBottom:8 }}>{s.emoji} {s.nicho}</p>
                        <p style={{ fontSize:12.5, color:'rgba(255,255,255,.65)', lineHeight:1.65, marginBottom:10, fontStyle:'italic' }}>"{s.texto}"</p>
                        <div style={{ background:'rgba(249,115,22,.06)', border:'1px solid rgba(249,115,22,.12)', borderRadius:8, padding:'8px 12px', marginBottom:10 }}>
                          <p style={{ fontSize:11, fontWeight:700, color:'#fb923c', margin:'0 0 2px' }}>DICA:</p>
                          <p style={{ fontSize:11, color:'#fdba74', margin:0, lineHeight:1.5 }}>{s.dica}</p>
                        </div>
                        <CopyBtn value={s.texto.replace('[Nome]','')} label="Copiar script" full/>
                      </div>
                    ))}
                  </div>
                )}

                {tabKit===1 && (
                  <div>
                    <p style={{ fontSize:12, color:'rgba(255,255,255,.32)', marginBottom:14 }}>O que falar quando o cliente resistir.</p>
                    {OBJECOES.map((o,i) => (
                      <div key={i} style={{ border:'1px solid #2c1f0c', borderRadius:10, overflow:'hidden', marginBottom:8 }}>
                        <button onClick={()=>setOpenObj(openObj===i?null:i)}
                          style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'13px 14px', background: openObj===i?'rgba(249,115,22,.06)':'transparent', border:'none', cursor:'pointer' }}>
                          <span style={{ fontSize:13, fontWeight:700, color:'#fff', textAlign:'left' }}>{o.q}</span>
                          {openObj===i ? <ChevronUp size={15} color="#fb923c"/> : <ChevronDown size={15} color="rgba(255,255,255,.28)"/>}
                        </button>
                        {openObj===i && (
                          <div style={{ padding:'0 14px 14px', background:'rgba(0,0,0,.25)' }}>
                            <p style={{ fontSize:13, color:'rgba(255,255,255,.62)', lineHeight:1.65, margin:'8px 0 12px', fontStyle:'italic' }}>"{o.a}"</p>
                            <CopyBtn value={o.a} label="Copiar resposta" full/>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {tabKit===2 && (() => {
                  const msgs = [
                    { label:'1ª abordagem',
                      msg:'Oi [Nome]! Tudo bem? 👋\n\nPassei pra te apresentar o ZatendeStok — sistema de gestão que tá ajudando muito negócio da região.\n\nControla estoque, faz o caixa, gerencia fiado e ainda manda promoção automática no WhatsApp dos clientes. Tudo no celular, sem instalar nada.\n\nTem interesse em conhecer? Posso te mandar mais detalhes! 😊' },
                    { label:'Seguimento (não respondeu)',
                      msg:'Oi [Nome]! 😊 Só passando pra ver se você chegou a ver minha mensagem.\n\nNão precisa decidir nada agora — posso só te mostrar como funciona em 5 minutos?\n\nA maioria das pessoas que vê fica surpresa com o quanto é simples. Qual dia fica melhor?' },
                    { label:'Envio do link',
                      msg:'[Nome], aqui está o link pra conhecer e solicitar o acesso:\n\n'+ link +'\n\nNossa equipe ativa em até 2 horas, sem burocracia. Qualquer dúvida é só chamar! 🚀' },
                  ]
                  return (
                    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                      <p style={{ fontSize:12, color:'rgba(255,255,255,.32)' }}>Mensagens prontas. Copie e edite o nome.</p>
                      {msgs.map(m => (
                        <div key={m.label} style={{ background:'rgba(255,255,255,.025)', border:'1px solid #2c1f0c', borderRadius:12, padding:'14px' }}>
                          <p style={{ fontSize:11, fontWeight:800, color:'#fb923c', marginBottom:8, textTransform:'uppercase', letterSpacing:'.06em' }}>{m.label}</p>
                          <p style={{ fontSize:12.5, color:'rgba(255,255,255,.62)', lineHeight:1.65, marginBottom:12, whiteSpace:'pre-line' }}>{m.msg}</p>
                          <CopyBtn value={m.msg} label="Copiar mensagem" full/>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>

            {/* histórico */}
            {aff.vendas?.length > 0 && (
              <div style={{ background:'#100e08', border:'1px solid #2c1f0c', borderRadius:16, overflow:'hidden', marginBottom:14 }}>
                <div style={{ padding:'14px 18px', borderBottom:'1px solid #2c1f0c' }}>
                  <p style={{ fontSize:13, fontWeight:800, color:'#fff', margin:0 }}>Histórico de conversões</p>
                </div>
                {[...aff.vendas].reverse().map((v,i) => (
                  <div key={i} style={{ padding:'12px 18px', borderBottom:'1px solid #0d0b07', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div>
                      <p style={{ fontSize:13, fontWeight:700, color:'#fff', margin:'0 0 2px' }}>{v.mercado}</p>
                      <p style={{ fontSize:11, color:'rgba(255,255,255,.28)', margin:0 }}>{v.niche} · {v.plano} · {v.creditedAt?new Date(v.creditedAt).toLocaleDateString('pt-BR'):'—'}</p>
                    </div>
                    <span style={{ fontSize:14, fontWeight:900, color: v.comissao>0?'#4ade80':'rgba(255,255,255,.28)' }}>
                      {v.comissao>0?`R$${v.comissao.toFixed(2).replace('.',',')}`:'pendente'}
                    </span>
                  </div>
                ))}
                <div style={{ padding:'12px 18px', display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,.32)' }}>Total acumulado</span>
                  <span style={{ fontSize:15, fontWeight:900, color:'#22c55e' }}>R${totalComissao.toFixed(2).replace('.',',')}</span>
                </div>
              </div>
            )}

            <Btn onClick={()=>wppOpen(`Oi Pedro! Sou o ${aff.nome}, código ${aff.codigo}. Tenho uma dúvida sobre o programa de afiliados.`)}
              style={{ marginBottom:10 }}>
              💬 Falar com Pedro
            </Btn>
            <button onClick={()=>{setAff(null);setInput('')}}
              style={{ display:'block',width:'100%',padding:'12px',background:'none',border:'1px solid #2c1f0c',borderRadius:12,color:'rgba(255,255,255,.32)',fontSize:13,fontWeight:600,cursor:'pointer' }}>
              ← Sair
            </button>
          </div>
        )}

        <p style={{ textAlign:'center', fontSize:11, color:'rgba(255,255,255,.14)', marginTop:32 }}>
          ZatendeStok · Portal do Vendedor · <a href="/" style={{ color:'rgba(255,255,255,.22)' }}>Página inicial</a>
        </p>
      </div>
    </div>
  )
}
