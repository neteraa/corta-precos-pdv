import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, Lock, User, MessageCircle, CheckCircle2, Package, TrendingUp, Users } from 'lucide-react'
import { getCredentials } from '../utils/auth.js'
import ZatendeStockLogo from '../components/ZatendeStockLogo.jsx'

const WHATSAPP = '5511985950956'
const WHATSAPP_DISPLAY = '(011) 98595-0956'

const FEATURES = [
  { icon: Package,     text: 'Ofertas do distribuidor em tempo real' },
  { icon: TrendingUp,  text: 'Controle de estoque inteligente' },
  { icon: Users,       text: 'Rede de mercados conectada' },
  { icon: CheckCircle2,text: 'Pedidos via WhatsApp automatizados' },
]

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const from     = location.state?.from?.pathname || '/dashboard'

  const [user, setUser]       = useState('')
  const [pass, setPass]       = useState('')
  const [show, setShow]       = useState(false)
  const [err,  setErr]        = useState('')
  const [loading, setLoading] = useState(false)
  const [tab, setTab]         = useState('cadastro') // 'cadastro' | 'acesso'

  const submit = (e) => {
    e.preventDefault()
    setErr('')
    setLoading(true)
    setTimeout(() => {
      const { username, password } = getCredentials()
      if (user.trim() === username && pass === password) {
        localStorage.setItem('cp_session', JSON.stringify({ loggedIn: true, user: user.trim(), storeId: 'default' }))
        navigate(from, { replace: true })
      } else {
        setErr('Usuário ou senha incorretos.')
        setLoading(false)
      }
    }, 400)
  }

  const openWhatsApp = (msg) => {
    const text = encodeURIComponent(msg)
    window.open(`https://wa.me/${WHATSAPP}?text=${text}`, '_blank')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0e1a', display: 'flex', flexDirection: 'column', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* Background glow */}
      <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(84,98,216,0.15) 0%, transparent 60%)', pointerEvents: 'none' }} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', position: 'relative', zIndex: 1 }}>

        {/* ── Logo ── */}
        <div style={{ marginBottom: 36, textAlign: 'center' }}>
          <ZatendeStockLogo variant="full" />
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', background: '#111827', borderRadius: 14, padding: 4, marginBottom: 24, width: '100%', maxWidth: 420 }}>
          {[
            { key: 'cadastro', label: '🏪 Cadastrar meu Mercado' },
            { key: 'acesso',   label: '🔐 Acesso ao sistema' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex: 1, padding: '10px 8px', border: 'none', cursor: 'pointer', borderRadius: 10,
              fontWeight: 700, fontSize: 12, transition: 'all .2s',
              background: tab === t.key ? '#5462D8' : 'transparent',
              color: tab === t.key ? '#fff' : '#6b7280',
            }}>{t.label}</button>
          ))}
        </div>

        {/* ── CADASTRO TAB ── */}
        {tab === 'cadastro' && (
          <div style={{ width: '100%', maxWidth: 420 }}>
            {/* Pitch card */}
            <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 20, padding: '28px 24px', marginBottom: 16 }}>
              <div style={{ color: '#fff', fontWeight: 900, fontSize: 20, marginBottom: 6 }}>
                Conecte seu mercado à maior rede de abastecimento
              </div>
              <div style={{ color: '#9ca3af', fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>
                Receba ofertas exclusivas do distribuidor, faça pedidos direto pelo WhatsApp e gerencie seu estoque — tudo numa plataforma só.
              </div>

              {FEATURES.map(({ icon: Icon, text }) => (
                <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(84,98,216,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={18} color="#5462D8" />
                  </div>
                  <span style={{ color: '#d1d5db', fontSize: 14, fontWeight: 500 }}>{text}</span>
                </div>
              ))}
            </div>

            {/* WhatsApp CTA */}
            <button
              onClick={() => openWhatsApp('Olá! Quero cadastrar meu mercado na plataforma ZatendeStock 🛒')}
              style={{
                width: '100%', padding: '16px', border: 'none', borderRadius: 14, cursor: 'pointer',
                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                color: '#fff', fontWeight: 900, fontSize: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                boxShadow: '0 8px 32px rgba(34,197,94,0.35)',
                marginBottom: 12,
              }}
            >
              <MessageCircle size={22} />
              Quero me cadastrar via WhatsApp
            </button>

            <div style={{ textAlign: 'center', color: '#4b5563', fontSize: 12 }}>
              Fale com a gente agora •{' '}
              <span style={{ color: '#22c55e', fontWeight: 700 }}>{WHATSAPP_DISPLAY}</span>
            </div>
          </div>
        )}

        {/* ── ACESSO TAB ── */}
        {tab === 'acesso' && (
          <div style={{ width: '100%', maxWidth: 420 }}>
            <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 20, padding: '28px 24px' }}>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 18, marginBottom: 4 }}>Entrar no sistema</div>
              <div style={{ color: '#6b7280', fontSize: 13, marginBottom: 24 }}>Acesso restrito a mercados cadastrados</div>

              <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Username */}
                <div>
                  <label style={{ display: 'block', color: '#9ca3af', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Usuário</label>
                  <div style={{ position: 'relative' }}>
                    <User size={16} color="#4b5563" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    <input
                      type="text" value={user}
                      onChange={e => { setUser(e.target.value); setErr('') }}
                      placeholder="seu usuário"
                      autoFocus autoComplete="username"
                      style={{ width: '100%', background: '#0d1117', border: '1px solid #1f2937', borderRadius: 12, padding: '13px 14px 13px 42px', color: '#fff', fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
                      onFocus={e => e.target.style.borderColor = '#5462D8'}
                      onBlur={e => e.target.style.borderColor = '#1f2937'}
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label style={{ display: 'block', color: '#9ca3af', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Senha</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} color="#4b5563" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    <input
                      type={show ? 'text' : 'password'} value={pass}
                      onChange={e => { setPass(e.target.value); setErr('') }}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      style={{ width: '100%', background: '#0d1117', border: '1px solid #1f2937', borderRadius: 12, padding: '13px 42px 13px 42px', color: '#fff', fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
                      onFocus={e => e.target.style.borderColor = '#5462D8'}
                      onBlur={e => e.target.style.borderColor = '#1f2937'}
                    />
                    <button type="button" onClick={() => setShow(v => !v)}
                      style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563', padding: 0 }}>
                      {show ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {err && (
                  <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', color: '#f87171', fontSize: 13, textAlign: 'center', fontWeight: 600 }}>
                    {err}
                  </div>
                )}

                <button type="submit" disabled={loading || !user || !pass}
                  style={{
                    padding: '14px', border: 'none', borderRadius: 12, cursor: loading || !user || !pass ? 'not-allowed' : 'pointer',
                    background: loading || !user || !pass ? '#1f2937' : 'linear-gradient(135deg, #5462D8, #4338ca)',
                    color: loading || !user || !pass ? '#4b5563' : '#fff',
                    fontWeight: 900, fontSize: 15,
                    boxShadow: loading || !user || !pass ? 'none' : '0 6px 24px rgba(84,98,216,0.4)',
                  }}>
                  {loading ? 'Entrando…' : 'Entrar'}
                </button>
              </form>

              {/* Não tem acesso */}
              <div style={{ marginTop: 20, padding: '14px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 12, textAlign: 'center' }}>
                <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 8 }}>Ainda não tem acesso?</div>
                <button
                  onClick={() => openWhatsApp('Olá! Preciso de acesso ao sistema ZatendeStock para meu mercado 🏪')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#22c55e', fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <MessageCircle size={14} /> Falar com a gente pelo WhatsApp
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 28, textAlign: 'center' }}>
          <a href="/guia" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(234,88,12,0.1)', border: '1px solid rgba(234,88,12,0.25)',
            color: '#f97316', borderRadius: 20, padding: '7px 16px',
            fontSize: 12, fontWeight: 700, textDecoration: 'none', marginBottom: 12,
          }}>📖 Ver guia completo do sistema</a>
          <div style={{ color: '#374151', fontSize: 11 }}>
            ZatendeStock · by <span style={{ color: '#5462D8' }}>etc!</span> · Dubai, UAE
          </div>
        </div>
      </div>
    </div>
  )
}
