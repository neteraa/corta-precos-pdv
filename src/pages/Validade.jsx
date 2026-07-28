import React, { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle, Clock, Search, Calendar } from 'lucide-react'
import { useStore, BRL } from '../store.jsx'

const WARN_DAYS = 30  // alert threshold

function daysUntil(dateStr) {
  if (!dateStr) return null
  const diff = new Date(dateStr + 'T00:00:00') - new Date()
  return Math.ceil(diff / 86400000)
}

function statusOf(days) {
  if (days === null)  return 'none'
  if (days < 0)       return 'expired'
  if (days <= 7)      return 'critical'
  if (days <= WARN_DAYS) return 'warning'
  return 'ok'
}

const STATUS_CFG = {
  expired:  { label: 'Vencido',          bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-600',    icon: AlertTriangle, iconColor: 'text-red-500'   },
  critical: { label: 'Vence em até 7d',  bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-600', icon: AlertTriangle, iconColor: 'text-orange-500' },
  warning:  { label: `Vence em ${WARN_DAYS}d`, bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', icon: Clock, iconColor: 'text-yellow-500' },
  ok:       { label: 'OK',               bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-600',  icon: CheckCircle, iconColor: 'text-green-500'  },
}

export default function Validade() {
  const { products, upsertProduct } = useStore()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')  // all | expired | critical | warning | ok | none

  const allWithExpiry = useMemo(() => {
    return products
      .map(p => ({ ...p, days: daysUntil(p.expiryDate), status: statusOf(daysUntil(p.expiryDate)) }))
      .filter(p => p.expiryDate || filter === 'none')
      .sort((a, b) => {
        if (a.days === null && b.days !== null) return 1
        if (b.days === null && a.days !== null) return -1
        return (a.days ?? 99999) - (b.days ?? 99999)
      })
  }, [products, filter])

  const counts = useMemo(() => {
    const c = { expired: 0, critical: 0, warning: 0, ok: 0, none: 0 }
    products.forEach(p => {
      const s = statusOf(daysUntil(p.expiryDate))
      if (s === 'none') { if (!p.expiryDate) c.none++; return }
      c[s]++
    })
    return c
  }, [products])

  const visible = useMemo(() => {
    let list = filter === 'all' ? allWithExpiry.filter(p => p.expiryDate) :
               filter === 'none' ? products.filter(p => !p.expiryDate).map(p => ({ ...p, days: null, status: 'none' })) :
               allWithExpiry.filter(p => p.status === filter)
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(p => p.name?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q))
    }
    return list
  }, [allWithExpiry, products, filter, query])

  const updateExpiry = (id, date) => upsertProduct({ id, expiryDate: date || null })

  return (
    <div className="space-y-5 animate-pop">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Controle de Validade</h1>
        <p className="text-gray-500 text-sm mt-0.5">Produtos próximos ao vencimento</p>
      </div>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all',      label: `Todos com validade (${allWithExpiry.filter(p=>p.expiryDate).length})`, color: 'bg-gray-200 text-gray-700' },
          { key: 'expired',  label: `Vencidos (${counts.expired})`,  color: counts.expired  > 0 ? 'bg-red-500 text-white'    : 'bg-gray-100 text-gray-500' },
          { key: 'critical', label: `≤ 7 dias (${counts.critical})`, color: counts.critical > 0 ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-500' },
          { key: 'warning',  label: `≤ ${WARN_DAYS}d (${counts.warning})`,  color: counts.warning  > 0 ? 'bg-yellow-400 text-white' : 'bg-gray-100 text-gray-500' },
          { key: 'ok',       label: `OK (${counts.ok})`,             color: 'bg-green-100 text-green-700' },
          { key: 'none',     label: `Sem data (${counts.none})`,     color: 'bg-gray-100 text-gray-500' },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${filter === f.key ? f.color + ' ring-2 ring-offset-1 ring-current' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Buscar produto…" className="input pl-9" />
      </div>

      {/* List */}
      <div className="space-y-2">
        {visible.length === 0 && (
          <div className="card p-8 text-center text-gray-400">
            <Calendar className="w-10 h-10 mx-auto opacity-30 mb-2" />
            <p className="text-sm">Nenhum produto nesta categoria</p>
            {filter === 'none' && <p className="text-xs mt-1">Todos os produtos já têm data de validade cadastrada!</p>}
          </div>
        )}
        {visible.map(p => {
          const cfg = STATUS_CFG[p.status] || STATUS_CFG.ok
          const Icon = cfg.icon
          return (
            <div key={p.id} className={`${cfg.bg} ${cfg.border} border rounded-xl p-3 flex items-center gap-3`}>
              <Icon className={`w-5 h-5 flex-shrink-0 ${cfg.iconColor}`} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-800 text-sm truncate">{p.name}</div>
                <div className="text-xs text-gray-500">{p.category} · {BRL.format(p.price || 0)} · {p.stock} un.</div>
              </div>
              <div className="text-right flex-shrink-0 mr-2">
                {p.days !== null ? (
                  <>
                    <div className={`text-sm font-black ${cfg.text}`}>
                      {p.days < 0 ? `${Math.abs(p.days)}d atrás` : p.days === 0 ? 'Hoje!' : `${p.days}d`}
                    </div>
                    <div className="text-xs text-gray-400">{new Date(p.expiryDate + 'T00:00:00').toLocaleDateString('pt-BR')}</div>
                  </>
                ) : (
                  <span className="text-xs text-gray-400">sem data</span>
                )}
              </div>
              <input
                type="date"
                value={p.expiryDate || ''}
                onChange={e => updateExpiry(p.id, e.target.value)}
                className="input w-36 py-1 text-sm flex-shrink-0"
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
