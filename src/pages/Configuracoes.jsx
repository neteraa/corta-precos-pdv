import React, { useState } from 'react'
import { Database, Download, Upload, Info, Store, QrCode, Save, KeyRound, Eye, EyeOff, Users, Plus, Trash2, Fingerprint, Copy, Check, Image, Palette } from 'lucide-react'
import { useStore } from '../store.jsx'
import { parseGdoorCsv } from '../utils/importCsv.js'
import { usePrinter } from '../hooks/usePrinter.js'
import PixQR from '../components/PixQR.jsx'
import { getCredentials, saveCredentials, getConfiguredStoreId, saveStoreId, slugify } from '../utils/auth.js'

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
  const [hoveredShade, setHoveredShade] = useState(null)
  const [hexInput, setHexInput] = useState(value)
  const previewColor = hoveredShade || value

  // Find shades for the current selected color
  const selectedEntry = PALETTE.flatMap(g => g.colors).find(c => c.v === value)
  const shades = selectedEntry?.shades || []

  // Apply color instantly to CSS variable so ALL themed elements update live (no flash, no wait-for-save)
  const apply = (v) => {
    document.documentElement.style.setProperty('--zs-theme', v)
    onChange(v)
    setHexInput(v)
  }

  const handleHex = (v) => {
    setHexInput(v)
    if (/^#[0-9a-fA-F]{6}$/.test(v)) apply(v)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Palette grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {PALETTE.map(({ group, colors }) => (
          <div key={group} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', width: 90, flexShrink: 0, letterSpacing: '.03em' }}>{group}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {colors.map(({ name, v, shades: sh }) => (
                <button key={v} title={name}
                  onClick={() => apply(v)}
                  onMouseEnter={() => setHoveredShade(v)}
                  onMouseLeave={() => setHoveredShade(null)}
                  style={{
                    width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer',
                    background: v, flexShrink: 0, transition: 'transform .12s, box-shadow .12s',
                    transform: value === v ? 'scale(1.25)' : 'scale(1)',
                    boxShadow: value === v ? `0 0 0 2px white, 0 0 0 4px ${v}` : '0 1px 4px rgba(0,0,0,.15)',
                    outline: 'none',
                  }} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Shade strip — shows when a palette color is selected */}
      {shades.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: '.03em' }}>TONALIDADES — {selectedEntry.name}</span>
          <div style={{ display: 'flex', gap: 5 }}>
            {shades.map((s, i) => (
              <button key={s} title={s} onClick={() => apply(s)}
                style={{
                  flex: 1, height: 26, borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: s, transition: 'transform .1s',
                  transform: value === s ? 'scaleY(1.3)' : 'scaleY(1)',
                  boxShadow: value === s ? `0 0 0 2px white, 0 0 0 3px ${s}` : 'none',
                  outline: 'none',
                }} />
            ))}
          </div>
        </div>
      )}

      {/* Hex input + color wheel + live preview */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10 }}>
          <div style={{ width: 20, height: 20, borderRadius: 5, background: previewColor, border: '1px solid rgba(0,0,0,.1)', flexShrink: 0 }} />
          <input value={hexInput} onChange={e => handleHex(e.target.value)}
            style={{ width: 80, border: 'none', background: 'transparent', fontSize: 13, fontFamily: 'monospace', fontWeight: 700, color: '#111', outline: 'none' }} />
          <input type="color" value={value} onChange={e => apply(e.target.value)}
            style={{ width: 24, height: 24, padding: 0, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'transparent' }} title="Roda de cores" />
        </div>

        {/* Live mini preview */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 12, border: '1px solid #e5e7eb', background: '#f9fafb' }}>
          <div style={{ width: 10, height: 24, borderRadius: 4, background: previewColor }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <div style={{ padding: '2px 10px', borderRadius: 6, background: previewColor, color: '#fff', fontSize: 10, fontWeight: 900 }}>BOTÃO</div>
              <div style={{ padding: '2px 8px', borderRadius: 20, background: previewColor + '22', color: previewColor, fontSize: 10, fontWeight: 700, border: `1px solid ${previewColor}44` }}>TAG</div>
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
          <label className="label text-xs">{form.role === 'caixa' ? '📟 Terminal' : 'Terminal'}</label>
          <input
            type="number" min={1} max={20}
            className="input text-center font-bold"
            value={form.terminalId}
            onChange={e => setForm(f => ({ ...f, terminalId: e.target.value }))}
            disabled={form.role !== 'caixa'}
            style={{ opacity: form.role !== 'caixa' ? 0.35 : 1 }}
          />
        </div>
      </div>

      {/* PIN field with dot preview */}
      <div>
        <label className="label text-xs">PIN de acesso (opcional)</label>
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
        {!form.pin && <p className="text-[10px] text-gray-400 mt-1">Sem PIN = funcionário entra sem senha</p>}
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

export default function Configuracoes() {
  const { products, sales, customers, importProducts, operators, upsertOperator, deleteOperator, syncOperators } = useStore()
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

  // ── Auth / credentials ────────────────────────────────────
  const [authForm, setAuthForm] = useState(() => {
    const { username } = getCredentials()
    return { username, newPass: '', confirmPass: '' }
  })
  const [showPass, setShowPass]   = useState(false)
  const [authMsg,  setAuthMsg]    = useState(null) // {type:'ok'|'err', text}

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

  const saveAuth = () => {
    setAuthMsg(null)
    if (!authForm.username.trim()) return setAuthMsg({ type: 'err', text: 'Usuário não pode ser vazio.' })
    if (authForm.newPass && authForm.newPass.length < 4)
      return setAuthMsg({ type: 'err', text: 'Senha precisa de pelo menos 4 caracteres.' })
    if (authForm.newPass !== authForm.confirmPass)
      return setAuthMsg({ type: 'err', text: 'As senhas não coincidem.' })
    const { password: currentPass } = getCredentials()
    const finalPass = authForm.newPass || currentPass
    saveCredentials(authForm.username.trim(), finalPass)
    setAuthForm(f => ({ ...f, newPass: '', confirmPass: '' }))
    setAuthMsg({ type: 'ok', text: '✅ Credenciais atualizadas!' })
    setTimeout(() => setAuthMsg(null), 3000)
    // Keep local server _auth.json in sync (silent fail on Netlify / offline)
    fetch('/api/update-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: authForm.username.trim(), password: finalPass }),
    }).catch(() => {})
  }

  const saveSettings = () => {
    setSettings(s => ({ ...s, ...form }))
    // Persist store name to server so /caixa can show it cross-device
    const storeId = getConfiguredStoreId()
    fetch('/api/persist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'cp_store_name', value: form.storeName, storeId }),
    }).catch(() => {})
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const exportBackup = () => {
    const data = JSON.stringify({ products, sales, customers, exportedAt: new Date().toISOString() }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `cortaprecos-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click()
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
          <Field label="Nome da loja">
            <input className="input" value={form.storeName} onChange={e => set('storeName', e.target.value)} placeholder="Ex: Mercado do João" />
          </Field>
          <Field label="Telefone / WhatsApp">
            <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(11) 99999-9999" />
          </Field>
          <Field label="Endereço (opcional)">
            <input className="input" value={form.address} onChange={e => set('address', e.target.value)} />
          </Field>
          <Field label="Instagram (sem @)">
            <input className="input" value={form.instagram} onChange={e => set('instagram', e.target.value)} placeholder="meumercado" />
          </Field>
        </div>

        {/* Logo da loja */}
        <div className="mt-4">
          <label className="label mb-2"><Image className="w-3 h-3 inline mr-1" />Logo da Loja</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            {settings.logoImage
              ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ padding: 8, background: '#09090b', borderRadius: 10, border: '1px solid #1f2937' }}>
                    <img src={settings.logoImage} alt="logo preview" style={{ height: 36, maxWidth: 120, objectFit: 'contain' }} />
                  </div>
                  <button onClick={() => setSettings(s => ({ ...s, logoImage: '' }))}
                    className="text-xs text-red-500 hover:text-red-700 font-semibold">
                    ✕ Remover
                  </button>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#9ca3af' }}>Aparece na sidebar, terminal e cupom. Sem logo, usa o ícone padrão.</div>
              )
            }
            <button
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: '1px dashed #d1d5db', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#6b7280', background: '#f9fafb' }}
              onClick={() => document.getElementById('_logo_file_input').click()}
            >
              <Upload className="w-3 h-3" />
              {settings.logoImage ? 'Trocar logo' : 'Enviar logo'}
            </button>
            <input id="_logo_file_input" type="file" accept="image/*,image/svg+xml" style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0]
                if (!file) return
                if (file.size > 1_000_000) { alert('Logo muito grande. Use uma imagem menor que 1MB (idealmente PNG/SVG otimizado).'); return }
                const reader = new FileReader()
                reader.onload = () => setSettings(s => ({ ...s, logoImage: reader.result }))
                reader.onerror = () => alert('Erro ao ler a imagem. Tente outro arquivo.')
                reader.readAsDataURL(file)
              }} />
          </div>
        </div>

        {/* Cor do tema */}
        <div className="mt-5">
          <label className="label mb-3"><Palette className="w-3 h-3 inline mr-1" />Identidade Visual — Cor do Sistema</label>
          <ColorPicker value={form.themeColor} onChange={v => set('themeColor', v)} />
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
      <Section icon={Download} title="Backup & Exportação">
        <p className="text-sm text-gray-500 mb-3">Exporta todos os dados em JSON.</p>
        <button onClick={exportBackup} className="btn-ghost">
          <Download className="w-4 h-4" /> Exportar backup (.json)
        </button>
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
          Altere o usuário e/ou senha de login. Deixe a senha em branco para manter a atual.
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
          <Field label="Nova senha">
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                className="input pr-10"
                value={authForm.newPass}
                onChange={e => setAuthForm(f => ({ ...f, newPass: e.target.value }))}
                placeholder="mínimo 4 caracteres"
              />
              <button type="button" onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </Field>
          <Field label="Confirmar nova senha">
            <input
              type={showPass ? 'text' : 'password'}
              className="input"
              value={authForm.confirmPass}
              onChange={e => setAuthForm(f => ({ ...f, confirmPass: e.target.value }))}
              placeholder="repita a senha"
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
        <button onClick={saveAuth} className="btn-primary mt-4">
          <Save className="w-4 h-4" /> Salvar acesso
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
          const urlCaixa = `${window.location.origin}/caixa/${sid}`
          const urlScan  = `${window.location.origin}/scan?storeId=${sid}`
          const urlEst   = `${window.location.origin}/scan?storeId=${sid}&mode=estoque`
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

    </div>
  )
}
