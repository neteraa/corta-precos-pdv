import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2, Copy, CheckCircle2, Link2, ChevronDown, ChevronUp } from 'lucide-react'
import ZatendeStokLogo from '../components/ZatendeStokLogo.jsx'

const BASE_URL  = 'https://zatendestok.com.br'
const ZAP_PEDRO = '5515997969303'

function openWpp(msg) {
  window.open(`https://wa.me/${ZAP_PEDRO}?text=${encodeURIComponent(msg)}`, '_blank')
}

function CopyBtn({ value, label, full }) {
  const [ok, setOk] = useState(false)
  const go = () => navigator.clipboard.writeText(value).then(() => { setOk(true); setTimeout(() => setOk(false), 2200) })
  return (
    <button onClick={go} style={{
      display:'flex', alignItems:'center', justifyContent:'center', gap:8,
      padding:'11px 18px', border:`1.5px solid ${ok?'#22c55e':'#e2e8f0'}`, borderRadius:10,
      background:ok?'#f0fdf4':'#fff', cursor:'pointer', color:ok?'#16a34a':'#0f172a',
      fontSize:13, fontWeight:700, transition:'all .2s', width:full?'100%':'auto' }}>
      <CheckCircle2 size={15} color={ok?'#22c55e':'#94a3b8'} />
      {ok ? 'Copiado!' : label}
    </button>
  )
}

function StatCard({ emoji, label, value, sub }) {
  return (
    <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, padding:'16px 18px' }}>
      <div style={{ fontSize:22, marginBottom:6 }}>{emoji}</div>
      <p style={{ fontSize:26, fontWeight:900, color:'#0f172a', margin:'0 0 2px' }}>{value}</p>
      <p style={{ fontSize:11, fontWeight:700, color:'#64748b', margin:'0 0 2px', textTransform:'uppercase', letterSpacing:'.06em' }}>{label}</p>
      {sub && <p style={{ fontSize:11, color:'#94a3b8', margin:0 }}>{sub}</p>}
    </div>
  )
}

const SCRIPTS = [
  {
    nicho: '🏪 Mercado / Mercearia',
    texto: 'Oi [Nome]! Vi que voc\u00ea tem um mercadinho aqui na regi\u00e3o. Tenho uma solu\u00e7\u00e3o que t\u00e1 ajudando v\u00e1rios mercados da cidade a controlar estoque, emitir fiado e mandar promo\u00e7\u00e3o autom\u00e1tica no WhatsApp dos clientes. Posso te explicar rapidinho?',
    dica:  'Foca no fiado digital e no controle de validade \u2014 essas s\u00e3o as duas maiores dores de mercado.',
  },
  {
    nicho: '🥖 Padaria / Confeitaria',
    texto: 'Oi [Nome]! Voc\u00ea tem a padaria aqui n\u00e9? Trabalho com um sistema que ajuda padarias a controlar insumos, emitir fiado e divulgar promo\u00e7\u00f5es do dia via WhatsApp. Posso te mostrar?',
    dica:  'Foca no controle de insumos e nas campanhas de fim de dia (p\u00e3o que sobrou vira promo\u00e7\u00e3o autom\u00e1tica).',
  },
  {
    nicho: '🥩 A\u00e7ougue / Frigor\u00edfico',
    texto: 'Oi [Nome]! Trabalho com um sistema pra a\u00e7ougue que controla o vencimento da carne por lote, organiza o fiado e manda oferta da semana no WhatsApp dos clientes. Tem interesse?',
    dica:  'Foca na validade por lote (dor enorme) e no fiado digitalizado \u2014 muitos a\u00e7ougues ainda usam caderno.',
  },
  {
    nicho: '🍽️ Restaurante / Lanchonete',
    texto: 'Oi [Nome]! Vi seu restaurante aqui na regi\u00e3o. Tenho um sistema que controla o estoque de insumos, faz o caixa do dia e capta clientes via WhatsApp automaticamente. Posso te mostrar?',
    dica:  'Foca no caixa do dia e controle de insumos \u2014 restaurante sangra dinheiro sem controle do que entra e sai.',
  },
]

const OBJECOES = [
  { q: '"J\u00e1 tenho sistema"',               a: 'Qual voc\u00ea usa? Pergunto porque a maioria dos nossos clientes veio de outro sistema. O que te incomoda mais no atual? \u00c0s vezes a gente resolve exatamente isso.' },
  { q: '"T\u00e1 caro"',                         a: 'Entendo! S\u00e3o R$9,90 por dia \u2014 menos que um caf\u00e9 por funcion\u00e1rio. A maioria dos clientes recupera o investimento no primeiro m\u00eas s\u00f3 com a redu\u00e7\u00e3o de perda por vencimento.' },
  { q: '"N\u00e3o sei mexer com tecnologia"',    a: '\u00c9 tudo pelo celular, igual usar WhatsApp. Em 10 minutos t\u00e1 funcionando. Nossa equipe faz o onboarding junto com voc\u00ea, sem press\u00e3o.' },
  { q: '"Vou pensar"',                             a: 'Claro! S\u00f3 me fala: tem alguma d\u00favida espec\u00edfica? \u00c0s vezes \u00e9 uma coisa simples que a gente resolve agora e fica muito mais f\u00e1cil de decidir.' },
  { q: '"Preciso falar com meu s\u00f3cio"',     a: 'Faz sentido! Quer que eu te mande um resuminho com o sistema e pre\u00e7o pra voc\u00ea mostrar pra ele? Fica muito mais f\u00e1cil de apresentar assim.' },
]

export default function Afiliado() {
  const [params]  = useSearchParams()
  const [code,    setCode]    = useState(params.get('code') || '')
  const [input,   setInput]   = useState(params.get('code') || '')
  const [aff,     setAff]     = useState(null)
  const [loading, setLoading] = useState(!!params.get('code'))
  const [error,   setError]   = useState('')
  const [tabKit,  setTabKit]  = useState(0)
  const [openObj, setOpenObj] = useState(null)

  const load = async (c) => {
    if (!c) return
    setLoading(true); setError(''); setAff(null)
    try {
      const res = await fetch(`/api/affiliates?code=${encodeURIComponent(c.toLowerCase())}`)
      const d   = await res.json()
      if (d.ok) { setAff(d.affiliate); setCode(c.toLowerCase()) }
      else setError('C\u00f3digo n\u00e3o encontrado. Confira e tente novamente.')
    } catch { setError('Erro de conex\u00e3o. Tente novamente.') }
    setLoading(false)
  }

  useEffect(() => { if (params.get('code')) load(params.get('code')) }, [])

  const totalComissao = aff?.vendas?.reduce((s, v) => s + (v.comissao || 0), 0) ?? 0
  const totalVendas   = aff?.vendas?.length ?? 0
  const pct           = aff ? Math.round((aff.comissaoPct || 0.20) * 100) : 20
  const link          = aff ? `${BASE_URL}/login?ref=${aff.codigo}` : ''

  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Inter',system-ui,sans-serif;background:#f8fafc}
    @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
    @keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}
    .aff-tab{transition:all .18s;cursor:pointer}
    .aff-tab:hover{background:rgba(79,91,213,.06)!important}
  `

  const wppRecruta = 'Ol\u00e1 Pedro! Vi o programa de afiliados do ZatendeStok e quero me cadastrar como vendedor. Como funciona?'

  return (
    <div style={{ minHeight:'100vh', background:'#f8fafc', fontFamily:"'Inter',system-ui,sans-serif" }}>
      <style>{CSS}</style>

      {/* HERO */}
      <div style={{ background:'linear-gradient(155deg,#1e1b4b 0%,#312e81 50%,#1e3a8a 100%)', padding:'32px 20px 40px', position:'relative', overflow:'hidden' }}>
        <div aria-hidden style={{ position:'absolute',top:-60,right:-60,width:240,height:240,borderRadius:'50%',background:'rgba(99,102,241,.25)',filter:'blur(60px)',pointerEvents:'none' }} />
        <div style={{ maxWidth:520, margin:'0 auto' }}>
          <ZatendeStokLogo variant="full" />
          {!aff && (
            <div style={{ marginTop:28, animation:'fadeUp .35s ease' }}>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
                {['💰 Renda extra real','📱 Vende pelo celular','🏆 Sem investimento','📊 Rastreia tudo'].map(t => (
                  <span key={t} style={{ padding:'4px 12px', background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.15)', borderRadius:999, fontSize:11, fontWeight:700, color:'rgba(255,255,255,.8)' }}>{t}</span>
                ))}
              </div>
              <h1 style={{ color:'#fff', fontSize:28, fontWeight:900, lineHeight:1.2, marginBottom:10 }}>
                Ganhe at\u00e9 <span style={{ color:'#a5f3fc' }}>R$99/m\u00eas</span><br/>por cada cliente indicado.
              </h1>
              <p style={{ color:'rgba(255,255,255,.65)', fontSize:14, lineHeight:1.65 }}>
                Indique mercados, padarias, a\u00e7ougues e restaurantes da sua regi\u00e3o para o ZatendeStok.
                Voc\u00ea recebe <strong style={{ color:'#a5f3fc' }}>20% de comiss\u00e3o</strong> e acompanha tudo pelo celular \u2014 sem sair de casa.
              </p>
            </div>
          )}
          {aff && (
            <div style={{ marginTop:20, animation:'fadeUp .3s ease' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                <span style={{ width:8,height:8,borderRadius:'50%',background:'#4ade80',display:'inline-block',animation:'pulse 2s ease infinite' }} />
                <span style={{ color:'rgba(255,255,255,.5)', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em' }}>Vendedor ativo</span>
                <span style={{ padding:'2px 8px', background:'rgba(255,255,255,.12)', borderRadius:999, fontSize:11, fontWeight:800, color:'#a5f3fc' }}>{pct}% comiss\u00e3o</span>
              </div>
              <h1 style={{ color:'#fff', fontSize:24, fontWeight:900 }}>Ol\u00e1, {aff.nome.split(' ')[0]}! 👋</h1>
              <p style={{ color:'rgba(255,255,255,.55)', fontSize:13, marginTop:4 }}>C\u00f3digo: <strong style={{ color:'#a5f3fc', fontFamily:'monospace' }}>{aff.codigo}</strong></p>
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth:520, margin:'0 auto', padding:'24px 16px 48px' }}>

        {/* SEM LOGIN */}
        {!aff && (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:20 }}>
              {[
                { n:'R$59', s:'plano essencial', l:'por cliente/m\u00eas' },
                { n:'R$99', s:'plano profissional', l:'por cliente/m\u00eas' },
                { n:'\u221e',   s:'de clientes',   l:'sem limite' },
              ].map(c => (
                <div key={c.n} style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:'14px 10px', textAlign:'center' }}>
                  <p style={{ fontSize:22, fontWeight:900, color:'#4F5BD5', margin:'0 0 2px' }}>{c.n}</p>
                  <p style={{ fontSize:11, fontWeight:800, color:'#0f172a', margin:'0 0 2px' }}>{c.l}</p>
                  <p style={{ fontSize:10, color:'#94a3b8' }}>{c.s}</p>
                </div>
              ))}
            </div>

            <div style={{ background:'#fff', borderRadius:18, border:'1px solid #e2e8f0', padding:'22px 20px', marginBottom:20 }}>
              <h2 style={{ fontSize:17, fontWeight:900, color:'#0f172a', marginBottom:4 }}>J\u00e1 \u00e9 vendedor?</h2>
              <p style={{ fontSize:13, color:'#64748b', marginBottom:16 }}>Digite seu c\u00f3digo para acessar seu painel.</p>
              <div style={{ display:'flex', gap:10 }}>
                <input value={input} onChange={e => setInput(e.target.value.toLowerCase())}
                  onKeyDown={e => e.key === 'Enter' && load(input)}
                  placeholder="seu c\u00f3digo (ex: pedro)"
                  style={{ flex:1, padding:'12px 14px', border:'1.5px solid #e2e8f0', borderRadius:10, fontSize:15, color:'#0f172a', fontFamily:'inherit', outline:'none' }} />
                <button onClick={() => load(input)} disabled={loading || !input.trim()}
                  style={{ padding:'12px 20px', background:'#4F5BD5', border:'none', borderRadius:10, color:'#fff', fontWeight:800, fontSize:14, cursor:'pointer', opacity: loading||!input.trim()?0.55:1 }}>
                  {loading ? <Loader2 size={16} style={{ animation:'spin 1s linear infinite' }}/> : 'Entrar'}
                </button>
              </div>
              {error && <p style={{ color:'#ef4444', fontSize:12, marginTop:8 }}>\u26a0 {error}</p>}
            </div>

            <div style={{ background:'linear-gradient(135deg,#4F5BD5,#3730A3)', borderRadius:18, padding:'22px 20px', marginBottom:20, color:'#fff' }}>
              <p style={{ fontSize:13, fontWeight:700, color:'rgba(255,255,255,.7)', marginBottom:6 }}>Ainda n\u00e3o \u00e9 vendedor?</p>
              <h3 style={{ fontSize:18, fontWeight:900, marginBottom:8, lineHeight:1.25 }}>Comece a ganhar hoje.<br/>\u00c9 de gra\u00e7a, sem investimento.</h3>
              <p style={{ fontSize:13, color:'rgba(255,255,255,.7)', lineHeight:1.6, marginBottom:18 }}>
                Entre em contato com Pedro e receba seu c\u00f3digo exclusivo, seu link de indica\u00e7\u00e3o e o kit completo de vendas \u2014 tudo pelo WhatsApp, agora.
              </p>
              <button onClick={() => openWpp(wppRecruta)}
                style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, width:'100%', padding:'14px', border:'none', borderRadius:12, background:'#22c55e', color:'#fff', fontWeight:800, fontSize:15, cursor:'pointer', boxShadow:'0 4px 16px rgba(34,197,94,.35)' }}>
                📲 Quero ser afiliado \u2014 falar agora
              </button>
            </div>

            <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:18, padding:'20px', marginBottom:20 }}>
              <h3 style={{ fontSize:15, fontWeight:900, color:'#0f172a', marginBottom:16 }}>Como funciona em 4 passos</h3>
              {[
                { emoji:'📋', title:'Recebe seu c\u00f3digo e link',   desc:'Pedro te cadastra e voc\u00ea recebe um link \u00fanico. Ex: zatendestok.com.br/login?ref=seucodigo' },
                { emoji:'📲', title:'Indica pelo celular',              desc:'Manda por WhatsApp, Instagram, pessoalmente. N\u00e3o precisa explicar nada t\u00e9cnico.' },
                { emoji:'\u2705',    title:'Cliente se cadastra',              desc:'O cliente acessa seu link e solicita o acesso. Nossa equipe ativa em at\u00e9 2 horas.' },
                { emoji:'💰', title:'Voc\u00ea recebe a comiss\u00e3o', desc:'20% do plano contratado. Pagamento combinado diretamente com Pedro.' },
              ].map((s, i) => (
                <div key={i} style={{ display:'flex', gap:14, marginBottom:14 }}>
                  <div style={{ width:36, height:36, borderRadius:10, background:'#eef2ff', border:'1.5px solid #c7d2fe', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>{s.emoji}</div>
                  <div>
                    <p style={{ fontSize:13, fontWeight:800, color:'#0f172a', margin:'3px 0 2px' }}>{s.title}</p>
                    <p style={{ fontSize:12, color:'#64748b', margin:0, lineHeight:1.5 }}>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:18, padding:'20px', marginBottom:20 }}>
              <h3 style={{ fontSize:15, fontWeight:900, color:'#0f172a', marginBottom:4 }}>Para quem voc\u00ea indica?</h3>
              <p style={{ fontSize:13, color:'#64748b', marginBottom:14 }}>Qualquer neg\u00f3cio de alimenta\u00e7\u00e3o que ainda n\u00e3o usa o sistema.</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[['🏪','Mercados'],['🥖','Padarias'],['🥩','A\u00e7ougues'],['🍽️','Restaurantes'],['🌯','Lanchonetes'],['🚚','Distribuidoras']].map(([e,t]) => (
                  <div key={t} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10 }}>
                    <span style={{ fontSize:20 }}>{e}</span>
                    <div>
                      <p style={{ fontSize:13, fontWeight:700, color:'#0f172a', margin:0 }}>{t}</p>
                      <p style={{ fontSize:10, color:'#22c55e', fontWeight:700, margin:0 }}>R$59\u2013R$99/cliente</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={() => openWpp(wppRecruta)}
              style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, width:'100%', padding:'16px', border:'none', borderRadius:14, background:'linear-gradient(135deg,#22c55e,#16a34a)', color:'#fff', fontWeight:900, fontSize:16, cursor:'pointer', boxShadow:'0 4px 20px rgba(34,197,94,.3)', marginBottom:10 }}>
              📲 Quero ser afiliado agora
            </button>
            <p style={{ textAlign:'center', fontSize:12, color:'#94a3b8', marginBottom:8 }}>Gr\u00e1tis \u00b7 Sem contrato \u00b7 20% de comiss\u00e3o</p>
          </>
        )}

        {/* DASHBOARD */}
        {aff && (
          <div style={{ animation:'fadeUp .3s ease' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
              <StatCard emoji="🏆" label="Convers\u00f5es"     value={totalVendas}   sub={`${totalVendas} cliente${totalVendas!==1?'s':''} ativo${totalVendas!==1?'s':''}`} />
              <StatCard emoji="💰" label="Comiss\u00e3o total" value={`R$${totalComissao.toFixed(2).replace('.',',')}`} sub="a receber do Pedro" />
            </div>

            {totalVendas > 0 && (
              <div style={{ background:'linear-gradient(135deg,#4F5BD5,#3730A3)', borderRadius:14, padding:'14px 18px', marginBottom:14, display:'flex', alignItems:'center', gap:14 }}>
                <span style={{ fontSize:24 }}>📈</span>
                <div>
                  <p style={{ color:'rgba(255,255,255,.7)', fontSize:11, fontWeight:700, margin:'0 0 2px' }}>PROJE\u00c7\u00c3O</p>
                  <p style={{ color:'#fff', fontSize:15, fontWeight:900, margin:0 }}>
                    Mais {Math.max(1,5-totalVendas)} indica\u00e7\u00e3o{5-totalVendas!==1?'s':''} e voc\u00ea chega a{' '}
                    <span style={{ color:'#a5f3fc' }}>R${Math.round(totalComissao + Math.max(1,5-totalVendas)*99)}/m\u00eas</span>
                  </p>
                </div>
              </div>
            )}

            <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, padding:'18px 20px', marginBottom:14 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                <Link2 size={15} color="#4F5BD5" />
                <span style={{ fontSize:13, fontWeight:800, color:'#0f172a' }}>Seu link de indica\u00e7\u00e3o</span>
              </div>
              <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:8, padding:'10px 12px', fontSize:12, color:'#4F5BD5', wordBreak:'break-all', marginBottom:12, fontFamily:'monospace', fontWeight:600 }}>
                {link}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <CopyBtn value={link} label="Copiar link" />
                <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent('Ei! Conhe\u00e7a o ZatendeStok \u2014 sistema de gest\u00e3o pra neg\u00f3cios de alimenta\u00e7\u00e3o. Acesse pelo meu link: ' + link)}`, '_blank')}
                  style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'11px', border:'none', borderRadius:10, background:'#22c55e', cursor:'pointer', color:'#fff', fontSize:13, fontWeight:800 }}>
                  📲 Compartilhar
                </button>
              </div>
            </div>

            {/* Kit de vendas */}
            <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, overflow:'hidden', marginBottom:14 }}>
              <div style={{ borderBottom:'1px solid #e2e8f0', display:'flex' }}>
                {['🎯 Scripts','💬 Obje\u00e7\u00f5es','📋 Msgs WA'].map((t, i) => (
                  <button key={i} onClick={() => setTabKit(i)} className="aff-tab"
                    style={{ flex:1, padding:'12px 4px', border:'none', background: tabKit===i?'#eef2ff':'transparent',
                      color: tabKit===i?'#4F5BD5':'#64748b', fontWeight: tabKit===i?800:600, fontSize:11, cursor:'pointer',
                      borderBottom: tabKit===i?'2px solid #4F5BD5':'2px solid transparent' }}>
                    {t}
                  </button>
                ))}
              </div>
              <div style={{ padding:'16px' }}>

                {tabKit===0 && (
                  <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                    <p style={{ fontSize:12, color:'#64748b' }}>Copie, adapte o nome e mande. Funciona por WA e pessoalmente.</p>
                    {SCRIPTS.map(s => (
                      <div key={s.nicho} style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:12, padding:'14px' }}>
                        <p style={{ fontSize:12, fontWeight:800, color:'#4F5BD5', marginBottom:8 }}>{s.nicho}</p>
                        <p style={{ fontSize:12.5, color:'#334155', lineHeight:1.6, marginBottom:10, fontStyle:'italic' }}>"{s.texto}"</p>
                        <div style={{ background:'#eef2ff', borderRadius:8, padding:'8px 12px', marginBottom:10 }}>
                          <p style={{ fontSize:11, fontWeight:700, color:'#4F5BD5', margin:'0 0 2px' }}>DICA:</p>
                          <p style={{ fontSize:11, color:'#4F5BD5', margin:0, lineHeight:1.5 }}>{s.dica}</p>
                        </div>
                        <CopyBtn value={s.texto.replace('[Nome]', '')} label="Copiar script" full />
                      </div>
                    ))}
                  </div>
                )}

                {tabKit===1 && (
                  <div>
                    <p style={{ fontSize:12, color:'#64748b', marginBottom:12 }}>O que fazer quando o cliente resistir.</p>
                    {OBJECOES.map((o, i) => (
                      <div key={i} style={{ border:'1px solid #e2e8f0', borderRadius:10, overflow:'hidden', marginBottom:8 }}>
                        <button onClick={() => setOpenObj(openObj===i ? null : i)}
                          style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 14px', background: openObj===i?'#eef2ff':'#fff', border:'none', cursor:'pointer' }}>
                          <span style={{ fontSize:13, fontWeight:700, color:'#0f172a', textAlign:'left' }}>{o.q}</span>
                          {openObj===i ? <ChevronUp size={15} color="#64748b"/> : <ChevronDown size={15} color="#64748b"/>}
                        </button>
                        {openObj===i && (
                          <div style={{ padding:'0 14px 14px', background:'#f8fafc' }}>
                            <p style={{ fontSize:13, color:'#334155', lineHeight:1.6, margin:'8px 0 10px', fontStyle:'italic' }}>"{o.a}"</p>
                            <CopyBtn value={o.a} label="Copiar resposta" full />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {tabKit===2 && (() => {
                  const msgs = [
                    {
                      label: '1\u00aa abordagem',
                      msg: 'Oi [Nome]! Tudo bem? 👋\n\nPassei pra te apresentar o ZatendeStok \u2014 sistema de gest\u00e3o que t\u00e1 ajudando muito neg\u00f3cio da regi\u00e3o.\n\nControla estoque, faz o caixa, gerencia fiado e ainda manda promo\u00e7\u00e3o autom\u00e1tica no WhatsApp dos clientes. Tudo no celular, sem instalar nada.\n\nTem interesse em conhecer? Posso te mandar mais detalhes! 😊',
                    },
                    {
                      label: 'Seguimento (n\u00e3o respondeu)',
                      msg: 'Oi [Nome]! 😊 S\u00f3 passando pra ver se voc\u00ea chegou a ver minha mensagem.\n\nN\u00e3o precisa decidir nada agora \u2014 posso s\u00f3 te mostrar como funciona em 5 minutos?\n\nA maioria das pessoas que v\u00ea fica surpresa com o quanto \u00e9 simples. Qual dia fica melhor?',
                    },
                    {
                      label: 'Envio do link',
                      msg: '[Nome], aqui est\u00e1 o link pra conhecer e solicitar o acesso:\n\n' + link + '\n\nNossa equipe ativa em at\u00e9 2 horas, sem burocracia. Qualquer d\u00favida \u00e9 s\u00f3 chamar! 🚀',
                    },
                  ]
                  return (
                    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                      <p style={{ fontSize:12, color:'#64748b' }}>Mensagens prontas. Copie e edite o nome do cliente.</p>
                      {msgs.map(m => (
                        <div key={m.label} style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:12, padding:'14px' }}>
                          <p style={{ fontSize:11, fontWeight:800, color:'#4F5BD5', marginBottom:8, textTransform:'uppercase', letterSpacing:'.06em' }}>{m.label}</p>
                          <p style={{ fontSize:12.5, color:'#334155', lineHeight:1.6, marginBottom:10, whiteSpace:'pre-line' }}>{m.msg}</p>
                          <CopyBtn value={m.msg} label="Copiar mensagem" full />
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>

            {aff.vendas?.length > 0 && (
              <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, overflow:'hidden', marginBottom:14 }}>
                <div style={{ padding:'14px 18px', borderBottom:'1px solid #e2e8f0' }}>
                  <p style={{ fontSize:13, fontWeight:800, color:'#0f172a', margin:0 }}>Hist\u00f3rico de convers\u00f5es</p>
                </div>
                {[...aff.vendas].reverse().map((v, i) => (
                  <div key={i} style={{ padding:'12px 18px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div>
                      <p style={{ fontSize:13, fontWeight:700, color:'#0f172a', margin:'0 0 2px' }}>{v.mercado}</p>
                      <p style={{ fontSize:11, color:'#94a3b8', margin:0 }}>{v.niche} \u00b7 {v.plano} \u00b7 {v.creditedAt ? new Date(v.creditedAt).toLocaleDateString('pt-BR') : '\u2014'}</p>
                    </div>
                    <span style={{ fontSize:14, fontWeight:900, color: v.comissao > 0 ? '#22c55e' : '#94a3b8' }}>
                      {v.comissao > 0 ? `R$${v.comissao.toFixed(2).replace('.',',')}` : 'pendente'}
                    </span>
                  </div>
                ))}
                <div style={{ padding:'12px 18px', background:'#f8fafc', display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontSize:12, fontWeight:700, color:'#64748b' }}>Total acumulado</span>
                  <span style={{ fontSize:15, fontWeight:900, color:'#22c55e' }}>R${totalComissao.toFixed(2).replace('.',',')}</span>
                </div>
              </div>
            )}

            <button onClick={() => openWpp(`Oi Pedro! Sou o ${aff.nome}, c\u00f3digo ${aff.codigo}. Tenho uma d\u00favida sobre o programa de afiliados.`)}
              style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, width:'100%', padding:'14px', border:'none', borderRadius:12, background:'#22c55e', color:'#fff', fontWeight:800, fontSize:14, cursor:'pointer', marginBottom:10 }}>
              💬 Falar com Pedro
            </button>
            <button onClick={() => { setAff(null); setCode(''); setInput('') }}
              style={{ display:'block', width:'100%', padding:'11px', background:'none', border:'1px solid #e2e8f0', borderRadius:12, color:'#64748b', fontSize:13, fontWeight:600, cursor:'pointer' }}>
              \u2190 Sair
            </button>
          </div>
        )}

        <p style={{ textAlign:'center', fontSize:11, color:'#cbd5e1', marginTop:28 }}>
          ZatendeStok \u00b7 Portal do Vendedor \u00b7 <a href="/" style={{ color:'#94a3b8' }}>P\u00e1gina inicial</a>
        </p>
      </div>
    </div>
  )
}
