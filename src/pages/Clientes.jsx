import React, { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, Search, X, User, HandCoins } from 'lucide-react'
import { useStore, fmtDate, BRL } from '../store.jsx'
import { Link } from 'react-router-dom'

const EMPTY = { name: '', phone: '', email: '', doc: '' }

export default function Clientes() {
  const { customers, upsertCustomer, deleteCustomer } = useStore()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null)

  const filtered = useMemo(() =>
    customers.filter(c =>
      !query ||
      c.name?.toLowerCase().includes(query.toLowerCase()) ||
      c.phone?.includes(query) ||
      c.doc?.includes(query)
    ), [customers, query])

  const save = (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    upsertCustomer({
      ...(editing.id ? { id: editing.id } : {}),
      name: fd.get('name'), phone: fd.get('phone'),
      email: fd.get('email'), doc: fd.get('doc'),
    })
    setEditing(null)
  }

  return (
    <div className="space-y-4 animate-pop">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Clientes</h1>
          <p className="text-gray-500 text-sm">{customers.length} clientes cadastrados</p>
        </div>
        <button onClick={() => setEditing(EMPTY)} className="btn-primary">
          <Plus className="w-4 h-4" /> Novo cliente
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por nome, telefone ou CPF/CNPJ..." className="input pl-9" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(c => {
          const hasFiado = (c.fiadoBalance || 0) > 0
          const isVip    = !!c.note
          return (
          <div key={c.id} className={`card p-4 flex items-start gap-3 relative overflow-hidden ${isVip ? 'border-orange-200' : ''}`}>
            {/* VIP shimmer strip */}
            {isVip && <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-orange-400 via-yellow-300 to-orange-400" />}

            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-black text-base ${
              isVip ? 'bg-orange-100 text-orange-600' : hasFiado ? 'bg-red-100 text-red-500' : 'bg-brand-100 text-brand-600'
            }`}>
              {c.name.charAt(0)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-gray-800 truncate">{c.name}</span>
                {isVip && <span className="text-orange-500 text-sm" title={c.note}>👑</span>}
              </div>
              {c.note && <div className="text-[10px] text-orange-500 font-semibold mt-0.5">{c.note}</div>}
              {c.phone && <div className="text-xs text-gray-500 mt-0.5">{c.phone}</div>}
              {c.email && <div className="text-xs text-gray-400 truncate">{c.email}</div>}
              {c.doc   && <div className="text-xs text-gray-400">{c.doc}</div>}
              {c.since && <div className="text-xs text-gray-300 mt-1">cliente desde {fmtDate(c.since)}</div>}

              {/* Fiado badge */}
              {hasFiado && (
                <Link to="/fiado" className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-[11px] font-bold hover:bg-red-100 transition-colors">
                  <HandCoins className="w-3 h-3" /> Fiado: {BRL.format(c.fiadoBalance)}
                </Link>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <button onClick={() => setEditing(c)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-brand-600">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => { if (confirm(`Excluir ${c.name}?`)) deleteCustomer(c.id) }} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="col-span-3 text-center py-12 text-gray-400 text-sm">Nenhum cliente encontrado</div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="card p-6 w-full max-w-md mx-4 animate-pop">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black text-gray-900">{editing.id ? 'Editar' : 'Novo'} Cliente</h2>
              <button onClick={() => setEditing(null)}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
            </div>
            <form onSubmit={save} className="space-y-3">
              <div>
                <label className="label">Nome completo *</label>
                <input name="name" required defaultValue={editing.name} className="input" />
              </div>
              <div>
                <label className="label">Telefone</label>
                <input name="phone" defaultValue={editing.phone} placeholder="(00) 99999-0000" className="input" />
              </div>
              <div>
                <label className="label">E-mail</label>
                <input name="email" type="email" defaultValue={editing.email} className="input" />
              </div>
              <div>
                <label className="label">CPF / CNPJ</label>
                <input name="doc" defaultValue={editing.doc} className="input" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setEditing(null)} className="btn-ghost flex-1 justify-center">Cancelar</button>
                <button type="submit" className="btn-primary flex-1 justify-center">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
