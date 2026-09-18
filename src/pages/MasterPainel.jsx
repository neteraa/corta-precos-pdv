import React, { useState, useEffect, useCallback } from 'react'
import { Plus, RefreshCw, Power, Trash2, LogIn, Copy, Check, Eye, EyeOff, ShieldAlert, Store, Clock, X, Key, Zap, Truck, BarChart2, TrendingUp, AlertTriangle, CalendarClock, Mail } from 'lucide-react'
import ZatendeStockLogo from '../components/ZatendeStockLogo.jsx'

/* ─── constants ──────────────────────────────────────────── */
const MK_KEY  = 'zs_master_key'
const BRL     = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function getMK() { return localStorage.getItem(MK_KEY) || '' }
function api(path, mk, opts = {}) {
  const sep = path.includes('?') ? '&' : '?'
  return fetch(`${path}${sep}mk=${encodeURIComponent(mk)}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  }).then(r => r.json())
}

/* ─── sub-components (module scope → no remount bug) ──── */
function StatCard({ label, value, sub, color = '#f97316' }) {
  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-2xl p-5">
      <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</div>
      <div className="text-3xl font-black" style={{ color }}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  )
}

function MarketCard({ market, mk, onRefresh, onAccess }) {
  const [busy,       setBusy]       = useState(false)
  const [copied,     setCopied]     = useState(false)
  const [showReset,  setShowReset]  = useState(false)
  const [newPass,    setNewPass]    = useState('')
  const [showResend, setShowResend] = useState(false)
  const [resendPass, setResendPass] = useState('')
  const [resendEmail, setResendEmail] = useState(market.email || '')
  const [resendStatus, setResendStatus] = useState(null)  // null | 'sending' | 'ok' | 'err'

  const initial = (market.storeName || '?')[0].toUpperCase()
  const colors = ['#f97316','#22c55e','#8b5cf6','#06b6d4','#f59e0b','#ec4899','#10b981']
  const color  = colors[(market.storeName || '').length % colors.length]

  const lastSeen = market.lastLogin
    ? (() => {
        const diff = Date.now() - new Date(market.lastLogin)
        const mins = Math.floor(diff / 60000)
        if (mins < 1)   return 'Agora mesmo'
        if (mins < 60)  return `${mins}min atrás`
        const hrs = Math.floor(mins / 60)
        if (hrs < 24)   return `${hrs}h atrás`
        return `${Math.floor(hrs / 24)}d atrás`
      })()
    : 'Nunca acessou'

  const toggle = async () => {
    setBusy(true)
    await api('/api/markets-admin', mk, { method: 'POST', body: JSON.stringify({ action: 'toggle', id: market.id }) })
    await onRefresh()
    setBusy(false)
  }

  const remove = async () => {
    if (!confirm(`Remover ${market.storeName}? Esta ação não pode ser desfeita.`)) return
    setBusy(true)
    await api('/api/markets-admin', mk, { method: 'POST', body: JSON.stringify({ action: 'delete', id: market.id }) })
    await onRefresh()
  }

  const resetPass = async () => {
    if (!newPass.trim() || newPass.length < 4) return
    setBusy(true)
    await api('/api/markets-admin', mk, { method: 'POST', body: JSON.stringify({ action: 'reset-pass', id: market.id, password: newPass }) })
    setNewPass('')
    setShowReset(false)
    setBusy(false)
  }

  const setExpiry = async (dateStr) => {
    setBusy(true)
    const expiresAt = dateStr ? new Date(dateStr + 'T23:59:59').toISOString() : null
    await api('/api/markets-admin', mk, { method: 'POST', body: JSON.stringify({ action: 'set-expiry', id: market.id, expiresAt }) })
    await onRefresh()
    setBusy(false)
  }

  const copyId = () => {
    navigator.clipboard.writeText(market.storeId).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const resendAccess = async () => {
    if (!resendEmail || !resendPass || resendPass.length < 4) return
    setResendStatus('sending')
    await api('/api/markets-admin', mk, { method: 'POST', body: JSON.stringify({ action: 'reset-pass', id: market.id, password: resendPass }) })
    const eRes = await sendWelcomeEmail(mk, { to: resendEmail, type: 'market', storeName: market.storeName, username: market.username, password: resendPass })
    setResendStatus(eRes.sent ? 'ok' : 'err')
    setTimeout(() => { setShowResend(false); setResendStatus(null); setResendPass('') }, 3000)
  }

  return (
    <div className={`relative flex flex-col rounded-2xl border transition-all ${
      market.active ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-900/50 border-gray-800 opacity-60'
    }`}>
      {/* header */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-700/50">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-black flex-shrink-0"
          style={{ background: color + '22', color, border: `2px solid ${color}` }}>
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-black text-white text-base leading-tight truncate">{market.storeName}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${market.active ? 'bg-green-400' : 'bg-gray-600'}`} />
            <span className="text-xs text-gray-400">{market.active ? 'Ativo' : 'Inativo'}</span>
          </div>
        </div>
        {/* status badge */}
        {market.lastLogin && Date.now() - new Date(market.lastLogin) < 5 * 60000 && (
          <span className="flex-shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
            ONLINE
          </span>
        )}
      </div>

      {/* body */}
      <div className="p-4 space-y-2 flex-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Usuário</span>
          <span className="text-gray-300 font-mono font-bold">{market.username}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Store ID</span>
          <div className="flex items-center gap-1.5">
            <span className="text-green-400 font-mono font-bold">{market.storeId}</span>
            <button onClick={copyId} className="text-gray-500 hover:text-green-400 transition-colors">
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Criado em</span>
          <span className="text-gray-400">{new Date(market.createdAt).toLocaleDateString('pt-BR')}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Último acesso</span>
          <span className="flex items-center gap-1 text-gray-400">
            <Clock className="w-3 h-3" /> {lastSeen}
          </span>
        </div>
        {market.storePhone && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">WhatsApp</span>
            <span className="text-gray-300">{market.storePhone}</span>
          </div>
        )}

        {/* Expiry / payment status */}
        {(() => {
          const exp  = market.expiresAt ? new Date(market.expiresAt) : null
          const days = exp ? Math.ceil((exp - Date.now()) / 86_400_000) : null
          const expired = exp && days < 0
          const warn    = exp && days >= 0 && days <= 5
          const badge   = expired ? { label: `VENCIDA ${Math.abs(days)}d atrás`, cls: 'bg-red-500/20 text-red-400 border-red-500/30' }
                        : warn    ? { label: `Vence em ${days}d`, cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' }
                        : exp     ? { label: `OK até ${exp.toLocaleDateString('pt-BR')}`, cls: 'bg-green-500/20 text-green-400 border-green-500/30' }
                        :           { label: 'Sem vencimento', cls: 'bg-gray-700 text-gray-500 border-gray-600' }
          return (
            <div className="pt-1 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Assinatura</span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${badge.cls}`}>{badge.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  defaultValue={exp ? exp.toISOString().slice(0,10) : ''}
                  disabled={busy}
                  onChange={e => setExpiry(e.target.value)}
                  className="flex-1 bg-gray-700 border border-gray-600 text-gray-200 text-xs rounded-lg px-2 py-1.5 outline-none focus:border-orange-500 disabled:opacity-40"
                  title="Data de vencimento da assinatura"
                />
                {exp && (
                  <button onClick={() => setExpiry('')} disabled={busy} title="Remover vencimento"
                    className="text-gray-500 hover:text-red-400 transition-colors text-xs px-1.5 py-1 rounded-lg hover:bg-red-500/10">
                    ✕
                  </button>
                )}
              </div>
            </div>
          )
        })()}
      </div>

      {/* reset password inline */}
      {showReset && (
        <div className="px-4 pb-3 flex gap-2">
          <input className="flex-1 bg-gray-700 border border-gray-600 text-white text-sm rounded-xl px-3 py-2 outline-none focus:border-orange-500"
            placeholder="Nova senha (mín. 4)" type="password" value={newPass}
            onChange={e => setNewPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && resetPass()} />
          <button onClick={resetPass} disabled={newPass.length < 4 || busy}
            className="px-3 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black disabled:opacity-40">OK</button>
          <button onClick={() => setShowReset(false)} className="px-3 py-2 rounded-xl bg-gray-700 text-gray-400 text-xs hover:bg-gray-600">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* reenviar acesso por email */}
      {showResend && (
        <div className="px-4 pb-3 space-y-2">
          {resendStatus === 'ok'  && <p className="text-green-400 text-xs font-bold">✅ Email enviado!</p>}
          {resendStatus === 'err' && <p className="text-yellow-400 text-xs">⚠️ Não enviado (configure RESEND_API_KEY em resend.com)</p>}
          {!resendStatus && <>
            <input className="w-full bg-gray-700 border border-gray-600 text-white text-xs rounded-xl px-3 py-2 outline-none focus:border-orange-500"
              placeholder="Email do cliente" type="email" value={resendEmail} onChange={e => setResendEmail(e.target.value)} />
            <div className="flex gap-2">
              <input className="flex-1 bg-gray-700 border border-gray-600 text-white text-xs rounded-xl px-3 py-2 outline-none focus:border-orange-500"
                placeholder="Nova senha (mín. 4)" type="password" value={resendPass} onChange={e => setResendPass(e.target.value)} />
              <button onClick={resendAccess} disabled={!resendEmail || resendPass.length < 4}
                className="px-3 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold disabled:opacity-40">Enviar</button>
              <button onClick={() => { setShowResend(false); setResendPass('') }}
                className="px-2 py-2 rounded-xl bg-gray-700 text-gray-400 text-xs hover:bg-gray-600"><X className="w-3 h-3" /></button>
            </div>
          </>}
        </div>
      )}

      {/* actions */}
      <div className="flex gap-2 p-4 pt-2 border-t border-gray-700/50">
        <button onClick={() => onAccess(market)}
          className="flex-1 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black transition-all flex items-center justify-center gap-1.5">
          <LogIn className="w-3.5 h-3.5" /> Acessar
        </button>
        <button onClick={() => { setShowResend(v => !v); setShowReset(false) }}
          title="Reenviar acesso por email"
          className="px-3 py-2 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-xs transition-colors">
          <Mail className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => setShowReset(v => !v)}
          title="Resetar senha"
          className="px-3 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs transition-colors">
          <Key className="w-3.5 h-3.5" />
        </button>
        <button onClick={toggle} disabled={busy}
          title={market.active ? 'Desativar' : 'Ativar'}
          className={`px-3 py-2 rounded-xl text-xs transition-colors ${
            market.active ? 'bg-gray-700 hover:bg-yellow-500/20 text-gray-300 hover:text-yellow-400' : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
          }`}>
          <Power className="w-3.5 h-3.5" />
        </button>
        <button onClick={remove} disabled={busy}
          title="Remover mercado"
          className="px-3 py-2 rounded-xl bg-gray-700 hover:bg-red-500/20 text-gray-400 hover:text-red-400 text-xs transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

/* ── shared email sender ─────────────────────────────────── */
async function sendWelcomeEmail(mk, { to, type, storeName, username, password }) {
  if (!to) return { sent: false, warning: 'Sem email cadastrado' }
  try {
    const res = await api('/api/send-email', mk, {
      method: 'POST',
      body: JSON.stringify({ to, type, storeName, username, password }),
    })
    return res
  } catch { return { sent: false, warning: 'Erro de rede ao enviar email' } }
}

/* ── reusable credential success screen ─────────────────── */
function CredSuccess({ title, icon: Icon, iconColor, accentColor, ok, emailResult, onClose }) {
  const mode = emailResult?.mode  // 'direct' | 'admin-notify' | undefined
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <div className="text-center mb-5">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 border-2"
               style={{ background: `${iconColor}20`, borderColor: iconColor }}>
            <Icon className="w-7 h-7" style={{ color: iconColor }} />
          </div>
          <h3 className="text-white font-black text-xl">{title}</h3>

          {emailResult?.sent && mode === 'direct' && (
            <p className="text-green-400 text-sm mt-2 flex items-center justify-center gap-1">
              <Check className="w-3.5 h-3.5" /> Email enviado direto para {ok.email}
            </p>
          )}
          {emailResult?.sent && mode === 'admin-notify' && (
            <div className="mt-2 px-3 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-yellow-400 text-xs font-bold">📬 Notificação enviada para seu email</p>
              <p className="text-gray-500 text-xs mt-0.5">Abra <strong className="text-gray-400">agn.girardi@gmail.com</strong> e encaminhe para o cliente</p>
            </div>
          )}
          {!emailResult?.sent && ok.email && (
            <p className="text-yellow-400 text-xs mt-2">⚠️ {emailResult?.warning || 'Email não enviado'}</p>
          )}
          {!ok.email && (
            <p className="text-gray-500 text-sm mt-1">Passe as credenciais ao cliente</p>
          )}
        </div>

        <div className="bg-gray-900 rounded-xl p-4 space-y-2 font-mono text-sm border border-gray-700 mb-4">
          <div className="flex justify-between"><span className="text-gray-400">URL</span><span style={{ color: accentColor }}>zatendestock.netlify.app</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Usuário</span><span className="text-white font-bold">{ok.username}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Senha</span><span className="text-white font-bold">{ok.password}</span></div>
          {ok.storeId && <div className="flex justify-between"><span className="text-gray-400">Store ID</span><span className="text-green-400">{ok.storeId}</span></div>}
        </div>
        <button onClick={onClose} className="w-full py-3 rounded-xl text-white font-black transition-colors" style={{ background: accentColor }}>
          Fechar
        </button>
      </div>
    </div>
  )
}

function AddMarketModal({ mk, onClose, onCreated }) {
  const [form, setForm] = useState({ storeName: '', username: '', password: '', storePhone: '', email: '' })
  const [show, setShow] = useState(false)
  const [err,  setErr]  = useState(null)
  const [ok,   setOk]   = useState(null)
  const [busy, setBusy] = useState(false)
  const [emailResult, setEmailResult] = useState(null)

  const submit = async () => {
    setErr(null)
    if (!form.storeName.trim() || !form.username.trim() || !form.password) return setErr('Preencha nome, usuário e senha.')
    if (form.password.length < 4) return setErr('Senha mínimo 4 caracteres.')
    setBusy(true)
    const res = await api('/api/markets-admin', mk, { method: 'POST', body: JSON.stringify(form) })
    if (!res.ok) { setBusy(false); return setErr(res.error || 'Erro ao criar mercado.') }
    const creds = { storeId: res.storeId, username: form.username, password: form.password, email: form.email }
    const eRes  = await sendWelcomeEmail(mk, { to: form.email, type: 'market', storeName: form.storeName, username: form.username, password: form.password })
    setBusy(false)
    setEmailResult(eRes)
    setOk(creds)
    onCreated()
  }

  if (ok) return <CredSuccess title="Mercado criado!" icon={Check} iconColor="#22c55e" accentColor="#f97316" ok={ok} emailResult={emailResult} onClose={onClose} />

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-black text-lg flex items-center gap-2"><Store className="w-5 h-5 text-orange-400" /> Novo Mercado</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-500 hover:text-white" /></button>
        </div>
        <div className="space-y-3">
          {[
            { key: 'storeName',  label: 'Nome do Mercado',         placeholder: 'Ex: Mercado São José' },
            { key: 'storePhone', label: 'WhatsApp (opcional)',      placeholder: '(11) 99999-0000' },
            { key: 'email',      label: 'Email (envia credenciais automaticamente)', placeholder: 'cliente@email.com' },
            { key: 'username',   label: 'Usuário de acesso',        placeholder: 'ex: mercadosaojose' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">{f.label}</label>
              <input className="w-full bg-gray-700 border border-gray-600 text-white rounded-xl px-4 py-2.5 outline-none focus:border-orange-500 text-sm"
                placeholder={f.placeholder} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
            </div>
          ))}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Senha inicial</label>
            <div className="relative">
              <input className="w-full bg-gray-700 border border-gray-600 text-white rounded-xl px-4 py-2.5 pr-12 outline-none focus:border-orange-500 text-sm"
                placeholder="mínimo 4 caracteres" type={show ? 'text' : 'password'}
                value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} onKeyDown={e => e.key === 'Enter' && submit()} />
              <button type="button" onClick={() => setShow(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200">
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
        {err && <div className="mt-3 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{err}</div>}
        <button onClick={submit} disabled={busy}
          className="w-full mt-5 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-black flex items-center justify-center gap-2">
          {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {busy ? 'Criando...' : 'Criar e Enviar Acesso'}
        </button>
      </div>
    </div>
  )
}

/* ─── DistCard ───────────────────────────────────────────── */
function DistCard({ dist, mk, onRefresh }) {
  const [busy,        setBusy]       = useState(false)
  const [showReset,   setShowReset]  = useState(false)
  const [newPass,     setNewPass]    = useState('')
  const [showResend,  setShowResend] = useState(false)
  const [resendPass,  setResendPass] = useState('')
  const [resendEmail, setResendEmail] = useState(dist.email || '')
  const [resendStatus, setResendStatus] = useState(null)

  const color  = ['#10b981', '#f97316', '#8b5cf6', '#0ea5e9', '#ec4899'][dist.storeName.length % 5]
  const initial = (dist.storeName || '?')[0].toUpperCase()

  function lastLoginLabel() {
    if (!dist.lastLogin) return '–'
    const diff = Date.now() - new Date(dist.lastLogin)
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}min atrás`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h atrás`
    return `${Math.floor(hrs / 24)}d atrás`
  }

  const toggle = async () => {
    setBusy(true)
    await api('/api/forn-admin', mk, { method: 'POST', body: JSON.stringify({ action: 'toggle', id: dist.id }) })
    await onRefresh(); setBusy(false)
  }

  const remove = async () => {
    if (!confirm(`Remover ${dist.storeName}?`)) return
    setBusy(true)
    await api('/api/forn-admin', mk, { method: 'POST', body: JSON.stringify({ action: 'delete', id: dist.id }) })
    await onRefresh(); setBusy(false)
  }

  const resetPass = async () => {
    if (!newPass.trim()) return
    setBusy(true)
    await api('/api/forn-admin', mk, { method: 'POST', body: JSON.stringify({ action: 'reset-pass', id: dist.id, password: newPass }) })
    setShowReset(false); setNewPass('')
    setBusy(false)
  }

  const setExpiry = async (dateStr) => {
    const expiresAt = dateStr ? new Date(dateStr + 'T23:59:59').toISOString() : null
    await api('/api/forn-admin', mk, { method: 'POST', body: JSON.stringify({ action: 'set-expiry', id: dist.id, expiresAt }) })
    await onRefresh()
  }

  const resendAccess = async () => {
    if (!resendEmail || !resendPass || resendPass.length < 4) return
    setResendStatus('sending')
    await api('/api/forn-admin', mk, { method: 'POST', body: JSON.stringify({ action: 'reset-pass', id: dist.id, password: resendPass }) })
    const eRes = await sendWelcomeEmail(mk, { to: resendEmail, type: 'dist', storeName: dist.storeName, username: dist.username, password: resendPass })
    setResendStatus(eRes.sent ? 'ok' : 'err')
    setTimeout(() => { setShowResend(false); setResendStatus(null); setResendPass('') }, 3000)
  }

  const exp    = dist.expiresAt ? new Date(dist.expiresAt) : null
  const days   = exp ? Math.ceil((exp - Date.now()) / 86_400_000) : null
  const expired = days !== null && days < 0

  const badge = expired
    ? { label: `VENCIDA ${Math.abs(days)}d atrás`, cls: 'bg-red-500/20 text-red-400 border-red-500/30' }
    : days !== null && days <= 5
    ? { label: `Vence em ${days}d`, cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' }
    : days !== null
    ? { label: `${days}d restantes`, cls: 'bg-green-500/20 text-green-400 border-green-500/30' }
    : { label: 'Sem vencimento', cls: 'bg-gray-700/50 text-gray-500 border-gray-600/30' }

  return (
    <div className={`rounded-2xl border p-5 flex flex-col gap-4 transition-all ${dist.active ? 'bg-gray-800/80 border-gray-700 hover:border-gray-600' : 'bg-gray-900/60 border-gray-800 opacity-60'}`}>
      {/* header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-base flex-shrink-0" style={{ background: color }}>
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-black text-white text-sm truncate">{dist.storeName}</div>
          <div className="text-gray-500 text-xs">@{dist.username}</div>
        </div>
        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${dist.active ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-gray-700/50 text-gray-500 border-gray-600/30'}`}>
          {dist.active ? 'ATIVO' : 'INATIVO'}
        </span>
      </div>

      {/* meta */}
      <div className="text-xs text-gray-500 space-y-1">
        {dist.storePhone && <div>📞 {dist.storePhone}</div>}
        <div className="flex items-center gap-1"><Clock className="w-3 h-3" /> {lastLoginLabel()}</div>
        <div><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.cls}`}>{badge.label}</span></div>
      </div>

      {/* expiry picker */}
      <div>
        <label className="text-[10px] text-gray-600 uppercase font-bold block mb-1">Vencimento</label>
        <input type="date" defaultValue={dist.expiresAt?.slice(0, 10) || ''}
          className="w-full text-xs bg-gray-700/50 border border-gray-700 rounded-lg px-3 py-1.5 text-gray-300 focus:outline-none focus:border-orange-500"
          onChange={e => setExpiry(e.target.value)} />
      </div>

      {/* reset pass */}
      {showReset ? (
        <div className="flex gap-2">
          <input placeholder="Nova senha" value={newPass} onChange={e => setNewPass(e.target.value)}
            className="flex-1 text-xs bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-orange-500" />
          <button onClick={resetPass} disabled={busy || !newPass.trim()}
            className="px-3 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold disabled:opacity-40">OK</button>
          <button onClick={() => setShowReset(false)}
            className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-400 text-xs"><X className="w-3 h-3" /></button>
        </div>
      ) : (
        <button onClick={() => { setShowReset(true); setShowResend(false) }}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-gray-700/50 hover:bg-gray-700 text-gray-400 hover:text-white text-xs transition-colors">
          <Key className="w-3 h-3" /> Resetar senha
        </button>
      )}

      {/* reenviar acesso por email */}
      {showResend && (
        <div className="space-y-2">
          {resendStatus === 'ok'  && <p className="text-green-400 text-xs font-bold">✅ Email enviado!</p>}
          {resendStatus === 'err' && <p className="text-yellow-400 text-xs">⚠️ Não enviado (configure RESEND_API_KEY em resend.com)</p>}
          {!resendStatus && <>
            <input className="w-full bg-gray-700 border border-gray-600 text-white text-xs rounded-xl px-3 py-2 outline-none focus:border-emerald-400"
              placeholder="Email do distribuidor" type="email" value={resendEmail} onChange={e => setResendEmail(e.target.value)} />
            <div className="flex gap-2">
              <input className="flex-1 bg-gray-700 border border-gray-600 text-white text-xs rounded-xl px-3 py-2 outline-none focus:border-emerald-400"
                placeholder="Nova senha (mín. 4)" type="password" value={resendPass} onChange={e => setResendPass(e.target.value)} />
              <button onClick={resendAccess} disabled={!resendEmail || resendPass.length < 4}
                className="px-3 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold disabled:opacity-40">Enviar</button>
              <button onClick={() => { setShowResend(false); setResendPass('') }}
                className="px-2 rounded-xl bg-gray-700 text-gray-400 text-xs hover:bg-gray-600"><X className="w-3 h-3" /></button>
            </div>
          </>}
        </div>
      )}

      {/* actions */}
      <div className="flex gap-2 pt-1 border-t border-gray-700/50">
        <button onClick={toggle} disabled={busy}
          className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-40 ${dist.active ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-green-500/20 hover:bg-green-500/30 text-green-400'}`}>
          <Power className="w-3 h-3" /> {dist.active ? 'Desativar' : 'Ativar'}
        </button>
        <button onClick={() => { setShowResend(v => !v); setShowReset(false) }}
          title="Reenviar acesso por email"
          className="px-3 py-2 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-xs transition-colors">
          <Mail className="w-3 h-3" />
        </button>
        <button onClick={remove} disabled={busy}
          className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs transition-colors disabled:opacity-40">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

/* ─── AddDistModal ───────────────────────────────────────── */
function AddDistModal({ mk, onClose, onCreated }) {
  const [form, setForm]       = useState({ storeName: '', username: '', password: '', storePhone: '', email: '', themeColor: '#10b981' })
  const [show, setShow]       = useState(false)
  const [err,  setErr]        = useState(null)
  const [ok,   setOk]         = useState(null)
  const [busy, setBusy]       = useState(false)
  const [emailResult, setEmailResult] = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.storeName || !form.username || !form.password) { setErr('Preencha todos os campos obrigatórios'); return }
    setBusy(true); setErr(null)
    const res = await api('/api/forn-admin', mk, { method: 'POST', body: JSON.stringify(form) })
    if (!res.ok) { setBusy(false); setErr(res.error || 'Erro ao criar'); return }
    const eRes = await sendWelcomeEmail(mk, { to: form.email, type: 'dist', storeName: form.storeName, username: form.username, password: form.password })
    setBusy(false); setEmailResult(eRes)
    setOk({ username: form.username, password: form.password, email: form.email })
    onCreated()
  }

  if (ok) return <CredSuccess title="Distribuidor criado!" icon={Check} iconColor="#10b981" accentColor="#10b981" ok={ok} emailResult={emailResult} onClose={onClose} />

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div className="font-black text-white text-lg flex items-center gap-2"><Truck className="w-5 h-5 text-emerald-400" /> Novo Distribuidor</div>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-500 hover:text-white" /></button>
        </div>
        <div className="space-y-4">
          {[
            ['storeName', 'Nome do distribuidor *', 'text'],
            ['storePhone', 'Telefone / WhatsApp', 'text'],
            ['email', 'Email (envia credenciais automaticamente)', 'email'],
            ['username', 'Usuário *', 'text'],
            ['password', 'Senha *', show ? 'text' : 'password'],
          ].map(([k, label, type]) => (
            <div key={k}>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{label}</label>
              <input className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-emerald-400"
                value={form[k]} onChange={e => set(k, e.target.value)} type={type} />
            </div>
          ))}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Cor do tema</label>
            <input type="color" value={form.themeColor} onChange={e => set('themeColor', e.target.value)}
              className="w-12 h-10 rounded-lg border border-gray-600 cursor-pointer bg-gray-700" />
          </div>
        </div>
        {err && <div className="mt-4 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{err}</div>}
        <button onClick={submit} disabled={busy}
          className="w-full mt-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white font-black flex items-center justify-center gap-2">
          {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {busy ? 'Criando...' : 'Criar e Enviar Acesso'}
        </button>
      </div>
    </div>
  )
}

export default function MasterPainel() {
  const [mk,           setMk]           = useState(getMK)
  const [mkInput,      setMkInput]       = useState(getMK)
  const [showMk,       setShowMk]        = useState(false)
  const [authed,       setAuthed]        = useState(false)
  const [markets,      setMarkets]       = useState([])
  const [distributors, setDistributors]  = useState([])
  const [loading,      setLoading]       = useState(false)
  const [err,          setErr]           = useState(null)
  const [showAdd,      setShowAdd]       = useState(false)   // 'market' | 'dist' | false
  const [tab,          setTab]           = useState('overview') // 'overview' | 'markets' | 'dist'

  const load = useCallback(async (key = mk) => {
    if (!key) return
    setLoading(true); setErr(null)
    try {
      const [mRes, dRes] = await Promise.all([
        api('/api/markets-admin', key),
        api('/api/forn-admin', key),
      ])
      if (!mRes.ok) { setErr('Chave master incorreta.'); setAuthed(false); return }
      setMarkets(mRes.markets || [])
      setDistributors(dRes.ok ? (dRes.distributors || []) : [])
      setAuthed(true)
    } catch {
      setErr('Erro de conexão. Verifique sua rede.')
    } finally {
      setLoading(false)
    }
  }, [mk])

  const login = async () => {
    const key = mkInput.trim(); if (!key) return
    localStorage.setItem(MK_KEY, key); setMk(key); await load(key)
  }

  const accessMarket = (market) => {
    localStorage.setItem('zs_master_session', JSON.stringify({ mk, returnTo: '/painel' }))
    localStorage.setItem('cp_session', JSON.stringify({
      loggedIn: true, user: market.username, storeId: market.storeId, storeName: market.storeName, role: 'admin',
    }))
    window.open('/dashboard', '_blank')
  }

  /* ── derived stats ── */
  const now        = Date.now()
  const mActive    = markets.filter(m => m.active)
  const dActive    = distributors.filter(d => d.active)
  const allActive  = mActive.length + dActive.length
  const totalAll   = markets.length + distributors.length
  const recent24   = [...markets, ...distributors].filter(x => x.lastLogin && now - new Date(x.lastLogin) < 86_400_000)
  const expiring7  = [...markets, ...distributors].filter(x => {
    if (!x.expiresAt) return false
    const d = Math.ceil((new Date(x.expiresAt) - now) / 86_400_000)
    return d >= 0 && d <= 7
  })
  const expired    = [...markets, ...distributors].filter(x => x.expiresAt && new Date(x.expiresAt) < now)

  /* ── login screen ── */
  if (!authed) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4"><ZatendeStockLogo variant="full" /></div>
          <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-black px-4 py-1.5 rounded-full">
            <ShieldAlert className="w-3.5 h-3.5" /> PAINEL MASTER — ACESSO RESTRITO
          </div>
        </div>
        <div className="bg-gray-800/60 border border-gray-700 rounded-2xl p-6 backdrop-blur-sm">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Chave Master</label>
          <div className="relative mb-4">
            <input className="w-full bg-gray-700 border border-gray-600 text-white rounded-xl px-4 py-3 pr-12 outline-none focus:border-orange-500 transition-colors font-mono"
              type={showMk ? 'text' : 'password'} placeholder="Chave de acesso master"
              value={mkInput} onChange={e => setMkInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()} autoFocus />
            <button onClick={() => setShowMk(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200">
              {showMk ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {err && <div className="mb-4 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{err}</div>}
          <button onClick={login} disabled={loading || !mkInput.trim()}
            className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-black transition-all flex items-center justify-center gap-2">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {loading ? 'Verificando...' : 'Entrar no Painel Master'}
          </button>
        </div>
        <p className="text-center text-gray-600 text-xs mt-6">ZatendeStock · Painel interno · Não compartilhe esta URL</p>
      </div>
    </div>
  )

  /* ── authenticated layout ── */
  const TABS = [
    { id: 'overview', label: 'Visão Geral',    icon: BarChart2 },
    { id: 'markets',  label: `Mercados (${markets.length})`,  icon: Store  },
    { id: 'dist',     label: `Distribuidores (${distributors.length})`, icon: Truck  },
  ]

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* sticky header */}
      <div className="bg-gray-900/80 border-b border-gray-800 sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-shrink-0">
            <ZatendeStockLogo variant="wordmark" />
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 hidden sm:block">
              PAINEL MASTER
            </span>
          </div>

          {/* tabs */}
          <div className="flex items-center gap-1 bg-gray-800/80 rounded-xl p-1 flex-1 max-w-md">
            {TABS.map(t => {
              const Icon = t.icon
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                    tab === t.id ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="hidden sm:block truncate">{t.label}</span>
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => load()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:block">Atualizar</span>
            </button>
            {tab !== 'overview' && (
              <button onClick={() => setShowAdd(tab === 'markets' ? 'market' : 'dist')}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black transition-colors">
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:block">{tab === 'markets' ? 'Novo Mercado' : 'Novo Distribuidor'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* ── VISÃO GERAL ── */}
        {tab === 'overview' && (
          <div className="space-y-8">
            {/* summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Clientes ativos"   value={allActive}         sub={`de ${totalAll} cadastrados`}      color="#f97316" />
              <StatCard label="Mercados"           value={markets.length}    sub={`${mActive.length} ativos`}        color="#8b5cf6" />
              <StatCard label="Distribuidores"     value={distributors.length} sub={`${dActive.length} ativos`}     color="#10b981" />
              <StatCard label="Acessaram hoje"     value={recent24.length}   sub="últimas 24h"                      color="#0ea5e9" />
            </div>

            {/* alert rows */}
            {expiring7.length > 0 && (
              <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-5">
                <div className="flex items-center gap-2 text-yellow-400 font-black text-sm mb-4">
                  <CalendarClock className="w-4 h-4" /> Vencendo em 7 dias ({expiring7.length})
                </div>
                <div className="space-y-2">
                  {expiring7.map(x => {
                    const d = Math.ceil((new Date(x.expiresAt) - now) / 86_400_000)
                    return (
                      <div key={x.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-300">{x.storeName || x.username}</span>
                        <span className="text-yellow-400 font-bold text-xs">{d === 0 ? 'hoje' : `${d}d`}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {expired.length > 0 && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5">
                <div className="flex items-center gap-2 text-red-400 font-black text-sm mb-4">
                  <AlertTriangle className="w-4 h-4" /> Licenças vencidas ({expired.length}) — cobrar ou desativar
                </div>
                <div className="space-y-2">
                  {expired.map(x => {
                    const d = Math.abs(Math.ceil((new Date(x.expiresAt) - now) / 86_400_000))
                    return (
                      <div key={x.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-300">{x.storeName || x.username}</span>
                        <span className="text-red-400 font-bold text-xs">{d}d atrás</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* recent activity */}
            <div>
              <div className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5" /> Atividade recente
              </div>
              {recent24.length === 0 ? (
                <p className="text-gray-600 text-sm">Nenhum acesso nas últimas 24h</p>
              ) : (
                <div className="space-y-2">
                  {recent24.map(x => {
                    const diff = now - new Date(x.lastLogin)
                    const label = diff < 3_600_000
                      ? `${Math.floor(diff / 60000)}min`
                      : `${Math.floor(diff / 3_600_000)}h`
                    return (
                      <div key={x.id} className="flex items-center gap-3 py-2 border-b border-gray-800/60">
                        <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                        <span className="text-gray-300 text-sm flex-1">{x.storeName || x.username}</span>
                        <span className="text-gray-600 text-xs">{label} atrás</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${x.tenantId ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'}`}>
                          {x.tenantId ? 'DIST' : 'MERC'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* quick nav */}
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setTab('markets')}
                className="flex items-center gap-3 p-5 rounded-2xl border border-gray-700 bg-gray-800/40 hover:bg-gray-800 transition-all text-left group">
                <Store className="w-8 h-8 text-purple-400" />
                <div>
                  <div className="font-black text-white">Mercados</div>
                  <div className="text-gray-500 text-xs">{markets.length} cadastrados · {mActive.length} ativos</div>
                </div>
              </button>
              <button onClick={() => setTab('dist')}
                className="flex items-center gap-3 p-5 rounded-2xl border border-gray-700 bg-gray-800/40 hover:bg-gray-800 transition-all text-left group">
                <Truck className="w-8 h-8 text-emerald-400" />
                <div>
                  <div className="font-black text-white">Distribuidores</div>
                  <div className="text-gray-500 text-xs">{distributors.length} cadastrados · {dActive.length} ativos</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ── MERCADOS ── */}
        {tab === 'markets' && (
          markets.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <Store className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="font-semibold text-lg">Nenhum mercado cadastrado ainda</p>
              <button onClick={() => setShowAdd('market')}
                className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black">
                <Plus className="w-4 h-4" /> Adicionar primeiro mercado
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {markets.map(m => (
                <MarketCard key={m.id} market={m} mk={mk} onRefresh={load} onAccess={accessMarket} />
              ))}
              <button onClick={() => setShowAdd('market')}
                className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-700 hover:border-orange-500/50 hover:bg-orange-500/5 transition-all min-h-[280px] gap-3 text-gray-500 hover:text-orange-400">
                <Plus className="w-8 h-8" /><span className="text-sm font-bold">Novo mercado</span>
              </button>
            </div>
          )
        )}

        {/* ── DISTRIBUIDORES ── */}
        {tab === 'dist' && (
          distributors.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <Truck className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="font-semibold text-lg">Nenhum distribuidor cadastrado ainda</p>
              <button onClick={() => setShowAdd('dist')}
                className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black">
                <Plus className="w-4 h-4" /> Adicionar primeiro distribuidor
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {distributors.map(d => (
                <DistCard key={d.id} dist={d} mk={mk} onRefresh={load} />
              ))}
              <button onClick={() => setShowAdd('dist')}
                className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-700 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all min-h-[280px] gap-3 text-gray-500 hover:text-emerald-400">
                <Plus className="w-8 h-8" /><span className="text-sm font-bold">Novo distribuidor</span>
              </button>
            </div>
          )
        )}
      </div>

      {showAdd === 'market' && (
        <AddMarketModal mk={mk} onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); load() }} />
      )}
      {showAdd === 'dist' && (
        <AddDistModal mk={mk} onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); load() }} />
      )}
    </div>
  )
}
