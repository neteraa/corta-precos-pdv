import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, Lock, User, MessageCircle, CheckCircle2, Package, TrendingUp, Users, Store } from 'lucide-react'
import { getCredentials, getConfiguredStoreId, saveStoreId } from '../utils/auth.js'
import ZatendeStockLogo from '../components/ZatendeStockLogo.jsx'

const WHATSAPP         = '5511985950956'
const WHATSAPP_DISPLAY = '(011) 98595-0956'

const FEATURES = [
  { icon: Package,      text: 'Ofertas exclusivas do distribuidor em tempo real' },
  { icon: TrendingUp,   text: 'Controle de estoque com alertas de validade' },
  { icon: Users,        text: 'Rede de mercados conectada ao mesmo distribuidor' },
  { icon: CheckCircle2, text: 'Pedidos automáticos via WhatsApp' },
]

const S = {
  page:  { minHeight: '100dvh', background: '#04080f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', position: 'relative', overflow: 'hidden' },
  glow:  { position: 'fixed', inset: 0, background: 'radial-gradient(ellipse at 50% 110%, rgba(249,115,22,.18) 0%, transparent 65%)', pointerEvents: 'none', zIndex: 0 },
  wrap:  { position: 'relative', zIndex: 1, width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 20 },
  card:  { background: '#0c1524', border: '1px solid #1a2740', borderRadius: 24, overflow: 'hidden' },
  input: { width: '100%', background: '#070d18', border: '1.5px solid #1a2740', borderRadius: 12, padding: '13px 14px 13px 44px', color: '#e5e7eb', fontSize: 15, outline: 'none', boxSizing: 'border-box', transition: 'border-color .2s' },
  label: { display: 'block', color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 },
  tab:   (active) => ({ flex: 1, padding: '11px 8px', border: 'none', cursor: 'pointer', borderRadius: 10, fontWeight: 700, fontSize: 13, transition: 'all .2s', background: active ? '#f97316' : 'transparent', color: active ? '#fff' : '#475569' }),
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const from     = location.state?.from?.pathname || '/dashboard'

  const [user, setUser]       = useState('')
  const [pass, setPass]       = useState('')
  const [show, setShow]       = useState(false)
  const [err,  setErr]        = useState('')
  const [loading, setLoading] = useState(false)
  const [tab, setTab]         = useState('acesso')

  const openWhatsApp = (msg) =>
    window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`, '_blank')

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErr('')

    // 1️⃣  Server auth
    try {
      const res  = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user.trim(), password: pass }) })
      const data = await res.json()
      if (data.ok) {
        saveStoreId(data.storeId)
        localStorage.setItem('cp_session', JSON.stringify({ loggedIn: true, user: user.trim(), storeId: data.storeId, storeName: data.storeName, role: 'admin' }))
        navigate(from, { replace: true })
        return
      }
    } catch { /* offline — fall through */ }

    // 2️⃣  Local fallback (offline / unregistered)
    const { username: lu, password: lp } = getCredentials()
    if (user.trim() === lu && pass === lp) {
      localStorage.setItem('cp_session', JSON.stringify({ loggedIn: true, user: user.trim(), storeId: getConfiguredStoreId(), role: 'admin' }))
      navigate(from, { replace: true })
    } else {
      setErr('Usuário ou senha incorretos.')
      setLoading(false)
    }
  }

  return (
    <div style={S.page}>
      <div style={S.glow} />
      <div style={S.wrap}>

        {/* Logo */}
        <div style={{ textAlign: 'center' }}>
          <ZatendeStockLogo variant="full" />
          <div style={{ color: '#475569', fontSize: 12, marginTop: 6 }}>Sistema de Gestão para Mercados</div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', background: '#070d18', borderRadius: 14, padding: 4, border: '1px solid #1a2740' }}>
          {[{ key: 'acesso', label: '🔐  Acesso ao sistema' }, { key: 'cadastro', label: '🏪  Cadastrar mercado' }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={S.tab(tab === t.key)}>{t.label}</button>
          ))}
        </div>

        {/* ── Cadastro Tab ── */}
        {tab === 'cadastro' && (
          <div style={S.card}>
            <div style={{ padding: '28px 24px 8px' }}>
              <div style={{ color: '#f1f5f9', fontWeight: 900, fontSize: 19, marginBottom: 8, lineHeight: 1.3 }}>Conecte seu mercado à maior rede de abastecimento</div>
              <div style={{ color: '#64748b', fontSize: 13, lineHeight: 1.7, marginBottom: 20 }}>Receba ofertas do distribuidor, faça pedidos via WhatsApp e gerencie estoque — tudo numa plataforma só.</div>
              {FEATURES.map(({ icon: Icon, text }) => (
                <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(249,115,22,.12)', border: '1px solid rgba(249,115,22,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={16} color="#f97316" />
                  </div>
                  <span style={{ color: '#94a3b8', fontSize: 13, fontWeight: 500 }}>{text}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: '8px 24px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={() => openWhatsApp('Olá! Quero cadastrar meu mercado na plataforma ZatendeStock 🛒')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '15px 20px', border: 'none', borderRadius: 14, cursor: 'pointer', background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', fontWeight: 900, fontSize: 15, boxShadow: '0 8px 28px rgba(34,197,94,.3)' }}>
                <MessageCircle size={20} /> Quero me cadastrar via WhatsApp
              </button>
              <div style={{ textAlign: 'center', color: '#334155', fontSize: 12 }}>
                Atendimento rápido • <span style={{ color: '#22c55e', fontWeight: 700 }}>{WHATSAPP_DISPLAY}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Acesso Tab ── */}
        {tab === 'acesso' && (
          <div style={S.card}>
            <div style={{ padding: '28px 24px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(249,115,22,.12)', border: '1px solid rgba(249,115,22,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Store size={22} color="#f97316" />
                </div>
                <div>
                  <div style={{ color: '#f1f5f9', fontWeight: 900, fontSize: 18 }}>Acesso do Mercado</div>
                  <div style={{ color: '#475569', fontSize: 12 }}>Faça login com suas credenciais</div>
                </div>
              </div>

              <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={S.label}>Usuário</label>
                  <div style={{ position: 'relative' }}>
                    <User size={16} color="#334155" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    <input type="text" value={user} onChange={e => { setUser(e.target.value); setErr('') }}
                      placeholder="seu usuário" autoComplete="username" style={S.input}
                      onFocus={e => e.target.style.borderColor = '#f97316'}
                      onBlur={e => e.target.style.borderColor = '#1a2740'} />
                  </div>
                </div>

                <div>
                  <label style={S.label}>Senha</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} color="#334155" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    <input type={show ? 'text' : 'password'} value={pass} onChange={e => { setPass(e.target.value); setErr('') }}
                      placeholder="••••••••" autoComplete="current-password"
                      style={{ ...S.input, paddingRight: 44 }}
                      onFocus={e => e.target.style.borderColor = '#f97316'}
                      onBlur={e => e.target.style.borderColor = '#1a2740'} />
                    <button type="button" onClick={() => setShow(v => !v)}
                      style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#334155', padding: 0 }}>
                      {show ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {err && (
                  <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 10, padding: '10px 14px', color: '#f87171', fontSize: 13, textAlign: 'center', fontWeight: 600 }}>
                    {err}
                  </div>
                )}

                <button type="submit" disabled={loading || !user || !pass} style={{
                  padding: '14px', border: 'none', borderRadius: 13, cursor: loading || !user || !pass ? 'not-allowed' : 'pointer',
                  background: loading || !user || !pass ? '#131f30' : 'linear-gradient(135deg,#f97316,#ea580c)',
                  color: loading || !user || !pass ? '#334155' : '#fff',
                  fontWeight: 900, fontSize: 15, transition: 'all .2s',
                  boxShadow: loading || !user || !pass ? 'none' : '0 6px 24px rgba(249,115,22,.35)',
                }}>
                  {loading ? 'Entrando…' : 'Entrar no Sistema'}
                </button>
              </form>

              {/* Caixa link hint */}
              <div style={{ marginTop: 20, padding: '12px 14px', background: 'rgba(34,197,94,.05)', border: '1px solid rgba(34,197,94,.15)', borderRadius: 12 }}>
                <div style={{ color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>👷 Para funcionários do caixa</div>
                <div style={{ color: '#64748b', fontSize: 12 }}>
                  Acesse <span style={{ color: '#22c55e', fontWeight: 700, fontFamily: 'monospace' }}>/caixa/seuusuario</span> para entrar com PIN
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          <a href="/guia" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(249,115,22,.08)', border: '1px solid rgba(249,115,22,.2)', color: '#f97316', borderRadius: 20, padding: '7px 18px', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
            📖 Ver guia do sistema
          </a>
          <div style={{ color: '#1e2a3a', fontSize: 11 }}>ZatendeStock · by <span style={{ color: '#f97316' }}>etc!</span> · Dubai, UAE</div>
        </div>

      </div>
    </div>
  )
}
