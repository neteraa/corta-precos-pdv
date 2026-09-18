import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Eye, EyeOff, Lock, User, MessageCircle, CheckCircle2,
  ArrowRight, ArrowLeft, Phone, MapPin,
  ShieldCheck, Zap, Headphones, Bell, BarChart3, Wifi,
} from 'lucide-react'
import { getCredentials, getConfiguredStoreId, saveStoreId } from '../utils/auth.js'
import ZatendeStockLogo from '../components/ZatendeStockLogo.jsx'

const ZAP            = '5511985950956'
const ZAP_DISPLAY    = '(011) 98595-0956'

const openWpp = (msg) => window.open(`https://wa.me/${ZAP}?text=${encodeURIComponent(msg)}`, '_blank')

/* ── micro style helpers ─────────────────────────────────── */
const field = {
  wrap:  { position: 'relative', marginBottom: 0 },
  label: { display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 },
  base:  { width: '100%', background: '#060d1a', border: '1.5px solid #1c2e47', borderRadius: 12, padding: '13px 14px 13px 44px', color: '#e2e8f0', fontSize: 15, outline: 'none', boxSizing: 'border-box', transition: 'border-color .25s, box-shadow .25s', WebkitAppearance: 'none' },
  icon:  { position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#2d4a6e' },
}

function Field({ label, icon: Icon, value, onChange, type = 'text', placeholder, right, noIcon }) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      {label && <label style={field.label}>{label}</label>}
      <div style={field.wrap}>
        {!noIcon && <Icon size={15} style={{ ...field.icon, color: focused ? '#f97316' : '#2d4a6e' }} />}
        <input
          type={type} value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={type === 'password' ? 'current-password' : 'off'}
          style={{ ...field.base, paddingLeft: noIcon ? 14 : 44, paddingRight: right ? 48 : 14, borderColor: focused ? '#f9731650' : '#1c2e47', boxShadow: focused ? '0 0 0 3px rgba(249,115,22,.08)' : 'none' }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {right}
      </div>
    </div>
  )
}

/* ── "Recuperar senha" slide-panel ───────────────────────── */
function RecoverPanel({ username, onClose }) {
  const msg = username
    ? `Olá! Preciso recuperar minha senha da ZatendeStock.\n\nMeu usuário é: *${username}*`
    : 'Olá! Preciso recuperar minha senha da ZatendeStock.'
  return (
    <div style={{ background: '#0a1628', border: '1px solid #1c2e47', borderRadius: 16, padding: '20px 22px', marginTop: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(249,115,22,.1)', border: '1px solid rgba(249,115,22,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Headphones size={16} color="#f97316" />
        </div>
        <div>
          <div style={{ color: '#f1f5f9', fontWeight: 800, fontSize: 14 }}>Recuperar senha</div>
          <div style={{ color: '#475569', fontSize: 12 }}>Fale com nosso suporte</div>
        </div>
      </div>
      <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.6, margin: '0 0 14px' }}>
        Para redefinir sua senha, envie uma mensagem para nossa equipe. O atendimento é rápido e feito pelo WhatsApp.
      </p>
      <button
        onClick={() => openWpp(msg)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '12px', border: 'none', borderRadius: 11, cursor: 'pointer', background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', fontWeight: 800, fontSize: 14, boxShadow: '0 4px 16px rgba(34,197,94,.25)' }}>
        <MessageCircle size={16} /> Falar com suporte no WhatsApp
      </button>
      <button onClick={onClose} style={{ display: 'block', width: '100%', marginTop: 10, padding: '8px', background: 'none', border: 'none', color: '#334155', fontSize: 12, cursor: 'pointer' }}>
        Voltar ao login
      </button>
    </div>
  )
}

/* ── Cadastro multi-step ─────────────────────────────────── */
const STEPS = [
  { n: 1, label: 'Seu mercado',    desc: 'Dados básicos do estabelecimento' },
  { n: 2, label: 'Confirmação',    desc: 'Revise e solicite o cadastro'    },
]

function CadastroFlow() {
  const [step,    setStep]    = useState(1)
  const [form,    setForm]    = useState({ nome: '', mercado: '', cidade: '', telefone: '' })
  const [sent,    setSent]    = useState(false)
  const [errors,  setErrors]  = useState({})

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }))

  const validate = () => {
    const e = {}
    if (!form.nome.trim())     e.nome     = 'Informe seu nome'
    if (!form.mercado.trim())  e.mercado  = 'Informe o nome do mercado'
    if (!form.cidade.trim())   e.cidade   = 'Informe a cidade'
    if (!form.telefone.trim()) e.telefone = 'Informe o WhatsApp'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const goNext = () => { if (validate()) setStep(2) }

  const solicitar = () => {
    const msg =
      `🛒 *Solicitação de cadastro — ZatendeStock*\n\n` +
      `👤 Nome: *${form.nome}*\n` +
      `🏪 Mercado: *${form.mercado}*\n` +
      `📍 Cidade: *${form.cidade}*\n` +
      `📱 WhatsApp: *${form.telefone}*\n\n` +
      `Quero começar a usar o ZatendeStock! 🚀`
    openWpp(msg)
    setSent(true)
  }

  if (sent) return (
    <div style={{ textAlign: 'center', padding: '32px 24px' }}>
      <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(34,197,94,.12)', border: '2px solid rgba(34,197,94,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
        <CheckCircle2 size={32} color="#22c55e" />
      </div>
      <div style={{ color: '#f1f5f9', fontWeight: 900, fontSize: 20, marginBottom: 8 }}>Solicitação enviada! 🎉</div>
      <div style={{ color: '#64748b', fontSize: 13, lineHeight: 1.7, marginBottom: 24 }}>
        Nossa equipe vai entrar em contato pelo WhatsApp em até <strong style={{ color: '#f97316' }}>2 horas</strong> para criar o seu acesso.
      </div>
      <div style={{ background: '#060d1a', border: '1px solid #1c2e47', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Phone size={16} color="#22c55e" style={{ flexShrink: 0 }} />
        <div style={{ textAlign: 'left' }}>
          <div style={{ color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Atendimento direto</div>
          <div style={{ color: '#22c55e', fontWeight: 800, fontSize: 14 }}>{ZAP_DISPLAY}</div>
        </div>
      </div>
    </div>
  )

  return (
    <div>
      {/* step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '20px 24px 0' }}>
        {STEPS.map((s, i) => (
          <React.Fragment key={s.n}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 800, flexShrink: 0, transition: 'all .25s',
                background: step >= s.n ? '#f97316' : '#0e1b2e',
                border: `2px solid ${step >= s.n ? '#f97316' : '#1c2e47'}`,
                color: step >= s.n ? '#fff' : '#334155',
              }}>
                {step > s.n ? <CheckCircle2 size={14} /> : s.n}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: step >= s.n ? '#f1f5f9' : '#334155' }}>{s.label}</div>
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: 1, background: step > s.n ? '#f97316' : '#1c2e47', margin: '0 10px', transition: 'background .25s' }} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* step 1 */}
      {step === 1 && (
        <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ color: '#475569', fontSize: 13, lineHeight: 1.6, marginBottom: 4 }}>
            Preencha os dados abaixo e nossa equipe cria seu acesso em até 2 horas.
          </div>
          {[
            { key: 'nome',     icon: User,        label: 'Seu nome completo',  placeholder: 'Ex: João Silva' },
            { key: 'mercado',  icon: Store,       label: 'Nome do mercado',    placeholder: 'Ex: Mercado Central' },
            { key: 'cidade',   icon: MapPin,      label: 'Cidade / Estado',    placeholder: 'Ex: São Paulo – SP' },
            { key: 'telefone', icon: Phone,       label: 'Seu WhatsApp',       placeholder: '(11) 99999-0000' },
          ].map(f => (
            <div key={f.key}>
              <Field label={f.label} icon={f.icon} value={form[f.key]} onChange={set(f.key)} placeholder={f.placeholder} />
              {errors[f.key] && <div style={{ color: '#f87171', fontSize: 11, marginTop: 4 }}>⚠ {errors[f.key]}</div>}
            </div>
          ))}
          <button onClick={goNext}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px', border: 'none', borderRadius: 13, cursor: 'pointer', background: 'linear-gradient(135deg,#f97316,#ea580c)', color: '#fff', fontWeight: 900, fontSize: 15, boxShadow: '0 6px 24px rgba(249,115,22,.3)', marginTop: 4 }}>
            Continuar <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* step 2 */}
      {step === 2 && (
        <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ color: '#475569', fontSize: 13, lineHeight: 1.6 }}>
            Confirme os dados abaixo. Vamos enviar uma mensagem via WhatsApp para nossa equipe.
          </div>
          <div style={{ background: '#060d1a', border: '1px solid #1c2e47', borderRadius: 14, overflow: 'hidden' }}>
            {[
              ['👤 Nome',      form.nome],
              ['🏪 Mercado',   form.mercado],
              ['📍 Cidade',    form.cidade],
              ['📱 WhatsApp',  form.telefone],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 16px', borderBottom: '1px solid #0e1b2e' }}>
                <span style={{ color: '#475569', fontSize: 13 }}>{k}</span>
                <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 14 }}>{v}</span>
              </div>
            ))}
          </div>
          <button onClick={solicitar}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '15px', border: 'none', borderRadius: 13, cursor: 'pointer', background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', fontWeight: 900, fontSize: 15, boxShadow: '0 6px 24px rgba(34,197,94,.3)' }}>
            <MessageCircle size={18} /> Solicitar cadastro via WhatsApp
          </button>
          <button onClick={() => setStep(1)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '11px', border: '1px solid #1c2e47', borderRadius: 11, cursor: 'pointer', background: 'transparent', color: '#475569', fontSize: 13 }}>
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

  const [user,     setUser]     = useState('')
  const [pass,     setPass]     = useState('')
  const [show,     setShow]     = useState(false)
  const [err,      setErr]      = useState('')
  const [loading,  setLoading]  = useState(false)
  const [tab,      setTab]      = useState('acesso')
  const [recover,  setRecover]  = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true); setErr('')
    try {
      const res  = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user.trim(), password: pass }) })
      const data = await res.json()
      if (data.ok) {
        saveStoreId(data.storeId)
        localStorage.setItem('cp_session', JSON.stringify({ loggedIn: true, user: user.trim(), storeId: data.storeId, storeName: data.storeName, role: 'admin' }))
        navigate(from, { replace: true }); return
      }
    } catch { /* offline */ }

    const { username: lu, password: lp } = getCredentials()
    if (user.trim() === lu && pass === lp) {
      localStorage.setItem('cp_session', JSON.stringify({ loggedIn: true, user: user.trim(), storeId: getConfiguredStoreId(), role: 'admin' }))
      navigate(from, { replace: true })
    } else {
      setErr('Usuário ou senha incorretos.')
      setLoading(false)
    }
  }

  /* ── shared styles ── */
  const page  = { minHeight: '100dvh', background: '#04080f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', position: 'relative', overflow: 'hidden' }
  const card  = { background: '#0c1524', border: '1px solid #1a2740', borderRadius: 24, overflow: 'hidden' }
  const tabBtn = (active) => ({ flex: 1, padding: '11px 8px', border: 'none', cursor: 'pointer', borderRadius: 10, fontWeight: 700, fontSize: 13, transition: 'all .2s', background: active ? '#f97316' : 'transparent', color: active ? '#fff' : '#475569' })

  return (
    <div style={page}>
      {/* ambient glow */}
      <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse at 50% 110%, rgba(249,115,22,.15) 0%, transparent 60%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse at 80% 20%, rgba(34,197,94,.06) 0%, transparent 50%)', pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center' }}>
          <ZatendeStockLogo variant="full" />
          <div style={{ color: '#334155', fontSize: 12, marginTop: 6, fontWeight: 500 }}>Sistema de Gestão para Mercados</div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', background: '#060d1a', borderRadius: 14, padding: 4, border: '1px solid #1a2740' }}>
          {[
            { key: 'acesso',   label: '🔐  Entrar' },
            { key: 'cadastro', label: '🏪  Quero me cadastrar' },
          ].map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setRecover(false) }} style={tabBtn(tab === t.key)}>{t.label}</button>
          ))}
        </div>

        {/* ─── LOGIN ─────────────────────────────────────────── */}
        {tab === 'acesso' && (
          <div style={card}>
            {!recover ? (
              <div style={{ padding: '28px 24px' }}>
                {/* header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(249,115,22,.1)', border: '1px solid rgba(249,115,22,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Store size={22} color="#f97316" />
                  </div>
                  <div>
                    <div style={{ color: '#f1f5f9', fontWeight: 900, fontSize: 18 }}>Acesso do Mercado</div>
                    <div style={{ color: '#475569', fontSize: 12 }}>Entre com usuário e senha</div>
                  </div>
                </div>

                <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <Field label="Usuário" icon={User} value={user} onChange={v => { setUser(v); setErr('') }} placeholder="seu usuário" />

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <label style={field.label}>Senha</label>
                      <button type="button" onClick={() => setRecover(true)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f97316', fontSize: 11, fontWeight: 700, padding: 0 }}>
                        Esqueceu a senha?
                      </button>
                    </div>
                    <Field icon={Lock} value={pass} onChange={v => { setPass(v); setErr('') }}
                      type={show ? 'text' : 'password'} placeholder="••••••••"
                      right={
                        <button type="button" onClick={() => setShow(v => !v)}
                          style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#334155', padding: 0 }}>
                          {show ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      }
                    />
                  </div>

                  {err && (
                    <div style={{ background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 10, padding: '10px 14px', color: '#f87171', fontSize: 13, textAlign: 'center', fontWeight: 600 }}>
                      {err} · <button type="button" onClick={() => setRecover(true)} style={{ background: 'none', border: 'none', color: '#f97316', cursor: 'pointer', fontSize: 13, fontWeight: 700, padding: 0 }}>recuperar senha</button>
                    </div>
                  )}

                  <button type="submit" disabled={loading || !user || !pass} style={{
                    padding: '14px', border: 'none', borderRadius: 13, marginTop: 2,
                    cursor: loading || !user || !pass ? 'not-allowed' : 'pointer',
                    background: loading || !user || !pass ? '#0e1b2e' : 'linear-gradient(135deg,#f97316,#ea580c)',
                    color: loading || !user || !pass ? '#334155' : '#fff',
                    fontWeight: 900, fontSize: 15, transition: 'all .2s',
                    boxShadow: loading || !user || !pass ? 'none' : '0 6px 24px rgba(249,115,22,.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                    {loading
                      ? <><span style={{ width: 16, height: 16, border: '2px solid #ffffff40', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin .7s linear infinite' }} /> Entrando…</>
                      : <><Zap size={16} /> Entrar no Sistema</>
                    }
                  </button>
                </form>

                {/* caixa hint */}
                <div style={{ marginTop: 20, padding: '12px 14px', background: 'rgba(34,197,94,.04)', border: '1px solid rgba(34,197,94,.12)', borderRadius: 12 }}>
                  <div style={{ color: '#374151', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>👷 Funcionários do caixa</div>
                  <div style={{ color: '#4b5563', fontSize: 12 }}>Acesse <span style={{ color: '#22c55e', fontWeight: 700, fontFamily: 'monospace' }}>/caixa/seuusuario</span> para entrar com PIN</div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '24px' }}>
                <RecoverPanel username={user} onClose={() => setRecover(false)} />
              </div>
            )}
          </div>
        )}

        {/* ─── CADASTRO ──────────────────────────────────────── */}
        {tab === 'cadastro' && (
          <div style={card}>
            {/* top banner */}
            <div style={{ background: 'linear-gradient(135deg, #0d1f38 0%, #0a1628 100%)', padding: '20px 24px', borderBottom: '1px solid #1a2740' }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                {[
                  { icon: ShieldCheck, text: 'Sem contrato' },
                  { icon: Zap,         text: 'Acesso em 2h' },
                  { icon: Headphones,  text: 'Suporte via WhatsApp' },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1 }}>
                    <Icon size={12} color="#f97316" style={{ flexShrink: 0 }} />
                    <span style={{ color: '#64748b', fontSize: 10, fontWeight: 600, lineHeight: 1.3 }}>{text}</span>
                  </div>
                ))}
              </div>
              <div style={{ color: '#f1f5f9', fontWeight: 900, fontSize: 17, lineHeight: 1.35 }}>
                Cadastre seu mercado e comece a receber ofertas exclusivas do distribuidor
              </div>
            </div>
            <CadastroFlow />
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          <a href="/guia" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(249,115,22,.06)', border: '1px solid rgba(249,115,22,.15)', color: '#f97316', borderRadius: 20, padding: '7px 18px', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
            📖 Ver guia do sistema
          </a>
          <div style={{ color: '#1a2740', fontSize: 11 }}>ZatendeStock · Suporte {ZAP_DISPLAY}</div>
        </div>

      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
