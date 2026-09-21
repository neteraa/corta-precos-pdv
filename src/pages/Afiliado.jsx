import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2, Copy, CheckCircle2, TrendingUp, DollarSign, Users, Link2 } from 'lucide-react'
import ZatendeStokLogo from '../components/ZatendeStokLogo.jsx'

const BASE_URL = 'https://zatendestok.com.br'

function StatCard({ icon: Icon, label, value, color = '#4F5BD5', sub }) {
  return (
    <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, padding:'18px 20px', display:'flex', flexDirection:'column', gap:6 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <div style={{ width:36, height:36, borderRadius:10, background:`${color}18`, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon size={18} color={color} />
        </div>
        <span style={{ fontSize:12, fontWeight:600, color:'#64748b', letterSpacing:'.04em' }}>{label}</span>
      </div>
      <p style={{ fontSize:28, fontWeight:900, color:'#0f172a', margin:0 }}>{value}</p>
      {sub && <p style={{ fontSize:11, color:'#94a3b8', margin:0 }}>{sub}</p>}
    </div>
  )
}

function CopyButton({ value, label }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button onClick={copy}
      style={{ display:'flex', alignItems:'center', gap:8, padding:'11px 16px', border:'1.5px solid #e2e8f0', borderRadius:10, background:'#fff', cursor:'pointer', color:'#0f172a', fontSize:13, fontWeight:600, transition:'all .15s' }}>
      {copied ? <CheckCircle2 size={16} color="#22c55e"/> : <Copy size={16} color="#64748b"/>}
      {copied ? 'Copiado!' : label}
    </button>
  )
}

export default function Afiliado() {
  const [params] = useSearchParams()
  const [code,   setCode]   = useState(params.get('code') || '')
  const [input,  setInput]  = useState(params.get('code') || '')
  const [aff,    setAff]    = useState(null)
  const [loading,setLoading]= useState(!!params.get('code'))
  const [error,  setError]  = useState('')

  const load = async (c) => {
    if (!c) return
    setLoading(true); setError(''); setAff(null)
    try {
      const res = await fetch(`/api/affiliates?code=${encodeURIComponent(c.toLowerCase())}`)
      const d   = await res.json()
      if (d.ok) { setAff(d.affiliate); setCode(c.toLowerCase()) }
      else setError('Código não encontrado. Verifique e tente novamente.')
    } catch { setError('Erro de conexão. Tente novamente.') }
    setLoading(false)
  }

  useEffect(() => { if (params.get('code')) load(params.get('code')) }, [])

  const totalVendas   = aff?.vendas?.length  ?? 0
  const totalComissao = aff?.vendas?.reduce((s, v) => s + (v.comissao || 0), 0) ?? 0
  const link          = aff ? `${BASE_URL}/login?ref=${aff.codigo}` : ''
  const pct           = aff ? Math.round((aff.comissaoPct || 0.20) * 100) : 20

  return (
    <div style={{ minHeight:'100vh', background:'#f8fafc', fontFamily:"'Inter',system-ui,sans-serif" }}>
      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#1e1b4b,#312e81)', padding:'24px 20px 20px' }}>
        <ZatendeStokLogo variant="full" />
        <p style={{ color:'rgba(255,255,255,.6)', fontSize:13, marginTop:8 }}>Portal do Vendedor</p>
      </div>

      <div style={{ maxWidth:480, margin:'0 auto', padding:'24px 16px' }}>

        {/* Busca por código */}
        {!aff && (
          <div style={{ background:'#fff', borderRadius:18, border:'1px solid #e2e8f0', padding:'24px 20px', marginBottom:20 }}>
            <h2 style={{ fontSize:18, fontWeight:900, color:'#0f172a', marginBottom:6 }}>Acesse seu painel</h2>
            <p style={{ fontSize:13, color:'#64748b', marginBottom:18 }}>Digite seu código de vendedor para ver suas comissões.</p>
            <div style={{ display:'flex', gap:10 }}>
              <input
                value={input} onChange={e => setInput(e.target.value.toLowerCase())}
                onKeyDown={e => e.key === 'Enter' && load(input)}
                placeholder="Seu código (ex: pedro)"
                style={{ flex:1, padding:'11px 14px', border:'1.5px solid #e2e8f0', borderRadius:10, fontSize:15, color:'#0f172a', fontFamily:'inherit', outline:'none' }}
              />
              <button onClick={() => load(input)} disabled={loading || !input.trim()}
                style={{ padding:'11px 20px', background:'#4F5BD5', border:'none', borderRadius:10, color:'#fff', fontWeight:800, fontSize:14, cursor:'pointer', opacity:loading||!input.trim()?0.6:1 }}>
                {loading ? <Loader2 size={16} style={{ animation:'spin 1s linear infinite' }}/> : 'Entrar'}
              </button>
            </div>
            {error && <p style={{ color:'#ef4444', fontSize:12, marginTop:8 }}>⚠ {error}</p>}
          </div>
        )}

        {/* Dashboard do afiliado */}
        {aff && (
          <>
            {/* Boas-vindas */}
            <div style={{ background:'linear-gradient(135deg,#4F5BD5,#3730A3)', borderRadius:18, padding:'20px', marginBottom:16, color:'#fff' }}>
              <p style={{ fontSize:12, opacity:.7, marginBottom:4 }}>Olá, vendedor!</p>
              <h2 style={{ fontSize:22, fontWeight:900, margin:'0 0 4px' }}>{aff.nome}</h2>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:12, opacity:.8 }}>Código: <strong>{aff.codigo}</strong></span>
                <span style={{ padding:'2px 8px', background:'rgba(255,255,255,.15)', borderRadius:999, fontSize:11, fontWeight:700 }}>{pct}% comissão</span>
                {!aff.ativo && <span style={{ padding:'2px 8px', background:'#ef4444', borderRadius:999, fontSize:11, fontWeight:700 }}>Inativo</span>}
              </div>
            </div>

            {/* Stats */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
              <StatCard icon={Users}      label="Conversões"     value={totalVendas}   color="#4F5BD5"
                sub={totalVendas === 1 ? '1 cliente ativo' : `${totalVendas} clientes ativos`} />
              <StatCard icon={DollarSign} label="Comissão Total" value={`R$${totalComissao.toFixed(2).replace('.',',')}`} color="#22c55e"
                sub="Aguardando pagamento" />
            </div>

            {/* Link de indicação */}
            <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, padding:'18px 20px', marginBottom:16 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                <Link2 size={16} color="#4F5BD5"/>
                <span style={{ fontSize:13, fontWeight:700, color:'#0f172a' }}>Seu link de indicação</span>
              </div>
              <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:8, padding:'10px 12px', fontSize:12, color:'#64748b', wordBreak:'break-all', marginBottom:10, fontFamily:'monospace' }}>
                {link}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <CopyButton value={link} label="Copiar link" />
                <button
                  onClick={() => {
                    const msg = `Olá! Eu indico o ZatendeStok para o seu negócio — sistema de gestão de estoque, PDV e bot de vendas no WhatsApp. Acesse pelo meu link e já começa a testar: ${link}`
                    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
                  }}
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'11px 16px', border:'none', borderRadius:10, background:'#22c55e', cursor:'pointer', color:'#fff', fontSize:13, fontWeight:700 }}>
                  📲 Compartilhar
                </button>
              </div>
            </div>

            {/* Como funciona */}
            <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, padding:'18px 20px', marginBottom:16 }}>
              <p style={{ fontSize:13, fontWeight:800, color:'#0f172a', marginBottom:14 }}>Como funciona</p>
              {[
                { n:'1', title:'Compartilha seu link', desc:'Manda para mercados, padarias, açougues, restaurantes da sua região.' },
                { n:'2', title:'Cliente solicita acesso', desc:'O cliente clica no link e preenche o formulário com seu código.' },
                { n:'3', title:'Admin aprova e ativa', desc:'Nossa equipe ativa em até 2 horas e o cliente já começa a usar.' },
                { n:'4', title:'Você recebe a comissão', desc:`${pct}% do valor do plano (R$${Math.round(297*pct/100)}–R$${Math.round(497*pct/100)}/mês por cliente ativo).` },
              ].map(s => (
                <div key={s.n} style={{ display:'flex', gap:12, marginBottom:12 }}>
                  <div style={{ width:26, height:26, borderRadius:'50%', background:'#eef2ff', border:'1.5px solid #c7d2fe', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, color:'#4F5BD5', flexShrink:0 }}>
                    {s.n}
                  </div>
                  <div>
                    <p style={{ fontSize:13, fontWeight:700, color:'#0f172a', margin:'2px 0 2px' }}>{s.title}</p>
                    <p style={{ fontSize:12, color:'#64748b', margin:0 }}>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Histórico de vendas */}
            {aff.vendas?.length > 0 && (
              <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, overflow:'hidden' }}>
                <div style={{ padding:'14px 20px', borderBottom:'1px solid #e2e8f0' }}>
                  <p style={{ fontSize:13, fontWeight:800, color:'#0f172a', margin:0 }}>Histórico de vendas</p>
                </div>
                {[...aff.vendas].reverse().map((v, i) => (
                  <div key={i} style={{ padding:'12px 20px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div>
                      <p style={{ fontSize:13, fontWeight:700, color:'#0f172a', margin:'0 0 2px' }}>{v.mercado}</p>
                      <p style={{ fontSize:11, color:'#94a3b8', margin:0 }}>
                        {v.niche} · {v.plano} · {v.creditedAt ? new Date(v.creditedAt).toLocaleDateString('pt-BR') : '—'}
                      </p>
                    </div>
                    <span style={{ fontSize:14, fontWeight:900, color:'#22c55e' }}>
                      R${(v.comissao||0).toFixed(2).replace('.',',')}
                    </span>
                  </div>
                ))}
                <div style={{ padding:'12px 20px', background:'#f8fafc', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:12, fontWeight:700, color:'#64748b' }}>Total acumulado</span>
                  <span style={{ fontSize:16, fontWeight:900, color:'#22c55e' }}>R${totalComissao.toFixed(2).replace('.',',')}</span>
                </div>
              </div>
            )}

            <button onClick={() => { setAff(null); setCode(''); setInput('') }}
              style={{ display:'block', width:'100%', marginTop:16, padding:'12px', background:'none', border:'1px solid #e2e8f0', borderRadius:12, color:'#64748b', fontSize:13, fontWeight:600, cursor:'pointer' }}>
              ← Sair
            </button>
          </>
        )}

        <p style={{ textAlign:'center', fontSize:12, color:'#cbd5e1', marginTop:24 }}>
          ZatendeStok · Portal do Vendedor · <a href="/" style={{ color:'#94a3b8' }}>Página inicial</a>
        </p>
      </div>
    </div>
  )
}
