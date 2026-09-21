import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, Lock, User, MessageCircle, CheckCircle2, ArrowRight, ArrowLeft, Phone, MapPin, ShieldCheck, Zap, Headphones, Bell, BarChart3, Wifi, Store, Truck } from 'lucide-react'
import { getCredentials, getConfiguredStoreId, saveStoreId } from '../utils/auth.js'
import { registerStoreId, wipeLegacyFlatKeys } from '../utils/tenantStorage.js'
import { seedSettingsFromSession } from '../hooks/usePrinter.js'
import ZatendeStokLogo from '../components/ZatendeStokLogo.jsx'

const ZAP         = '5515997969303'
const ZAP_DISPLAY = '(15) 99796-9303'
const openWpp     = (msg) => window.open(`https://wa.me/${ZAP}?text=${encodeURIComponent(msg)}`, '_blank')

const B = { blue:'#4F5BD5', blueDk:'#3730A3', green:'#22c55e', greenDk:'#16a34a', text:'#0f172a', muted:'#64748b', border:'#e2e8f0', bg:'#f8fafc' }

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter',system-ui,sans-serif}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
  @keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}
  .inp:focus{outline:none;border-color:#4F5BD5!important;box-shadow:0 0 0 3px rgba(79,91,213,.12)!important}
  .inp::placeholder{color:#94a3b8}
  .btn-blue{transition:all .18s}
  .btn-blue:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 8px 28px rgba(79,91,213,.35)!important}
  .btn-wpp{transition:all .18s}
  .btn-wpp:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(34,197,94,.35)!important}
  .tab-pill{transition:all .2s}
  .tab-pill.active{background:#fff!important;color:#0f172a!important;box-shadow:0 1px 6px rgba(0,0,0,.1)!important}
  .tipo-card{transition:all .2s;cursor:pointer}
  .tipo-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.1)!important}
  @media(max-width:899px){.lp{display:none!important}.mob-hdr{display:block!important}}
`

function Inp({ label, icon: Icon, right, topRight, ...props }) {
  return (
    <div>
      {(label || topRight) && (
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
          {label && <label style={{ fontSize:12, fontWeight:600, color:B.muted, letterSpacing:'.04em' }}>{label}</label>}
          {topRight}
        </div>
      )}
      <div style={{ position:'relative' }}>
        {Icon && <Icon size={15} color="#94a3b8" style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} />}
        <input className="inp" {...props} style={{ width:'100%', border:`1.5px solid ${B.border}`, borderRadius:10, padding:`12px 14px 12px ${Icon?38:14}px`, paddingRight:right?44:14, fontSize:15, color:B.text, background:'#fff', transition:'border-color .2s,box-shadow .2s', ...props.style }} />
        {right}
      </div>
    </div>
  )
}

const FEATS = [
  { icon:Bell,          color:'#fbbf24', text:'Alertas antes do estoque acabar'         },
  { icon:MessageCircle, color:'#4ade80', text:'Bot de vendas e promoções via WhatsApp'   },
  { icon:BarChart3,     color:'#818cf8', text:'Relatórios e caixa do dia em tempo real'  },
  { icon:Wifi,          color:'#38bdf8', text:'Funciona 24h no celular, sem instalar app'},
]

const NICHES_FOR = [
  { emoji:'🏪', label:'Mercado'    },
  { emoji:'🥖', label:'Padaria'    },
  { emoji:'🥩', label:'Açougue'   },
  { emoji:'🍽️', label:'Restaurante'},
  { emoji:'🚚', label:'Distribuid.'},
]

function LeftPanel() {
  return (
    <div className="lp" style={{ flex:'0 0 400px', background:'linear-gradient(155deg,#1e1b4b 0%,#312e81 45%,#1e3a8a 100%)', padding:'48px 40px', display:'flex', flexDirection:'column', justifyContent:'space-between', position:'relative', overflow:'hidden' }}>
      <div aria-hidden style={{ position:'absolute', top:-80, right:-80, width:300, height:300, borderRadius:'50%', background:'rgba(99,102,241,.25)', filter:'blur(60px)', pointerEvents:'none' }} />
      <div aria-hidden style={{ position:'absolute', bottom:-60, left:-60, width:250, height:250, borderRadius:'50%', background:'rgba(34,197,94,.15)', filter:'blur(50px)', pointerEvents:'none' }} />
      <div aria-hidden style={{ position:'absolute', inset:0, backgroundImage:'radial-gradient(circle,rgba(255,255,255,.04) 1px,transparent 1px)', backgroundSize:'28px 28px', pointerEvents:'none' }} />
      <div style={{ position:'relative' }}>
        <ZatendeStokLogo variant="full" />
        <div style={{ marginTop:40 }}>
          <div style={{ color:'rgba(255,255,255,.45)', fontSize:11, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', marginBottom:10 }}>Por que nos escolher</div>
          <h2 style={{ color:'#fff', fontSize:27, fontWeight:900, lineHeight:1.25, marginBottom:8 }}>Gestão pra quem<br/>vende de verdade.</h2>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:28 }}>
            {NICHES_FOR.map(n => (
              <span key={n.label} style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 10px', background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.12)', borderRadius:999, fontSize:11, fontWeight:700, color:'rgba(255,255,255,.65)' }}>
                {n.emoji} {n.label}
              </span>
            ))}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {FEATS.map(({ icon:Icon, color, text }) => (
              <div key={text} style={{ display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ width:36, height:36, borderRadius:10, background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <Icon size={16} color={color} />
                </div>
                <span style={{ color:'rgba(255,255,255,.75)', fontSize:14, fontWeight:500, lineHeight:1.4 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ position:'relative', marginTop:40, padding:'16px 18px', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', borderRadius:14 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background:'#4ade80', display:'inline-block', animation:'pulse 2s ease infinite' }} />
          <span style={{ color:'rgba(255,255,255,.45)', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em' }}>Sistema ativo agora</span>
        </div>
        <p style={{ color:'rgba(255,255,255,.4)', fontSize:12, lineHeight:1.6 }}>Novo acesso criado em até 2 horas · Suporte {ZAP_DISPLAY}</p>
      </div>
    </div>
  )
}

function RecoverPanel({ username, onClose }) {
  const msg = username
    ? `Olá! Preciso recuperar minha senha da ZatendeStok.\n\nMeu usuário é: *${username}*`
    : 'Olá! Preciso recuperar minha senha da ZatendeStok.'
  return (
    <div style={{ animation:'fadeUp .3s ease' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <div style={{ width:44, height:44, borderRadius:12, background:'#f0fdf4', border:'1px solid #bbf7d0', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Headphones size={20} color={B.green} />
        </div>
        <div>
          <div style={{ fontWeight:800, fontSize:17, color:B.text }}>Recuperar senha</div>
          <div style={{ color:B.muted, fontSize:13 }}>Nosso suporte resolve em minutos</div>
        </div>
      </div>
      <p style={{ color:B.muted, fontSize:14, lineHeight:1.7, marginBottom:20 }}>Envie uma mensagem e redefinimos sua senha rapidinho.</p>
      <button className="btn-wpp" onClick={() => openWpp(msg)}
        style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, width:'100%', padding:'14px', border:'none', borderRadius:12, cursor:'pointer', background:`linear-gradient(135deg,${B.green},${B.greenDk})`, color:'#fff', fontWeight:800, fontSize:15, boxShadow:'0 4px 16px rgba(34,197,94,.25)' }}>
        <MessageCircle size={18} /> Falar com suporte no WhatsApp
      </button>
      <button onClick={onClose}
        style={{ display:'block', width:'100%', marginTop:12, padding:'10px', background:'none', border:`1px solid ${B.border}`, borderRadius:10, color:B.muted, fontSize:13, fontWeight:600, cursor:'pointer' }}>
        ← Voltar ao login
      </button>
    </div>
  )
}

/* ── Configs de nicho ──────────────────────────────────────── */
const NICHE_CFG = [
  {
    id:'mercado',     tipo:'mercado',
    emoji:'🏪', label:'Mercado / Loja',
    color:B.blue, bg:'#eef2ff', brd:'#c7d2fe',
    desc:'Estoque FIFO, PDV, validade, fiado e pedidos ao distribuidor',
    nomePlaceholder:'Ex: Mercado Central',   nomeLabel:'Nome do mercado',
  },
  {
    id:'padaria',     tipo:'mercado',
    emoji:'🥖', label:'Padaria / Confeitaria',
    color:'#d97706', bg:'#fffbeb', brd:'#fde68a',
    desc:'Controle de insumos, PDV no balcão e campanhas via WhatsApp',
    nomePlaceholder:'Ex: Padaria São José',  nomeLabel:'Nome da padaria',
  },
  {
    id:'açougue',     tipo:'mercado',
    emoji:'🥩', label:'Açougue / Frigorífico',
    color:'#dc2626', bg:'#fef2f2', brd:'#fecaca',
    desc:'Validade por lote, PDV por peso e controle de cortes',
    nomePlaceholder:'Ex: Açougue do Zé',    nomeLabel:'Nome do açougue',
  },
  {
    id:'restaurante', tipo:'mercado',
    emoji:'🍽️', label:'Restaurante / Lanchonete',
    color:'#7c3aed', bg:'#f5f3ff', brd:'#ddd6fe',
    desc:'Estoque de insumos, caixa do dia e captação de clientes',
    nomePlaceholder:'Ex: Restaurante Bela Vista', nomeLabel:'Nome do restaurante',
  },
  {
    id:'distribuidor', tipo:'distribuidor',
    emoji:'🚚', label:'Distribuidora / Atacado',
    color:B.green, bg:'#f0fdf4', brd:'#bbf7d0',
    desc:'Portal de ofertas, gestão de pedidos e conexão com mercados',
    nomePlaceholder:'Ex: Distribuidora São Paulo', nomeLabel:'Nome da distribuidora',
  },
]

/* ── Cadastro multi-step COM seleção de tipo ─────────────── */
function CadastroFlow() {
  const [niche,  setNiche]  = useState(null)   // null | id de NICHE_CFG
  const [affRef, setAffRef] = useState('')     // código do afiliado se ?ref=xxx
  const [step,   setStep]   = useState(1)
  const [form,   setForm]   = useState({ nome:'', empresa:'', cidade:'', telefone:'', email:'' })
  const [sent,   setSent]   = useState(false)
  const [errs,   setErrs]   = useState({})
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const cfg  = NICHE_CFG.find(n => n.id === niche)
  const tipo = cfg?.tipo || 'mercado'

  // Captura ?ref= do afiliado na URL
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref') || ''
    if (ref) setAffRef(ref.toLowerCase().trim())
  }, [])

  const validate = () => {
    const e = {}
    if (!form.nome.trim())     e.nome     = 'Informe seu nome'
    if (!form.empresa.trim())  e.empresa  = cfg ? `Informe o ${cfg.nomeLabel.toLowerCase()}` : 'Informe o nome do negócio'
    if (!form.cidade.trim())   e.cidade   = 'Informe a cidade'
    if (!form.telefone.trim()) e.telefone = 'Informe o WhatsApp'
    setErrs(e); return Object.keys(e).length === 0
  }

  const solicitar = async () => {
    setSent(true)
    try {
      await fetch('/api/request-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, mercado: form.empresa, tipo, niche, ref: affRef }),
      })
    } catch {}
    openWpp(`🛒 *Solicitação de cadastro — ZatendeStok*\n\n👤 Nome: *${form.nome}*\n🏪 ${cfg?.nomeLabel||'Negócio'}: *${form.empresa}*\n📍 Cidade: *${form.cidade}*\n📱 WhatsApp: *${form.telefone}*\n🏷 Tipo: *${cfg?.label||'Negócio'}*${affRef ? `\n🔗 Indicado por: *${affRef}*` : ''}\n\nQuero começar a usar o ZatendeStok! 🚀`)
  }

  /* Passo 0 — escolha do tipo */
  if (!niche) return (
    <div style={{ animation:'fadeUp .25s ease' }}>
      {affRef && (
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10, marginBottom:16 }}>
          <span style={{ fontSize:14 }}>🤝</span>
          <span style={{ fontSize:12, color:B.green, fontWeight:700 }}>Indicado por <strong>{affRef}</strong> — bem-vindo ao ZatendeStok!</span>
        </div>
      )}
      <div style={{ marginBottom:22 }}>
        <h1 style={{ fontSize:21, fontWeight:900, color:B.text, marginBottom:4 }}>O que você quer cadastrar?</h1>
        <p style={{ color:B.muted, fontSize:13 }}>Escolha o tipo de negócio para continuar</p>
      </div>

      {/* 3 colunas: mercado, padaria, açougue */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:10 }}>
        {NICHE_CFG.slice(0,3).map(n => (
          <button key={n.id} className="tipo-card" onClick={() => setNiche(n.id)}
            style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10, padding:'18px 10px', border:`2px solid ${B.border}`, borderRadius:14, background:'#fff', boxShadow:'0 2px 8px rgba(0,0,0,.05)' }}>
            <div style={{ width:46, height:46, borderRadius:12, background:n.bg, border:`1.5px solid ${n.brd}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>
              {n.emoji}
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontWeight:800, fontSize:12, color:B.text, lineHeight:1.3 }}>{n.label}</div>
              <div style={{ fontSize:10.5, color:B.muted, lineHeight:1.4, marginTop:3 }}>{n.desc}</div>
            </div>
          </button>
        ))}
      </div>

      {/* 2 colunas: restaurante, distribuidora */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        {NICHE_CFG.slice(3).map(n => (
          <button key={n.id} className="tipo-card" onClick={() => setNiche(n.id)}
            style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10, padding:'18px 16px', border:`2px solid ${B.border}`, borderRadius:14, background:'#fff', boxShadow:'0 2px 8px rgba(0,0,0,.05)' }}>
            <div style={{ width:46, height:46, borderRadius:12, background:n.bg, border:`1.5px solid ${n.brd}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>
              {n.emoji}
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontWeight:800, fontSize:13, color:B.text, marginBottom:3 }}>{n.label}</div>
              <div style={{ fontSize:11, color:B.muted, lineHeight:1.4 }}>{n.desc}</div>
            </div>
          </button>
        ))}
      </div>

      <div style={{ marginTop:14, padding:'10px 14px', background:'#f8fafc', border:`1px solid ${B.border}`, borderRadius:12 }}>
        <p style={{ color:B.muted, fontSize:12, textAlign:'center' }}>Acesso criado em até 2 horas · Sem contrato · Suporte via WhatsApp</p>
      </div>
    </div>
  )

  /* Sucesso */
  if (sent) return (
    <div style={{ textAlign:'center', animation:'fadeUp .3s ease' }}>
      <div style={{ width:72, height:72, borderRadius:'50%', background:'#f0fdf4', border:'2px solid #bbf7d0', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
        <CheckCircle2 size={36} color={B.green} />
      </div>
      <div style={{ fontSize:20, fontWeight:900, color:B.text, marginBottom:8 }}>Solicitação enviada!</div>
      <p style={{ color:B.muted, fontSize:14, lineHeight:1.7, marginBottom:24 }}>
        Nossa equipe entra em contato em até <strong style={{ color:B.blue }}>2 horas</strong> pelo WhatsApp.
      </p>
      <div style={{ background:B.bg, border:`1px solid ${B.border}`, borderRadius:12, padding:'14px 16px', display:'flex', alignItems:'center', gap:12 }}>
        <Phone size={16} color={B.green} style={{ flexShrink:0 }} />
        <div style={{ textAlign:'left' }}>
          <div style={{ fontSize:11, fontWeight:700, color:B.muted, textTransform:'uppercase', marginBottom:2 }}>Atendimento direto</div>
          <div style={{ color:B.green, fontWeight:800, fontSize:14 }}>{ZAP_DISPLAY}</div>
        </div>
      </div>
    </div>
  )

  /* Badge de tipo selecionado */
  const tipoBadge = cfg ? (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:20 }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 12px', background:cfg.bg, border:`1px solid ${cfg.brd}`, borderRadius:999 }}>
        <span style={{ fontSize:14 }}>{cfg.emoji}</span>
        <span style={{ fontSize:12, fontWeight:700, color:cfg.color }}>{cfg.label}</span>
      </div>
      <button onClick={() => { setNiche(null); setStep(1) }} style={{ background:'none', border:'none', cursor:'pointer', color:B.muted, fontSize:12, fontWeight:600 }}>trocar</button>
    </div>
  ) : null

  /* Steps bar */
  const stepsBar = (
    <div style={{ display:'flex', alignItems:'center', marginBottom:20 }}>
      {[{ n:1, label:'Dados' },{ n:2, label:'Confirmar' }].map((s, i, arr) => (
        <React.Fragment key={s.n}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:26, height:26, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, flexShrink:0, transition:'all .25s', background:step>=s.n?B.blue:B.bg, border:`2px solid ${step>=s.n?B.blue:B.border}`, color:step>=s.n?'#fff':B.muted }}>
              {step>s.n?'✓':s.n}
            </div>
            <span style={{ fontSize:12, fontWeight:700, color:step>=s.n?B.text:B.muted }}>{s.label}</span>
          </div>
          {i<arr.length-1 && <div style={{ flex:1, height:2, background:step>s.n?B.blue:B.border, margin:'0 10px', borderRadius:2, transition:'background .3s' }} />}
        </React.Fragment>
      ))}
    </div>
  )

  return (
    <div style={{ animation:'fadeUp .25s ease' }}>
      {tipoBadge}
      {stepsBar}

      {step===1 && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <p style={{ color:B.muted, fontSize:13 }}>Preencha abaixo — nossa equipe cria seu acesso em até 2 horas.</p>
          {[
            { key:'nome',     icon:User,                label:'Seu nome completo',          placeholder:'Ex: João Silva'               },
            { key:'empresa',  icon:tipo==='distribuidor'?Truck:Store, label:cfg?.nomeLabel||'Nome do negócio', placeholder:cfg?.nomePlaceholder||'Nome do negócio' },
            { key:'cidade',   icon:MapPin,              label:'Cidade / Estado',             placeholder:'Ex: São Paulo – SP'           },
            { key:'telefone', icon:Phone,               label:'WhatsApp',                    placeholder:'(11) 99999-0000'              },
            { key:'email',    icon:null,                label:'Email (opcional)',             placeholder:'seu@email.com'                },
          ].map(f => (
            <div key={f.key}>
              <Inp label={f.label} icon={f.icon} value={form[f.key]} onChange={set(f.key)} placeholder={f.placeholder} type={f.key==='email'?'email':'text'} />
              {errs[f.key] && <p style={{ color:'#ef4444', fontSize:11, marginTop:4 }}>⚠ {errs[f.key]}</p>}
            </div>
          ))}
          <button className="btn-blue" onClick={() => { if(validate()) setStep(2) }}
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'14px', marginTop:4, border:'none', borderRadius:12, cursor:'pointer', background:`linear-gradient(135deg,${B.blue},${B.blueDk})`, color:'#fff', fontWeight:800, fontSize:15, boxShadow:'0 4px 20px rgba(79,91,213,.3)' }}>
            Continuar <ArrowRight size={16} />
          </button>
        </div>
      )}

      {step===2 && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <p style={{ color:B.muted, fontSize:13 }}>Confira os dados e solicite o cadastro.</p>
          <div style={{ border:`1px solid ${B.border}`, borderRadius:12, overflow:'hidden' }}>
            {[['Nome',form.nome],[cfg?.nomeLabel||'Negócio',form.empresa],['Cidade',form.cidade],['WhatsApp',form.telefone],form.email?['Email',form.email]:null].filter(Boolean).map(([k,v]) => (
              <div key={k} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'11px 16px', borderBottom:`1px solid ${B.border}`, background:'#fff' }}>
                <span style={{ color:B.muted, fontSize:13 }}>{k}</span>
                <span style={{ color:B.text, fontWeight:700, fontSize:14 }}>{v}</span>
              </div>
            ))}
          </div>
          <button className="btn-wpp" onClick={solicitar}
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'15px', border:'none', borderRadius:12, cursor:'pointer', background:`linear-gradient(135deg,${B.green},${B.greenDk})`, color:'#fff', fontWeight:800, fontSize:15, boxShadow:'0 4px 20px rgba(34,197,94,.3)' }}>
            <MessageCircle size={18} /> Solicitar via WhatsApp
          </button>
          <button onClick={() => setStep(1)}
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'11px', border:`1px solid ${B.border}`, borderRadius:10, cursor:'pointer', background:'transparent', color:B.muted, fontSize:13, fontWeight:600 }}>
            <ArrowLeft size={14} /> Voltar e editar
          </button>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════ */
export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const from     = location.state?.from?.pathname || '/dashboard'
  const [user,    setUser]    = useState('')
  const [pass,    setPass]    = useState('')
  const [show,    setShow]    = useState(false)
  const [err,     setErr]     = useState('')
  const [loading, setLoading] = useState(false)
  const [tab,     setTab]     = useState('acesso')
  const [recover, setRecover] = useState(false)

  const submit = async (e) => {
    e.preventDefault(); setLoading(true); setErr('')
    const u = user.trim().toLowerCase()

    /* 1. Try mercado auth */
    try {
      const res  = await fetch('/api/auth', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ username:u, password:pass }) })
      const data = await res.json()
      if (data.ok) {
        saveStoreId(data.storeId)
        localStorage.setItem('cp_session', JSON.stringify({ loggedIn:true, user:u, storeId:data.storeId, storeName:data.storeName, storePhone:data.storePhone, niche:data.niche||'mercado', role:'admin' }))
        wipeLegacyFlatKeys()
        registerStoreId(data.storeId)
        seedSettingsFromSession()          // pre-populate storeName + themeColor
        navigate(from, { replace:true }); return
      }
    } catch {}

    /* 2. Try distribuidor auth */
    try {
      const res  = await fetch('/api/forn-auth', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ username:u, password:pass }) })
      const data = await res.json()
      if (data.ok) {
        localStorage.setItem('cp_session_v1', JSON.stringify({ loggedIn:true, id:data.tenantId, username:u, storeName:data.storeName }))
        navigate('/fornecedor', { replace:true }); return
      }
    } catch {}

    /* 3. Fallback: local credentials (offline/seed) */
    const { username:lu, password:lp } = getCredentials()
    if (u === lu && pass === lp) {
      const sid = getConfiguredStoreId()
      localStorage.setItem('cp_session', JSON.stringify({ loggedIn:true, user:u, storeId:sid, role:'admin' }))
      registerStoreId(sid)
      seedSettingsFromSession()
      navigate(from, { replace:true }); return
    }

    setErr('Usuário ou senha incorretos.'); setLoading(false)
  }

  return (
    <div style={{ minHeight:'100dvh', display:'flex', fontFamily:"'Inter',system-ui,sans-serif", background:B.bg }}>
      <style>{CSS}</style>
      <LeftPanel />

      <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:'100dvh', overflowY:'auto' }}>
        <div className="mob-hdr" style={{ display:'none', background:'linear-gradient(135deg,#1e1b4b,#1e3a8a)', padding:'20px 24px' }}>
          <ZatendeStokLogo variant="full" />
        </div>

        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'40px 24px' }}>
          <div style={{ width:'100%', maxWidth:420 }}>
            <div style={{ display:'flex', background:'#eef2f7', border:`1px solid ${B.border}`, borderRadius:14, padding:4, marginBottom:28, gap:2 }}>
              {[{ key:'acesso', label:'Entrar' },{ key:'cadastro', label:'Criar conta' }].map(t => (
                <button key={t.key} className={`tab-pill ${tab===t.key?'active':''}`}
                  onClick={() => { setTab(t.key); setRecover(false) }}
                  style={{ flex:1, padding:'10px 8px', border:'none', cursor:'pointer', borderRadius:10, fontWeight:700, fontSize:13, color:tab===t.key?B.text:B.muted, background:'transparent' }}>
                  {t.label}
                </button>
              ))}
            </div>

            {tab==='acesso' && (
              <div style={{ animation:'fadeUp .3s ease' }}>
                {!recover ? (
                  <>
                    <div style={{ marginBottom:24 }}>
                      <h1 style={{ fontSize:22, fontWeight:900, color:B.text, marginBottom:4 }}>Bem-vindo de volta</h1>
                      <p style={{ color:B.muted, fontSize:14 }}>Mercados, padarias, açougues, restaurantes e distribuidoras</p>
                    </div>
                    <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
                      <Inp label="Usuário" icon={User} value={user} onChange={e => { setUser(e.target.value); setErr('') }} placeholder="seu usuário" autoComplete="username" />
                      <Inp label="Senha" icon={Lock}
                        topRight={<button type="button" onClick={() => setRecover(true)} style={{ background:'none', border:'none', cursor:'pointer', color:B.blue, fontSize:12, fontWeight:700 }}>Esqueceu a senha?</button>}
                        type={show?'text':'password'} value={pass} onChange={e => { setPass(e.target.value); setErr('') }} placeholder="senha" autoComplete="current-password"
                        right={<button type="button" onClick={() => setShow(v => !v)} style={{ position:'absolute', right:13, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#94a3b8', padding:0 }}>{show?<EyeOff size={16}/>:<Eye size={16}/>}</button>}
                      />
                      {err && (
                        <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, padding:'11px 14px', color:'#dc2626', fontSize:13, fontWeight:600 }}>
                          {err} — <button type="button" onClick={() => setRecover(true)} style={{ background:'none', border:'none', color:B.blue, cursor:'pointer', fontSize:13, fontWeight:700 }}>recuperar senha</button>
                        </div>
                      )}
                      <button type="submit" disabled={loading||!user||!pass} className="btn-blue"
                        style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'14px', marginTop:4, border:'none', borderRadius:12, fontWeight:800, fontSize:15, cursor:loading||!user||!pass?'not-allowed':'pointer', background:loading||!user||!pass?B.border:`linear-gradient(135deg,${B.blue},${B.blueDk})`, color:loading||!user||!pass?B.muted:'#fff', boxShadow:loading||!user||!pass?'none':'0 4px 20px rgba(79,91,213,.3)' }}>
                        {loading
                          ? <><span style={{ width:16, height:16, border:'2px solid rgba(255,255,255,.3)', borderTopColor:'#fff', borderRadius:'50%', display:'inline-block', animation:'spin .7s linear infinite' }} /> Entrando</>
                          : <><Zap size={16}/> Entrar no Sistema</>}
                      </button>
                    </form>
                    <div style={{ marginTop:20, padding:'12px 14px', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:12 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:'#166534', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:3 }}>Funcionários do caixa</div>
                      <div style={{ color:'#4b5563', fontSize:12 }}>Acesse <span style={{ color:B.green, fontWeight:700, fontFamily:'monospace' }}>/caixa/seuusuario</span> para entrar com PIN</div>
                    </div>
                  </>
                ) : <RecoverPanel username={user} onClose={() => setRecover(false)} />}
              </div>
            )}

            {tab==='cadastro' && (
              <div style={{ animation:'fadeUp .3s ease' }}>
                <CadastroFlow />
              </div>
            )}

            <div style={{ marginTop:32, textAlign:'center', display:'flex', flexDirection:'column', gap:8, alignItems:'center' }}>
              <a href="/guia" style={{ color:B.muted, fontSize:12, fontWeight:600, textDecoration:'none' }}>Ver guia do sistema</a>
              <span style={{ color:B.border, fontSize:11 }}>ZatendeStok · zatendestok.com.br</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
