/**
 * /fornecedores — Gestão de Fornecedores do Mercado
 * Cadastro de fornecedores, histórico de compras e contato rápido.
 */
import React, { useState, useMemo, useCallback } from 'react'
import {
  Plus, Search, Phone, Pencil, Trash2, X, Package, Calendar,
  ChevronDown, ChevronUp, MessageCircle, FileText, TrendingUp,
  Truck, Clock, Check, AlertCircle, Building2, Receipt, Star,
} from 'lucide-react'
import { mktKey } from '../utils/tenantStorage.js'

const BRL    = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const LS_KEY = 'cp_suppliers_v1'

// ─── Categorias ───────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'bebidas',    emoji: '🥤', label: 'Bebidas',      color: '#3b82f6' },
  { id: 'carnes',     emoji: '🥩', label: 'Carnes',       color: '#ef4444' },
  { id: 'hortifruti', emoji: '🥬', label: 'Hortifruti',   color: '#22c55e' },
  { id: 'laticinios', emoji: '🧀', label: 'Laticínios',   color: '#f59e0b' },
  { id: 'limpeza',    emoji: '🧴', label: 'Limpeza',      color: '#8b5cf6' },
  { id: 'padaria',    emoji: '🍞', label: 'Padaria/Forno',color: '#d97706' },
  { id: 'mercearia',  emoji: '🛒', label: 'Mercearia',    color: '#0891b2' },
  { id: 'frios',      emoji: '❄️', label: 'Frios',        color: '#06b6d4' },
  { id: 'tabaco',     emoji: '🚬', label: 'Tabaco',       color: '#6b7280' },
  { id: 'outros',     emoji: '📦', label: 'Outros',       color: '#9ca3af' },
]

const VISIT_DAYS    = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'A combinar']
const PAYMENT_TERMS = ['À vista', '7 dias', '14 dias', '21 dias', '28 dias', '30 dias', '45 dias', '60 dias']

function getCat(id) {
  return CATEGORIES.find(c => c.id === id) || CATEGORIES.at(-1)
}

// ─── Persistência ─────────────────────────────────────────────────────────────
function loadSuppliers() {
  try { return JSON.parse(localStorage.getItem(mktKey(LS_KEY)) || '[]') } catch { return [] }
}
function persist(list) {
  try { localStorage.setItem(mktKey(LS_KEY), JSON.stringify(list)) } catch {}
}
function uid()  { return 'sup_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) }
function puid() { return 'pur_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) }

// ─── Helpers ──────────────────────────────────────────────────────────────────
const today   = () => new Date().toISOString().slice(0, 10)
const fmtDate = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'
const waLink  = (phone) => {
  const num = phone?.replace(/\D/g, '')
  if (!num || num.length < 8) return null
  return `https://wa.me/55${num.replace(/^55/, '').replace(/^0/, '')}`
}

// ─── Defaults ─────────────────────────────────────────────────────────────────
const EMPTY_SUP = {
  name: '', tradeName: '', cnpj: '', contactName: '', phone: '',
  email: '', category: 'outros', visitDay: 'A combinar',
  paymentTerm: '30 dias', minOrder: '', notes: '', active: true, purchases: [],
}

const EMPTY_PUR = { date: today(), items: '', total: '', invoice: '', notes: '' }

// ─── Componente de campo de formulário ────────────────────────────────────────
const Field = ({ label, children, half }) => (
  <div className={half ? 'sm:col-span-1' : 'sm:col-span-2'}>
    <label className="label">{label}</label>
    {children}
  </div>
)

// ─── Estatísticas ─────────────────────────────────────────────────────────────
function useStats(suppliers) {
  return useMemo(() => {
    const active   = suppliers.filter(s => s.active !== false)
    const thisMonth = new Date().toISOString().slice(0, 7)  // 'YYYY-MM'
    let spentMonth  = 0
    let totalPur    = 0
    for (const s of suppliers) {
      for (const p of s.purchases || []) {
        totalPur++
        if (p.date?.startsWith(thisMonth)) spentMonth += Number(p.total) || 0
      }
    }
    return { total: suppliers.length, active: active.length, spentMonth, totalPur }
  }, [suppliers])
}

// ─── Card de fornecedor ───────────────────────────────────────────────────────
function SupplierCard({ sup, onEdit, onPurchase, onHistory, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const cat   = getCat(sup.category)
  const wa    = waLink(sup.phone)
  const purs  = sup.purchases || []
  const last  = purs.length ? purs.reduce((a, b) => a.date > b.date ? a : b) : null
  const totalSpent = purs.reduce((s, p) => s + (Number(p.total) || 0), 0)

  return (
    <div className={`card overflow-hidden transition-all ${sup.active === false ? 'opacity-60' : ''}`}>
      {/* ── Header com cor da categoria ── */}
      <div style={{ background: cat.color + '18', borderBottom: `2px solid ${cat.color}30` }}
           className="px-4 py-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xl">{cat.emoji}</span>
          <div className="min-w-0">
            <div className="font-black text-gray-900 truncate leading-tight">{sup.name}</div>
            {sup.tradeName && <div className="text-xs text-gray-500 truncate">{sup.tradeName}</div>}
            <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5"
              style={{ background: cat.color + '22', color: cat.color }}>
              {cat.label}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {sup.active === false && (
            <span className="text-[10px] font-bold bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">inativo</span>
          )}
          <button onClick={() => onEdit(sup)} title="Editar"
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/60 text-gray-500 hover:text-gray-800 transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Corpo ── */}
      <div className="p-4 space-y-3">
        {/* Contato */}
        <div className="flex items-center gap-2 text-sm">
          <div className="w-6 text-center text-gray-400"><Building2 className="w-3.5 h-3.5 inline" /></div>
          <span className="text-gray-700 font-medium truncate">
            {sup.contactName || <span className="text-gray-400 italic">sem contato</span>}
          </span>
        </div>
        {sup.phone && (
          <div className="flex items-center gap-2">
            <div className="w-6 text-center text-gray-400"><Phone className="w-3.5 h-3.5 inline" /></div>
            <span className="text-sm text-gray-700">{sup.phone}</span>
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer"
                className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-green-50 text-green-700 hover:bg-green-100 transition-colors">
                <MessageCircle className="w-3 h-3" /> ZAP
              </a>
            )}
          </div>
        )}
        {sup.visitDay && sup.visitDay !== 'A combinar' && (
          <div className="flex items-center gap-2 text-sm">
            <div className="w-6 text-center text-gray-400"><Clock className="w-3.5 h-3.5 inline" /></div>
            <span className="text-gray-600">Visita: <strong>{sup.visitDay}</strong></span>
          </div>
        )}

        {/* Última compra */}
        <div className="rounded-xl p-3 space-y-1"
          style={{ background: last ? '#f0fdf4' : '#f9fafb', border: `1px solid ${last ? '#bbf7d0' : '#e5e7eb'}` }}>
          {last ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-green-700 uppercase tracking-wide">Última compra</span>
                <span className="text-xs font-black text-green-800">{BRL.format(Number(last.total) || 0)}</span>
              </div>
              <p className="text-xs text-gray-600 leading-snug line-clamp-2">{last.items}</p>
              <div className="flex items-center gap-1 text-[11px] text-gray-400">
                <Calendar className="w-3 h-3" />
                {fmtDate(last.date)}
                {last.invoice && <span className="ml-1 text-gray-400">· NF {last.invoice}</span>}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <AlertCircle className="w-3.5 h-3.5" />
              Nenhuma compra registrada ainda
            </div>
          )}
        </div>

        {/* Total gasto */}
        {purs.length > 0 && (
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{purs.length} {purs.length === 1 ? 'compra' : 'compras'} no histórico</span>
            <span className="font-bold text-gray-700">Total: {BRL.format(totalSpent)}</span>
          </div>
        )}
      </div>

      {/* ── Ações ── */}
      <div className="border-t border-gray-100 px-4 py-2.5 flex items-center gap-2">
        <button onClick={() => onPurchase(sup)}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors"
          style={{ background: 'var(--zs-theme)11', color: 'var(--zs-theme)' }}>
          <Plus className="w-3.5 h-3.5" /> Registrar compra
        </button>
        <button onClick={() => onHistory(sup)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
          <FileText className="w-3.5 h-3.5" /> Histórico
        </button>
        <button onClick={() => onDelete(sup)}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Modal de Cadastro / Edição ────────────────────────────────────────────────
function SupplierModal({ initial, onSave, onClose }) {
  const isNew = !initial?.id
  const [form, setForm] = useState(() => ({ ...EMPTY_SUP, ...initial }))
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    onSave({
      ...form,
      name: form.name.trim(),
      id: form.id || uid(),
      purchases: form.purchases || [],
      createdAt: form.createdAt || today(),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h2 className="text-lg font-black text-gray-900">
            {isNew ? '➕ Novo Fornecedor' : '✏️ Editar Fornecedor'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Identificação */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nome / Razão Social *" >
              <input className="input" value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="Ex: Distribuidora BevMax" required autoFocus />
            </Field>
            <Field label="Nome Fantasia" half>
              <input className="input" value={form.tradeName} onChange={e => set('tradeName', e.target.value)}
                placeholder="Ex: BevMax" />
            </Field>
            <Field label="CNPJ / CPF" half>
              <input className="input" value={form.cnpj} onChange={e => set('cnpj', e.target.value)}
                placeholder="00.000.000/0001-00" />
            </Field>
            <Field label="Categoria" half>
              <select className="input" value={form.category} onChange={e => set('category', e.target.value)}>
                {CATEGORIES.map(c => (
                  <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* Contato */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nome do Contato" >
              <input className="input" value={form.contactName} onChange={e => set('contactName', e.target.value)}
                placeholder="Ex: João Oliveira" />
            </Field>
            <Field label="Telefone / WhatsApp" half>
              <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)}
                placeholder="(15) 99999-9999" />
            </Field>
            <Field label="E-mail" >
              <input className="input" value={form.email} onChange={e => set('email', e.target.value)}
                placeholder="contato@fornecedor.com" type="email" />
            </Field>
          </div>

          {/* Condições comerciais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Dia de Visita" half>
              <select className="input" value={form.visitDay} onChange={e => set('visitDay', e.target.value)}>
                {VISIT_DAYS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Prazo de Pagamento" half>
              <select className="input" value={form.paymentTerm} onChange={e => set('paymentTerm', e.target.value)}>
                {PAYMENT_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Pedido Mínimo (R$)" half>
              <input className="input" value={form.minOrder} onChange={e => set('minOrder', e.target.value)}
                placeholder="Ex: 500" type="number" min="0" step="0.01" />
            </Field>
            <Field label="Status" half>
              <select className="input" value={form.active ? 'true' : 'false'} onChange={e => set('active', e.target.value === 'true')}>
                <option value="true">✅ Ativo</option>
                <option value="false">⏸️ Inativo</option>
              </select>
            </Field>
          </div>

          {/* Observações */}
          <Field label="Observações">
            <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="Ex: Entrega toda segunda-feira de manhã. Mínimo R$500." />
          </Field>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" className="btn-primary flex-1">
              <Check className="w-4 h-4" /> {isNew ? 'Cadastrar' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal de Registro de Compra ───────────────────────────────────────────────
function PurchaseModal({ supplier, onSave, onClose }) {
  const [form, setForm] = useState(EMPTY_PUR)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.items.trim() || !form.total) return
    onSave(supplier.id, { ...form, id: puid(), total: Number(form.total) })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="border-b border-gray-100 px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-gray-900">📦 Registrar Compra</h2>
            <p className="text-xs text-gray-500 mt-0.5">{supplier.name}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Data da compra</label>
              <input className="input" type="date" value={form.date} onChange={e => set('date', e.target.value)} required />
            </div>
            <div>
              <label className="label">Valor total (R$) *</label>
              <input className="input" type="number" min="0" step="0.01" value={form.total}
                onChange={e => set('total', e.target.value)} placeholder="0,00" required />
            </div>
          </div>
          <div>
            <label className="label">Itens comprados *</label>
            <textarea className="input resize-none" rows={3} value={form.items}
              onChange={e => set('items', e.target.value)} required
              placeholder="Ex: Coca-Cola 2L (24cx), Guaraná 1L (12cx), Água 500ml (48un)" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Nº da Nota Fiscal</label>
              <input className="input" value={form.invoice} onChange={e => set('invoice', e.target.value)}
                placeholder="Ex: 123456" />
            </div>
            <div>
              <label className="label">Observações</label>
              <input className="input" value={form.notes} onChange={e => set('notes', e.target.value)}
                placeholder="Opcional" />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" className="btn-primary flex-1">
              <Check className="w-4 h-4" /> Registrar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal de Histórico ────────────────────────────────────────────────────────
function HistoryModal({ supplier, onDeletePurchase, onClose }) {
  const purs  = [...(supplier.purchases || [])].sort((a, b) => b.date.localeCompare(a.date))
  const total = purs.reduce((s, p) => s + (Number(p.total) || 0), 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="border-b border-gray-100 px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-base font-black text-gray-900">📋 Histórico de Compras</h2>
            <p className="text-xs text-gray-500 mt-0.5">{supplier.name} · {purs.length} compras · Total: {BRL.format(total)}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-5 space-y-3 flex-1">
          {purs.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhuma compra registrada ainda.</p>
            </div>
          ) : purs.map(p => (
            <div key={p.id} className="rounded-xl border border-gray-100 p-3 hover:border-gray-200 transition-colors group">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-black text-gray-900">{BRL.format(Number(p.total) || 0)}</span>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />{fmtDate(p.date)}
                    </span>
                    {p.invoice && (
                      <span className="text-[11px] bg-blue-50 text-blue-700 font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1">
                        <Receipt className="w-2.5 h-2.5" /> NF {p.invoice}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-1 leading-relaxed">{p.items}</p>
                  {p.notes && <p className="text-[11px] text-gray-400 mt-1 italic">{p.notes}</p>}
                </div>
                <button onClick={() => onDeletePurchase(supplier.id, p.id)}
                  className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-100 p-4 flex-shrink-0">
          <button onClick={onClose} className="btn-secondary w-full">Fechar</button>
        </div>
      </div>
    </div>
  )
}

// ─── Página Principal ──────────────────────────────────────────────────────────
export default function Fornecedores() {
  const [suppliers, setSuppliers] = useState(loadSuppliers)
  const [query,     setQuery]     = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [showInactive, setShowInactive] = useState(false)

  // Modais
  const [editSup,    setEditSup]    = useState(null) // null | supplier obj
  const [purchaseFor, setPurchaseFor] = useState(null) // null | supplier
  const [historyFor,  setHistoryFor]  = useState(null) // null | supplier

  const stats = useStats(suppliers)

  // ── Filtro ──
  const filtered = useMemo(() => {
    let list = suppliers
    if (!showInactive) list = list.filter(s => s.active !== false)
    if (catFilter !== 'all') list = list.filter(s => s.category === catFilter)
    if (query) {
      const q = query.toLowerCase()
      list = list.filter(s =>
        s.name?.toLowerCase().includes(q) ||
        s.tradeName?.toLowerCase().includes(q) ||
        s.contactName?.toLowerCase().includes(q) ||
        s.cnpj?.includes(q) ||
        s.phone?.includes(q)
      )
    }
    // Ordena: ativos primeiro, depois por nome
    return [...list].sort((a, b) => {
      if ((a.active === false) !== (b.active === false)) return (a.active === false) ? 1 : -1
      return a.name.localeCompare(b.name)
    })
  }, [suppliers, catFilter, query, showInactive])

  // ── Ações ──
  const saveSup = useCallback((sup) => {
    setSuppliers(prev => {
      const exists = prev.findIndex(s => s.id === sup.id)
      const next   = exists >= 0
        ? prev.map(s => s.id === sup.id ? sup : s)
        : [...prev, sup]
      persist(next)
      return next
    })
    setEditSup(null)
  }, [])

  const deleteSup = useCallback((sup) => {
    if (!confirm(`Excluir "${sup.name}"? O histórico de compras também será apagado.`)) return
    setSuppliers(prev => {
      const next = prev.filter(s => s.id !== sup.id)
      persist(next)
      return next
    })
  }, [])

  const savePurchase = useCallback((supId, purchase) => {
    setSuppliers(prev => {
      const next = prev.map(s => s.id === supId
        ? { ...s, purchases: [...(s.purchases || []), purchase] }
        : s
      )
      persist(next)
      return next
    })
    setPurchaseFor(null)
  }, [])

  const deletePurchase = useCallback((supId, purId) => {
    if (!confirm('Remover esta compra do histórico?')) return
    setSuppliers(prev => {
      const next = prev.map(s => s.id === supId
        ? { ...s, purchases: (s.purchases || []).filter(p => p.id !== purId) }
        : s
      )
      persist(next)
      // Atualiza historyFor para refletir a deleção
      setHistoryFor(h => h?.id === supId ? next.find(s => s.id === supId) || null : h)
      return next
    })
  }, [])

  // ── Categorias com contagem ──
  const catCounts = useMemo(() => {
    const counts = {}
    for (const s of suppliers.filter(s => s.active !== false)) {
      counts[s.category] = (counts[s.category] || 0) + 1
    }
    return counts
  }, [suppliers])

  return (
    <div className="space-y-5 animate-pop pb-8">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <Truck className="w-7 h-7" style={{ color: 'var(--zs-theme)' }} />
            Fornecedores
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {stats.active} fornecedores ativos · {stats.totalPur} compras registradas
          </p>
        </div>
        <button onClick={() => setEditSup(EMPTY_SUP)} className="btn-primary">
          <Plus className="w-4 h-4" /> Novo Fornecedor
        </button>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Fornecedores ativos', value: stats.active,      icon: Truck,     color: 'var(--zs-theme)' },
          { label: 'Compras este mês',    value: BRL.format(stats.spentMonth), icon: TrendingUp, color: '#22c55e' },
          { label: 'Total de compras',    value: stats.totalPur,    icon: Receipt,   color: '#3b82f6' },
          { label: 'Categorias',          value: Object.keys(catCounts).length, icon: Star, color: '#f59e0b' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon className="w-4 h-4" style={{ color }} />
              <span className="text-xs text-gray-500 font-medium">{label}</span>
            </div>
            <div className="text-xl font-black text-gray-900">{value}</div>
          </div>
        ))}
      </div>

      {/* ── Busca + Filtros ── */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por nome, contato, CNPJ ou telefone..."
            className="input pl-9" />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Filtro por categoria */}
          <button onClick={() => setCatFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${catFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Todos {stats.active > 0 && `(${stats.active})`}
          </button>
          {CATEGORIES.filter(c => catCounts[c.id]).map(c => (
            <button key={c.id} onClick={() => setCatFilter(catFilter === c.id ? 'all' : c.id)}
              className="px-3 py-1.5 rounded-full text-xs font-bold transition-colors"
              style={{
                background: catFilter === c.id ? c.color : c.color + '18',
                color: catFilter === c.id ? '#fff' : c.color,
              }}>
              {c.emoji} {c.label} ({catCounts[c.id]})
            </button>
          ))}
          {suppliers.some(s => s.active === false) && (
            <button onClick={() => setShowInactive(v => !v)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ml-auto ${showInactive ? 'bg-gray-300 text-gray-700' : 'bg-gray-100 text-gray-500'}`}>
              {showInactive ? '👁 Ocultar inativos' : 'Mostrar inativos'}
            </button>
          )}
        </div>
      </div>

      {/* ── Grid de fornecedores ── */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Truck className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-bold text-gray-500">
            {suppliers.length === 0
              ? 'Nenhum fornecedor cadastrado ainda'
              : 'Nenhum fornecedor encontrado com esses filtros'}
          </p>
          {suppliers.length === 0 && (
            <button onClick={() => setEditSup(EMPTY_SUP)} className="btn-primary mt-4">
              <Plus className="w-4 h-4" /> Cadastrar primeiro fornecedor
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(sup => (
            <SupplierCard
              key={sup.id}
              sup={sup}
              onEdit={setEditSup}
              onPurchase={setPurchaseFor}
              onHistory={setHistoryFor}
              onDelete={deleteSup}
            />
          ))}
        </div>
      )}

      {/* ── Modais ── */}
      {editSup    && <SupplierModal  initial={editSup}    onSave={saveSup}      onClose={() => setEditSup(null)} />}
      {purchaseFor && <PurchaseModal supplier={purchaseFor} onSave={savePurchase} onClose={() => setPurchaseFor(null)} />}
      {historyFor  && <HistoryModal  supplier={historyFor} onDeletePurchase={deletePurchase} onClose={() => setHistoryFor(null)} />}
    </div>
  )
}
