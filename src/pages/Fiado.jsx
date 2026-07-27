/**
 * /fiado — Sistema de fiado (crediário informal).
 * Registra dívidas e pagamentos por cliente.
 * Esposa do Neteta — com carinho 🙏
 */
import React, { useState, useMemo } from 'react'
import {
  HandCoins, Plus, Minus, ChevronDown, ChevronUp,
  Users, AlertTriangle, CheckCircle2, Search, X, Clock
} from 'lucide-react'
import { useStore, BRL } from '../store.jsx'

const fmt = (d) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })

/* ── small badge ──────────────────────────────────────────── */
function Badge({ children, red }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide ${
      red ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
    }`}>{children}</span>
  )
}

/* ── modal: lançar fiado ou acertar ──────────────────────── */
function FiadoModal({ customer, mode, onClose, onConfirm }) {
  const [amount, setAmount] = useState('')
  const [desc,   setDesc]   = useState('')
  const isDebt = mode === 'debito'
  const valid  = parseFloat(amount) > 0

  const presets = isDebt
    ? [5, 10, 15, 20, 30, 50]
    : [customer?.fiadoBalance, 10, 20, 50].filter(Boolean)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-pop overflow-hidden">
        {/* header */}
        <div className={`px-6 py-5 ${isDebt ? 'bg-red-600' : 'bg-green-600'}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white/70 text-xs font-semibold uppercase tracking-wider">
                {isDebt ? '📋 Lançar Fiado' : '✅ Receber Pagamento'}
              </div>
              <div className="text-white font-black text-xl mt-0.5">{customer?.name}</div>
            </div>
            <button onClick={onClose} className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30">
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
          {customer?.fiadoBalance > 0 && (
            <div className="mt-3 bg-white/15 rounded-xl px-3 py-2 text-white text-sm">
              Saldo atual: <span className="font-black">{BRL.format(customer.fiadoBalance)}</span>
            </div>
          )}
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* amount */}
          <div>
            <label className="label">Valor (R$)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">R$</span>
              <input
                autoFocus
                type="number" min="0.01" step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0,00"
                className="input pl-9 text-xl font-black"
              />
            </div>
            {/* quick presets */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {presets.map(v => (
                <button key={v} onClick={() => setAmount(v.toFixed(2))}
                  className="px-2.5 py-1 text-xs font-bold border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
                  {BRL.format(v)}
                </button>
              ))}
            </div>
          </div>

          {/* description */}
          <div>
            <label className="label">{isDebt ? 'O que foi?' : 'Observação'} (opcional)</label>
            <input type="text" value={desc} onChange={e => setDesc(e.target.value)}
              placeholder={isDebt ? 'ex: pão, leite, arroz…' : 'ex: acerto de contas'}
              className="input" />
          </div>

          {/* confirm */}
          <button
            disabled={!valid}
            onClick={() => onConfirm(parseFloat(amount), desc)}
            className={`w-full py-3.5 rounded-xl font-black text-base transition-all ${
              valid
                ? isDebt
                  ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-200'
                  : 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-200'
                : 'bg-gray-100 text-gray-300 cursor-not-allowed'
            }`}>
            {isDebt ? `Lançar ${amount ? BRL.format(+amount) : ''}` : `Receber ${amount ? BRL.format(+amount) : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── customer card ────────────────────────────────────────── */
function CustomerCard({ c, onDebt, onPay }) {
  const [open, setOpen] = useState(false)
  const logs = [...(c.fiadoLogs || [])].reverse()
  const hasBalance = (c.fiadoBalance || 0) > 0

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
      hasBalance ? 'border-red-100' : 'border-gray-100'
    }`}>
      {/* main row */}
      <div className="flex items-center gap-4 px-5 py-4">
        {/* avatar */}
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-lg flex-shrink-0 ${
          hasBalance ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
        }`}>
          {c.name.charAt(0).toUpperCase()}
        </div>

        {/* info */}
        <div className="flex-1 min-w-0">
          <div className="font-bold text-gray-900 truncate">{c.name}</div>
          {c.phone && <div className="text-xs text-gray-400">{c.phone}</div>}
        </div>

        {/* balance */}
        <div className="text-right flex-shrink-0">
          {hasBalance ? (
            <>
              <div className="font-black text-red-600 text-lg leading-none">{BRL.format(c.fiadoBalance)}</div>
              <div className="text-[10px] text-red-400 font-semibold mt-0.5">deve</div>
            </>
          ) : (
            <>
              <div className="font-black text-green-600 text-sm leading-none">Quite ✓</div>
              <div className="text-[10px] text-green-400 font-semibold mt-0.5">zerado</div>
            </>
          )}
        </div>

        {/* actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={() => onDebt(c)}
            className="w-8 h-8 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg flex items-center justify-center transition-colors"
            title="Lançar fiado">
            <Plus className="w-4 h-4" />
          </button>
          {hasBalance && (
            <button onClick={() => onPay(c)}
              className="w-8 h-8 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg flex items-center justify-center transition-colors"
              title="Receber pagamento">
              <Minus className="w-4 h-4" />
            </button>
          )}
          {logs.length > 0 && (
            <button onClick={() => setOpen(!open)}
              className="w-8 h-8 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-lg flex items-center justify-center transition-colors">
              {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* history */}
      {open && logs.length > 0 && (
        <div className="border-t border-gray-50 bg-gray-50/50 px-5 py-3 space-y-2">
          <div className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Clock className="w-3 h-3" /> Histórico
          </div>
          {logs.slice(0, 20).map(log => (
            <div key={log.id} className="flex items-center gap-3 text-sm">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs ${
                log.type === 'pagamento' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'
              }`}>
                {log.type === 'pagamento' ? '↑' : '↓'}
              </span>
              <span className="flex-1 text-gray-600 truncate">{log.desc || (log.type === 'pagamento' ? 'Pagamento' : 'Fiado')}</span>
              <span className="text-gray-400 text-[10px] flex-shrink-0">{fmt(log.ts)}</span>
              <span className={`font-black flex-shrink-0 ${log.type === 'pagamento' ? 'text-green-600' : 'text-red-600'}`}>
                {log.type === 'pagamento' ? '-' : '+'}{BRL.format(Math.abs(log.amount))}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── main page ────────────────────────────────────────────── */
export default function Fiado() {
  const { customers, upsertCustomer, addFiado, payFiado } = useStore()
  const [search, setSearch]   = useState('')
  const [modal,  setModal]    = useState(null)   // { customer, mode: 'debito'|'pagamento' }
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [showNew, setShowNew]  = useState(false)
  const [toast,   setToast]    = useState(null)

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const allWithFiado = useMemo(() =>
    customers.filter(c => (c.fiadoBalance || 0) > 0 || (c.fiadoLogs || []).length > 0)
  , [customers])

  const totalOwed = useMemo(() =>
    customers.reduce((s, c) => s + (c.fiadoBalance || 0), 0)
  , [customers])

  const debtors = useMemo(() =>
    customers.filter(c => (c.fiadoBalance || 0) > 0)
  , [customers])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return allWithFiado.filter(c =>
      c.name.toLowerCase().includes(q) || (c.phone || '').includes(q)
    )
  }, [allWithFiado, search])

  const handleConfirm = (amount, desc) => {
    if (!modal) return
    if (modal.mode === 'debito') {
      addFiado(modal.customer.id, amount, desc)
      showToast(`✅ Fiado de ${BRL.format(amount)} lançado para ${modal.customer.name}`)
    } else {
      payFiado(modal.customer.id, amount, desc)
      showToast(`💰 Pagamento de ${BRL.format(amount)} registrado!`)
    }
    setModal(null)
  }

  const handleNewCustomer = () => {
    if (!newName.trim()) return
    upsertCustomer({ name: newName.trim(), phone: newPhone.trim() })
    showToast(`👤 ${newName} adicionado(a)!`)
    setNewName(''); setNewPhone(''); setShowNew(false)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-pop">

      {/* toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-xl font-semibold text-sm animate-pop ${
          toast.ok ? 'bg-gray-900 text-white' : 'bg-red-600 text-white'
        }`}>{toast.msg}</div>
      )}

      {/* modal */}
      {modal && (
        <FiadoModal
          customer={modal.customer}
          mode={modal.mode}
          onClose={() => setModal(null)}
          onConfirm={handleConfirm}
        />
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <HandCoins className="w-6 h-6 text-orange-500" /> Fiado
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">Controle de crédito informal por cliente</p>
        </div>
        <button onClick={() => setShowNew(!showNew)} className="btn-primary">
          <Plus className="w-4 h-4" /> Novo cliente
        </button>
      </div>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-red-100 shadow-sm" style={{ borderLeft: '4px solid #dc2626' }}>
          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total em fiado</div>
          <div className="text-2xl font-black text-red-600">{BRL.format(totalOwed)}</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-orange-100 shadow-sm" style={{ borderLeft: '4px solid #ea580c' }}>
          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Com saldo</div>
          <div className="text-2xl font-black text-orange-600">{debtors.length}</div>
          <div className="text-[10px] text-gray-400">clientes devendo</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm" style={{ borderLeft: '4px solid #6b7280' }}>
          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Cadastrados</div>
          <div className="text-2xl font-black text-gray-700">{customers.length}</div>
          <div className="text-[10px] text-gray-400">clientes total</div>
        </div>
      </div>

      {/* ── Add new customer ── */}
      {showNew && (
        <div className="bg-white rounded-2xl border border-orange-200 p-5 shadow-sm animate-pop space-y-3">
          <div className="font-bold text-gray-800 flex items-center gap-2">
            <Users className="w-4 h-4 text-orange-500" /> Adicionar cliente ao fiado
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Nome *</label>
              <input value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="Nome do cliente" className="input"
                onKeyDown={e => e.key === 'Enter' && handleNewCustomer()} />
            </div>
            <div>
              <label className="label">Telefone</label>
              <input value={newPhone} onChange={e => setNewPhone(e.target.value)}
                placeholder="(15) 99999-9999" className="input" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleNewCustomer} disabled={!newName.trim()} className="btn-primary">
              <Plus className="w-4 h-4" /> Adicionar
            </button>
            <button onClick={() => setShowNew(false)} className="btn-ghost">Cancelar</button>
          </div>
        </div>
      )}

      {/* ── Search ── */}
      {allWithFiado.length > 3 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cliente..." className="input pl-9" />
        </div>
      )}

      {/* ── All customers with fiado activity ── */}
      {filtered.length === 0 && allWithFiado.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
          <HandCoins className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <div className="font-bold text-gray-400">Nenhum fiado lançado ainda</div>
          <p className="text-sm text-gray-300 mt-1">Adicione um cliente acima e lance o primeiro fiado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Debtors first, then settled */}
          {[...filtered].sort((a, b) => (b.fiadoBalance || 0) - (a.fiadoBalance || 0)).map(c => (
            <CustomerCard
              key={c.id}
              c={c}
              onDebt={c => setModal({ customer: c, mode: 'debito' })}
              onPay={c => setModal({ customer: c, mode: 'pagamento' })}
            />
          ))}
        </div>
      )}

      {/* ── Quick launch for customers without fiado history ── */}
      {customers.filter(c => !(c.fiadoLogs || []).length).length > 0 && (
        <div>
          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
            Lançar fiado para outro cliente
          </div>
          <div className="flex flex-wrap gap-2">
            {customers.filter(c => !(c.fiadoLogs || []).length).map(c => (
              <button key={c.id}
                onClick={() => setModal({ customer: c, mode: 'debito' })}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 hover:border-orange-300 hover:bg-orange-50 rounded-xl text-sm font-semibold text-gray-700 transition-all shadow-sm">
                <span className="w-6 h-6 bg-gray-100 rounded-lg flex items-center justify-center text-xs font-black text-gray-500">
                  {c.name.charAt(0)}
                </span>
                {c.name}
                <Plus className="w-3 h-3 text-gray-400" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Alert: high debtors ── */}
      {debtors.filter(c => (c.fiadoBalance || 0) >= 50).length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-red-700 text-sm">Saldos altos detectados</div>
            <div className="text-red-500 text-xs mt-0.5">
              {debtors.filter(c => (c.fiadoBalance || 0) >= 50).map(c => c.name).join(', ')} — considere cobrar 😉
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
