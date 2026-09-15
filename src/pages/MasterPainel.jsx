import React, { useState, useEffect, useCallback } from 'react'
import { Plus, RefreshCw, Power, Trash2, LogIn, Copy, Check, Eye, EyeOff, ShieldAlert, Store, Clock, X, Key, Zap } from 'lucide-react'
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
  const [busy,   setBusy]   = useState(false)
  const [copied, setCopied] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [newPass, setNewPass] = useState('')

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

  const copyId = () => {
    navigator.clipboard.writeText(market.storeId).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
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
      </div>

      {/* reset password inline */}
      {showReset && (
        <div className="px-4 pb-3 flex gap-2">
          <input
            className="flex-1 bg-gray-700 border border-gray-600 text-white text-sm rounded-xl px-3 py-2 outline-none focus:border-orange-500"
            placeholder="Nova senha (mín. 4)"
            type="password"
            value={newPass}
            onChange={e => setNewPass(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && resetPass()}
          />
          <button onClick={resetPass} disabled={newPass.length < 4 || busy}
            className="px-3 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black disabled:opacity-40 transition-colors">
            OK
          </button>
          <button onClick={() => setShowReset(false)}
            className="px-3 py-2 rounded-xl bg-gray-700 text-gray-400 text-xs transition-colors hover:bg-gray-600">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* actions */}
      <div className="flex gap-2 p-4 pt-2 border-t border-gray-700/50">
        <button onClick={() => onAccess(market)}
          className="flex-1 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black transition-all flex items-center justify-center gap-1.5">
          <LogIn className="w-3.5 h-3.5" /> Acessar
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

function AddMarketModal({ mk, onClose, onCreated }) {
  const [form, setForm]   = useState({ storeName: '', username: '', password: '', storePhone: '' })
  const [show, setShow]   = useState(false)
  const [err,  setErr]    = useState(null)
  const [ok,   setOk]     = useState(null)
  const [busy, setBusy]   = useState(false)

  const submit = async () => {
    setErr(null)
    if (!form.storeName.trim() || !form.username.trim() || !form.password)
      return setErr('Preencha nome, usuário e senha.')
    if (form.password.length < 4)
      return setErr('Senha mínimo 4 caracteres.')
    setBusy(true)
    const res = await api('/api/markets-admin', mk, {
      method: 'POST',
      body: JSON.stringify({ ...form, action: 'create' }),
    })
    setBusy(false)
    if (!res.ok) return setErr(res.error || 'Erro ao criar mercado.')
    setOk({ storeId: res.storeId, username: res.username, password: form.password })
    onCreated()
  }

  if (ok) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-pop">
        <div className="text-center mb-5">
          <div className="w-14 h-14 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center mx-auto mb-3">
            <Check className="w-7 h-7 text-green-400" />
          </div>
          <h3 className="text-white font-black text-xl">Mercado criado!</h3>
          <p className="text-gray-400 text-sm mt-1">Passe as credenciais para o cliente</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 space-y-2 font-mono text-sm border border-gray-700">
          <div className="flex justify-between">
            <span className="text-gray-400">URL</span>
            <span className="text-orange-400">zatendestock.netlify.app</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Usuário</span>
            <span className="text-white font-bold">{ok.username}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Senha</span>
            <span className="text-white font-bold">{ok.password}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Store ID</span>
            <span className="text-green-400 font-bold">{ok.storeId}</span>
          </div>
        </div>
        <button onClick={onClose}
          className="w-full mt-4 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black transition-colors">
          Fechar
        </button>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-pop" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-black text-lg flex items-center gap-2"><Store className="w-5 h-5 text-orange-400" /> Novo Mercado</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-3">
          {[
            { key: 'storeName', label: 'Nome do Mercado', placeholder: 'Ex: Mercado São José', type: 'text' },
            { key: 'storePhone', label: 'WhatsApp (opcional)', placeholder: '(11) 99999-0000', type: 'text' },
            { key: 'username', label: 'Usuário de acesso', placeholder: 'ex: mercadosaojose', type: 'text' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">{f.label}</label>
              <input
                className="w-full bg-gray-700 border border-gray-600 text-white rounded-xl px-4 py-2.5 outline-none focus:border-orange-500 transition-colors text-sm"
                placeholder={f.placeholder} type={f.type}
                value={form[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
              />
            </div>
          ))}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Senha inicial</label>
            <div className="relative">
              <input
                className="w-full bg-gray-700 border border-gray-600 text-white rounded-xl px-4 py-2.5 pr-12 outline-none focus:border-orange-500 transition-colors text-sm"
                placeholder="mínimo 4 caracteres"
                type={show ? 'text' : 'password'}
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && submit()}
              />
              <button type="button" onClick={() => setShow(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200">
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {err && <div className="mt-3 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{err}</div>}

        <button onClick={submit} disabled={busy}
          className="w-full mt-5 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-black transition-all flex items-center justify-center gap-2">
          {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {busy ? 'Criando...' : 'Criar Mercado'}
        </button>
      </div>
    </div>
  )
}

/* ─── main page ──────────────────────────────────────────── */
export default function MasterPainel() {
  const [mk,       setMk]       = useState(getMK)
  const [mkInput,  setMkInput]  = useState(getMK)
  const [showMk,   setShowMk]   = useState(false)
  const [authed,   setAuthed]   = useState(false)
  const [markets,  setMarkets]  = useState([])
  const [loading,  setLoading]  = useState(false)
  const [err,      setErr]      = useState(null)
  const [showAdd,  setShowAdd]  = useState(false)

  const load = useCallback(async (key = mk) => {
    if (!key) return
    setLoading(true)
    setErr(null)
    try {
      const res = await api('/api/markets-admin', key)
      if (!res.ok) { setErr('Chave master incorreta.'); setAuthed(false); return }
      setMarkets(res.markets || [])
      setAuthed(true)
    } catch {
      setErr('Erro de conexão. Verifique sua rede.')
    } finally {
      setLoading(false)
    }
  }, [mk])

  const login = async () => {
    const key = mkInput.trim()
    if (!key) return
    localStorage.setItem(MK_KEY, key)
    setMk(key)
    await load(key)
  }

  const accessMarket = (market) => {
    // Save current master session separately, then impersonate the market
    localStorage.setItem('zs_master_session', JSON.stringify({ mk, returnTo: '/painel' }))
    localStorage.setItem('cp_session', JSON.stringify({
      loggedIn:  true,
      user:      market.username,
      storeId:   market.storeId,
      storeName: market.storeName,
      role:      'admin',
    }))
    window.open('/dashboard', '_blank')
  }

  const active  = markets.filter(m => m.active)
  const recent  = markets.filter(m => m.lastLogin && Date.now() - new Date(m.lastLogin) < 24 * 3600000)

  if (!authed) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <ZatendeStockLogo variant="full" />
          </div>
          <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-black px-4 py-1.5 rounded-full">
            <ShieldAlert className="w-3.5 h-3.5" /> PAINEL MASTER — ACESSO RESTRITO
          </div>
        </div>

        <div className="bg-gray-800/60 border border-gray-700 rounded-2xl p-6 backdrop-blur-sm">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Chave Master</label>
          <div className="relative mb-4">
            <input
              className="w-full bg-gray-700 border border-gray-600 text-white rounded-xl px-4 py-3 pr-12 outline-none focus:border-orange-500 transition-colors font-mono"
              type={showMk ? 'text' : 'password'}
              placeholder="Chave de acesso master"
              value={mkInput}
              onChange={e => setMkInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && login()}
              autoFocus
            />
            <button onClick={() => setShowMk(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200">
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

        <p className="text-center text-gray-600 text-xs mt-6">
          ZatendeStock · Painel interno · Não compartilhe esta URL
        </p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* header */}
      <div className="bg-gray-900/80 border-b border-gray-800 sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ZatendeStockLogo variant="wordmark" />
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
              PAINEL MASTER
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => load()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
            </button>
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black transition-colors">
              <Plus className="w-3.5 h-3.5" /> Novo Mercado
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          <StatCard label="Mercados ativos" value={active.length} sub={`de ${markets.length} cadastrados`} />
          <StatCard label="Acessaram hoje" value={recent.length} sub="últimas 24 horas" color="#22c55e" />
          <StatCard label="Total mercados" value={markets.length} sub="na plataforma" color="#8b5cf6" />
        </div>

        {/* markets grid */}
        {markets.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <Store className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="font-semibold text-lg">Nenhum mercado cadastrado ainda</p>
            <p className="text-sm mt-1 mb-6">Clique em "Novo Mercado" para adicionar o primeiro cliente</p>
            <button onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black transition-colors">
              <Plus className="w-4 h-4" /> Adicionar primeiro mercado
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {markets.map(m => (
              <MarketCard key={m.id} market={m} mk={mk} onRefresh={load} onAccess={accessMarket} />
            ))}
            {/* Add card */}
            <button onClick={() => setShowAdd(true)}
              className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-700 hover:border-orange-500/50 hover:bg-orange-500/5 transition-all min-h-[280px] gap-3 text-gray-500 hover:text-orange-400">
              <Plus className="w-8 h-8" />
              <span className="text-sm font-bold">Novo mercado</span>
            </button>
          </div>
        )}
      </div>

      {showAdd && (
        <AddMarketModal mk={mk} onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); load() }} />
      )}
    </div>
  )
}
