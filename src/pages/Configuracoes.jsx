import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Database, Download, Upload, Info, Store, QrCode, Save, KeyRound, Eye, EyeOff, Users, Plus, Trash2, Fingerprint, Copy, Check, Image, Palette, MessageCircle, Wifi, WifiOff, RefreshCw, LogOut, Bot, Clock, MapPin, CreditCard, Tag, Phone as PhoneIcon } from 'lucide-react'
import { useStore } from '../store.jsx'
import { parseGdoorCsv } from '../utils/importCsv.js'
import { usePrinter, getNicheMeta } from '../hooks/usePrinter.js'
import PixQR from '../components/PixQR.jsx'
import { getCredentials, saveCredentials, getConfiguredStoreId, saveStoreId, slugify } from '../utils/auth.js'
import { getMktStoreToken, mktKey } from '../utils/tenantStorage.js'

/* ── Stable sub-components (MUST be outside the page fn to avoid remount-on-type) ── */
const Field = ({ label, hint, children }) => (
  <div>
    <label className="label">{label}</label>
    {children}
    {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
  </div>
)

const Section = ({ icon: Icon, title, children }) => (
  <div className="card p-5">
    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
      <Icon className="w-4 h-4" style={{ color: 'var(--zs-theme)' }} />
      <h2 className="font-bold text-gray-800">{title}</h2>
    </div>
    {children}
  </div>
)

/* ── Curated color palette ─────────────────────────────────── */
const PALETTE = [
  { group: '🔥 Quentes',    colors: [
    { name:'Laranja Brasa', v:'#f97316', shades:['#fed7aa','#fb923c','#f97316','#ea580c','#c2410c'] },
    { name:'Vermelho',      v:'#ef4444', shades:['#fecaca','#f87171','#ef4444','#dc2626','#b91c1c'] },
    { name:'Rosa Neon',     v:'#f43f5e', shades:['#fecdd3','#fb7185','#f43f5e','#e11d48','#be123c'] },
    { name:'Âmbar',         v:'#f59e0b', shades:['#fde68a','#fbbf24','#f59e0b','#d97706','#b45309'] },
  ]},
  { group: '🌊 Frios',      colors: [
    { name:'Azul',          v:'#3b82f6', shades:['#bfdbfe','#60a5fa','#3b82f6','#2563eb','#1d4ed8'] },
    { name:'Oceano',        v:'#0ea5e9', shades:['#bae6fd','#38bdf8','#0ea5e9','#0284c7','#0369a1'] },
    { name:'Ciano',         v:'#06b6d4', shades:['#a5f3fc','#22d3ee','#06b6d4','#0891b2','#0e7490'] },
    { name:'Teal',          v:'#14b8a6', shades:['#99f6e4','#2dd4bf','#14b8a6','#0d9488','#0f766e'] },
  ]},
  { group: '🌿 Naturais',   colors: [
    { name:'Verde',         v:'#22c55e', shades:['#bbf7d0','#4ade80','#22c55e','#16a34a','#15803d'] },
    { name:'Esmeralda',     v:'#10b981', shades:['#a7f3d0','#34d399','#10b981','#059669','#047857'] },
    { name:'Lima',          v:'#84cc16', shades:['#d9f99d','#a3e635','#84cc16','#65a30d','#4d7c0f'] },
    { name:'Menta Suave',   v:'#6ee7b7', shades:['#d1fae5','#6ee7b7','#34d399','#10b981','#059669'] },
  ]},
  { group: '💜 Vibrantes',  colors: [
    { name:'Violeta',       v:'#8b5cf6', shades:['#ddd6fe','#a78bfa','#8b5cf6','#7c3aed','#6d28d9'] },
    { name:'Roxo',          v:'#a855f7', shades:['#e9d5ff','#c084fc','#a855f7','#9333ea','#7e22ce'] },
    { name:'Fúcsia',        v:'#d946ef', shades:['#f5d0fe','#e879f9','#d946ef','#c026d3','#a21caf'] },
    { name:'Rosa Pink',     v:'#ec4899', shades:['#fbcfe8','#f472b6','#ec4899','#db2777','#be185d'] },
  ]},
  { group: '🌙 Premium',    colors: [
    { name:'Índigo',        v:'#6366f1', shades:['#c7d2fe','#818cf8','#6366f1','#4f46e5','#4338ca'] },
    { name:'Ardósia Azul',  v:'#334155', shades:['#cbd5e1','#64748b','#334155','#1e293b','#0f172a'] },
    { name:'Grafite',       v:'#374151', shades:['#d1d5db','#6b7280','#374151','#1f2937','#111827'] },
    { name:'Carvão',        v:'#1e293b', shades:['#94a3b8','#475569','#1e293b','#0f172a','#020617'] },
  ]},
]

function ColorPicker({ value, onChange }) {
  const [hexInput, setHexInput] = useState(value)

  const selectedEntry = PALETTE.flatMap(g => g.colors).find(c => c.v === value)
  const shades = selectedEntry?.shades || []

  // Applies color: updates CSS var immediately (live UI) + form state + hex input
  const apply = (v) => {
    document.documentElement.style.setProperty('--zs-theme', v)
    onChange(v)
    setHexInput(v)
  }

  const handleHex = (raw) => {
    setHexInput(raw)
    if (/^#[0-9a-fA-F]{6}$/.test(raw)) apply(raw)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Palette grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {PALETTE.map(({ group, colors }) => (
          <div key={group} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', width: 90, flexShrink: 0, letterSpacing: '.03em' }}>{group}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {colors.map(({ name, v }) => (
                <button key={v} title={name} onClick={() => apply(v)}
                  style={{
                    width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer',
                    background: v, flexShrink: 0, outline: 'none',
                    transition: 'transform .12s, box-shadow .12s',
                    transform: value === v ? 'scale(1.28)' : 'scale(1)',
                    boxShadow: value === v ? `0 0 0 2px white, 0 0 0 4px ${v}` : '0 1px 4px rgba(0,0,0,.15)',
                  }} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Shade strip */}
      {shades.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: '.03em' }}>
            TONALIDADES — {selectedEntry.name}
          </span>
          <div style={{ display: 'flex', gap: 5 }}>
            {shades.map(s => (
              <button key={s} title={s} onClick={() => apply(s)}
                style={{
                  flex: 1, height: 26, borderRadius: 8, border: 'none', cursor: 'pointer', outline: 'none',
                  background: s, transition: 'transform .1s',
                  transform: value === s ? 'scaleY(1.32)' : 'scaleY(1)',
                  boxShadow: value === s ? `0 0 0 2px white, 0 0 0 3px ${s}` : 'none',
                }} />
            ))}
          </div>
        </div>
      )}

      {/* Hex input + color wheel + live preview */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10 }}>
          <div style={{ width: 20, height: 20, borderRadius: 5, background: value, border: '1px solid rgba(0,0,0,.1)', flexShrink: 0 }} />
          <input value={hexInput} onChange={e => handleHex(e.target.value)}
            style={{ width: 80, border: 'none', background: 'transparent', fontSize: 13, fontFamily: 'monospace', fontWeight: 700, color: '#111', outline: 'none' }} />
          <input type="color" value={value} onChange={e => apply(e.target.value)}
            style={{ width: 24, height: 24, padding: 0, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'transparent' }} title="Cor personalizada (roda de cores)" />
        </div>

        {/* Live mini preview using the actual CSS variable */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 12, border: '1px solid #e5e7eb', background: '#f9fafb' }}>
          <div style={{ width: 10, height: 24, borderRadius: 4, background: 'var(--zs-theme)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <div style={{ padding: '2px 10px', borderRadius: 6, background: 'var(--zs-theme)', color: '#fff', fontSize: 10, fontWeight: 900 }}>BOTÃO</div>
              <div style={{ padding: '2px 8px', borderRadius: 20, background: 'color-mix(in srgb, var(--zs-theme) 15%, transparent)', color: 'var(--zs-theme)', fontSize: 10, fontWeight: 700, border: '1px solid color-mix(in srgb, var(--zs-theme) 35%, transparent)' }}>TAG</div>
            </div>
            <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600 }}>Preview ao vivo</div>
          </div>
        </div>
      </div>
    </div>
  )
}

const ROLE_META = {
  admin:   { label: 'Admin',   color: '#f97316', bg: '#fff7ed', border: '#fed7aa', desc: 'Acesso total ao sistema' },
  gerente: { label: 'Gerente', color: '#8b5cf6', bg: '#faf5ff', border: '#ddd6fe', desc: 'Tudo exceto configurações' },
  caixa:   { label: 'Caixa',   color: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0', desc: 'PDV + Fiado' },
}

function OperatorCard({ op, onDelete }) {
  const meta = ROLE_META[op.role] ?? ROLE_META.caixa
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all hover:shadow-sm"
      style={{ background: meta.bg, borderColor: meta.border }}>
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-lg flex-shrink-0"
        style={{ background: meta.color + '22', color: meta.color, border: `2px solid ${meta.color}` }}>
        {op.name[0]?.toUpperCase()}
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="font-bold text-gray-800 text-sm leading-tight">{op.name}</div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full"
            style={{ background: meta.color + '18', color: meta.color }}>
            {meta.label}
          </span>
          {op.terminalId && (
            <span className="text-[10px] text-gray-500 font-semibold">📟 Terminal {op.terminalId}</span>
          )}
          {op.pin && (
            <span className="text-[10px] text-gray-400 font-mono tracking-widest">
              {'•'.repeat(op.pin.length)}
            </span>
          )}
        </div>
      </div>
      {/* Delete */}
      <button onClick={() => onDelete(op)}
        className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}

function AddOperatorForm({ onAdd }) {
  const [form, setForm] = useState({ name: '', role: 'caixa', pin: '', terminalId: '1' })
  const [pinFocus, setPinFocus] = useState(false)
  const meta = ROLE_META[form.role] ?? ROLE_META.caixa

  const submit = () => {
    if (!form.name.trim()) return
    onAdd({
      name:       form.name.trim(),
      role:       form.role,
      pin:        form.pin,
      terminalId: form.role === 'caixa' ? (parseInt(form.terminalId) || 1) : undefined,
    })
    setForm({ name: '', role: 'caixa', pin: '', terminalId: '1' })
  }

  return (
    <div className="rounded-2xl border-2 border-dashed p-4 space-y-3 transition-all"
      style={{ borderColor: meta.color + '55', background: meta.bg }}>

      {/* Role selector — big pill tabs */}
      <div className="flex gap-2">
        {Object.entries(ROLE_META).map(([key, m]) => (
          <button key={key} type="button"
            onClick={() => setForm(f => ({ ...f, role: key }))}
            className="flex-1 py-2 rounded-xl text-xs font-black transition-all border-2"
            style={{
              borderColor:  form.role === key ? m.color : 'transparent',
              background:   form.role === key ? m.color + '18' : '#f9fafb',
              color:        form.role === key ? m.color : '#9ca3af',
            }}>
            {m.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-500 text-center -mt-1">{meta.desc}</p>

      {/* Name + Terminal row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <label className="label text-xs">Nome do funcionário</label>
          <input
            className="input"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="Ex: João Silva"
          />
        </div>
        <div>
          <label className="label text-xs">{form.role === 'caixa' ? '📟 Terminal (nº do caixa)' : 'Terminal'}</label>
          <input
            type="number" min={1} max={20}
            className="input text-center font-bold"
            value={form.terminalId}
            onChange={e => setForm(f => ({ ...f, terminalId: e.target.value }))}
            disabled={form.role !== 'caixa'}
            style={{ opacity: form.role !== 'caixa' ? 0.35 : 1 }}
          />
          {form.role === 'caixa' && <p className="text-[10px] text-gray-400 mt-1">Caixa 1, 2, 3… — separa o carrinho por terminal</p>}
        </div>
      </div>

      {/* PIN field with dot preview */}
      <div>
        <label className="label text-xs">PIN de acesso (opcional)</label>
        <p className="text-[10px] text-gray-400 mb-1.5">4 a 6 dígitos numéricos · ex: 1234 ou 198556</p>
        <div className="relative">
          <input
            className="input pr-24 font-mono tracking-widest"
            maxLength={6}
            value={form.pin}
            onChange={e => setForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '') }))}
            onFocus={() => setPinFocus(true)}
            onBlur={() => setPinFocus(false)}
            placeholder="Ex: 1234"
            type={pinFocus ? 'text' : 'password'}
          />
          {/* dot preview */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1.5">
            {[0,1,2,3,4,5].map(i => (
              <div key={i} className="w-2 h-2 rounded-full transition-all duration-150"
                style={{ background: form.pin.length > i ? meta.color : '#e5e7eb' }} />
            ))}
          </div>
        </div>
        <p className="text-[10px] text-gray-400 mt-1">
          {form.pin ? `✓ PIN com ${form.pin.length} dígito${form.pin.length > 1 ? 's' : ''} definido` : 'Sem PIN = funcionário entra direto, sem pedir senha'}
        </p>
      </div>

      {/* Submit */}
      <button type="button" onClick={submit}
        disabled={!form.name.trim()}
        className="w-full py-3 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2"
        style={{
          background: form.name.trim() ? meta.color : '#f3f4f6',
          color:      form.name.trim() ? '#fff' : '#9ca3af',
          boxShadow:  form.name.trim() ? `0 4px 16px ${meta.color}40` : 'none',
        }}>
        <Plus className="w-4 h-4" />
        Adicionar {meta.label}
      </button>
    </div>
  )
}

/* ── WhatsApp Bot Section ─────────────────────────────────────────────── */
function WhatsAppBotSection({ instance }) {
  const [wa, setWa]       = useState(null)   // { exists, status, phone, profileName, qrcode }
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const timerRef = useRef(null)

  const poll = useCallback(async () => {
    try {
      const r = await fetch(`/api/wa-status?instance=${instance}`)
      const d = await r.json()
      setWa(d)
      if (d.status === 'open' && d.phone) {
        try {
          const lsKey = mktKey('cp_printer_settings')
          const cfg = JSON.parse(localStorage.getItem(lsKey) || '{}')
          if (!cfg.phone) {
            const digits = d.phone.replace(/\D/g, '').replace(/^55/, '')
            cfg.phone = digits.length === 11
              ? `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
              : `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
            localStorage.setItem(lsKey, JSON.stringify(cfg))
            window.dispatchEvent(new CustomEvent('cp-settings-saved', { detail: { sourceId: 'wa-auto' } }))
          }
        } catch {}
      }
    } catch { /* offline */ } finally { setLoading(false) }
  }, [instance])

  // Poll: a cada 8s se conectando, a cada 30s se conectado
  useEffect(() => {
    poll()
    const tick = () => {
      poll()
      const interval = wa?.status === 'open' ? 30_000 : 8_000
      timerRef.current = setTimeout(tick, interval)
    }
    timerRef.current = setTimeout(tick, wa?.status === 'open' ? 30_000 : 8_000)
    return () => clearTimeout(timerRef.current)
  }, [poll, wa?.status])

  const handleCreate = async () => {
    setCreating(true)
    try {
      await fetch(`/api/wa-status?instance=${instance}&action=create`, { method: 'POST' })
      await poll()
    } finally { setCreating(false) }
  }

  const handleRefreshQR = async () => {
    setRefreshing(true)
    try {
      const r = await fetch(`/api/wa-status?instance=${instance}&action=refresh-qr`, { method: 'POST' })
      const d = await r.json()
      setWa(prev => ({ ...prev, qrcode: d.qrcode }))
    } finally { setRefreshing(false) }
  }

  const handleDisconnect = async () => {
    if (!confirm('Desconectar o WhatsApp? O bot vai parar de responder até reconectar.')) return
    await fetch(`/api/wa-status?instance=${instance}&action=disconnect`, { method: 'POST' })
    setWa(prev => ({ ...prev, status: 'connecting', phone: null, profileName: null, qrcode: null }))
    setTimeout(poll, 2000)
  }

  if (loading) return (
    <div className="flex items-center gap-2 py-4 text-gray-400 text-sm">
      <RefreshCw className="w-4 h-4 animate-spin" /> Verificando status...
    </div>
  )

  // Sem configuração de Evolution API
  if (wa?.error?.includes('não configurada')) return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
      ⚠️ Evolution API não configurada. Configure <code>EVOLUTION_API_URL</code> e <code>EVOLUTION_API_KEY</code> no Netlify.
    </div>
  )

  // Instância não existe ainda
  if (!wa?.exists) return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">Nenhuma instância criada para esta loja ainda.</p>
      <button onClick={handleCreate} disabled={creating}
        className="btn-primary flex items-center gap-2 text-sm px-4 py-2">
        <MessageCircle className="w-4 h-4" />
        {creating ? 'Criando...' : 'Criar instância WhatsApp'}
      </button>
    </div>
  )

  const connected = wa.status === 'open'

  return (
    <div className="space-y-4">
      {/* Status badge */}
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold ${connected ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
        {connected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
        {connected ? `Conectado — ${wa.profileName || wa.phone || ''}` : 'Aguardando conexão'}
      </div>

      {/* QR Code se não conectado */}
      {!connected && wa.qrcode && (
        <div className="flex flex-col items-start gap-3">
          <div className="border-2 border-gray-200 rounded-2xl p-3 bg-white inline-block">
            <img src={wa.qrcode} alt="QR Code WhatsApp" className="w-52 h-52 object-contain" />
          </div>
          <p className="text-xs text-gray-500 max-w-xs">
            Abra o WhatsApp no celular → <strong>Aparelhos conectados</strong> → <strong>Conectar um aparelho</strong> → escaneie esse QR.
            O QR atualiza automaticamente a cada 8 segundos.
          </p>
          <button onClick={handleRefreshQR} disabled={refreshing}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-semibold">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar QR manualmente
          </button>
        </div>
      )}

      {/* Sem QR ainda */}
      {!connected && !wa.qrcode && (
        <div className="text-sm text-gray-400 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" /> Gerando QR code...
        </div>
      )}

      {/* Botão desconectar */}
      {connected && (
        <button onClick={handleDisconnect}
          className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 font-semibold">
          <LogOut className="w-3.5 h-3.5" /> Desconectar WhatsApp
        </button>
      )}

      <p className="text-xs text-gray-400">
        Instância: <code className="bg-gray-100 px-1 rounded">{instance}</code>
        {wa.phone && <> · Número: <strong>+{wa.phone}</strong></>}
      </p>
    </div>
  )
}

/* ── Perfil público do bot do mercado ──────────────────────────────────────── */
const PAYMENT_OPTIONS = ['Dinheiro', 'PIX', 'Débito', 'Crédito', 'Vale-Alimentação', 'Fiado']

function MarketBotProfileSection({ storeId }) {
  const [profile, setProfile] = useState({
    storeName: '', address: '', neighborhood: '', city: '',
    hours: '', payments: [], promotions: '', about: '', policies: '', instagram: '',
  })
  const [saving, setSaving]   = useState(false)
  const [saved,  setSaved]    = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!storeId) return
    fetch(`/api/market-profile?storeId=${storeId}`)
      .then(r => r.json())
      .then(d => { if (d && Object.keys(d).length) setProfile(p => ({ ...p, ...d })) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [storeId])

  const toggle = (pay) => setProfile(p => ({
    ...p,
    payments: p.payments?.includes(pay)
      ? p.payments.filter(x => x !== pay)
      : [...(p.payments || []), pay],
  }))

  const save = async () => {
    if (!storeId) return
    setSaving(true)
    try {
      await fetch(`/api/market-profile?storeId=${storeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-zs-storeid': storeId },
        body: JSON.stringify(profile),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  const inp = 'w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/40 transition-all'
  const ta  = inp + ' resize-none'
  const lbl = 'text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5'

  if (loading) return <div className="text-gray-600 text-sm py-4 text-center">Carregando...</div>

  return (
    <div className="space-y-5">
      {/* Alerta explicativo */}
      <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 text-sm text-orange-200">
        <p className="font-bold mb-1">🤖 Como funciona</p>
        <p className="text-orange-300 text-xs leading-relaxed">
          Quando seus clientes mandarem mensagem no seu WhatsApp, o bot vai responder automaticamente usando essas informações.
          Quanto mais completo você preencher, melhor o bot vai atender!
        </p>
      </div>

      {/* Nome e contato */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={lbl}><Store className="w-3.5 h-3.5" /> Nome da Loja</label>
          <input className={inp} placeholder="Ex: Mercadinho do João" value={profile.storeName}
            onChange={e => setProfile(p => ({ ...p, storeName: e.target.value }))} />
        </div>
        <div>
          <label className={lbl}><PhoneIcon className="w-3.5 h-3.5" /> Instagram (opcional)</label>
          <input className={inp} placeholder="@mercadinhodojoao" value={profile.instagram}
            onChange={e => setProfile(p => ({ ...p, instagram: e.target.value }))} />
        </div>
      </div>

      {/* Endereço */}
      <div>
        <label className={lbl}><MapPin className="w-3.5 h-3.5" /> Endereço</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input className={inp + ' sm:col-span-1'} placeholder="Rua e número" value={profile.address}
            onChange={e => setProfile(p => ({ ...p, address: e.target.value }))} />
          <input className={inp} placeholder="Bairro" value={profile.neighborhood}
            onChange={e => setProfile(p => ({ ...p, neighborhood: e.target.value }))} />
          <input className={inp} placeholder="Cidade" value={profile.city}
            onChange={e => setProfile(p => ({ ...p, city: e.target.value }))} />
        </div>
      </div>

      {/* Horário */}
      <div>
        <label className={lbl}><Clock className="w-3.5 h-3.5" /> Horário de Funcionamento</label>
        <input className={inp} placeholder="Ex: Seg a Sex 07:00–21:00 · Sáb 07:00–20:00 · Dom 08:00–13:00"
          value={profile.hours} onChange={e => setProfile(p => ({ ...p, hours: e.target.value }))} />
      </div>

      {/* Formas de pagamento */}
      <div>
        <label className={lbl}><CreditCard className="w-3.5 h-3.5" /> Formas de Pagamento</label>
        <div className="flex flex-wrap gap-2">
          {PAYMENT_OPTIONS.map(opt => {
            const active = profile.payments?.includes(opt)
            return (
              <button key={opt} onClick={() => toggle(opt)} type="button"
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  active ? 'bg-orange-500/20 border-orange-500 text-orange-300' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                }`}>
                {opt}
              </button>
            )
          })}
        </div>
      </div>

      {/* Promoções — campo mais importante */}
      <div>
        <label className={lbl}><Tag className="w-3.5 h-3.5" /> 🔥 Promoções Atuais</label>
        <textarea rows={5} className={ta}
          placeholder={"Ex:\n• Refrigerante 2L — R$ 6,99\n• Frango inteiro — R$ 9,99/kg\n• Leve 3 pague 2 em massas\n• PIX tem 5% de desconto em qualquer compra"}
          value={profile.promotions}
          onChange={e => setProfile(p => ({ ...p, promotions: e.target.value }))} />
        <p className="text-xs text-gray-600 mt-1">O bot vai responder essas promoções quando alguém perguntar "tem promoção?"</p>
      </div>

      {/* Sobre e políticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={lbl}><Bot className="w-3.5 h-3.5" /> Sobre a Loja</label>
          <textarea rows={3} className={ta} placeholder="Ex: Mercadinho de bairro com mais de 10 anos, especializado em carnes e hortifrúti frescos."
            value={profile.about} onChange={e => setProfile(p => ({ ...p, about: e.target.value }))} />
        </div>
        <div>
          <label className={lbl}><Check className="w-3.5 h-3.5" /> Políticas (entrega, troca, fiado)</label>
          <textarea rows={3} className={ta} placeholder="Ex: Fazemos entrega no bairro. Troca em até 24h com nota. Fiado apenas para clientes cadastrados."
            value={profile.policies} onChange={e => setProfile(p => ({ ...p, policies: e.target.value }))} />
        </div>
      </div>

      {/* Aviso de segurança */}
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-300">
        🔒 <strong>O bot nunca vai revelar:</strong> faturamento, custos, margens, fornecedores, folha de pagamento ou qualquer dado financeiro/interno — mesmo que o cliente pergunte diretamente.
      </div>

      <button onClick={save} disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-black text-sm transition-all">
        {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {saving ? 'Salvando...' : saved ? 'Salvo! ✅' : 'Salvar configurações do bot'}
      </button>
    </div>
  )
}

export default function Configuracoes() {
  const { products, sales, customers, promos, operators, cashMovements, importProducts,
          upsertOperator, deleteOperator, syncOperators, clearBusinessData, bulkUpsertProducts,
          upsertPromo, upsertCustomer } = useStore()
  const [clearing, setClearing] = useState(null) // null | 'confirm-products' | 'confirm-all' | 'done'
  const { settings, setSettings } = usePrinter()
  const [form, setForm] = useState(() => ({
    storeName:  settings.storeName  || '',
    phone:      settings.phone      || '',
    address:    settings.address    || '',
    instagram:  settings.instagram  || '',
    pixKey:     settings.pixKey     || '',
    pixCity:    settings.pixCity    || 'SAO PAULO',
    themeColor: settings.themeColor || '#f97316',
  }))
  const [saved, setSaved] = useState(false)

  // Quando o sync traz cp_settings do servidor (cross-device), preenche campos vazios
  useEffect(() => {
    setForm(f => {
      const update = {}
      if (!f.storeName && settings.storeName)  update.storeName  = settings.storeName
      if (!f.phone     && settings.phone)      update.phone      = settings.phone
      if (!f.address   && settings.address)    update.address    = settings.address
      if (!f.instagram && settings.instagram)  update.instagram  = settings.instagram
      if (!f.pixKey    && settings.pixKey)     update.pixKey     = settings.pixKey
      if (!f.pixCity   && settings.pixCity)    update.pixCity    = settings.pixCity
      if (!f.themeColor && settings.themeColor) update.themeColor = settings.themeColor
      return Object.keys(update).length ? { ...f, ...update } : f
    })
  }, [settings])

  // ── Logo upload ──────────────────────────────────────────
  const logoFileRef = useRef(null)
  const [logoState, setLogoState] = useState(null) // null | 'loading' | 'ok' | 'err string'

  const handleLogoFile = useCallback((file) => {
    if (!file) return
    if (file.size > 2_000_000) { setLogoState('Arquivo muito grande (máx. 2 MB). Use PNG comprimido ou SVG.'); return }
    setLogoState('loading')
    const reader = new FileReader()
    reader.onload = (ev) => {
      const src = ev.target.result
      // Compress raster images > 300 KB via canvas
      if (!src.startsWith('data:image/svg') && file.size > 300_000) {
        const img = new window.Image()
        img.onload = () => {
          const MAX = 400
          const scale = Math.min(1, MAX / Math.max(img.width, img.height))
          const cv = document.createElement('canvas')
          cv.width  = Math.round(img.width  * scale)
          cv.height = Math.round(img.height * scale)
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height)
          setSettings(s => ({ ...s, logoImage: cv.toDataURL('image/png', 0.85) }))
          setLogoState('ok')
        }
        img.onerror = () => setLogoState('Não foi possível carregar a imagem. Tente PNG ou SVG.')
        img.src = src
      } else {
        setSettings(s => ({ ...s, logoImage: src }))
        setLogoState('ok')
      }
    }
    reader.onerror = () => setLogoState('Erro ao ler o arquivo. Tente PNG ou SVG.')
    reader.readAsDataURL(file)
  }, [setSettings])

  const openLogoPicker = useCallback(() => {
    setLogoState(null)
    logoFileRef.current?.click()
  }, [])

  // ── Auth / credentials ────────────────────────────────────
  const [authForm, setAuthForm] = useState(() => {
    const { username } = getCredentials()
    return { username, currentPass: '', newPass: '', confirmPass: '' }
  })
  const [showPass, setShowPass]   = useState(false)
  const [authMsg,  setAuthMsg]    = useState(null) // {type:'ok'|'err', text}
  const [authSaving, setAuthSaving] = useState(false)

  // ── Store ID (installation identity) ─────────────────────
  const [storeIdInput, setStoreIdInput] = useState(getConfiguredStoreId)
  const [storeIdMsg,   setStoreIdMsg]   = useState(null)
  const [copied,       setCopied]       = useState(false)
  const storeIdPreview = slugify(storeIdInput)

  const saveStore = () => {
    if (!storeIdInput.trim()) return
    const saved = saveStoreId(storeIdInput.trim())
    setStoreIdInput(saved)
    setStoreIdMsg({ type: 'ok', text: `✅ ID salvo: ${saved}` })
    setTimeout(() => setStoreIdMsg(null), 3000)
  }

  const copyId = () => {
    navigator.clipboard.writeText(storeIdPreview).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const saveAuth = async () => {
    setAuthMsg(null)
    if (!authForm.username.trim())
      return setAuthMsg({ type: 'err', text: 'Usuário não pode ser vazio.' })
    if (!authForm.currentPass)
      return setAuthMsg({ type: 'err', text: 'Informe a senha atual para confirmar.' })
    if (authForm.newPass && authForm.newPass.length < 4)
      return setAuthMsg({ type: 'err', text: 'Nova senha precisa de pelo menos 4 caracteres.' })
    if (authForm.newPass !== authForm.confirmPass)
      return setAuthMsg({ type: 'err', text: 'As senhas não coincidem.' })

    setAuthSaving(true)
    try {
      const storeId = getConfiguredStoreId()
      const token   = getMktStoreToken()
      const body    = {
        storeId,
        currentPassword: authForm.currentPass,
        newPassword:     authForm.newPass    || undefined,
        newUsername:     authForm.username.trim() !== getCredentials().username
                           ? authForm.username.trim()
                           : undefined,
      }
      const res  = await fetch('/api/update-auth', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'x-zs-token': token },
        body:    JSON.stringify(body),
      })
      const data = await res.json()
      if (!data.ok) {
        setAuthMsg({ type: 'err', text: `❌ ${data.error}` })
        return
      }
      // Sucesso — atualiza o localStorage também para manter local em sincronia
      const { password: currentPass } = getCredentials()
      saveCredentials(authForm.username.trim(), authForm.newPass || currentPass)
      setAuthForm(f => ({ ...f, currentPass: '', newPass: '', confirmPass: '' }))
      setAuthMsg({ type: 'ok', text: '✅ Credenciais atualizadas com sucesso!' })
      setTimeout(() => setAuthMsg(null), 4000)
    } catch {
      setAuthMsg({ type: 'err', text: '❌ Erro de conexão — tente novamente.' })
    } finally {
      setAuthSaving(false)
    }
  }

  const saveSettings = () => {
    const merged = { ...settings, ...form }
    setSettings(() => merged)
    const storeId = getConfiguredStoreId()
    const token   = getMktStoreToken()
    const hdr     = { 'Content-Type': 'application/json', 'x-zs-token': token }
    // Persiste storeName legado (cross-device /caixa)
    fetch('/api/persist', { method: 'POST', headers: hdr,
      body: JSON.stringify({ key: 'cp_store_name', value: form.storeName, storeId }) }).catch(() => {})
    // Persiste configurações completas incluindo logoImage (já comprimida ≤ 400px no upload)
    fetch('/api/persist', { method: 'POST', headers: hdr,
      body: JSON.stringify({ key: 'cp_settings', value: JSON.stringify(merged), storeId }) }).catch(() => {})
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const exportBackup = () => {
    const storeId = getConfiguredStoreId() || 'default'
    const payload = {
      version: 2,
      storeId,
      storeName: settings.storeName || storeId,
      exportedAt: new Date().toISOString(),
      products,
      sales,
      customers,
      promos: promos || [],
      operators: operators || [],
      cashMovements: cashMovements || [],
      settings: (() => { const { logoImage, ...s } = settings; return s })(),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `backup-${(settings.storeName || storeId).replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`
    a.click(); URL.revokeObjectURL(a.href)
  }

  const importBackup = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (!data.products && !data.customers && !data.sales)
        return alert('❌ Arquivo de backup inválido.')
      const confirm = window.confirm(
        `Restaurar backup de ${data.storeName || 'mercado'}?\n` +
        `• ${(data.products||[]).length} produtos\n` +
        `• ${(data.customers||[]).length} clientes\n` +
        `• ${(data.sales||[]).length} vendas\n` +
        `• ${(data.promos||[]).length} promoções\n\n` +
        `Dados atuais NÃO serão apagados — apenas mesclados.`
      )
      if (!confirm) return
      if (data.products?.length) bulkUpsertProducts(data.products)
      if (data.customers?.length) data.customers.forEach(c => upsertCustomer(c))
      if (data.promos?.length) data.promos.forEach(p => upsertPromo(p))
      alert(`✅ Backup restaurado com sucesso!\n${(data.products||[]).length} produtos importados.`)
    } catch (err) {
      alert('❌ Erro ao restaurar: ' + err.message)
    }
    e.target.value = ''
  }

  const handleImportCsv = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    try {
      const buf = await file.arrayBuffer()
      const list = parseGdoorCsv(buf)
      importProducts(list)
      alert(`✅ ${list.length} produtos importados!`)
    } catch (err) { alert('Erro: ' + err.message) }
    e.target.value = ''
  }

  const handleImportNFe = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    try {
      const text = await file.text()
      const parser = new DOMParser()
      const doc = parser.parseFromString(text, 'application/xml')
      const dets = Array.from(doc.querySelectorAll('det'))
      if (dets.length === 0) { alert('XML inválido ou sem itens (det).'); return }
      const items = dets.map(det => {
        const get = (tag) => det.querySelector(tag)?.textContent?.trim() || ''
        return {
          ean:   get('cEAN'),
          name:  get('xProd'),
          qty:   parseFloat(get('qCom'))  || 0,
          cost:  parseFloat(get('vUnCom').replace(',', '.')) || 0,
          ncm:   get('NCM'),
          unit:  get('uCom'),
        }
      })
      // Pass to store for stock update
      importProducts(items.map(i => ({
        barcode:  i.ean !== 'SEM GTIN' ? i.ean : '',
        name:     i.name,
        cost:     i.cost,
        price:    i.cost * 1.3,    // default 30% margin
        stock:    i.qty,
        category: 'NF-e Import',
        unit:     i.unit,
      })), { merge: true, addStock: true })
      alert(`✅ NF-e importada! ${items.length} itens processados.\nEstoque atualizado com as quantidades da nota.`)
    } catch (err) { alert('Erro ao ler NF-e: ' + err.message) }
    e.target.value = ''
  }

  return (
    <div className="space-y-4 max-w-2xl animate-pop">
      <h1 className="text-2xl font-black text-gray-900">Configurações</h1>

      {/* ── Dados da loja ──────────────────────────────────────── */}
      <Section icon={Store} title="Dados da Loja">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nome da loja" hint="Aparece no cupom, sidebar e no terminal de caixa">
            <input className="input" maxLength={40} value={form.storeName} onChange={e => set('storeName', e.target.value)} placeholder="Ex: Mercado do João" />
          </Field>
          <Field label="Telefone / WhatsApp" hint="Com DDD — ex: (15) 99660-4075 · usado no link do cupom">
            <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(15) 99999-9999" />
          </Field>
          <Field label="Endereço (opcional)" hint="Impresso no rodapé do cupom térmico">
            <input className="input" value={form.address} onChange={e => set('address', e.target.value)} placeholder="Rua Exemplo, 123 — Bairro" />
          </Field>
          <Field label="Instagram (sem @)" hint="Aparece no cupom — ex: meumercado">
            <input className="input" value={form.instagram} onChange={e => set('instagram', e.target.value)} placeholder="meumercado" />
          </Field>
        </div>

        {/* Logo da loja */}
        <div className="mt-4 space-y-2">
          <label className="label mb-1"><Image className="w-3 h-3 inline mr-1" />Logo da Loja</label>
          <p className="text-xs text-gray-400">PNG, JPG ou SVG · máx. 2 MB · fundo transparente fica melhor na sidebar escura</p>
          <div className="flex items-center gap-4 flex-wrap">
            {settings.logoImage ? (
              <div className="flex items-center gap-3">
                <div style={{ padding: 8, background: '#09090b', borderRadius: 10, border: '1px solid #1f2937' }}>
                  <img src={settings.logoImage} alt="logo" style={{ height: 40, maxWidth: 130, objectFit: 'contain' }} />
                </div>
                <button onClick={() => { setSettings(s => ({ ...s, logoImage: '' })); setLogoState(null) }}
                  className="text-xs text-red-500 hover:text-red-700 font-semibold">✕ Remover</button>
              </div>
            ) : (
              <div className="text-xs text-gray-400 italic">Sem logo — ícone padrão ZatendeStok</div>
            )}
            <button onClick={openLogoPicker}
              className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 text-gray-600 transition-colors">
              {logoState === 'loading'
                ? <><span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-gray-700 rounded-full animate-spin" />Carregando...</>
                : <><Upload className="w-3.5 h-3.5" />{settings.logoImage ? 'Trocar logo' : 'Enviar logo'}</>}
            </button>
          </div>
          {logoState === 'ok' && (
            <p className="text-xs text-green-600 font-bold">✅ Logo carregada com sucesso!</p>
          )}
          {logoState && logoState !== 'ok' && logoState !== 'loading' && (
            <p className="text-xs text-red-500">{logoState}</p>
          )}
          <input ref={logoFileRef} type="file" accept="image/*,image/svg+xml" className="hidden"
            onChange={e => { handleLogoFile(e.target.files?.[0]); e.target.value = '' }} />
        </div>

        {/* Cor do tema */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-1">
            <label className="label"><Palette className="w-3 h-3 inline mr-1" />Identidade Visual — Cor do Sistema</label>
            {(() => {
              try {
                const session = JSON.parse(localStorage.getItem('cp_session') || '{}')
                const meta    = getNicheMeta(session.niche || 'mercado')
                const applyNiche = () => {
                  set('themeColor', meta.color)
                  setSettings(s => ({ ...s, themeColor: meta.color }))
                }
                return (
                  <button onClick={applyNiche} title={`Cor padrão: ${meta.label}`}
                    className="text-[10px] font-bold px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-all flex items-center gap-1">
                    <span>{meta.emoji}</span>
                    <span>Cor do {meta.label}</span>
                    <span style={{ display:'inline-block', width:10, height:10, borderRadius:'50%', background:meta.color }} />
                  </button>
                )
              } catch { return null }
            })()}
          </div>
          <p className="text-xs text-gray-400 mb-3">A cor muda botões, sidebar e terminal em tempo real. Clique em Salvar para persistir.</p>
          <ColorPicker value={form.themeColor} onChange={v => {
            set('themeColor', v)
            // Atualiza settings AGORA para Layout.jsx não reverter via useEffect([themeColor])
            setSettings(s => ({ ...s, themeColor: v }))
          }} />
        </div>

        <button onClick={saveSettings} className={`btn-primary mt-5 ${saved ? '!bg-green-600' : ''}`}>
          <Save className="w-4 h-4" /> {saved ? '✅ Salvo!' : 'Salvar dados'}
        </button>
      </Section>

      {/* ── Chave PIX ──────────────────────────────────────────── */}
      <Section icon={QrCode} title="PIX — QR Code Automático">
        <p className="text-sm text-gray-500 mb-4">
          Configure sua chave PIX para gerar QR codes automaticamente no valor exato durante o pagamento.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <Field label="Chave PIX" hint="Telefone (+5515...), CPF, CNPJ, e-mail ou chave aleatória">
            <input className="input font-mono text-sm" value={form.pixKey}
              onChange={e => set('pixKey', e.target.value)}
              placeholder="+55159966XXXX ou CPF/CNPJ" />
          </Field>
          <Field label="Cidade (para o QR)">
            <input className="input" value={form.pixCity} onChange={e => set('pixCity', e.target.value)} placeholder="SAO PAULO" />
          </Field>
        </div>
        {form.pixKey && (
          <div className="flex flex-col sm:flex-row items-center gap-6 bg-gray-50 rounded-xl p-4">
            <PixQR amount={10} pixKey={form.pixKey} name={form.storeName} city={form.pixCity} txid="TESTE" size={140} />
            <div className="text-sm text-gray-600">
              <p className="font-bold text-gray-800 mb-1">Preview (R$10,00)</p>
              <p>O QR aparece automaticamente no PDV quando o pagamento é PIX, com o valor exato da compra.</p>
              <p className="mt-2 text-xs text-gray-400">Chave: {form.pixKey}</p>
            </div>
          </div>
        )}
        <button onClick={saveSettings} className={`btn-primary mt-4 ${saved ? 'bg-green-600 hover:bg-green-600' : ''}`}>
          <Save className="w-4 h-4" /> {saved ? '✅ Salvo!' : 'Salvar chave PIX'}
        </button>
      </Section>

      {/* ── Base de dados / NF-e ───────────────────────────────── */}
      <Section icon={Database} title="Importar Dados">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Base CSV Gdoor</p>
            <p className="text-xs text-gray-400 mb-2">
              Separador <code className="bg-gray-100 px-1 rounded">|</code>, encoding Mac Roman. Atualiza produtos e estoque.
            </p>
            <label className="btn-ghost cursor-pointer text-sm">
              <Upload className="w-4 h-4" /> Importar CSV (Gdoor)
              <input type="file" accept=".csv,.txt" className="hidden" onChange={handleImportCsv} />
            </label>
          </div>
          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm font-semibold text-gray-700 mb-1">📄 NF-e XML do Fornecedor</p>
            <p className="text-xs text-gray-400 mb-2">
              Importa nota fiscal eletrônica (XML). Atualiza estoque e custo automaticamente.
            </p>
            <label className="btn-primary cursor-pointer text-sm">
              <Upload className="w-4 h-4" /> Importar NF-e XML
              <input type="file" accept=".xml" className="hidden" onChange={handleImportNFe} />
            </label>
          </div>
        </div>
      </Section>

      {/* ── Backup ─────────────────────────────────────────────── */}
      <Section icon={Download} title="Backup & Restauração">
        {/* storeId badge — confirma isolamento multi-tenant */}
        <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-gray-900 border border-gray-800">
          <span className="text-xs font-black text-green-400">🔐 DADOS ISOLADOS</span>
          <span className="font-mono text-xs text-gray-400 flex-1 truncate">{getConfiguredStoreId() || 'default'}</span>
          <span className="text-[10px] text-gray-600">storeId único</span>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Inclui: <strong className="text-gray-400">{products.length} produtos</strong> · {customers.length} clientes · {sales.length} vendas · {(promos||[]).length} promoções · {(operators||[]).length} operadores
        </p>
        <div className="flex gap-3 flex-wrap">
          <button onClick={exportBackup} className="btn-primary">
            <Download className="w-4 h-4" /> Salvar backup no computador
          </button>
          <label className="btn-ghost cursor-pointer">
            <Upload className="w-4 h-4" /> Restaurar backup (.json)
            <input type="file" accept=".json" className="hidden" onChange={importBackup} />
          </label>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          💡 Restaurar mescla os dados — não apaga o que já existe.
        </p>
      </Section>

      {/* ── Status ─────────────────────────────────────────────── */}
      <Section icon={Info} title="Status do Sistema">
        <div className="grid grid-cols-3 gap-3">
          {[['Produtos', products.length], ['Vendas', sales.length], ['Clientes', customers.length]].map(([label, value]) => (
            <div key={label} className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-xl font-black text-gray-800">{value}</div>
              <div className="text-xs text-gray-500">{label}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Identificação da Instalação ────────────────────────── */}
      <Section icon={Fingerprint} title="Identificação desta Instalação">
        <p className="text-sm text-gray-500 mb-4">
          Cada mercado precisa de um <strong>ID único</strong> para que os dados fiquem completamente separados no servidor.
          Configure uma vez e nunca mais mude.
        </p>

        <div className="mb-3">
          <label className="label">Nome do mercado (gera o ID automaticamente)</label>
          <input
            className="input"
            value={storeIdInput}
            onChange={e => setStoreIdInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveStore()}
            placeholder="ex: cortaprecos, mercadoxpto"
          />
        </div>

        {/* Preview do ID gerado */}
        <div className="flex items-center gap-3 bg-gray-900 rounded-xl px-4 py-3 mb-4">
          <div className="flex-1">
            <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-0.5">ID gerado</div>
            <div className="font-mono font-black text-green-400 text-lg tracking-wider">
              {storeIdPreview || '—'}
            </div>
          </div>
          <button onClick={copyId}
            className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-gray-700">
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
        </div>

        {storeIdPreview === 'default' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-sm text-yellow-700 mb-3 flex gap-2">
            <span className="text-lg">⚠️</span>
            <div>
              <strong>ID padrão detectado.</strong> Se este é um mercado novo, troca o ID para algo único
              (ex: o nome do mercado). Do contrário, os dados podem se misturar com outros mercados que usam o padrão.
            </div>
          </div>
        )}

        {storeIdMsg && (
          <div className={`mb-3 px-4 py-2.5 rounded-xl text-sm font-medium ${
            storeIdMsg.type === 'ok'
              ? 'bg-green-500/10 text-green-700 border border-green-200'
              : 'bg-red-500/10 text-red-600 border border-red-200'
          }`}>{storeIdMsg.text}</div>
        )}

        <button onClick={saveStore} disabled={!storeIdPreview || storeIdPreview === getConfiguredStoreId()}
          className="btn-primary disabled:opacity-40">
          <Save className="w-4 h-4" /> Salvar ID do mercado
        </button>

        <p className="text-xs text-gray-400 mt-3">
          💡 Cada computador de caixa deste mercado deve ter o mesmo ID configurado aqui.
          Mercados diferentes = IDs diferentes = dados 100% separados no servidor.
        </p>
      </Section>

      {/* ── Acesso / Login ─────────────────────────────────────── */}
      <Section icon={KeyRound} title="Acesso ao Sistema">
        <p className="text-sm text-gray-500 mb-4">
          Altere o usuário e/ou senha de login. A senha atual é obrigatória para confirmar a alteração.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Usuário">
            <input
              className="input"
              value={authForm.username}
              onChange={e => setAuthForm(f => ({ ...f, username: e.target.value }))}
              placeholder="admin"
            />
          </Field>
          <div /> {/* spacer */}
          <Field label="Senha atual *" hint="Obrigatório para salvar qualquer alteração">
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                className="input pr-10"
                value={authForm.currentPass}
                onChange={e => setAuthForm(f => ({ ...f, currentPass: e.target.value }))}
                placeholder="senha que você usa para entrar"
              />
              <button type="button" onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </Field>
          <div /> {/* spacer */}
          <Field label="Nova senha" hint="Mínimo 4 caracteres · deixe em branco para manter a atual">
            <input
              type={showPass ? 'text' : 'password'}
              className="input"
              value={authForm.newPass}
              onChange={e => setAuthForm(f => ({ ...f, newPass: e.target.value }))}
              placeholder="deixe em branco para manter"
            />
          </Field>
          <Field label="Confirmar nova senha">
            <input
              type={showPass ? 'text' : 'password'}
              className="input"
              value={authForm.confirmPass}
              onChange={e => setAuthForm(f => ({ ...f, confirmPass: e.target.value }))}
              placeholder="repita a nova senha"
            />
          </Field>
        </div>
        {authMsg && (
          <div className={`mt-3 px-4 py-2.5 rounded-xl text-sm font-medium ${
            authMsg.type === 'ok'
              ? 'bg-green-500/10 text-green-700 border border-green-200'
              : 'bg-red-500/10 text-red-600 border border-red-200'
          }`}>
            {authMsg.text}
          </div>
        )}
        <button onClick={saveAuth} disabled={authSaving || !authForm.currentPass} className="btn-primary mt-4 disabled:opacity-50">
          <Save className="w-4 h-4" /> {authSaving ? 'Salvando…' : 'Salvar acesso'}
        </button>
      </Section>

      {/* ── Operadores ──────────────────────────────────────────── */}
      <Section icon={Users} title="Operadores de Caixa">
        <p className="text-sm text-gray-500 mb-3">
          Cada funcionário entra com seu nome + PIN. O caixa só vê o PDV; o gerente vê tudo exceto configurações.
        </p>

        {/* Links callout */}
        {(() => {
          const sid      = getConfiguredStoreId()
          const tok      = getMktStoreToken()
          const urlCaixa = `${window.location.origin}/caixa/${sid}?t=${tok}`
          const urlScan  = `${window.location.origin}/scan?storeId=${sid}&t=${tok}`
          const urlEst   = `${window.location.origin}/scan?storeId=${sid}&mode=estoque&t=${tok}`
          const row = (emoji, label, url) => (
            <div key={url} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
              <span className="text-xl shrink-0">{emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-gray-300 font-semibold text-xs">{label}</p>
                <p className="text-gray-500 font-mono text-[10px] break-all mt-0.5">{url}</p>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(url).then(() => alert('Link copiado!'))}
                className="shrink-0 px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-bold transition-colors">
                Copiar
              </button>
            </div>
          )
          return (
            <div className="rounded-xl bg-orange-500/10 border border-orange-500/30 p-3 mb-4 space-y-2">
              <p className="text-orange-400 font-bold text-xs uppercase tracking-wider mb-1">🔗 Links do sistema</p>
              {row('🧾', 'Terminal de Caixa (operador login com PIN)', urlCaixa)}
              {row('📷', 'Scanner PDV — celular envia código pro caixa', urlScan)}
              {row('📦', 'Scanner Estoque — cadastra produtos + qtd no celular', urlEst)}
            </div>
          )
        })()}

        {/* Operator cards */}
        {operators.length > 0 && (
          <div className="space-y-2 mb-4">
            {operators.map(op => (
              <OperatorCard key={op.id} op={op}
                onDelete={op => { if (confirm(`Remover ${op.name}?`)) deleteOperator(op.id) }} />
            ))}
          </div>
        )}

        {/* Force-sync button */}
        {operators.length > 0 && (
          <button
            onClick={() => { syncOperators(); alert('Operadores sincronizados! O link /caixa já vai funcionar em qualquer dispositivo.') }}
            className="w-full mb-3 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-orange-500/40 text-orange-400 hover:bg-orange-500/10 text-sm font-semibold transition-colors">
            🔄 Sincronizar operadores com o servidor
          </button>
        )}

        {/* Add form — self-contained, no state in parent → no scroll jump */}
        <AddOperatorForm onAdd={op => upsertOperator(op)} />
      </Section>

      {/* ── WhatsApp Bot ────────────────────────────────────────────────── */}
      <Section icon={Bot} title="Bot do Meu Mercado — Atendimento Automático">
        <p className="text-xs text-gray-400 mb-4">
          Configure as informações públicas da sua loja. Quando clientes mandarem mensagem no WhatsApp,
          o bot responde automaticamente com horário, promoções, endereço e muito mais.
        </p>
        <MarketBotProfileSection storeId={getConfiguredStoreId()} />
      </Section>

      <Section icon={MessageCircle} title="Bot WhatsApp (IA) — Conexão">
        <p className="text-xs text-gray-400 mb-4">
          Conecte o número de WhatsApp da sua loja. Escaneie o QR Code com o celular do número que vai atender seus clientes.
        </p>
        <WhatsAppBotSection instance={getConfiguredStoreId() || 'zatendestok'} />
      </Section>

      {/* ── Zona de Risco ─────────────────────────────────────────────── */}
      <Section icon={Trash2} title="Limpar Base de Dados">
        <p className="text-xs text-gray-400 mb-4">
          Remove produtos, vendas, clientes e fiado — tanto deste dispositivo quanto do servidor.
          Operadores e configurações da loja <strong className="text-gray-300">não</strong> são apagados.
        </p>

        {clearing === 'done' ? (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-semibold">
            <Check className="w-5 h-5 shrink-0" /> Dados apagados com sucesso — local e servidor.
          </div>
        ) : clearing === 'confirm-products' ? (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 space-y-3">
            <p className="text-sm text-red-300 font-semibold">⚠️ Apagar apenas o catálogo de produtos?</p>
            <p className="text-xs text-gray-400">Vendas, clientes e fiado continuam. Não tem como desfazer.</p>
            <div className="flex gap-2">
              <button onClick={async () => {
                await clearBusinessData(['cp_products'])
                setClearing('done')
                setTimeout(() => setClearing(null), 4000)
              }} className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-700">
                Confirmar — apagar produtos
              </button>
              <button onClick={() => setClearing(null)} className="px-4 py-2 rounded-lg border border-gray-700 text-gray-400 text-sm hover:bg-gray-800">
                Cancelar
              </button>
            </div>
          </div>
        ) : clearing === 'confirm-all' ? (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 space-y-3">
            <p className="text-sm text-red-300 font-semibold">⚠️ Apagar TODOS os dados do negócio?</p>
            <p className="text-xs text-gray-400">Produtos, vendas, clientes, fiado e caixa. Não tem como desfazer.</p>
            <div className="flex gap-2">
              <button onClick={async () => {
                await clearBusinessData(['cp_products','cp_sales','cp_customers','cp_fiado','cp_cash','cp_promos'])
                setClearing('done')
                setTimeout(() => setClearing(null), 4000)
              }} className="flex-1 py-2 rounded-lg bg-red-700 text-white text-sm font-bold hover:bg-red-800">
                Confirmar — apagar tudo
              </button>
              <button onClick={() => setClearing(null)} className="px-4 py-2 rounded-lg border border-gray-700 text-gray-400 text-sm hover:bg-gray-800">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <button
              onClick={() => setClearing('confirm-products')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm font-semibold transition-colors text-left">
              <Trash2 className="w-4 h-4 shrink-0" />
              <div>
                <div>Limpar catálogo de produtos</div>
                <div className="text-xs text-gray-500 font-normal mt-0.5">{products.length} produto{products.length !== 1 ? 's' : ''} cadastrado{products.length !== 1 ? 's' : ''} · vendas e clientes ficam</div>
              </div>
            </button>
            <button
              onClick={() => setClearing('confirm-all')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-red-700/40 text-red-500 hover:bg-red-700/10 text-sm font-semibold transition-colors text-left">
              <Database className="w-4 h-4 shrink-0" />
              <div>
                <div>Limpar tudo — produtos, vendas, clientes e fiado</div>
                <div className="text-xs text-gray-500 font-normal mt-0.5">{sales.length} venda{sales.length !== 1 ? 's' : ''} · {customers.length} cliente{customers.length !== 1 ? 's' : ''} · Operadores e configs ficam</div>
              </div>
            </button>
          </div>
        )}
      </Section>

    </div>
  )
}
