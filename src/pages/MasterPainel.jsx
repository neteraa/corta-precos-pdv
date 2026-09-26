import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, RefreshCw, Power, Trash2, LogIn, Copy, Check, Eye, EyeOff, ShieldAlert, Store, Clock, X, Key, Zap, Truck, BarChart2, TrendingUp, AlertTriangle, CalendarClock, Mail, ClipboardList, CheckCircle2, XCircle, MessageCircle, Phone, MapPin, Bot, Users, Building2, Flame, Send, Loader2, Menu, LogOut, Award, Link2, ToggleLeft, ToggleRight, DollarSign } from 'lucide-react'
import ZatendeStokLogo from '../components/ZatendeStokLogo.jsx'

/* ─── constants ──────────────────────────────────────────── */
const MK_KEY  = 'zs_master_key'
const BRL     = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

// Cidades da região de Itapeva SP e entorno — para o combobox de busca
const CITIES_LIST = [
  // ── Microregião de Itapeva ─────────────────────────────────
  'Itapeva SP', 'Capão Bonito SP', 'Guapiara SP', 'Buri SP', 'Apiaí SP',
  'Itaberá SP', 'Taquarivaí SP', 'Ribeira SP', 'Nova Campina SP',
  'Barão de Antonina SP', 'Coronel Macedo SP',
  // ── Microregião de Ourinhos ────────────────────────────────
  'Ourinhos SP', 'Piraju SP', 'Taquarituba SP', 'Salto Grande SP',
  'Chavantes SP', 'Ribeirão do Sul SP', 'Sarutaiá SP',
  'Santa Cruz do Rio Pardo SP', 'Bernardino de Campos SP',
  // ── Microregião de Avaré ───────────────────────────────────
  'Avaré SP', 'Cerqueira César SP', 'Paranapanema SP', 'Itaporanga SP',
  'Fartura SP', 'Manduri SP',
  // ── Microregião de Botucatu ────────────────────────────────
  'Botucatu SP', 'São Manuel SP', 'Itatinga SP', 'Pratânia SP',
  // ── Microregião de Assis ──────────────────────────────────
  'Assis SP', 'Cândido Mota SP', 'Palmital SP', 'Tarumã SP', 'Ibirarema SP',
  // ── Paraná (vizinhos) ─────────────────────────────────────
  'Siqueira Campos PR', 'Tomazina PR', 'Jaboti PR', 'Andirá PR',
  'Cambará PR', 'Bandeirantes PR', 'Cornélio Procópio PR',
  'Santo Antônio da Platina PR', 'Jacarezinho PR',
  // ── Grandes cidades SP ────────────────────────────────────
  'Sorocaba SP', 'Itapetininga SP', 'Itu SP', 'Tatui SP', 'Boituva SP',
  'São Paulo SP', 'Campinas SP', 'São José dos Campos SP',
]

function getMK() { return localStorage.getItem(MK_KEY) || '' }
function api(path, mk, opts = {}) {
  const sep = path.includes('?') ? '&' : '?'
  return fetch(`${path}${sep}mk=${encodeURIComponent(mk)}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  }).then(r => r.json())
}

/* ─── sub-components (module scope → no remount bug) ──── */
function StatCard({ label, value, sub, color = '#f97316', icon: Icon, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick}
      className={`relative overflow-hidden rounded-xl border border-gray-200 bg-white p-6 text-left w-full transition-all duration-200 group shadow-sm hover:shadow-md ${onClick ? 'hover:scale-[1.01] hover:border-gray-300 cursor-pointer' : ''}`}>
      {/* subtle gradient background */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: `linear-gradient(135deg, ${color}08 0%, transparent 50%)` }} />
      {Icon && <Icon className="w-6 h-6 mb-3" style={{ color }} />}
      <div className="text-3xl font-black tracking-tight leading-none text-gray-900">{value}</div>
      <div className="text-xs font-semibold uppercase tracking-wider mt-2" style={{ color }}>{label}</div>
      {sub && <div className="text-xs text-gray-600 mt-1">{sub}</div>}
    </Tag>
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
    // Ignora enquanto o usuário está digitando o ano (ex: "0002", "0020")
    if (dateStr) {
      const year = parseInt(dateStr.slice(0, 4), 10)
      if (year < 2020 || year > 2099) return
    }
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

  const sendWppAccess = async () => {
    const phone = market.storePhone
    if (!phone) { alert('Mercado sem telefone cadastrado. Edite o cadastro e adicione o WhatsApp do dono.'); return }
    if (!resendPass || resendPass.length < 4) { alert('Digite uma senha (mín. 4 caracteres) antes de enviar.'); return }
    setResendStatus('sending')
    await api('/api/markets-admin', mk, { method: 'POST', body: JSON.stringify({ action: 'reset-pass', id: market.id, password: resendPass }) })
    try {
      const res = await fetch('/api/wa-welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mk, phone, storeName: market.storeName, username: market.username, password: resendPass }),
      })
      const d = await res.json()
      setResendStatus(d.ok ? 'ok' : 'err')
    } catch { setResendStatus('err') }
    setTimeout(() => { setShowResend(false); setResendStatus(null); setResendPass('') }, 3000)
  }

  return (
    <div className={`relative flex flex-col rounded-2xl border transition-all ${
      market.active ? 'bg-gray-100/50 border-gray-300' : 'bg-white/50 border-gray-200 opacity-60'
    }`}>
      {/* header */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-300/50">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-black flex-shrink-0"
          style={{ background: color + '22', color, border: `2px solid ${color}` }}>
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-black text-white text-base leading-tight truncate">{market.storeName}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${market.active ? 'bg-green-400' : 'bg-gray-600'}`} />
            <span className="text-xs text-gray-600">{market.active ? 'Ativo' : 'Inativo'}</span>
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
          <span className="text-gray-700 font-mono font-bold">{market.username}</span>
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
          <span className="text-gray-600">{new Date(market.createdAt).toLocaleDateString('pt-BR')}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Último acesso</span>
          <span className="flex items-center gap-1 text-gray-600">
            <Clock className="w-3 h-3" /> {lastSeen}
          </span>
        </div>
        {market.storePhone && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">WhatsApp</span>
            <span className="text-gray-700">{market.storePhone}</span>
          </div>
        )}

        {/* Plano */}
        {(() => {
          const PLAN_COLORS = { Essencial: '#6366f1', Profissional: '#f97316', Enterprise: '#f59e0b' }
          const current = market.plan || null
          const setPlan = async (plan) => {
            setBusy(true)
            await api('/api/markets-admin', mk, { method: 'POST', body: JSON.stringify({ action: 'set-plan', id: market.id, plan }) })
            await onRefresh()
            setBusy(false)
          }
          return (
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-gray-500">Plano</span>
              <select
                value={current || ''}
                disabled={busy}
                onChange={e => setPlan(e.target.value || null)}
                className="bg-gray-200 border border-gray-400 text-xs rounded-lg px-2 py-1 outline-none focus:border-orange-500 disabled:opacity-40"
                style={{ color: PLAN_COLORS[current] || '#9ca3af' }}>
                <option value="">— sem plano —</option>
                <option value="Essencial" style={{ color: PLAN_COLORS.Essencial }}>Essencial — R$297/mês</option>
                <option value="Profissional" style={{ color: PLAN_COLORS.Profissional }}>Profissional — R$497/mês</option>
                <option value="Enterprise" style={{ color: PLAN_COLORS.Enterprise }}>Enterprise — Personalizado</option>
              </select>
            </div>
          )
        })()}

        {/* Nicho */}
        {(() => {
          const NICHE_OPTS = [
            { v:'mercado',       e:'🏪', l:'Mercado' },
            { v:'padaria',       e:'🥖', l:'Padaria' },
            { v:'acougue',       e:'🥩', l:'Açougue' },
            { v:'restaurante',   e:'🍽️', l:'Restaurante' },
            { v:'lanchonete',    e:'🌯', l:'Lanchonete' },
            { v:'distribuidora', e:'🚚', l:'Distribuidora' },
          ]
          const cur = market.niche || 'mercado'
          const setNiche = async (niche) => {
            setBusy(true)
            await api('/api/markets-admin', mk, { method: 'POST', body: JSON.stringify({ action: 'set-niche', id: market.id, niche }) })
            await onRefresh()
            setBusy(false)
          }
          return (
            <div className="flex items-center justify-between text-xs pt-0.5">
              <span className="text-gray-500">Nicho</span>
              <select value={cur} disabled={busy}
                onChange={e => setNiche(e.target.value)}
                className="bg-gray-200 border border-gray-400 text-xs rounded-lg px-2 py-1 outline-none focus:border-indigo-500 disabled:opacity-40 text-gray-200">
                {NICHE_OPTS.map(o => <option key={o.v} value={o.v}>{o.e} {o.l}</option>)}
              </select>
            </div>
          )
        })()}

        {/* Expiry / payment status */}
        {(() => {
          const _raw = market.expiresAt ? new Date(market.expiresAt) : null
          const exp  = _raw && _raw.getFullYear() >= 2020 ? _raw : null
          const days = exp ? Math.ceil((exp - Date.now()) / 86_400_000) : null
          const expired = exp && days < 0
          const warn    = exp && days >= 0 && days <= 5
          const badge   = expired ? { label: `VENCIDA ${Math.abs(days)}d atrás`, cls: 'bg-red-500/20 text-red-400 border-red-500/30' }
                        : warn    ? { label: `Vence em ${days}d`, cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' }
                        : exp     ? { label: `OK até ${exp.toLocaleDateString('pt-BR')}`, cls: 'bg-green-500/20 text-green-400 border-green-500/30' }
                        :           { label: 'Sem vencimento', cls: 'bg-gray-200 text-gray-500 border-gray-400' }
          return (
            <div className="pt-1 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Assinatura</span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${badge.cls}`}>{badge.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  defaultValue={exp && exp.getFullYear() >= 2020 ? exp.toISOString().slice(0,10) : ''}
                  min="2020-01-01" max="2099-12-31"
                  disabled={busy}
                  onChange={e => setExpiry(e.target.value)}
                  className="flex-1 bg-gray-200 border border-gray-400 text-gray-200 text-xs rounded-lg px-2 py-1.5 outline-none focus:border-orange-500 disabled:opacity-40"
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
          <input className="flex-1 bg-gray-200 border border-gray-400 text-white text-sm rounded-xl px-3 py-2 outline-none focus:border-orange-500"
            placeholder="Nova senha (mín. 4)" type="password" value={newPass}
            onChange={e => setNewPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && resetPass()} />
          <button onClick={resetPass} disabled={newPass.length < 4 || busy}
            className="px-3 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black disabled:opacity-40">OK</button>
          <button onClick={() => setShowReset(false)} className="px-3 py-2 rounded-xl bg-gray-200 text-gray-600 text-xs hover:bg-gray-600">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* reenviar acesso por email */}
      {showResend && (
        <div className="px-4 pb-3 space-y-2">
          {resendStatus === 'sending' && <p className="text-orange-400 text-xs font-bold animate-pulse">⏳ Enviando...</p>}
          {resendStatus === 'ok'  && <p className="text-green-400 text-xs font-bold">✅ Enviado com sucesso!</p>}
          {resendStatus === 'err' && <p className="text-yellow-400 text-xs">⚠️ Não enviado — verifique a configuração</p>}
          {!resendStatus && <>
            <p className="text-xs text-gray-600 font-semibold">Reenviar acesso ao cliente:</p>
            <input className="w-full bg-gray-200 border border-gray-400 text-white text-xs rounded-xl px-3 py-2 outline-none focus:border-orange-500"
              placeholder="Nova senha (mín. 4 caracteres)" type="password" value={resendPass} onChange={e => setResendPass(e.target.value)} />
            <input className="w-full bg-gray-200 border border-gray-400 text-white text-xs rounded-xl px-3 py-2 outline-none focus:border-orange-500"
              placeholder="Email do cliente (para envio por email)" type="email" value={resendEmail} onChange={e => setResendEmail(e.target.value)} />
            <div className="flex gap-2">
              {/* WhatsApp — principal */}
              <button onClick={sendWppAccess} disabled={resendPass.length < 4}
                title={market.storePhone ? `Enviar para ${market.storePhone}` : 'Sem telefone cadastrado'}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-bold disabled:opacity-40 transition-colors">
                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
              </button>
              {/* Email */}
              <button onClick={resendAccess} disabled={!resendEmail || resendPass.length < 4}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold disabled:opacity-40 transition-colors">
                <Mail className="w-3.5 h-3.5" /> Email
              </button>
              <button onClick={() => { setShowResend(false); setResendPass('') }}
                className="px-2 py-2 rounded-xl bg-gray-200 text-gray-600 text-xs hover:bg-gray-600"><X className="w-3 h-3" /></button>
            </div>
          </>}
        </div>
      )}

      {/* actions */}
      <div className="flex gap-2 p-4 pt-2 border-t border-gray-300/50">
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
          className="px-3 py-2 rounded-xl bg-gray-200 hover:bg-gray-600 text-gray-700 text-xs transition-colors">
          <Key className="w-3.5 h-3.5" />
        </button>
        <button onClick={toggle} disabled={busy}
          title={market.active ? 'Desativar' : 'Ativar'}
          className={`px-3 py-2 rounded-xl text-xs transition-colors ${
            market.active ? 'bg-gray-200 hover:bg-yellow-500/20 text-gray-700 hover:text-yellow-400' : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
          }`}>
          <Power className="w-3.5 h-3.5" />
        </button>
        <button onClick={remove} disabled={busy}
          title="Remover mercado"
          className="px-3 py-2 rounded-xl bg-gray-200 hover:bg-red-500/20 text-gray-600 hover:text-red-400 text-xs transition-colors">
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
      <div className="bg-gray-100 border border-gray-300 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <div className="text-center mb-5">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 border-2"
               style={{ background: `${iconColor}20`, borderColor: iconColor }}>
            <Icon className="w-7 h-7" style={{ color: iconColor }} />
          </div>
          <h3 className="text-white font-black text-xl">{title}</h3>

          {/* WhatsApp */}
          {emailResult?.wpp?.ok && (
            <p className="text-green-400 text-sm mt-2 flex items-center justify-center gap-1">
              <Check className="w-3.5 h-3.5" /> WhatsApp enviado para {ok.storePhone}
            </p>
          )}
          {emailResult?.wpp && !emailResult.wpp.ok && (
            <p className="text-yellow-400 text-xs mt-2">⚠️ WhatsApp: {emailResult.wpp.error || 'não enviado — verifique o bot'}</p>
          )}

          {/* Email */}
          {emailResult?.sent && mode === 'direct' && (
            <p className="text-green-400 text-sm mt-1 flex items-center justify-center gap-1">
              <Check className="w-3.5 h-3.5" /> Email enviado para {ok.email}
            </p>
          )}
          {emailResult?.sent && mode === 'admin-notify' && (
            <div className="mt-2 px-3 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-yellow-400 text-xs font-bold">📬 Notificação enviada para seu email</p>
              <p className="text-gray-500 text-xs mt-0.5">Abra <strong className="text-gray-600">agn.girardi@gmail.com</strong> e encaminhe para o cliente</p>
            </div>
          )}
          {!emailResult?.sent && ok.email && (
            <p className="text-yellow-400 text-xs mt-1">⚠️ {emailResult?.warning || 'Email não enviado'}</p>
          )}
          {!ok.email && !emailResult?.wpp && (
            <p className="text-gray-500 text-sm mt-1">Passe as credenciais ao cliente manualmente</p>
          )}
        </div>

        <div className="bg-white rounded-xl p-4 space-y-2 font-mono text-sm border border-gray-300 mb-4">
          <div className="flex justify-between"><span className="text-gray-600">URL</span><span style={{ color: accentColor }}>zatendestok.com.br</span></div>
          <div className="flex justify-between"><span className="text-gray-600">Usuário</span><span className="text-white font-bold">{ok.username}</span></div>
          <div className="flex justify-between"><span className="text-gray-600">Senha</span><span className="text-white font-bold">{ok.password}</span></div>
          {ok.storeId && <div className="flex justify-between"><span className="text-gray-600">Store ID</span><span className="text-green-400">{ok.storeId}</span></div>}
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
    const creds = { storeId: res.storeId, username: form.username, password: form.password, email: form.email, storePhone: form.storePhone }

    // Envio em paralelo: email + WhatsApp (quando telefone preenchido)
    const [eRes, wRes] = await Promise.all([
      sendWelcomeEmail(mk, { to: form.email, type: 'market', storeName: form.storeName, username: form.username, password: form.password }),
      form.storePhone
        ? fetch('/api/wa-welcome', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mk, phone: form.storePhone, storeName: form.storeName, username: form.username, password: form.password }),
          }).then(r => r.json()).catch(() => ({ ok: false, error: 'Erro de rede' }))
        : Promise.resolve(null),
    ])

    setBusy(false)
    setEmailResult({ ...eRes, wpp: wRes })
    setOk(creds)
    onCreated()
  }

  if (ok) return <CredSuccess title="Mercado criado!" icon={Check} iconColor="#22c55e" accentColor="#f97316" ok={ok} emailResult={emailResult} onClose={onClose} />

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="bg-gray-100 border border-gray-300 rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
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
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">{f.label}</label>
              <input className="w-full bg-gray-200 border border-gray-400 text-white rounded-xl px-4 py-2.5 outline-none focus:border-orange-500 text-sm"
                placeholder={f.placeholder} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
            </div>
          ))}
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Senha inicial</label>
            <div className="relative">
              <input className="w-full bg-gray-200 border border-gray-400 text-white rounded-xl px-4 py-2.5 pr-12 outline-none focus:border-orange-500 text-sm"
                placeholder="mínimo 4 caracteres" type={show ? 'text' : 'password'}
                value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} onKeyDown={e => e.key === 'Enter' && submit()} />
              <button type="button" onClick={() => setShow(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-200">
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
    if (dateStr) {
      const year = parseInt(dateStr.slice(0, 4), 10)
      if (year < 2020 || year > 2099) return
    }
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

  const _rawExp = dist.expiresAt ? new Date(dist.expiresAt) : null
  const exp     = _rawExp && _rawExp.getFullYear() >= 2020 ? _rawExp : null
  const days    = exp ? Math.ceil((exp - Date.now()) / 86_400_000) : null
  const expired = days !== null && days < 0

  const badge = expired
    ? { label: `VENCIDA ${Math.abs(days)}d atrás`, cls: 'bg-red-500/20 text-red-400 border-red-500/30' }
    : days !== null && days <= 5
    ? { label: `Vence em ${days}d`, cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' }
    : days !== null
    ? { label: `${days}d restantes`, cls: 'bg-green-500/20 text-green-400 border-green-500/30' }
    : { label: 'Sem vencimento', cls: 'bg-gray-200/50 text-gray-500 border-gray-400/30' }

  return (
    <div className={`rounded-2xl border p-5 flex flex-col gap-4 transition-all ${dist.active ? 'bg-gray-100/80 border-gray-300 hover:border-gray-400' : 'bg-white/60 border-gray-200 opacity-60'}`}>
      {/* header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-base flex-shrink-0" style={{ background: color }}>
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-black text-white text-sm truncate">{dist.storeName}</div>
          <div className="text-gray-500 text-xs">@{dist.username}</div>
        </div>
        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${dist.active ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-gray-200/50 text-gray-500 border-gray-400/30'}`}>
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
        <input type="date"
          defaultValue={dist.expiresAt && parseInt(dist.expiresAt.slice(0,4),10) >= 2020 ? dist.expiresAt.slice(0,10) : ''}
          min="2020-01-01" max="2099-12-31"
          className="w-full text-xs bg-gray-200/50 border border-gray-300 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:border-orange-500"
          onChange={e => setExpiry(e.target.value)} />
      </div>

      {/* reset pass */}
      {showReset ? (
        <div className="flex gap-2">
          <input placeholder="Nova senha" value={newPass} onChange={e => setNewPass(e.target.value)}
            className="flex-1 text-xs bg-gray-200 border border-gray-400 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-orange-500" />
          <button onClick={resetPass} disabled={busy || !newPass.trim()}
            className="px-3 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold disabled:opacity-40">OK</button>
          <button onClick={() => setShowReset(false)}
            className="px-3 py-2 rounded-lg bg-gray-200 hover:bg-gray-600 text-gray-600 text-xs"><X className="w-3 h-3" /></button>
        </div>
      ) : (
        <button onClick={() => { setShowReset(true); setShowResend(false) }}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-gray-200/50 hover:bg-gray-200 text-gray-600 hover:text-white text-xs transition-colors">
          <Key className="w-3 h-3" /> Resetar senha
        </button>
      )}

      {/* reenviar acesso por email */}
      {showResend && (
        <div className="space-y-2">
          {resendStatus === 'ok'  && <p className="text-green-400 text-xs font-bold">✅ Email enviado!</p>}
          {resendStatus === 'err' && <p className="text-yellow-400 text-xs">⚠️ Não enviado (configure RESEND_API_KEY em resend.com)</p>}
          {!resendStatus && <>
            <input className="w-full bg-gray-200 border border-gray-400 text-white text-xs rounded-xl px-3 py-2 outline-none focus:border-emerald-400"
              placeholder="Email do distribuidor" type="email" value={resendEmail} onChange={e => setResendEmail(e.target.value)} />
            <div className="flex gap-2">
              <input className="flex-1 bg-gray-200 border border-gray-400 text-white text-xs rounded-xl px-3 py-2 outline-none focus:border-emerald-400"
                placeholder="Nova senha (mín. 4)" type="password" value={resendPass} onChange={e => setResendPass(e.target.value)} />
              <button onClick={resendAccess} disabled={!resendEmail || resendPass.length < 4}
                className="px-3 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold disabled:opacity-40">Enviar</button>
              <button onClick={() => { setShowResend(false); setResendPass('') }}
                className="px-2 rounded-xl bg-gray-200 text-gray-600 text-xs hover:bg-gray-600"><X className="w-3 h-3" /></button>
            </div>
          </>}
        </div>
      )}

      {/* actions */}
      <div className="flex gap-2 pt-1 border-t border-gray-300/50">
        <button onClick={toggle} disabled={busy}
          className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-40 ${dist.active ? 'bg-gray-200 hover:bg-gray-600 text-gray-700' : 'bg-green-500/20 hover:bg-green-500/30 text-green-400'}`}>
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
      <div className="bg-gray-100 border border-gray-300 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
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
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">{label}</label>
              <input className="w-full bg-gray-200 border border-gray-400 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-emerald-400"
                value={form[k]} onChange={e => set(k, e.target.value)} type={type} />
            </div>
          ))}
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Cor do tema</label>
            <input type="color" value={form.themeColor} onChange={e => set('themeColor', e.target.value)}
              className="w-12 h-10 rounded-lg border border-gray-400 cursor-pointer bg-gray-200" />
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
  const [requests,     setRequests]      = useState([])
  const [loading,      setLoading]       = useState(false)
  const [err,          setErr]           = useState(null)
  const [showAdd,      setShowAdd]       = useState(false)
  const [tab,          setTab]           = useState('overview')
  const [sidebarOpen,  setSidebarOpen]   = useState(false)
  const [leads,        setLeads]         = useState([])
  const [leadsLoading, setLeadsLoading]  = useState(false)
  const [leadsFilter,  setLeadsFilter]   = useState('all') // 'all' | 'novo' | 'curioso' | 'interessado' | 'demo' | 'fechado'
  const [selectedLead, setSelectedLead]  = useState(null)  // modal de detalhes
  const [migrating,    setMigrating]     = useState(false)
  const [migrateResult, setMigrateResult] = useState(null)

  // ── Prospecção — fila ──────────────────────────────────────
  const [prospInnerTab, setProspInnerTab]   = useState('search')
  // entrada manual
  const [manualPhone,   setManualPhone]     = useState('')
  const [manualName,    setManualName]      = useState('')
  // colar texto em massa
  const [captureText,   setCaptureText]     = useState('')
  const [parsedPhones,  setParsedPhones]    = useState([])
  const [addingQueue,   setAddingQueue]     = useState(false)
  // fila
  const [queue,         setQueue]           = useState([])
  const [queueStats,    setQueueStats]      = useState({ pending:0, sent:0, failed:0, dailySent:0, dailyLimit:20 })
  const [queueLoading,  setQueueLoading]    = useState(false)
  // validação WA
  const [validating,    setValidating]      = useState(false)
  const [validResult,   setValidResult]     = useState(null)
  // disparo
  const [sendProgress,  setSendProgress]    = useState(null)
  const [sendLog,       setSendLog]         = useState([])
  const stopRef = useRef(false)
  // Google Places search
  const [searchQuery,    setSearchQuery]    = useState('mercado')
  const [searchCity,     setSearchCity]     = useState('Itapeva SP')
  const [searchLoading,  setSearchLoading]  = useState(false)
  const [searchResults,  setSearchResults]  = useState([])
  const [searchNextPage, setSearchNextPage] = useState(null)
  const [searchSelected, setSearchSelected] = useState(new Set())
  const [googleKey,      setGoogleKey]      = useState(null) // null=pendente, true/false
  const [addingSearch,       setAddingSearch]       = useState(false)
  const [addingSearchStatus, setAddingSearchStatus] = useState(null) // 'validating' | 'adding' | null
  const [showCityDrop,       setShowCityDrop]       = useState(false)

  const [campaigns,         setCampaigns]         = useState([])
  const [campsLoading,      setCampsLoading]      = useState(false)
  const [prospLeads,        setProspLeads]        = useState([])
  const [prospLeadsLoading, setProspLeadsLoading] = useState(false)
  const [leadsView,         setLeadsView]         = useState('pipeline') // 'pipeline' | 'list'
  const [sendCountdown,     setSendCountdown]     = useState(null)       // segundos restantes no delay
  const [contactedPhones,   setContactedPhones]   = useState(new Set())  // já contatados (dedup)

  const [approving,    setApproving]     = useState(null) // id being processed

  // ── Afiliados ──────────────────────────────────────────────
  const [affiliates,    setAffiliates]   = useState([])
  const [affLoading,    setAffLoading]   = useState(false)
  const [affForm,       setAffForm]      = useState({ nome:'', telefone:'', codigo:'', comissaoPct:'20' })
  const [affAdding,     setAffAdding]    = useState(false)
  const [affShowForm,   setAffShowForm]  = useState(false)

  const load = useCallback(async (key = mk) => {
    if (!key) return
    setLoading(true); setErr(null)
    try {
      const [mRes, dRes, rRes] = await Promise.all([
        api('/api/markets-admin', key),
        api('/api/forn-admin', key),
        api('/api/request-admin', key),
      ])
      if (!mRes.ok) { setErr('Chave master incorreta.'); setAuthed(false); return }
      setMarkets(mRes.markets || [])
      setDistributors(dRes.ok ? (dRes.distributors || []) : [])
      setRequests(rRes.ok ? (rRes.requests || []) : [])
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

  const loadLeads = useCallback(async () => {
    if (!mk) return
    setLeadsLoading(true)
    try {
      const res = await api('/api/leads', mk)
      if (res.ok) setLeads(res.leads || [])
    } catch { /* silencioso */ }
    finally { setLeadsLoading(false) }
  }, [mk])

  // Carrega leads ao entrar na aba
  useEffect(() => { if (tab === 'leads' && mk) loadLeads() }, [tab, mk, loadLeads])

  const migrateHistory = async () => {
    if (!confirm('Criar histórico de conversas para leads antigos?\n\nIsso vai criar conversas simuladas baseadas nos dados dos leads que ainda não têm histórico.\n\nOBS: Isso cria históricos para a instância "zara" (bot de vendas ZatendeStok).')) return
    setMigrating(true)
    setMigrateResult(null)
    try {
      // Passa instance=zara (bot de vendas ZatendeStok - leads do MasterPainel)
      const res = await api('/api/migrate-chat-history?instance=zara', mk, { method: 'POST' })
      setMigrateResult(res)
      if (res.ok) {
        setTimeout(() => setMigrateResult(null), 8000)
      }
    } catch (e) {
      setMigrateResult({ ok: false, error: e.message })
    } finally {
      setMigrating(false)
    }
  }



  // ── Helpers da Fila ────────────────────────────────────────
  const queueApi = useCallback((body) =>
    fetch('/api/wa-queue', {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', 'x-master-key': mk },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }).then(r => r.json()),
  [mk])

  const loadQueue = useCallback(async () => {
    setQueueLoading(true)
    try {
      const data = await queueApi(null)
      if (data.ok) { setQueue(data.queue || []); setQueueStats(data.stats || {}) }
    } finally { setQueueLoading(false) }
  }, [queueApi])

  useEffect(() => { if (tab === 'prospect' && mk) loadQueue() }, [tab, mk, loadQueue])

  const loadAffiliates = useCallback(async () => {
    if (!mk) return
    setAffLoading(true)
    try {
      const res = await fetch(`/api/affiliates?mk=${mk}`)
      const d   = await res.json()
      if (d.ok) setAffiliates(d.affiliates || [])
    } finally { setAffLoading(false) }
  }, [mk])

  useEffect(() => { if (tab === 'afiliados' && mk) loadAffiliates() }, [tab, mk, loadAffiliates])

  const addAffiliate = async () => {
    if (!affForm.nome.trim() || !affForm.telefone.trim()) return
    setAffAdding(true)
    try {
      const res = await fetch(`/api/affiliates?mk=${mk}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:      'create',
          nome:        affForm.nome.trim(),
          telefone:    affForm.telefone.trim(),
          codigo:      affForm.codigo.trim() || undefined,
          comissaoPct: Number(affForm.comissaoPct) / 100,
        }),
      })
      const d = await res.json()
      if (d.ok) {
        setAffiliates(prev => [...prev, d.affiliate])
        setAffForm({ nome:'', telefone:'', codigo:'', comissaoPct:'20' })
        setAffShowForm(false)
      } else { alert(d.error || 'Erro ao criar afiliado') }
    } finally { setAffAdding(false) }
  }

  const toggleAffiliate = async (id) => {
    const res = await fetch(`/api/affiliates?mk=${mk}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle', id }),
    })
    const d = await res.json()
    if (d.ok) setAffiliates(prev => prev.map(a => a.id === id ? { ...a, ativo: d.ativo } : a))
  }

  const deleteAffiliate = async (id, nome) => {
    if (!confirm(`Excluir afiliado "${nome}"?`)) return
    const res = await fetch(`/api/affiliates?mk=${mk}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id }),
    })
    if ((await res.json()).ok) setAffiliates(prev => prev.filter(a => a.id !== id))
  }

  // Normaliza telefone no frontend (igual ao backend)
  const normalizePhone = useCallback((raw) => {
    const d = raw.replace(/\D/g, '').replace(/^0+/, '')
    if (d.startsWith('55') && d.length >= 12) return d
    if (d.length === 11) return `55${d}`
    if (d.length === 10) return `55${d}`
    return null
  }, [])

  // Entrada manual — adiciona um número direto à fila
  const addManual = useCallback(async () => {
    const phone = normalizePhone(manualPhone)
    if (!phone) return
    setAddingQueue(true)
    try {
      const res = await queueApi({ action: 'add', contacts: [{ phone, name: manualName.trim() }] })
      if (res.ok) { setManualPhone(''); setManualName(''); await loadQueue() }
    } finally { setAddingQueue(false) }
  }, [manualPhone, manualName, normalizePhone, queueApi, loadQueue])

  // Parser de texto em massa
  const parsePhones = useCallback((text) => {
    const found = new Set()
    const p1 = /\(([1-9]\d)\)\s*([0-9]{4,5})[-\s]([0-9]{4})/g
    let m
    while ((m = p1.exec(text)) !== null) {
      const n = `55${m[1]}${m[2]}${m[3]}`
      if (n.length >= 12 && n.length <= 13) found.add(n)
    }
    const p2 = /\b([1-9]\d)\s+([0-9]{4,5})[-\s]([0-9]{4})\b/g
    while ((m = p2.exec(text)) !== null) {
      const n = `55${m[1]}${m[2]}${m[3]}`
      if (n.length >= 12 && n.length <= 13) found.add(n)
    }
    const p3 = /\b([1-9]\d)(\d{8,9})\b/g
    while ((m = p3.exec(text)) !== null) {
      const n = `55${m[1]}${m[2]}`
      if (n.length >= 12 && n.length <= 13) found.add(n)
    }
    return [...found].map(phone => ({ phone, name: '' }))
  }, [])

  const handleParseText = useCallback(() => {
    const phones = parsePhones(captureText)
    const existingPhones = new Set(queue.map(c => c.phone))
    setParsedPhones(phones.filter(p => !existingPhones.has(p.phone)))
  }, [captureText, parsePhones, queue])

  const addParsedToQueue = useCallback(async () => {
    if (!parsedPhones.length) return
    setAddingQueue(true)
    try {
      const res = await queueApi({ action: 'add', contacts: parsedPhones })
      if (res.ok) { setCaptureText(''); setParsedPhones([]); await loadQueue(); setProspInnerTab('queue') }
    } finally { setAddingQueue(false) }
  }, [parsedPhones, queueApi, loadQueue])

  // Validação WhatsApp — verifica se números têm WA antes de enviar
  const validateQueueWA = useCallback(async () => {
    const pending = queue.filter(c => c.status === 'pending')
    if (!pending.length) return
    setValidating(true)
    setValidResult(null)
    try {
      const res = await fetch('/api/wa-validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-master-key': mk },
        body: JSON.stringify({ phones: pending.map(c => c.phone) }),
      })
      const data = await res.json()
      setValidResult(data)
      // Remove da fila quem não tem WhatsApp
      if (data.ok && data.results) {
        const noWA = data.results.filter(r => !r.exists).map(r => r.phone)
        for (const c of pending) {
          if (noWA.includes(c.phone)) {
            await queueApi({ action: 'update', id: c.id, status: 'failed', error: 'Sem WhatsApp' })
          }
        }
        await loadQueue()
      }
    } finally { setValidating(false) }
  }, [queue, mk, queueApi, loadQueue])

  // Disparo com delay anti-ban real (45-90s) e template rotativo
  const loadContactedPhones = useCallback(async () => {
    try {
      const d = await queueApi({ action: 'get-contacted' })
      setContactedPhones(new Set(d.phones || []))
    } catch {}
  }, [queueApi])

  const loadProspLeads = useCallback(async () => {
    setProspLeadsLoading(true)
    try {
      const res = await fetch(`/api/wa-leads?mk=${encodeURIComponent(mk)}`, { headers: { 'x-master-key': mk } })
      const d = await res.json()
      setProspLeads(d.leads || [])
    } catch { setProspLeads([]) }
    finally { setProspLeadsLoading(false) }
  }, [mk])

  const loadCampaigns = useCallback(async () => {
    setCampsLoading(true)
    try {
      const d = await queueApi({ action: 'get-campaigns' })
      setCampaigns(d.campaigns || [])
    } catch { setCampaigns([]) }
    finally { setCampsLoading(false) }
  }, [queueApi])

  const startQueueSend = useCallback(async () => {
    const pending = queue.filter(c => c.status === 'pending')
    if (!pending.length) return
    const canSend = Math.min(pending.length, (queueStats.dailyLimit || 20) - (queueStats.dailySent || 0))
    if (canSend <= 0) return

    const hour = new Date().getHours()
    if (hour < 8 || hour >= 19) {
      if (!window.confirm('São ' + hour + 'h — fora do horário comercial (8h-19h). WhatsApp detecta envios noturnos como spam. Quer continuar mesmo assim?')) return
    }

    stopRef.current = false
    setSendProgress({ current: 0, total: canSend })
    setSendLog([])
    setSendCountdown(null)
    const startedAt = new Date().toISOString()
    let totalSent = 0, totalFailed = 0

    const baseTemplateIdx = Math.floor(Math.random() * 6)

    for (let i = 0; i < canSend; i++) {
      if (stopRef.current) break
      const contact = pending[i]

      setSendProgress(prev => ({ ...prev, current: i, sending: contact.name || contact.phone }))
      try {
        const res = await fetch('/api/wa-prospect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-master-key': mk },
          body: JSON.stringify({ contacts: [{ phone: contact.phone, name: contact.name, templateIdx: baseTemplateIdx + i }] }),
        })
        const data = await res.json()
        const success = data.sent > 0
        await queueApi({ action: 'update', id: contact.id, status: success ? 'sent' : 'failed', error: success ? null : (data.results?.[0]?.error || 'falhou') })
        setSendLog(prev => [...prev, { phone: contact.phone, name: contact.name, success, ts: new Date().toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit', second:'2-digit' }) }])
        if (success) totalSent++; else totalFailed++
      } catch (e) {
        await queueApi({ action: 'update', id: contact.id, status: 'failed', error: e.message })
        setSendLog(prev => [...prev, { phone: contact.phone, name: contact.name, success: false, ts: new Date().toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit', second:'2-digit' }) }])
        totalFailed++
      }

      setSendProgress(prev => ({ ...prev, current: i + 1, sending: null }))

      if (i < canSend - 1 && !stopRef.current) {
        const waitMs = 45000 + Math.floor(Math.random() * 45000)
        const endTime = Date.now() + waitMs
        // Countdown em tempo real
        await new Promise(resolve => {
          const tick = () => {
            const left = Math.max(0, Math.round((endTime - Date.now()) / 1000))
            setSendCountdown(left)
            if (left <= 0 || stopRef.current) { setSendCountdown(null); resolve() }
            else setTimeout(tick, 1000)
          }
          tick()
        })
      }
    }

    setSendCountdown(null)
    setSendProgress(null)
    // Salvar histórico da campanha
    await queueApi({ action: 'save-campaign', sent: totalSent, failed: totalFailed, startedAt, endedAt: new Date().toISOString() })
    await Promise.all([loadQueue(), loadCampaigns()])
  }, [queue, queueStats, mk, queueApi, loadQueue, loadCampaigns])

  // ── Google Places Search ───────────────────────────────────
  const checkGoogleKey = useCallback(async () => {
    try {
      const res = await fetch('/api/wa-places', { headers: { 'x-master-key': mk } })
      const d = await res.json()
      setGoogleKey(d.configured === true)
    } catch { setGoogleKey(false) }
  }, [mk])

  useEffect(() => {
    if (tab === 'prospect' && mk) {
      if (prospInnerTab === 'search' && googleKey === null) checkGoogleKey()
      if (prospInnerTab === 'search') loadContactedPhones()
      if (prospInnerTab === 'leads')  loadProspLeads()
      if (prospInnerTab === 'queue')  loadCampaigns()
    }
  }, [tab, prospInnerTab, mk, googleKey, checkGoogleKey, loadContactedPhones, loadProspLeads, loadCampaigns])

  const runSearch = useCallback(async (pageToken = null) => {
    setSearchLoading(true)
    if (!pageToken) { setSearchResults([]); setSearchSelected(new Set()) }
    try {
      const res = await fetch('/api/wa-places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-master-key': mk },
        body: JSON.stringify({ query: searchQuery, city: searchCity, pageToken }),
      })
      const data = await res.json()
      if (data.ok) {
        setSearchResults(prev => pageToken ? [...prev, ...data.results] : data.results)
        setSearchNextPage(data.nextPageToken || null)
      }
    } finally { setSearchLoading(false) }
  }, [searchQuery, searchCity, mk])

  const toggleSelect = useCallback((phone) => {
    setSearchSelected(prev => {
      const n = new Set(prev)
      n.has(phone) ? n.delete(phone) : n.add(phone)
      return n
    })
  }, [])

  const addSearchToQueue = useCallback(async () => {
    const candidates = searchResults.filter(r => searchSelected.has(r.phone))
    if (!candidates.length) return
    setAddingSearch(true)
    setAddingSearchStatus('validating')
    try {
      // 1) Valida quais têm WhatsApp ativo antes de adicionar
      const valRes  = await fetch('/api/wa-validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-master-key': mk },
        body: JSON.stringify({ phones: candidates.map(r => r.phone) }),
      })
      const valData = await valRes.json()
      const validSet = new Set(
        (valData.results || []).filter(r => r.exists).map(r => r.phone)
      )
      const contacts = candidates.filter(r => validSet.has(r.phone)).map(r => ({ phone: r.phone, name: r.name, niche: searchQuery }))
      const skipped  = candidates.length - contacts.length

      if (!contacts.length) {
        alert(`❌ Nenhum dos ${candidates.length} selecionados tem WhatsApp ativo.\nTente outros leads ou outra cidade.`)
        return
      }

      // 2) Adiciona só os válidos
      setAddingSearchStatus('adding')
      const res = await queueApi({ action: 'add', contacts })
      if (res.ok) {
        setSearchSelected(new Set())
        await Promise.all([loadQueue(), loadContactedPhones()])
        setProspInnerTab('queue')
        if (skipped > 0) alert(`✅ ${contacts.length} adicionados à fila\n⚠️ ${skipped} sem WhatsApp — pulados automaticamente`)
      }
    } finally {
      setAddingSearch(false)
      setAddingSearchStatus(null)
    }
  }, [searchResults, searchSelected, searchQuery, queueApi, loadQueue, loadContactedPhones, mk])

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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4"><ZatendeStokLogo variant="full" /></div>
          <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-black px-4 py-1.5 rounded-full">
            <ShieldAlert className="w-3.5 h-3.5" /> PAINEL MASTER — ACESSO RESTRITO
          </div>
        </div>
        <div className="bg-gray-100/60 border border-gray-300 rounded-2xl p-6 backdrop-blur-sm">
          <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Chave Master</label>
          <div className="relative mb-4">
            <input className="w-full bg-gray-200 border border-gray-400 text-white rounded-xl px-4 py-3 pr-12 outline-none focus:border-orange-500 transition-colors font-mono"
              type={showMk ? 'text' : 'password'} placeholder="Chave de acesso master"
              value={mkInput} onChange={e => setMkInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()} autoFocus />
            <button onClick={() => setShowMk(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-200">
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
        <p className="text-center text-gray-600 text-xs mt-6">ZatendeStok · Painel interno · Não compartilhe esta URL</p>
      </div>
    </div>
  )

  const pendingCount = requests.filter(r => r.status === 'pending').length

  const approveRequest = async (req) => {
    setApproving(req.id)
    try {
      const res = await api('/api/request-admin', mk, {
        method: 'POST',
        body: JSON.stringify({ action: 'approve', id: req.id }),
      })
      if (res.ok) {
        setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'approved', username: res.username } : r))
        const isDistrib = res.tipo === 'distribuidor'
        if (!isDistrib) {
          setMarkets(prev => [...prev, { storeName: req.mercado, username: res.username, storeId: res.storeId, active: true, email: req.email }])
        }
        const loginUrl = isDistrib ? '/fornecedor' : '/login'
        const emailInfo = res.emailResult?.sent ? '\nEmail enviado ao cliente!' : '\nEnvie as credenciais manualmente via WhatsApp.'
        alert(`✅ Acesso criado!\n\nTipo: ${isDistrib ? 'Distribuidora' : 'Mercado'}\nUsuário: ${res.username}\nSenha: ${res.password}\nLogin: ${loginUrl}${emailInfo}`)
      }
    } catch { alert('Erro ao aprovar.') }
    setApproving(null)
  }

  const rejectRequest = async (id) => {
    if (!confirm('Rejeitar esta solicitação?')) return
    await api('/api/request-admin', mk, { method: 'POST', body: JSON.stringify({ action: 'reject', id }) })
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'rejected' } : r))
  }

  const deleteRequest = async (id) => {
    if (!confirm('Excluir esta solicitação?')) return
    await api('/api/request-admin', mk, { method: 'POST', body: JSON.stringify({ action: 'delete', id }) })
    setRequests(prev => prev.filter(r => r.id !== id))
  }

  /* ── authenticated layout ── */
  const TABS = [
    { id: 'overview',  label: 'Visão Geral',                                         icon: BarChart2     },
    { id: 'requests',  label: pendingCount > 0 ? `Solicitações (${pendingCount})` : 'Solicitações', icon: ClipboardList },
    { id: 'markets',   label: `Mercados (${markets.length})`,                         icon: Store         },
    { id: 'conversas', label: 'Conversas Globais 💬',                                 icon: MessageCircle },
    { id: 'dist',      label: `Distribuidores (${distributors.length})`,              icon: Truck         },
    { id: 'leads',     label: leads.length > 0 ? `Leads Bot (${leads.length})` : 'Leads Bot', icon: Bot },
    { id: 'afiliados', label: affiliates.length > 0 ? `Afiliados (${affiliates.length})` : 'Afiliados', icon: Award },
    { id: 'prospect',  label: 'Prospectar 🚀',  icon: Send },
  ]

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex">

      {/* ── SIDEBAR DESKTOP ─────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-[260px] fixed inset-y-0 left-0 bg-white border-r border-gray-200 z-30 shadow-sm">
        <div className="px-6 py-6 border-b border-gray-200">
          <ZatendeStokLogo variant="wordmark" />
          <div className="mt-3">
            <span className="text-[10px] font-black px-2.5 py-1 rounded-md bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-sm">PAINEL MASTER</span>
          </div>
        </div>
        <nav className="flex-1 px-4 py-5 space-y-1 overflow-y-auto">
          {TABS.map(t => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all relative ' + (active ? 'bg-gradient-to-r from-orange-50 to-orange-100 text-orange-600 shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900')}>
                {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-orange-500 to-orange-600 rounded-r-md shadow-md" />}
                <Icon className={'w-5 h-5 flex-shrink-0 ' + (active ? 'text-orange-600' : 'text-gray-600')} />
                <span className="flex-1 text-left truncate">{t.label}</span>
              </button>
            )
          })}
        </nav>
        <div className="px-4 pb-5 pt-4 border-t border-gray-200 space-y-2">
          <button onClick={() => load()} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all font-semibold">
            <RefreshCw className={'w-4 h-4 ' + (loading ? 'animate-spin' : '')} />
            <span>Atualizar dados</span>
          </button>
          <button onClick={() => { localStorage.removeItem(MK_KEY); window.location.reload() }} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-red-600 hover:bg-red-50 hover:text-red-700 transition-all font-semibold">
            <LogOut className="w-4 h-4" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* ── SIDEBAR MOBILE OVERLAY ──────────────────────────── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <aside className="w-[240px] bg-white border-r border-gray-200 flex flex-col">
            <div className="px-5 py-4 border-b border-gray-200/60 flex items-center justify-between">
              <ZatendeStokLogo variant="wordmark" />
              <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
              {TABS.map(t => {
                const Icon = t.icon
                const active = tab === t.id
                return (
                  <button key={t.id} onClick={() => { setTab(t.id); setSidebarOpen(false) }}
                    className={'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ' + (active ? 'bg-orange-500/10 text-orange-400' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-700')}>
                    <Icon className={'w-4 h-4 flex-shrink-0 ' + (active ? 'text-orange-400' : 'text-gray-600')} />
                    <span className="flex-1 text-left">{t.label}</span>
                  </button>
                )
              })}
            </nav>
          </aside>
          <div className="flex-1 bg-black/60" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* ── ÁREA PRINCIPAL ──────────────────────────────────── */}
      <div className="flex-1 lg:ml-[240px] flex flex-col min-h-screen">

        {/* Top bar mobile */}
        <div className="sticky top-0 z-20 bg-gray-50/90 backdrop-blur-sm border-b border-gray-200 px-4 py-3 flex items-center gap-3 lg:px-6">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-600">
            <Menu className="w-5 h-5" />
          </button>
          <div className="lg:hidden"><ZatendeStokLogo variant="wordmark" /></div>
          <div className="hidden lg:block flex-1">
            <span className="text-sm font-bold text-gray-500">{TABS.find(t => t.id === tab)?.label}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => load()} className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold transition-colors">
              <RefreshCw className={'w-3.5 h-3.5 ' + (loading ? 'animate-spin' : '')} /> Atualizar
            </button>
            {(tab === 'markets' || tab === 'dist') && (
              <button onClick={() => setShowAdd(tab === 'markets' ? 'market' : 'dist')} className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-white text-xs font-black transition-colors shadow-lg shadow-orange-500/20">
                <Plus className="w-3.5 h-3.5" />
                {tab === 'markets' ? 'Novo Mercado' : 'Nova Distribuidora'}
              </button>
            )}
          </div>
        </div>

      <div className="max-w-6xl mx-auto px-4 py-8 w-full">

        {/* ── VISÃO GERAL ── */}
        {tab === 'overview' && (
          <div className="space-y-6">

            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Clientes ativos" value={allActive}            sub={`de ${totalAll} cadastrados`}      color="#f97316" icon={Users}         />
              <StatCard label="Mercados"         value={markets.length}       sub={`${mActive.length} ativos`}        color="#a78bfa" icon={Store}         />
              <StatCard label="Distribuidores"   value={distributors.length}  sub={`${dActive.length} ativos`}        color="#34d399" icon={Truck}         />
              <StatCard label="Solicitações"     value={pendingCount}         sub={pendingCount > 0 ? '⏳ aguardando' : 'nenhuma pendente'}
                color={pendingCount > 0 ? '#fbbf24' : '#64748b'} icon={ClipboardList} onClick={() => setTab('requests')} />
            </div>

            {/* Alertas */}
            {(expiring7.length > 0 || expired.length > 0) && (
              <div className="space-y-3">
                {expiring7.length > 0 && (
                  <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4">
                    <p className="flex items-center gap-2 text-yellow-400 font-black text-sm mb-3">
                      <CalendarClock className="w-4 h-4" /> {expiring7.length} vencendo em 7 dias
                    </p>
                    <div className="space-y-2">
                      {expiring7.map(x => {
                        const d = Math.ceil((new Date(x.expiresAt) - now) / 86_400_000)
                        return (
                          <div key={x.id} className="flex items-center justify-between">
                            <span className="text-gray-700 text-sm">{x.storeName || x.username}</span>
                            <span className="text-yellow-400 font-black text-xs bg-yellow-500/10 px-2 py-0.5 rounded-full">{d === 0 ? 'hoje' : `${d}d`}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                {expired.length > 0 && (
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
                    <p className="flex items-center gap-2 text-red-400 font-black text-sm mb-3">
                      <AlertTriangle className="w-4 h-4" /> {expired.length} licença{expired.length>1?'s':''} vencida{expired.length>1?'s':''} — cobrar ou desativar
                    </p>
                    <div className="space-y-2">
                      {expired.map(x => {
                        const d = Math.abs(Math.ceil((new Date(x.expiresAt) - now) / 86_400_000))
                        return (
                          <div key={x.id} className="flex items-center justify-between">
                            <span className="text-gray-700 text-sm">{x.storeName || x.username}</span>
                            <span className="text-red-400 font-black text-xs bg-red-500/10 px-2 py-0.5 rounded-full">{d}d atrás</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Atividade recente */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-200 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-xs font-black text-gray-600 uppercase tracking-wider">Atividade recente (24h)</span>
              </div>
              {recent24.length === 0 ? (
                <div className="px-5 py-8 text-center text-gray-600 text-sm">Nenhum acesso nas últimas 24h</div>
              ) : (
                <div className="divide-y divide-gray-800/60">
                  {recent24.map(x => {
                    const diff  = now - new Date(x.lastLogin)
                    const label = diff < 3_600_000 ? `${Math.floor(diff/60000)}min` : `${Math.floor(diff/3_600_000)}h`
                    const isDist = !!x.tenantId
                    return (
                      <div key={x.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-100/30 transition-colors">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isDist ? 'bg-emerald-400' : 'bg-purple-400'}`} />
                        <span className="text-gray-200 text-sm flex-1 font-medium">{x.storeName || x.username}</span>
                        <span className="text-gray-600 text-xs">{label} atrás</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isDist ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'}`}>
                          {isDist ? 'DIST' : 'MERC'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Quick nav */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { tab:'markets', icon: Store, label:'Mercados', sub:`${markets.length} cadastrados · ${mActive.length} ativos`, color:'#a78bfa' },
                { tab:'dist',    icon: Truck, label:'Distribuidores', sub:`${distributors.length} cadastrados · ${dActive.length} ativos`, color:'#34d399' },
              ].map(c => (
                <button key={c.tab} onClick={() => setTab(c.tab)}
                  className="flex items-center gap-4 p-5 rounded-2xl border border-gray-200 bg-white hover:bg-gray-100 hover:border-gray-300 transition-all text-left group">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${c.color}18`, border: `1px solid ${c.color}30` }}>
                    <c.icon className="w-5 h-5" style={{ color: c.color }} />
                  </div>
                  <div>
                    <div className="font-black text-white text-sm">{c.label}</div>
                    <div className="text-gray-500 text-xs mt-0.5">{c.sub}</div>
                  </div>
                </button>
              ))}
            </div>

            {/* CTA Prospectar */}
            <button onClick={() => setTab('prospect')}
              className="w-full flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-r from-orange-500/10 to-orange-600/5 border border-orange-500/20 hover:border-orange-500/40 transition-all text-left group">
              <div className="w-11 h-11 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                <Send className="w-5 h-5 text-orange-400" />
              </div>
              <div className="flex-1">
                <div className="font-black text-white text-sm flex items-center gap-2">Prospectar com Zara <span className="text-orange-400">🚀</span></div>
                <div className="text-gray-500 text-xs mt-0.5">Busca mercados automaticamente e dispara mensagens com a Zara</div>
              </div>
              <div className="text-gray-600 text-sm group-hover:text-orange-400 transition-colors">→</div>
            </button>
          </div>
        )}

        {/* ── SOLICITAÇÕES ── */}
        {tab === 'requests' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-white">Solicitações de cadastro</h2>
                <p className="text-gray-600 text-sm mt-1">{pendingCount} pendente{pendingCount !== 1 ? 's' : ''} · {requests.length} total</p>
              </div>
              {pendingCount > 0 && (
                <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 px-3 py-1.5 rounded-xl">
                  <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
                  <span className="text-yellow-400 text-xs font-bold">{pendingCount} aguardando aprovação</span>
                </div>
              )}
            </div>

            {requests.length === 0 && (
              <div className="text-center py-20 text-gray-600">
                <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="font-bold text-lg">Nenhuma solicitação ainda</p>
                <p className="text-sm mt-1">Quando um mercado solicitar cadastro pelo site, aparece aqui.</p>
              </div>
            )}

            <div className="space-y-3">
              {[...requests].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).map(req => {
                const isPending  = req.status === 'pending'
                const isApproved = req.status === 'approved'
                const isRejected = req.status === 'rejected'
                const dt = new Date(req.createdAt).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' })
                return (
                  <div key={req.id} className={`rounded-2xl border p-5 ${
                    isPending  ? 'bg-gray-100/60 border-gray-300' :
                    isApproved ? 'bg-green-500/5 border-green-500/20' :
                    'bg-gray-100/30 border-gray-200 opacity-60'
                  }`}>
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                      {/* info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                          <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                            isPending  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                            isApproved ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                            'bg-gray-200 text-gray-600'
                          }`}>
                            {isPending ? '⏳ Pendente' : isApproved ? '✅ Aprovado' : '❌ Rejeitado'}
                          </span>
                          {req.niche && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full border bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                              {req.niche === 'padaria' ? '🥖' : req.niche === 'açougue' ? '🥩' : req.niche === 'restaurante' ? '🍽️' : req.niche === 'distribuidor' ? '🚛' : '🏪'} {req.niche}
                            </span>
                          )}
                          {req.ref && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full border bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
                              🤝 {req.ref}
                            </span>
                          )}
                          <span className="text-gray-500 text-xs">{dt}</span>
                          {isApproved && req.username && (
                            <span className="text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full font-mono">@{req.username}</span>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="flex items-center gap-2">
                            <Store className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                            <span className="text-white font-bold text-sm">{req.mercado}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600 text-sm">{req.nome}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                            <a href={`https://wa.me/55${req.telefone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                              className="text-green-400 text-sm hover:underline">{req.telefone}</a>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                            <span className="text-gray-600 text-sm">{req.cidade}</span>
                          </div>
                          {req.email && (
                            <div className="flex items-center gap-2 sm:col-span-2">
                              <Mail className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                              <span className="text-gray-600 text-sm">{req.email}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* actions */}
                      {isPending && (
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={() => rejectRequest(req.id)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-200 hover:bg-red-500/20 hover:border-red-500/30 border border-gray-400 text-gray-700 hover:text-red-400 text-xs font-bold transition-colors">
                            <XCircle className="w-3.5 h-3.5" /> Rejeitar
                          </button>
                          <button
                            onClick={() => approveRequest(req)}
                            disabled={approving === req.id}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-xs font-black transition-colors">
                            {approving === req.id
                              ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              : <CheckCircle2 className="w-3.5 h-3.5" />}
                            Aprovar e criar acesso
                          </button>
                        </div>
                      )}
                      {!isPending && (
                        <button onClick={() => deleteRequest(req.id)}
                          className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

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
                className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 hover:border-orange-500/50 hover:bg-orange-500/5 transition-all min-h-[280px] gap-3 text-gray-500 hover:text-orange-400">
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
                className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all min-h-[280px] gap-3 text-gray-500 hover:text-emerald-400">
                <Plus className="w-8 h-8" /><span className="text-sm font-bold">Novo distribuidor</span>
              </button>
            </div>
          )
        )}
        {/* ── LEADS BOT ── */}
        {tab === 'leads' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  <Bot className="w-5 h-5 text-orange-400" /> Leads capturados pela Zara
                </h2>
                <p className="text-gray-500 text-sm mt-0.5">Contatos que interagiram com o bot WhatsApp</p>
              </div>
              <div className="flex gap-2">
                <button onClick={migrateHistory} disabled={migrating}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold disabled:opacity-50 transition-all">
                  <MessageCircle className={`w-4 h-4 ${migrating ? 'animate-spin' : ''}`} /> Criar Histórico
                </button>
                <button onClick={loadLeads} disabled={leadsLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-bold text-gray-700 disabled:opacity-50 transition-all">
                  <RefreshCw className={`w-4 h-4 ${leadsLoading ? 'animate-spin' : ''}`} /> Atualizar
                </button>
              </div>
            </div>

            {/* Resultado da migração */}
            {migrateResult && (
              <div className={`rounded-xl p-4 ${migrateResult.ok ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                <div className={`font-bold text-sm ${migrateResult.ok ? 'text-green-400' : 'text-red-400'}`}>
                  {migrateResult.ok ? '✅ Migração concluída!' : '❌ Erro na migração'}
                </div>
                {migrateResult.ok && (
                  <div className="text-gray-600 text-sm mt-1">
                    <strong>{migrateResult.created}</strong> histórico(s) criado(s) · 
                    <strong className="ml-1">{migrateResult.skipped}</strong> já existiam ·
                    <strong className="ml-1">{migrateResult.total}</strong> total de leads
                  </div>
                )}
                {migrateResult.error && (
                  <div className="text-red-300 text-sm mt-1">{migrateResult.error}</div>
                )}
              </div>
            )}

            {/* Filtros por status */}
            {!leadsLoading && leads.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {[
                  { id: 'all',        label: 'Todos',       icon: null,         count: leads.length },
                  { id: 'novo',       label: 'Novos',       icon: null,         count: leads.filter(l => l.stage === 'novo').length },
                  { id: 'curioso',    label: 'Curiosos',    icon: null,         count: leads.filter(l => l.stage === 'curioso').length },
                  { id: 'interessado',label: 'Interessados',icon: '🔥',         count: leads.filter(l => l.stage === 'interessado').length },
                  { id: 'demo',       label: 'Quer Demo',   icon: '⭐',         count: leads.filter(l => l.stage === 'demo').length },
                  { id: 'fechado',    label: 'Fechados',    icon: '✅',         count: leads.filter(l => l.stage === 'fechado').length },
                ].map(f => (
                  <button key={f.id} onClick={() => setLeadsFilter(f.id)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                      leadsFilter === f.id
                        ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                        : 'bg-gray-100/50 text-gray-600 hover:bg-gray-100 hover:text-gray-700'
                    }`}>
                    {f.icon && <span>{f.icon}</span>}
                    {f.label} <span className={`ml-1 ${leadsFilter === f.id ? 'text-orange-100' : 'text-gray-600'}`}>({f.count})</span>
                  </button>
                ))}
              </div>
            )}

            {leadsLoading && (
              <div className="text-center py-20 text-gray-500">
                <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin opacity-40" />
                <p>Carregando leads...</p>
              </div>
            )}

            {!leadsLoading && leads.length === 0 && (
              <div className="text-center py-20 text-gray-600">
                <Bot className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="font-semibold text-lg">Nenhum lead ainda</p>
                <p className="text-sm mt-1">Quando alguém mandar mensagem pro bot, aparece aqui</p>
              </div>
            )}

            {!leadsLoading && leads.length > 0 && (
              <div className="space-y-3">
                {/* Resumo */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Total', value: leads.length,                                     color: 'text-white',       bg: 'bg-gray-100' },
                    { label: 'Interessados', value: leads.filter(l => ['interessado','demo','fechado'].includes(l.stage)).length, color: 'text-orange-400', bg: 'bg-orange-500/10' },
                    { label: 'Prontos p/ demo', value: leads.filter(l => l.stage === 'demo').length,   color: 'text-yellow-400',  bg: 'bg-yellow-500/10' },
                    { label: 'Fechados', value: leads.filter(l => l.stage === 'fechado').length,       color: 'text-green-400',   bg: 'bg-green-500/10' },
                  ].map(s => (
                    <div key={s.label} className={`${s.bg} rounded-2xl p-4 border border-gray-300/50`}>
                      <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
                      <div className="text-xs text-gray-500 mt-1">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Tabela de leads */}
                <div className="rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-white/60">
                          <th className="text-left px-4 py-3 text-gray-500 font-semibold text-xs uppercase tracking-wider">Contato</th>
                          <th className="text-left px-4 py-3 text-gray-500 font-semibold text-xs uppercase tracking-wider hidden sm:table-cell">Mercado</th>
                          <th className="text-left px-4 py-3 text-gray-500 font-semibold text-xs uppercase tracking-wider hidden md:table-cell">Cidade</th>
                          <th className="text-left px-4 py-3 text-gray-500 font-semibold text-xs uppercase tracking-wider">Status</th>
                          <th className="text-left px-4 py-3 text-gray-500 font-semibold text-xs uppercase tracking-wider hidden lg:table-cell">Último contato</th>
                          <th className="px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/60">
                        {leads
                          .filter(lead => leadsFilter === 'all' || lead.stage === leadsFilter)
                          .map((lead, i) => {
                          const displayName = lead.name || lead.waName || '(sem nome)'
                          const phone = lead.phone || ''
                          const waLink = `https://wa.me/${phone}`
                          const stageMap = {
                            novo:        { label: 'Novo',        color: 'bg-gray-200 text-gray-700' },
                            curioso:     { label: 'Curioso',     color: 'bg-blue-500/20 text-blue-300' },
                            interessado: { label: 'Interessado', color: 'bg-orange-500/20 text-orange-300' },
                            demo:        { label: 'Quer demo',   color: 'bg-yellow-500/20 text-yellow-300' },
                            fechado:     { label: '🔥 Fechado',  color: 'bg-green-500/20 text-green-300' },
                          }
                          const stage = stageMap[lead.stage] || stageMap.novo
                          const timeAgo = (iso) => {
                            if (!iso) return '—'
                            const diff = Date.now() - new Date(iso).getTime()
                            const mins = Math.floor(diff / 60000)
                            if (mins < 1)  return 'agora'
                            if (mins < 60) return `${mins}min`
                            const hrs = Math.floor(mins / 60)
                            if (hrs < 24)  return `${hrs}h`
                            return `${Math.floor(hrs / 24)}d`
                          }
                          return (
                            <tr key={phone || i} onClick={() => setSelectedLead(lead)} className="hover:bg-gray-100/40 transition-colors cursor-pointer group">
                              <td className="px-4 py-3">
                                <div className="font-semibold text-white flex items-center gap-2">
                                  {displayName}
                                  <span className="text-xs text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">(clique para detalhes)</span>
                                </div>
                                <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                  <Phone className="w-3 h-3" />
                                  {phone ? `+${phone.slice(0,2)} (${phone.slice(2,4)}) ${phone.slice(4,9)}-${phone.slice(9)}` : '—'}
                                </div>
                              </td>
                              <td className="px-4 py-3 hidden sm:table-cell">
                                <div className="text-gray-700 flex items-center gap-1">
                                  <Building2 className="w-3 h-3 text-gray-600" />
                                  {lead.market || <span className="text-gray-600 italic">não informado</span>}
                                </div>
                              </td>
                              <td className="px-4 py-3 hidden md:table-cell">
                                <div className="text-gray-600 flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-gray-600" />
                                  {lead.city || <span className="text-gray-600 italic">—</span>}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${stage.color}`}>
                                  {stage.label}
                                </span>
                              </td>
                              <td className="px-4 py-3 hidden lg:table-cell text-gray-500 text-xs">
                                {timeAgo(lead.updatedAt)}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <a href={waLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 text-xs font-bold transition-colors">
                                  <MessageCircle className="w-3.5 h-3.5" /> Chamar
                                </a>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── MODAL DETALHES DO LEAD ────────────────────────────────────── */}
            {selectedLead && (
              <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }} onClick={() => setSelectedLead(null)}>
                <div className="bg-white border border-gray-300 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                  {/* Header */}
                  <div className="sticky top-0 bg-white border-b border-gray-300 px-6 py-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-black text-white flex items-center gap-2">
                        <Bot className="w-5 h-5 text-orange-400" />
                        {selectedLead.name || selectedLead.waName || '(sem nome)'}
                      </h3>
                      <p className="text-gray-500 text-sm mt-0.5">Detalhes do lead</p>
                    </div>
                    <button onClick={() => setSelectedLead(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                      <X className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>

                  {/* Body */}
                  <div className="p-6 space-y-5">
                    {/* Info Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-gray-100/50 rounded-xl p-4 border border-gray-300/50">
                        <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Telefone</div>
                        <div className="text-white font-bold flex items-center gap-2">
                          <Phone className="w-4 h-4 text-gray-500" />
                          {selectedLead.phone ? `+${selectedLead.phone.slice(0,2)} (${selectedLead.phone.slice(2,4)}) ${selectedLead.phone.slice(4,9)}-${selectedLead.phone.slice(9)}` : '—'}
                        </div>
                      </div>

                      <div className="bg-gray-100/50 rounded-xl p-4 border border-gray-300/50">
                        <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Status</div>
                        <div className="text-white font-bold">
                          {(() => {
                            const stageMap = {
                              novo:        { label: 'Novo',        color: 'bg-gray-200 text-gray-700' },
                              curioso:     { label: 'Curioso',     color: 'bg-blue-500/20 text-blue-300' },
                              interessado: { label: 'Interessado', color: 'bg-orange-500/20 text-orange-300' },
                              demo:        { label: 'Quer demo',   color: 'bg-yellow-500/20 text-yellow-300' },
                              fechado:     { label: '🔥 Fechado',  color: 'bg-green-500/20 text-green-300' },
                            }
                            const stage = stageMap[selectedLead.stage] || stageMap.novo
                            return <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold ${stage.color}`}>{stage.label}</span>
                          })()}
                        </div>
                      </div>

                      {selectedLead.market && (
                        <div className="bg-gray-100/50 rounded-xl p-4 border border-gray-300/50">
                          <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Mercado</div>
                          <div className="text-white font-bold flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-gray-500" />
                            {selectedLead.market}
                          </div>
                        </div>
                      )}

                      {selectedLead.city && (
                        <div className="bg-gray-100/50 rounded-xl p-4 border border-gray-300/50">
                          <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Cidade</div>
                          <div className="text-white font-bold flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-500" />
                            {selectedLead.city}
                          </div>
                        </div>
                      )}

                      <div className="bg-gray-100/50 rounded-xl p-4 border border-gray-300/50">
                        <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Primeiro Contato</div>
                        <div className="text-white font-bold flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-500" />
                          {selectedLead.createdAt ? new Date(selectedLead.createdAt).toLocaleString('pt-BR') : '—'}
                        </div>
                      </div>

                      <div className="bg-gray-100/50 rounded-xl p-4 border border-gray-300/50">
                        <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Última Interação</div>
                        <div className="text-white font-bold flex items-center gap-2">
                          <CalendarClock className="w-4 h-4 text-gray-500" />
                          {selectedLead.updatedAt ? new Date(selectedLead.updatedAt).toLocaleString('pt-BR') : '—'}
                        </div>
                      </div>
                    </div>

                    {/* Informações Adicionais */}
                    {(selectedLead.niche || selectedLead.employees || selectedLead.currentSystem) && (
                      <div className="bg-gray-100/30 rounded-xl p-4 border border-gray-300/50">
                        <div className="text-sm text-gray-600 font-semibold mb-3">📋 Informações do Negócio</div>
                        <div className="space-y-2 text-sm">
                          {selectedLead.niche && <div className="flex gap-2"><span className="text-gray-500">Nicho:</span> <span className="text-white font-semibold">{selectedLead.niche}</span></div>}
                          {selectedLead.employees && <div className="flex gap-2"><span className="text-gray-500">Funcionários:</span> <span className="text-white font-semibold">{selectedLead.employees}</span></div>}
                          {selectedLead.currentSystem && <div className="flex gap-2"><span className="text-gray-500">Sistema atual:</span> <span className="text-white font-semibold">{selectedLead.currentSystem}</span></div>}
                        </div>
                      </div>
                    )}

                    {/* Ações */}
                    <div className="flex gap-3">
                      <a href={`https://wa.me/${selectedLead.phone}`} target="_blank" rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold text-sm transition-all shadow-lg shadow-green-500/30">
                        <MessageCircle className="w-4 h-4" /> Chamar no WhatsApp
                      </a>
                      <button onClick={() => setSelectedLead(null)}
                        className="px-4 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm transition-colors">
                        Fechar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── ABA AFILIADOS ────────────────────────────────────── */}
      {tab === 'afiliados' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-xl font-black text-white">Vendedores externos</h2>
              <p className="text-gray-600 text-sm mt-0.5">Cada afiliado tem um link único com o código dele. Comissão paga manualmente.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={loadAffiliates} className="btn-ghost flex items-center gap-2 text-sm">
                <RefreshCw className={`w-4 h-4 ${affLoading?'animate-spin':''}`}/> Atualizar
              </button>
              <button onClick={() => setAffShowForm(f => !f)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors">
                <Plus className="w-4 h-4"/> Novo afiliado
              </button>
            </div>
          </div>

          {/* Formulário novo afiliado */}
          {affShowForm && (
            <div className="bg-white border border-gray-300 rounded-xl p-5 space-y-3">
              <h3 className="font-bold text-white text-sm">Cadastrar novo vendedor</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-600 font-semibold mb-1 block">Nome *</label>
                  <input value={affForm.nome} onChange={e => setAffForm(f=>({...f,nome:e.target.value}))}
                    placeholder="Ex: Pedro Vendas" className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm text-white"/>
                </div>
                <div>
                  <label className="text-xs text-gray-600 font-semibold mb-1 block">WhatsApp *</label>
                  <input value={affForm.telefone} onChange={e => setAffForm(f=>({...f,telefone:e.target.value}))}
                    placeholder="(15) 99999-0000" className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm text-white"/>
                </div>
                <div>
                  <label className="text-xs text-gray-600 font-semibold mb-1 block">Código (opcional)</label>
                  <input value={affForm.codigo} onChange={e => setAffForm(f=>({...f,codigo:e.target.value.toLowerCase().replace(/[^a-z0-9]/g,'')}))}
                    placeholder="pedro (gerado auto se vazio)" className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm text-white font-mono"/>
                </div>
                <div>
                  <label className="text-xs text-gray-600 font-semibold mb-1 block">Comissão (%)</label>
                  <input value={affForm.comissaoPct} onChange={e => setAffForm(f=>({...f,comissaoPct:e.target.value}))}
                    type="number" min="1" max="50" className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm text-white"/>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={addAffiliate} disabled={affAdding || !affForm.nome.trim() || !affForm.telefone.trim()}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors">
                  {affAdding ? <Loader2 className="w-4 h-4 animate-spin"/> : <Plus className="w-4 h-4"/>} Criar afiliado
                </button>
                <button onClick={() => setAffShowForm(false)} className="btn-ghost text-sm px-3 py-2">Cancelar</button>
              </div>
            </div>
          )}

          {affLoading && <div className="text-center text-gray-600 py-10 text-sm">Carregando...</div>}

          {!affLoading && affiliates.length === 0 && (
            <div className="text-center py-14 text-gray-500">
              <Award className="w-10 h-10 mx-auto mb-3 opacity-30"/>
              <p className="font-bold">Nenhum afiliado cadastrado</p>
              <p className="text-sm mt-1">Crie um afiliado e ele vai receber um link único para indicar clientes.</p>
            </div>
          )}

          {!affLoading && affiliates.length > 0 && (
            <div className="space-y-3">
              {affiliates.map(aff => {
                const totalComissao = (aff.vendas||[]).reduce((s,v) => s+v.comissao,0)
                const pct           = Math.round((aff.comissaoPct||0.20)*100)
                const link          = `https://zatendestok.com.br/login?ref=${aff.codigo}`
                return (
                  <div key={aff.id} className={`bg-white border rounded-xl p-4 ${aff.ativo ? 'border-gray-300' : 'border-gray-200 opacity-60'}`}>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-black text-white">{aff.nome}</span>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full border bg-indigo-500/10 text-indigo-400 border-indigo-500/20 font-mono">
                            {aff.codigo}
                          </span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${aff.ativo ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-gray-200 text-gray-600 border-gray-400'}`}>
                            {aff.ativo ? '● Ativo' : '○ Inativo'}
                          </span>
                          <span className="text-xs text-yellow-400 font-bold">{pct}% comissão</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-600 flex-wrap">
                          <span>{aff.telefone}</span>
                          <span className="text-gray-600">·</span>
                          <span>{aff.vendas?.length||0} conversões</span>
                          <span className="text-gray-600">·</span>
                          <span className="text-green-400 font-bold">R${totalComissao.toFixed(2).replace('.',',')}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-gray-500 font-mono truncate max-w-xs">{link}</span>
                          <button onClick={() => navigator.clipboard.writeText(link)}
                            className="text-gray-500 hover:text-white transition-colors flex-shrink-0" title="Copiar link">
                            <Copy className="w-3.5 h-3.5"/>
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => toggleAffiliate(aff.id)} title={aff.ativo ? 'Desativar' : 'Ativar'}
                          className="p-1.5 hover:text-white text-gray-600 transition-colors">
                          {aff.ativo ? <ToggleRight className="w-5 h-5 text-green-400"/> : <ToggleLeft className="w-5 h-5"/>}
                        </button>
                        <button onClick={() => window.open(`https://wa.me/55${aff.telefone.replace(/\D/g,'')}?text=${encodeURIComponent(`Olá ${aff.nome}! Seu link de afiliado: ${link}`)}`, '_blank')}
                          className="p-1.5 hover:text-green-400 text-gray-600 transition-colors" title="Enviar link por WA">
                          <MessageCircle className="w-4 h-4"/>
                        </button>
                        <button onClick={() => window.open(`/afiliado?code=${aff.codigo}`, '_blank')}
                          className="p-1.5 hover:text-indigo-400 text-gray-600 transition-colors" title="Ver painel do afiliado">
                          <Link2 className="w-4 h-4"/>
                        </button>
                        <button onClick={() => deleteAffiliate(aff.id, aff.nome)}
                          className="p-1.5 hover:text-red-400 text-gray-600 transition-colors">
                          <Trash2 className="w-4 h-4"/>
                        </button>
                      </div>
                    </div>

                    {/* Vendas do afiliado */}
                    {aff.vendas?.length > 0 && (
                      <div className="mt-3 border-t border-gray-200 pt-3 space-y-1.5">
                        {aff.vendas.map((v,i) => (
                          <div key={i} className="flex items-center justify-between text-xs text-gray-600">
                            <span>{v.mercado} <span className="text-gray-600">· {v.niche} · {v.plano}</span></span>
                            <span className="text-green-400 font-bold">+R${(v.comissao||0).toFixed(2).replace('.',',')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ABA PROSPECÇÃO ──────────────────────────────────── */}
      {tab === 'prospect' && (
        <div className="space-y-5">

          {/* Header + stats */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <Send className="w-5 h-5 text-orange-400" /> Prospectar com Zara
              </h2>
              <p className="text-gray-500 text-sm mt-0.5">Cole qualquer texto com telefones — a Zara extrai e envia com delay anti-ban automático.</p>
            </div>
            <button onClick={loadQueue} disabled={queueLoading} className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-bold text-gray-600 transition-all disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${queueLoading ? 'animate-spin' : ''}`} /> Atualizar
            </button>
          </div>

          {/* Barra de limite diário */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Limite diário de envios</span>
              <span className="text-xs font-black text-white">{queueStats.dailySent || 0} / {queueStats.dailyLimit || 30} enviados hoje</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5">
              <div className="h-2.5 rounded-full bg-gradient-to-r from-orange-500 to-orange-400 transition-all"
                style={{ width: `${Math.min(100, ((queueStats.dailySent||0)/(queueStats.dailyLimit||30))*100)}%` }} />
            </div>
            <div className="flex gap-4 mt-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />{queueStats.pending||0} pendentes</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />{queueStats.sent||0} enviados</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />{queueStats.failed||0} falharam</span>
            </div>
          </div>

          {/* Inner tabs */}
          <div className="flex gap-2 overflow-x-auto pb-0.5">
            {[
              { id:'search',  label:'🔍 Buscar Automático' },
              { id:'capture', label:'➕ Adicionar' },
              { id:'queue',   label:`📋 Fila (${queueStats.pending||0})` },
              { id:'leads',   label:`🎯 Leads (${prospLeads.length||0})` },
            ].map(t => (
              <button key={t.id} onClick={() => setProspInnerTab(t.id)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex-shrink-0 ${prospInnerTab===t.id ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── SUB: BUSCAR AUTOMÁTICO ────────────────────────── */}
          {prospInnerTab === 'search' && (
            <div className="space-y-4">
              {googleKey === null && (
                <div className="text-center py-10 text-gray-600"><Loader2 className="w-6 h-6 mx-auto animate-spin mb-2" /><p className="text-sm">Verificando configuração...</p></div>
              )}

              {googleKey === false && (
                <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0 text-2xl">🗺️</div>
                    <div>
                      <h3 className="text-white font-black text-lg">Ativar busca automática de mercados</h3>
                      <p className="text-gray-600 text-sm mt-1">Integra com o Google Maps e busca automaticamente os contatos de mercadinhos perto de qualquer cidade — com nome, telefone e avaliação.</p>
                    </div>
                  </div>

                  <div className="bg-gray-100/50 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-black text-gray-600 uppercase tracking-wider">✅ Como ativar (grátis, ~5 minutos)</p>
                    {[
                      { n:'1', text:'Acesse', link:'https://console.cloud.google.com', linkText:'console.cloud.google.com' },
                      { n:'2', text:'Crie um projeto → ative "Places API (New)"' },
                      { n:'3', text:'Credenciais → criar chave de API → copie a chave' },
                      { n:'4', text:'Netlify → seu site → Variables → adicione:', code:'GOOGLE_PLACES_API_KEY = sua-chave-aqui' },
                      { n:'5', text:'Redeploy automático → volte aqui e clique "Verificar novamente"' },
                    ].map(s => (
                      <div key={s.n} className="flex gap-2.5 text-sm text-gray-600">
                        <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">{s.n}</span>
                        <span>
                          {s.text}{' '}
                          {s.link && <a href={s.link} target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">{s.linkText}</a>}
                          {s.code && <code className="block mt-1 bg-white px-3 py-1.5 rounded-lg text-xs text-green-400 font-mono">{s.code}</code>}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3">
                    <button onClick={checkGoogleKey} className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-black text-sm transition-all">
                      🔄 Verificar novamente
                    </button>
                    <a href="https://console.cloud.google.com/apis/library/places-backend.googleapis.com" target="_blank" rel="noopener noreferrer"
                      className="flex-1 py-3 rounded-xl bg-gray-200 hover:bg-gray-600 text-white font-bold text-sm text-center transition-all">
                      Ir para Google Cloud →
                    </a>
                  </div>

                  <p className="text-xs text-gray-600 text-center">💡 Google dá $200/mês grátis → equivale a ~6.000 buscas grátis (~120.000 contatos por mês)</p>
                </div>
              )}

              {googleKey === true && (
                <div className="space-y-4">
                  {/* Barra de busca */}
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
                    <p className="text-sm font-black text-white">🔍 Buscar estabelecimentos</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">O que buscar</label>
                        <select value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                          className="w-full bg-gray-100 border border-gray-300 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 text-sm transition-colors">
                          {[
                            '── Mercados ──','mercado','supermercado','mercearia','mini mercado','mercadinho','conveniência',
                            '── Alimentação ──','padaria','confeitaria','açougue','restaurante','lanchonete','espetinho','pizzaria','bar','sorveteria',
                            '── Distribuição ──','distribuidora','atacado',
                          ].map(q => q.startsWith('──')
                            ? <option key={q} disabled style={{ color:'#666', fontStyle:'italic' }}>{q}</option>
                            : <option key={q} value={q}>{q}</option>
                          )}
                        </select>
                      </div>
                      <div className="sm:col-span-2 relative">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Cidade / região</label>
                        <input value={searchCity}
                          onChange={e => { setSearchCity(e.target.value); setShowCityDrop(true) }}
                          onFocus={() => setShowCityDrop(true)}
                          onBlur={() => setTimeout(() => setShowCityDrop(false), 150)}
                          onKeyDown={e => { if (e.key === 'Enter') { setShowCityDrop(false); runSearch() } if (e.key === 'Escape') setShowCityDrop(false) }}
                          placeholder="Buscar cidade da região..."
                          className="w-full bg-gray-100 border border-gray-300 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 text-sm transition-colors" />
                        {showCityDrop && (() => {
                          const q = searchCity.toLowerCase().trim()
                          const hits = CITIES_LIST.filter(c => !q || c.toLowerCase().includes(q)).slice(0, 25)
                          return hits.length > 0 ? (
                            <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-gray-100 border border-gray-300 rounded-xl shadow-2xl max-h-56 overflow-y-auto">
                              {hits.map(city => (
                                <button key={city} type="button"
                                  onMouseDown={() => { setSearchCity(city); setShowCityDrop(false) }}
                                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-orange-500/10 hover:text-orange-300 text-gray-700 transition-colors border-b border-gray-300/50 last:border-0">
                                  <span className="font-bold">{city.split(' ').slice(0,-1).join(' ')}</span>
                                  <span className="text-gray-500 ml-1">{city.split(' ').slice(-1)}</span>
                                </button>
                              ))}
                            </div>
                          ) : null
                        })()}
                      </div>
                    </div>
                    <button onClick={() => runSearch()} disabled={searchLoading || !searchCity.trim()}
                      className="w-full py-3.5 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white font-black text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20">
                      {searchLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Buscando no Google Maps...</> : <><Send className="w-4 h-4" /> Buscar mercados agora</>}
                    </button>
                  </div>

                  {/* Resultados */}
                  {searchResults.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-white">{searchResults.length} encontrado{searchResults.length>1?'s':''} com telefone</p>
                          {contactedPhones.size > 0 && (() => { const dup = searchResults.filter(r=>contactedPhones.has(r.phone)).length; return dup > 0 ? <p className="text-xs text-gray-600 mt-0.5">⚠️ {dup} já contatado{dup>1?'s':''} — marcados em cinza</p> : null })()}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setSearchSelected(new Set(searchResults.filter(r => !contactedPhones.has(r.phone)).map(r => r.phone)))}
                            className="text-xs text-orange-400 hover:text-orange-300 font-bold">
                            Selecionar novos
                          </button>
                          <span className="text-gray-700">·</span>
                          <button onClick={() => setSearchSelected(new Set())}
                            className="text-xs text-gray-500 hover:text-gray-600 font-bold">
                            Limpar
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {searchResults.map(r => {
                          const selected  = searchSelected.has(r.phone)
                          const contacted = contactedPhones.has(r.phone)
                          return (
                            <button key={r.phone} onClick={() => toggleSelect(r.phone)}
                              className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all relative ${
                                contacted ? 'border-gray-300/50 bg-white/40 opacity-60'
                                : selected ? 'border-orange-500/50 bg-orange-500/10'
                                : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                              <div className={`w-5 h-5 rounded-md border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors ${
                                selected ? 'border-orange-500 bg-orange-500' : 'border-gray-400'}`}>
                                {selected && <Check className="w-3 h-3 text-white" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className={`font-bold text-sm truncate ${contacted ? 'text-gray-500' : 'text-white'}`}>{r.name}</p>
                                  {contacted && <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-500 flex-shrink-0">Já enviado</span>}
                                </div>
                                {r.rating && (
                                  <p className="text-yellow-400 text-xs mt-0.5">⭐ {r.rating.toFixed(1)} <span className="text-gray-600">({r.reviews})</span></p>
                                )}
                                <p className={`text-xs font-mono mt-0.5 ${contacted ? 'text-gray-600' : 'text-green-400'}`}>{r.phone}</p>
                                {r.address && <p className="text-gray-600 text-xs mt-0.5 truncate">📍 {r.address.split(',').slice(0,2).join(',')}</p>}
                              </div>
                            </button>
                          )
                        })}
                      </div>

                      {searchNextPage && (
                        <button onClick={() => runSearch(searchNextPage)} disabled={searchLoading}
                          className="w-full py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-bold transition-all disabled:opacity-50">
                          {searchLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Carregar mais resultados'}
                        </button>
                      )}

                      {searchSelected.size > 0 && (
                        <button onClick={addSearchToQueue} disabled={addingSearch}
                          className="w-full py-3.5 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white font-black text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 sticky bottom-4">
                          {addingSearchStatus === 'validating'
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Verificando WhatsApp ({searchSelected.size})...</>
                            : addingSearchStatus === 'adding'
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Adicionando à fila...</>
                            : <><Plus className="w-4 h-4" /> Adicionar {searchSelected.size} à fila — valida WA auto</>}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── SUB: CAPTURAR ─────────────────────────────────── */}
          {prospInnerTab === 'capture' && (
            <div className="space-y-4">

              {/* ── ENTRADA MANUAL (primária) ─── */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
                <div>
                  <p className="text-sm font-black text-white mb-0.5">➕ Adicionar número manualmente</p>
                  <p className="text-xs text-gray-500">Abre o Google Maps → clica num mercado → copia o telefone → cola aqui</p>
                </div>
                <div className="flex gap-2">
                  <input value={manualPhone} onChange={e => setManualPhone(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addManual()}
                    placeholder="(15) 99999-9999"
                    className="flex-1 bg-gray-100 border border-gray-300 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 transition-colors text-sm" />
                  <input value={manualName} onChange={e => setManualName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addManual()}
                    placeholder="Nome do mercado (opcional)"
                    className="flex-1 bg-gray-100 border border-gray-300 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 transition-colors text-sm hidden sm:block" />
                  <button onClick={addManual} disabled={addingQueue || !normalizePhone(manualPhone)}
                    className="px-5 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white font-black text-lg transition-all">
                    {addingQueue ? <Loader2 className="w-5 h-5 animate-spin" /> : '+'}
                  </button>
                </div>
                {/* campo de nome no mobile */}
                <input value={manualName} onChange={e => setManualName(e.target.value)}
                  placeholder="Nome do mercado (opcional)"
                  className="w-full bg-gray-100 border border-gray-300 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 transition-colors text-sm sm:hidden" />

                {/* Dica passo-a-passo */}
                <div className="bg-gray-100/50 rounded-xl p-3 space-y-1.5">
                  <p className="text-xs font-black text-gray-600 uppercase tracking-wider mb-2">📍 Workflow: Google Maps → aqui</p>
                  {[
                    'Abre o Google Maps no celular ou computador',
                    'Pesquisa "mercado Itapeva SP" (ou sua cidade)',
                    'Clica em qualquer mercado da lista',
                    'Copia o número de telefone que aparece',
                    'Cola no campo acima + clica "+"',
                    'Repete pra cada mercado — leva 30 seg por contato',
                  ].map((s, i) => (
                    <div key={i} className="flex gap-2 text-xs text-gray-500">
                      <span className="text-orange-400 font-black flex-shrink-0">{i+1}.</span> {s}
                    </div>
                  ))}
                </div>
              </div>

              {/* ── COLAR TEXTO EM MASSA (secundário) ─── */}
              <details className="group bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <summary className="px-5 py-4 cursor-pointer flex items-center justify-between text-sm font-bold text-gray-600 hover:text-white select-none">
                  <span>📋 Colar lista de texto com vários números de uma vez</span>
                  <span className="text-gray-600 group-open:rotate-180 transition-transform inline-block">▼</span>
                </summary>
                <div className="px-5 pb-5 space-y-4 border-t border-gray-200">
                  <p className="text-xs text-gray-600 pt-4">Cole aqui qualquer texto que contenha telefones — CSV, lista do WhatsApp, texto copiado de sites. O sistema extrai os números automaticamente.</p>
                  <textarea value={captureText} onChange={e => { setCaptureText(e.target.value); setParsedPhones([]) }}
                    rows={6} placeholder={`(15) 3522-1234\n(15) 99988-7766\nMercado Central: (15) 3523-9999\n15 99777-8888`}
                    className="w-full bg-gray-100 border border-gray-300 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 transition-colors text-sm font-mono resize-none" />
                  <button onClick={handleParseText} disabled={!captureText.trim()}
                    className="w-full py-3 rounded-xl bg-gray-200 hover:bg-gray-600 disabled:opacity-40 text-white font-bold text-sm transition-all">
                    🔍 Extrair telefones do texto
                  </button>
                  {parsedPhones.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-sm font-bold text-green-400">✅ {parsedPhones.length} encontrado{parsedPhones.length>1?'s':''} — nenhum duplicado</p>
                      <div className="bg-gray-100 rounded-xl max-h-36 overflow-y-auto divide-y divide-gray-700/40">
                        {parsedPhones.map((p, i) => (
                          <div key={i} className="flex items-center gap-3 px-3 py-2">
                            <Phone className="w-3 h-3 text-green-400 flex-shrink-0" />
                            <span className="font-mono text-xs text-white">+{p.phone.slice(0,2)} ({p.phone.slice(2,4)}) {p.phone.slice(4,9)}-{p.phone.slice(9)}</span>
                          </div>
                        ))}
                      </div>
                      <button onClick={addParsedToQueue} disabled={addingQueue}
                        className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white font-black text-sm transition-all flex items-center justify-center gap-2">
                        {addingQueue ? <><Loader2 className="w-4 h-4 animate-spin" /> Adicionando...</> : <><Plus className="w-4 h-4" /> Adicionar {parsedPhones.length} à fila</>}
                      </button>
                    </div>
                  )}
                  {parsedPhones.length === 0 && captureText.trim() && (
                    <p className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                      ⚠️ Nenhum número encontrado. Os números precisam ter DDD: (15) 9999-9999 ou 15999999999.
                    </p>
                  )}
                  <p className="text-xs text-gray-600">Dica avançada: <a href="https://outscraper.com" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">outscraper.com</a> exporta 100 contatos do Maps por ~R$5</p>
                </div>
              </details>
            </div>
          )}

          {/* ── SUB: FILA ─────────────────────────────────────── */}
          {prospInnerTab === 'queue' && (
            <div className="space-y-4">

              {/* Botões de ação */}
              {!sendProgress ? (
                <div className="space-y-3">
                  {/* Validar WA primeiro */}
                  {(queueStats.pending || 0) > 0 && (
                    <button onClick={validateQueueWA} disabled={validating}
                      className="w-full py-3 rounded-xl bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 border border-gray-300">
                      {validating
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Verificando números no WhatsApp...</>
                        : <><CheckCircle2 className="w-4 h-4 text-green-400" /> ① Verificar quais têm WhatsApp</>}
                    </button>
                  )}

                  {validResult && (
                    <div className={`rounded-xl px-4 py-3 text-sm border ${validResult.ok ? 'bg-gray-100/50 border-gray-300' : 'bg-red-500/10 border-red-500/30'}`}>
                      {validResult.ok
                        ? <span className="text-gray-700">✅ <b className="text-green-400">{validResult.valid}</b> têm WhatsApp · <b className="text-red-400">{validResult.invalid}</b> removidos da fila (sem WA)</span>
                        : <span className="text-red-400">{validResult.error}</span>}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button onClick={startQueueSend}
                      disabled={!queueStats.pending || (queueStats.dailySent||0) >= (queueStats.dailyLimit||20)}
                      className="flex-1 py-3.5 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20">
                      <Send className="w-4 h-4" />
                      {(queueStats.dailySent||0) >= (queueStats.dailyLimit||20)
                        ? '🚫 Limite diário atingido — volta amanhã'
                        : `② Zara disparar ${Math.min(queueStats.pending||0, (queueStats.dailyLimit||20)-(queueStats.dailySent||0))} mensagens agora`}
                    </button>
                    {((queueStats.sent||0) > 0 || (queueStats.failed||0) > 0) && (
                      <button onClick={() => queueApi({ action:'clear', mode:'done' }).then(loadQueue)}
                        className="px-4 py-3.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold transition-all">
                        Limpar enviados
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 text-center">Anti-ban: delay 45-90s entre envios • max 20/dia • 6 versões diferentes da mensagem • só horário comercial</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-orange-500/30 p-5 space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-black text-orange-400 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {sendCountdown != null
                          ? `⏱ Anti-ban: aguardando ${sendCountdown}s...`
                          : sendProgress.sending
                          ? `📤 Enviando para ${sendProgress.sending}...`
                          : `Zara disparando — ${sendProgress.current}/${sendProgress.total}`}
                      </p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        ✅ {sendLog.filter(l=>l.success).length} enviadas · ❌ {sendLog.filter(l=>!l.success).length} falhas · {sendProgress.total - sendProgress.current} restantes
                      </p>
                    </div>
                    <button onClick={() => { stopRef.current = true; setSendCountdown(null) }}
                      className="text-xs text-red-400 hover:text-red-300 font-bold px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors border border-red-500/20">
                      ⏹ Parar
                    </button>
                  </div>

                  {/* Barra de progresso */}
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div className="h-2.5 rounded-full bg-gradient-to-r from-orange-600 to-orange-400 transition-all duration-500"
                      style={{ width: `${(sendProgress.current/sendProgress.total)*100}%` }} />
                  </div>

                  {/* Countdown visual */}
                  {sendCountdown != null && (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-yellow-500/60 transition-all duration-1000"
                          style={{ width: `${(sendCountdown / 90) * 100}%` }} />
                      </div>
                      <span className="text-xs text-yellow-500 font-mono font-bold w-12 text-right">{sendCountdown}s</span>
                    </div>
                  )}

                  {/* Log completo de envios */}
                  {sendLog.length > 0 && (
                    <div className="bg-gray-50 rounded-xl border border-gray-200 max-h-48 overflow-y-auto">
                      <div className="p-3 space-y-1.5">
                        {[...sendLog].reverse().map((l, i) => (
                          <div key={i} className={`flex items-center gap-2 text-xs ${l.success ? 'text-green-400' : 'text-red-400'}`}>
                            {l.success
                              ? <CheckCircle2 className="w-3 h-3 flex-shrink-0"/>
                              : <XCircle className="w-3 h-3 flex-shrink-0"/>}
                            <span className="font-mono text-gray-500">{l.ts}</span>
                            <span className="font-mono">+{l.phone.slice(0,2)} ({l.phone.slice(2,4)}) {l.phone.slice(4,9)}-{l.phone.slice(9)}</span>
                            {l.name && <span className="text-gray-600 truncate">— {l.name}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-gray-600 text-center">🔒 Não feche esta aba. Templates diferentes em cada envio.</p>
                </div>
              )}

              {/* Histórico de campanhas */}
              {!sendProgress && campaigns.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                    <p className="text-xs font-black text-gray-600 uppercase tracking-wider">📊 Histórico de campanhas</p>
                    <button onClick={loadCampaigns} className="text-xs text-gray-600 hover:text-gray-600">
                      <RefreshCw className="w-3 h-3"/>
                    </button>
                  </div>
                  <div className="divide-y divide-gray-800/60 max-h-48 overflow-y-auto">
                    {campaigns.slice(0, 20).map(c => {
                      const start = c.startedAt ? new Date(c.startedAt) : null
                      const end   = c.endedAt   ? new Date(c.endedAt)   : null
                      const dur   = start && end ? Math.round((end - start) / 60000) : null
                      const total = (c.sent || 0) + (c.failed || 0)
                      return (
                        <div key={c.id} className="px-4 py-2.5 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-600">
                              {start ? start.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '—'}
                            </p>
                            <p className="text-xs text-gray-600">{dur != null ? `${dur} min · ${total} msgs` : `${total} msgs`}</p>
                          </div>
                          <span className="text-xs font-bold text-green-400">✅ {c.sent}</span>
                          {c.failed > 0 && <span className="text-xs font-bold text-red-400">❌ {c.failed}</span>}
                          <div className="w-16 bg-gray-100 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full bg-green-500"
                              style={{ width: total > 0 ? `${(c.sent/total)*100}%` : '0%' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Lista da fila */}
              {queueLoading ? (
                <div className="text-center py-10 text-gray-600"><Loader2 className="w-6 h-6 mx-auto animate-spin mb-2" /><p className="text-sm">Carregando fila...</p></div>
              ) : queue.length === 0 ? (
                <div className="text-center py-16 text-gray-600 bg-white rounded-2xl border border-gray-200">
                  <Send className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="font-semibold">Fila vazia</p>
                  <p className="text-sm mt-1">Vai em <button onClick={() => setProspInnerTab('capture')} className="text-orange-400 hover:underline">Capturar Contatos</button> e adiciona os primeiros</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white border-b border-gray-200">
                        <tr>
                          <th className="text-left px-4 py-3 text-gray-500 font-semibold text-xs uppercase tracking-wider">Telefone</th>
                          <th className="text-left px-4 py-3 text-gray-500 font-semibold text-xs uppercase tracking-wider hidden sm:table-cell">Nome</th>
                          <th className="text-left px-4 py-3 text-gray-500 font-semibold text-xs uppercase tracking-wider">Status</th>
                          <th className="px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/60">
                        {queue.map(c => {
                          const statusMap = {
                            pending: { label:'Pendente', color:'bg-yellow-500/20 text-yellow-300' },
                            sent:    { label:'Enviado ✓', color:'bg-green-500/20 text-green-300' },
                            failed:  { label:'Falhou', color:'bg-red-500/20 text-red-300' },
                          }
                          const st = statusMap[c.status] || statusMap.pending
                          const waLink = `https://wa.me/${c.phone}`
                          return (
                            <tr key={c.id} className="hover:bg-gray-100/30">
                              <td className="px-4 py-3 font-mono text-sm text-white">
                                +{c.phone.slice(0,2)} ({c.phone.slice(2,4)}) {c.phone.slice(4,9)}-{c.phone.slice(9)}
                              </td>
                              <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{c.name || <span className="text-gray-700 italic">—</span>}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${st.color}`}>{st.label}</span>
                                {c.error && <p className="text-xs text-red-400/70 mt-0.5">{c.error}</p>}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <a href={waLink} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 text-xs font-bold">
                                  <MessageCircle className="w-3 h-3" /> WA
                                </a>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── SUB: LEADS PIPELINE ────────────────────────────── */}
          {prospInnerTab === 'leads' && (
            <div className="space-y-4">
              {/* Header + view toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-black text-white">🎯 Pipeline de Leads</p>
                  <p className="text-xs text-gray-500 mt-0.5">Leads que responderam à Zara — atualizado em tempo real</p>
                </div>
                <div className="flex gap-2 items-center">
                  <button onClick={loadProspLeads} disabled={prospLeadsLoading}
                    className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors">
                    <RefreshCw className={`w-4 h-4 ${prospLeadsLoading ? 'animate-spin' : ''}`}/>
                  </button>
                  {['pipeline','list'].map(v => (
                    <button key={v} onClick={() => setLeadsView(v)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${leadsView===v ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {v === 'pipeline' ? '⬛ Pipeline' : '☰ Lista'}
                    </button>
                  ))}
                </div>
              </div>

              {leadsLoading ? (
                <div className="text-center py-16 text-gray-600"><Loader2 className="w-6 h-6 mx-auto animate-spin mb-2"/><p className="text-sm">Carregando leads...</p></div>
              ) : prospLeads.length === 0 ? (
                <div className="text-center py-16 text-gray-600 bg-white rounded-2xl border border-gray-200">
                  <Users className="w-10 h-10 mx-auto mb-3 opacity-30"/>
                  <p className="font-semibold">Nenhum lead ainda</p>
                  <p className="text-sm mt-1 text-gray-700">Quando um mercado responder à Zara, aparece aqui automaticamente</p>
                </div>
              ) : leadsView === 'pipeline' ? (
                /* ── PIPELINE VIEW ── */
                <div className="space-y-3">
                  {/* Métricas rápidas */}
                  {(() => {
                    const byStage = { novo:0, curioso:0, interessado:0, demo:0, fechado:0 }
                    prospLeads.forEach(l => { const s = l.stage || 'novo'; byStage[s] = (byStage[s]||0)+1 })
                    const stages = [
                      { id:'novo',        label:'Novo',        color:'text-gray-600',   bg:'bg-gray-200/40 border-gray-300',    dot:'bg-gray-500' },
                      { id:'curioso',     label:'Curioso',     color:'text-blue-400',   bg:'bg-blue-500/10 border-blue-500/20', dot:'bg-blue-500' },
                      { id:'interessado', label:'Interessado', color:'text-yellow-400', bg:'bg-yellow-500/10 border-yellow-500/20', dot:'bg-yellow-500' },
                      { id:'demo',        label:'Demo',        color:'text-orange-400', bg:'bg-orange-500/10 border-orange-500/20', dot:'bg-orange-500' },
                      { id:'fechado',     label:'Fechado 🎉',  color:'text-green-400',  bg:'bg-green-500/10 border-green-500/20', dot:'bg-green-500' },
                    ]
                    return (
                      <>
                        <div className="grid grid-cols-5 gap-2">
                          {stages.map(s => (
                            <div key={s.id} className={`rounded-xl border p-3 text-center ${s.bg}`}>
                              <p className={`text-2xl font-black ${s.color}`}>{byStage[s.id]||0}</p>
                              <p className={`text-[10px] font-bold mt-0.5 ${s.color}`}>{s.label}</p>
                            </div>
                          ))}
                        </div>
                        {stages.map(s => {
                          const stagLeads = prospLeads.filter(l => (l.stage||'novo') === s.id)
                          if (!stagLeads.length) return null
                          return (
                            <div key={s.id} className={`rounded-2xl border overflow-hidden ${s.bg}`}>
                              <div className="px-4 py-2.5 flex items-center gap-2 border-b border-gray-200/40">
                                <span className={`w-2 h-2 rounded-full ${s.dot}`}/>
                                <span className={`text-xs font-black uppercase tracking-wider ${s.color}`}>{s.label}</span>
                                <span className={`text-xs font-bold ml-auto ${s.color}`}>{stagLeads.length}</span>
                              </div>
                              <div className="divide-y divide-gray-800/30">
                                {stagLeads.map(l => (
                                  <div key={l.phone} className="px-4 py-2.5 flex items-center gap-3 hover:bg-gray-100/20">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-bold text-white truncate">{l.name || l.waName || '—'}</p>
                                      <p className="text-xs text-gray-500 truncate">{l.market || ''}{l.city ? ` · ${l.city}` : ''}</p>
                                    </div>
                                    <span className="text-xs text-gray-600 font-mono whitespace-nowrap">
                                      {l.updatedAt ? new Date(l.updatedAt).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '—'}
                                    </span>
                                    <a href={`https://wa.me/${l.phone}`} target="_blank" rel="noopener noreferrer"
                                      className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 text-xs font-bold transition-colors">
                                      <MessageCircle className="w-3 h-3"/> Responder
                                    </a>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </>
                    )
                  })()}
                </div>
              ) : (
                /* ── LIST VIEW ── */
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white border-b border-gray-200">
                        <tr>
                          <th className="text-left px-4 py-3 text-gray-500 font-semibold text-xs uppercase tracking-wider">Nome / Mercado</th>
                          <th className="text-left px-4 py-3 text-gray-500 font-semibold text-xs uppercase tracking-wider hidden sm:table-cell">Cidade</th>
                          <th className="text-left px-4 py-3 text-gray-500 font-semibold text-xs uppercase tracking-wider">Estágio</th>
                          <th className="text-left px-4 py-3 text-gray-500 font-semibold text-xs uppercase tracking-wider hidden md:table-cell">Atualizado</th>
                          <th className="px-4 py-3"/>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/60">
                        {prospLeads.map(l => {
                          const stageMap = {
                            novo:        { label:'Novo',        cls:'bg-gray-200/50 text-gray-600' },
                            curioso:     { label:'Curioso',     cls:'bg-blue-500/20 text-blue-300' },
                            interessado: { label:'Interessado', cls:'bg-yellow-500/20 text-yellow-300' },
                            demo:        { label:'Demo',        cls:'bg-orange-500/20 text-orange-300' },
                            fechado:     { label:'Fechado 🎉',  cls:'bg-green-500/20 text-green-300' },
                          }
                          const st = stageMap[l.stage] || stageMap.novo
                          return (
                            <tr key={l.phone} className="hover:bg-gray-100/30">
                              <td className="px-4 py-3">
                                <p className="font-bold text-white text-sm truncate">{l.name || l.waName || '—'}</p>
                                {l.market && <p className="text-xs text-gray-500 truncate">{l.market}</p>}
                              </td>
                              <td className="px-4 py-3 text-gray-600 text-xs hidden sm:table-cell">{l.city || '—'}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${st.cls}`}>{st.label}</span>
                              </td>
                              <td className="px-4 py-3 text-gray-600 text-xs hidden md:table-cell">
                                {l.updatedAt ? new Date(l.updatedAt).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '—'}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <a href={`https://wa.me/${l.phone}`} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 text-xs font-bold">
                                  <MessageCircle className="w-3 h-3"/> WA
                                </a>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showAdd === 'market' && (
        <AddMarketModal mk={mk} onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); load() }} />
      )}
      {showAdd === 'dist' && (
        <AddDistModal mk={mk} onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); load() }} />
      )}
      </div>
    </div>
  )
}
