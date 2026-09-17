import React, { useState, useMemo, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, Lock, User, MessageCircle, CheckCircle2, Package, TrendingUp, Users, ChevronLeft, ShieldCheck, Wifi } from 'lucide-react'
import { getCredentials, loginAsOperator, getConfiguredStoreId } from '../utils/auth.js'
import ZatendeStockLogo from '../components/ZatendeStockLogo.jsx'

const WHATSAPP = '5511985950956'
const WHATSAPP_DISPLAY = '(011) 98595-0956'

const FEATURES = [
  { icon: Package,     text: 'Ofertas do distribuidor em tempo real' },
  { icon: TrendingUp,  text: 'Controle de estoque inteligente' },
  { icon: Users,       text: 'Rede de mercados conectada' },
  { icon: CheckCircle2,text: 'Pedidos via WhatsApp automatizados' },
]

/** Read operators from localStorage without needing the store/context. */
function readOperators() {
  try {
    const storeId = (() => {
      try { return JSON.parse(localStorage.getItem('cp_session'))?.storeId ?? 'default' } catch { return 'default' }
    })()
    const raw = localStorage.getItem(`mkt:${storeId}:cp_operators`)
              ?? localStorage.getItem('cp_operators')
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

const ROLE_LABEL = { admin: 'Admin', gerente: 'Gerente', caixa: 'Caixa' }
const ROLE_COLOR = { admin: '#f97316', gerente: '#818cf8', caixa: '#22c55e' }

const PIN_KEYS = ['1','2','3','4','5','6','7','8','9','⌫','0','✓']

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const from     = location.state?.from?.pathname || '/dashboard'

  /* ── admin form state ── */
  const [user, setUser]       = useState('')
  const [pass, setPass]       = useState('')
  const [show, setShow]       = useState(false)
  const [err,  setErr]        = useState('')
  const [loading, setLoading] = useState(false)
  const [tab, setTab]         = useState('cadastro')
  const [showAdminForm, setShowAdminForm] = useState(false)

  /* ── operator PIN state ── */
  const localOps = useMemo(readOperators, [])
  const [remoteOps, setRemoteOps] = useState([])
  const operators = localOps.length > 0 ? localOps : remoteOps

  const [selectedOp, setSelectedOp] = useState(null)
  const [pin, setPin]               = useState('')
  const [pinErr, setPinErr]         = useState(false)

  // Fetch operators from server if localStorage is empty (cross-device support)
  useEffect(() => {
    if (localOps.length > 0) return
    const storeId = getConfiguredStoreId()
    fetch(`/api/restore?storeId=${storeId}`)
      .then(r => r.json())
      .then(({ ok, data }) => {
        if (!ok || !data?.cp_operators) return
        const ops = JSON.parse(data.cp_operators)
        if (ops.length > 0) {
          // Cache locally so next load is instant
          try { localStorage.setItem(`mkt:${storeId}:cp_operators`, data.cp_operators) } catch {}
          setRemoteOps(ops)
        }
      })
      .catch(() => {})
  }, [localOps.length])

  const handlePin = (k) => {
    if (k === '⌫') { setPin(p => p.slice(0, -1)); setPinErr(false); return }
    if (k === '✓')  { confirmPin(); return }
    if (pin.length < 6) { setPin(p => p + k); setPinErr(false) }
  }

  const confirmPin = () => {
    const op = selectedOp
    if (!op) return
    if (!op.pin || pin === op.pin) {
      loginAsOperator(op)
      navigate(op.role === 'caixa' ? '/pdv' : (from || '/dashboard'), { replace: true })
    } else {
      setPinErr(true)
      setPin('')
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    setLoading(true)

    try {
      // 1️⃣  Try server-side auth (registered markets)
      const res = await fetch('/api/auth', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username: user.trim(), password: pass }),
      })
      const data = await res.json()

      if (data.ok) {
        // Server validated → use the storeId the server returned
        import('../utils/auth.js').then(({ saveStoreId }) => saveStoreId(data.storeId))
        localStorage.setItem('cp_session', JSON.stringify({
          loggedIn:  true,
          user:      user.trim(),
          storeId:   data.storeId,
          storeName: data.storeName,
          role:      'admin',
        }))
        navigate(from, { replace: true })
        return
      }
      // Server said no (user not registered yet or wrong pass) → fall through to local
    } catch {
      // Network/server error → fall back to local credentials (offline support)
    }

    // 2️⃣  Fallback: localStorage credentials (offline / unregistered markets)
    const { username: storedUser, password: storedPass } = getCredentials()
    if (user.trim() === storedUser && pass === storedPass) {
      localStorage.setItem('cp_session', JSON.stringify({
        loggedIn: true,
        user:     user.trim(),
        storeId:  getConfiguredStoreId(),
        role:     'admin',
      }))
      navigate(from, { replace: true })
    } else {
      setErr('Usuário ou senha incorretos.')
      setLoading(false)
    }
  }

  const openWhatsApp = (msg) => {
    const text = encodeURIComponent(msg)
    window.open(`https://wa.me/${WHATSAPP}?text=${text}`, '_blank')
  }

  /* ── helpers ────────────────────────────────────────────── */
  const avatarColor = (op) => ROLE_COLOR[op.role] ?? '#6b7280'

  const S = {
    page:  { minHeight: '100dvh', background: '#04080f', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', position: 'relative', overflow: 'hidden' },
    glow:  { position: 'fixed', inset: 0, background: 'radial-gradient(ellipse at 50% 110%, rgba(249,115,22,.18) 0%, transparent 65%)', pointerEvents: 'none', zIndex: 0 },
    wrap:  { position: 'relative', zIndex: 1, width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 20 },
    card:  { background: '#0c1524', border: '1px solid #1a2740', borderRadius: 24, overflow: 'hidden' },
    input: { width: '100%', background: '#070d18', border: '1.5px solid #1a2740', borderRadius: 12, padding: '13px 14px 13px 44px', color: '#e5e7eb', fontSize: 15, outline: 'none', boxSizing: 'border-box', transition: 'border-color .2s' },
    label: { display: 'block', color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 },
    tab:   (active) => ({ flex: 1, padding: '11px 8px', border: 'none', cursor: 'pointer', borderRadius: 10, fontWeight: 700, fontSize: 13, transition: 'all .2s', background: active ? '#f97316' : 'transparent', color: active ? '#fff' : '#475569' }),
  }

  return (
    <div style={S.page}>
      <div style={S.glow} />

      <div style={S.wrap}>

        {/* ── Logo ── */}
        <div style={{ textAlign: 'center' }}>
          <ZatendeStockLogo variant="full" />
          <div style={{ color: '#475569', fontSize: 12, marginTop: 6, letterSpacing: '.04em' }}>
            Sistema de Gestão para Mercados
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', background: '#070d18', borderRadius: 14, padding: 4, border: '1px solid #1a2740' }}>
          {[
            { key: 'cadastro', label: '🏪  Quero me cadastrar' },
            { key: 'acesso',   label: '🔐  Entrar no sistema' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={S.tab(tab === t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ══ CADASTRO TAB ══ */}
        {tab === 'cadastro' && (
          <div style={S.card}>
            <div style={{ padding: '28px 24px 8px' }}>
              <div style={{ color: '#f1f5f9', fontWeight: 900, fontSize: 19, marginBottom: 8, lineHeight: 1.3 }}>
                Conecte seu mercado à maior rede de abastecimento
              </div>
              <div style={{ color: '#64748b', fontSize: 13, lineHeight: 1.7, marginBottom: 24 }}>
                Receba ofertas do distribuidor, faça pedidos via WhatsApp e gerencie estoque — tudo numa plataforma só.
              </div>
              {[
                { icon: Package,      text: 'Ofertas exclusivas do distribuidor em tempo real' },
                { icon: TrendingUp,   text: 'Controle de estoque inteligente com alertas' },
                { icon: Users,        text: 'Rede de mercados conectada ao mesmo distribuidor' },
                { icon: CheckCircle2, text: 'Pedidos automáticos via WhatsApp' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(249,115,22,.12)', border: '1px solid rgba(249,115,22,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={17} color="#f97316" />
                  </div>
                  <span style={{ color: '#94a3b8', fontSize: 13, fontWeight: 500 }}>{text}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: '8px 24px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => openWhatsApp('Olá! Quero cadastrar meu mercado na plataforma ZatendeStock 🛒')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '15px 20px', border: 'none', borderRadius: 14, cursor: 'pointer', background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', fontWeight: 900, fontSize: 15, boxShadow: '0 8px 28px rgba(34,197,94,.3)' }}
              >
                <MessageCircle size={20} /> Quero me cadastrar via WhatsApp
              </button>
              <div style={{ textAlign: 'center', color: '#334155', fontSize: 12 }}>
                Atendimento rápido • <span style={{ color: '#22c55e', fontWeight: 700 }}>{WHATSAPP_DISPLAY}</span>
              </div>
            </div>
          </div>
        )}

        {/* ══ ACESSO TAB ══ */}
        {tab === 'acesso' && (
          <div style={S.card}>

            {/* PIN screen */}
            {selectedOp ? (
              <div style={{ padding: '24px 20px 28px', textAlign: 'center' }}>
                <button
                  onClick={() => { setSelectedOp(null); setPin(''); setPinErr(false) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#475569', fontSize: 13, fontWeight: 600, marginBottom: 24 }}
                >
                  <ChevronLeft size={16} /> Voltar
                </button>

                <div style={{ width: 72, height: 72, borderRadius: '50%', background: avatarColor(selectedOp) + '22', border: `2.5px solid ${avatarColor(selectedOp)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', fontSize: 28, fontWeight: 900, color: avatarColor(selectedOp) }}>
                  {selectedOp.name[0].toUpperCase()}
                </div>
                <div style={{ color: '#f1f5f9', fontWeight: 800, fontSize: 20 }}>{selectedOp.name}</div>
                <div style={{ color: avatarColor(selectedOp), fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 28 }}>
                  {ROLE_LABEL[selectedOp.role] ?? selectedOp.role}{selectedOp.terminalId ? ` · Caixa ${selectedOp.terminalId}` : ''}
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginBottom: 6 }}>
                  {[0,1,2,3,4,5].map(i => (
                    <div key={i} style={{ width: 16, height: 16, borderRadius: '50%', background: pin.length > i ? (pinErr ? '#ef4444' : '#f97316') : '#1a2740', border: `2px solid ${pin.length > i ? (pinErr ? '#ef4444' : '#f97316') : '#2d3f5c'}`, transition: 'all .15s' }} />
                  ))}
                </div>
                {pinErr && <div style={{ color: '#f87171', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>PIN incorreto — tente novamente</div>}
                {!selectedOp.pin && <div style={{ color: '#475569', fontSize: 12, marginBottom: 8 }}>Sem PIN configurado — pressione ✓ para entrar</div>}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, maxWidth: 280, margin: '20px auto 0' }}>
                  {PIN_KEYS.map(k => (
                    <button key={k} onClick={() => handlePin(k)}
                      onPointerDown={e => { e.currentTarget.style.transform = 'scale(.93)'; e.currentTarget.style.opacity = '.75' }}
                      onPointerUp={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.opacity = '' }}
                      onPointerLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.opacity = '' }}
                      style={{
                        height: 68, borderRadius: 16, cursor: 'pointer',
                        fontSize: k === '⌫' ? 22 : 24, fontWeight: 900,
                        background: k === '✓' ? 'linear-gradient(135deg,#f97316,#ea580c)' : k === '⌫' ? '#131f30' : '#0e1928',
                        color: k === '✓' ? '#fff' : '#cbd5e1',
                        border: k === '✓' ? 'none' : '1px solid #1a2740',
                        boxShadow: k === '✓' ? '0 6px 20px rgba(249,115,22,.35)' : 'none',
                        transition: 'transform .08s, opacity .08s',
                      }}>
                      {k}
                    </button>
                  ))}
                </div>
              </div>

            ) : (
              <div style={{ padding: '24px 20px 20px' }}>
                {operators.length > 0 && (
                  <>
                    <div style={{ color: '#f1f5f9', fontWeight: 900, fontSize: 18, marginBottom: 4 }}>Quem está no caixa?</div>
                    <div style={{ color: '#475569', fontSize: 13, marginBottom: 20 }}>Toque no seu nome para entrar</div>
                    <div style={{ display: 'grid', gridTemplateColumns: operators.length === 1 ? '1fr' : operators.length >= 4 ? 'repeat(3,1fr)' : 'repeat(2,1fr)', gap: 10, marginBottom: 20 }}>
                      {operators.map(op => (
                        <button key={op.id} onClick={() => { setSelectedOp(op); setPin(''); setPinErr(false) }}
                          onPointerEnter={e => { e.currentTarget.style.background = `${avatarColor(op)}1a`; e.currentTarget.style.borderColor = `${avatarColor(op)}55`; e.currentTarget.style.transform = 'translateY(-2px)' }}
                          onPointerLeave={e => { e.currentTarget.style.background = `${avatarColor(op)}0d`; e.currentTarget.style.borderColor = `${avatarColor(op)}22`; e.currentTarget.style.transform = '' }}
                          style={{ padding: '18px 12px', border: `1.5px solid ${avatarColor(op)}22`, borderRadius: 18, cursor: 'pointer', textAlign: 'center', background: `${avatarColor(op)}0d`, transition: 'all .15s' }}>
                          <div style={{ width: 52, height: 52, borderRadius: '50%', background: avatarColor(op) + '22', border: `2px solid ${avatarColor(op)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', fontSize: 22, fontWeight: 900, color: avatarColor(op) }}>
                            {op.name[0].toUpperCase()}
                          </div>
                          <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 14 }}>{op.name}</div>
                          <div style={{ color: avatarColor(op), fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 4 }}>
                            {ROLE_LABEL[op.role] ?? op.role}{op.terminalId ? ` · Cx ${op.terminalId}` : ''}
                          </div>
                        </button>
                      ))}
                    </div>
                    <div style={{ borderTop: '1px solid #131f30', paddingTop: 16 }}>
                      <button onClick={() => setShowAdminForm(v => !v)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#334155', fontSize: 12, fontWeight: 600, margin: '0 auto', padding: '4px 8px', borderRadius: 8 }}>
                        <ShieldCheck size={14} /> Acesso Admin / Sistema
                      </button>
                    </div>
                  </>
                )}

                {(operators.length === 0 || showAdminForm) && (
                  <div style={{ marginTop: operators.length > 0 ? 16 : 0 }}>
                    {operators.length === 0 && (
                      <>
                        <div style={{ color: '#f1f5f9', fontWeight: 900, fontSize: 20, marginBottom: 6 }}>Entrar no sistema</div>
                        <div style={{ color: '#475569', fontSize: 13, marginBottom: 24 }}>Acesso restrito a mercados cadastrados</div>
                      </>
                    )}
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

                    {operators.length === 0 && (
                      <div style={{ marginTop: 20, padding: '14px', background: 'rgba(34,197,94,.06)', border: '1px solid rgba(34,197,94,.15)', borderRadius: 12, textAlign: 'center' }}>
                        <div style={{ color: '#475569', fontSize: 12, marginBottom: 8 }}>Ainda não tem acesso?</div>
                        <button onClick={() => openWhatsApp('Olá! Preciso de acesso ao ZatendeStock para meu mercado 🏪')}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#22c55e', fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <MessageCircle size={14} /> Falar pelo WhatsApp
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Footer ── */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          <a href="/guia" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(249,115,22,.08)', border: '1px solid rgba(249,115,22,.2)', color: '#f97316', borderRadius: 20, padding: '7px 18px', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
            📖 Ver guia completo do sistema
          </a>
          <div style={{ color: '#1e2a3a', fontSize: 11 }}>
            ZatendeStock · by <span style={{ color: '#f97316' }}>etc!</span> · Dubai, UAE
          </div>
        </div>

      </div>
    </div>
  )
}
