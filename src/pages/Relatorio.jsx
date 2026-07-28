import React, { useState, useMemo } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { TrendingUp, ShoppingCart, Percent, DollarSign, Download } from 'lucide-react'
import { useStore, BRL } from '../store.jsx'

const PERIODS = [
  { label: 'Hoje',       days: 0  },
  { label: '7 dias',     days: 7  },
  { label: '30 dias',    days: 30 },
  { label: '90 dias',    days: 90 },
]

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export default function Relatorio() {
  const { sales, products } = useStore()
  const [period, setPeriod] = useState(7)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo,   setCustomTo]   = useState('')

  const filtered = useMemo(() => {
    const now = new Date()
    if (customFrom && customTo) {
      const f = new Date(customFrom + 'T00:00:00')
      const t = new Date(customTo   + 'T23:59:59')
      return sales.filter(s => { const d = new Date(s.date); return d >= f && d <= t })
    }
    if (period === 0) return sales.filter(s => sameDay(new Date(s.date), now))
    const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - period)
    return sales.filter(s => new Date(s.date) >= cutoff)
  }, [sales, period, customFrom, customTo])

  const productMap = useMemo(() => Object.fromEntries(products.map(p => [p.name, p])), [products])

  const stats = useMemo(() => {
    const total     = filtered.reduce((s, x) => s + x.total, 0)
    const count     = filtered.length
    const ticket    = count > 0 ? total / count : 0
    const discount  = filtered.reduce((s, x) => s + (x.discount || 0) + (x.promoDiscount || 0), 0)

    // Profit estimation
    let revenue = 0, cost = 0
    filtered.forEach(s => s.items?.forEach(i => {
      const p = productMap[i.name]
      revenue += i.qty * i.price
      if (p?.cost) cost += i.qty * p.cost
    }))
    const margin = revenue > 0 ? ((revenue - cost) / revenue * 100) : 0
    const profit = revenue - cost

    // Payment breakdown
    const byPayment = {}
    filtered.forEach(s => {
      const k = (s.payment || 'Outro').split(' ')[0]
      byPayment[k] = (byPayment[k] || 0) + s.total
    })

    // Category breakdown
    const byCat = {}
    filtered.forEach(s => s.items?.forEach(i => {
      const p = productMap[i.name]
      const cat = p?.category || 'Outros'
      byCat[cat] = (byCat[cat] || { revenue: 0, qty: 0 })
      byCat[cat].revenue += i.qty * i.price
      byCat[cat].qty     += i.qty
    }))
    const catData = Object.entries(byCat)
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8)

    // Top products
    const byProd = {}
    filtered.forEach(s => s.items?.forEach(i => {
      byProd[i.name] = (byProd[i.name] || { qty: 0, revenue: 0 })
      byProd[i.name].qty     += i.qty
      byProd[i.name].revenue += i.qty * i.price
    }))
    const topProds = Object.entries(byProd)
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)

    // Daily chart (last 30 days max)
    const days = Math.min(period || 30, 60)
    const now = new Date()
    const chartData = Array.from({ length: days === 0 ? 1 : days }, (_, i) => {
      const d = new Date(now)
      d.setDate(d.getDate() - (days - 1 - i))
      const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      const day = filtered.filter(s => sameDay(new Date(s.date), d))
      return { label, total: day.reduce((s, x) => s + x.total, 0), qtd: day.length }
    })

    return { total, count, ticket, discount, margin, profit, byPayment, catData, topProds, chartData }
  }, [filtered, productMap])

  const exportCSV = () => {
    const rows = [['Data','Total','Pagamento','Itens','Desconto']]
    filtered.forEach(s => rows.push([
      new Date(s.date).toLocaleDateString('pt-BR'),
      s.total.toFixed(2).replace('.', ','),
      s.payment || '',
      s.items?.length || 0,
      ((s.discount || 0) + (s.promoDiscount || 0)).toFixed(2).replace('.', ','),
    ]))
    const csv = rows.map(r => r.join(';')).join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csv)
    a.download = `relatorio-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
  }

  return (
    <div className="space-y-5 animate-pop">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Relatório Gerencial</h1>
          <p className="text-gray-500 text-sm mt-0.5">Análise por período</p>
        </div>
        <button onClick={exportCSV} className="btn-ghost text-sm">
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      {/* Period picker */}
      <div className="flex items-center gap-2 flex-wrap">
        {PERIODS.map(p => (
          <button key={p.days} onClick={() => { setPeriod(p.days); setCustomFrom(''); setCustomTo('') }}
            className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors ${period === p.days && !customFrom ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {p.label}
          </button>
        ))}
        <div className="flex items-center gap-1.5 ml-auto">
          <input type="date" value={customFrom} onChange={e => { setCustomFrom(e.target.value); setPeriod(-1) }}
            className="input py-1 text-sm w-36" />
          <span className="text-gray-400 text-sm">até</span>
          <input type="date" value={customTo} onChange={e => { setCustomTo(e.target.value); setPeriod(-1) }}
            className="input py-1 text-sm w-36" />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Faturamento',  value: BRL.format(stats.total),           icon: TrendingUp,  color: '#ea580c' },
          { label: 'Vendas',       value: stats.count,                        icon: ShoppingCart, color: '#3b82f6' },
          { label: 'Ticket Médio', value: BRL.format(stats.ticket),           icon: DollarSign,  color: '#8b5cf6' },
          { label: 'Margem Est.',  value: `${stats.margin.toFixed(1)}%`,      icon: Percent,     color: '#22c55e' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm" style={{ borderLeft: `4px solid ${k.color}` }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{k.label}</span>
              <k.icon className="w-4 h-4" style={{ color: k.color }} />
            </div>
            <div className="text-2xl font-black text-gray-900">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      {stats.chartData.length > 1 && (
        <div className="card p-4">
          <h2 className="font-bold text-gray-800 mb-4">Faturamento no Período</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={stats.chartData}>
              <defs>
                <linearGradient id="rgrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#ea580c" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ea580c" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={v => [BRL.format(v), 'Total']} />
              <Area type="monotone" dataKey="total" stroke="#ea580c" strokeWidth={2} fill="url(#rgrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Payment breakdown */}
        <div className="card p-4">
          <h2 className="font-bold text-gray-800 mb-4">Formas de Pagamento</h2>
          <div className="space-y-3">
            {Object.entries(stats.byPayment).sort((a,b) => b[1]-a[1]).map(([k, v]) => {
              const pct = stats.total > 0 ? (v / stats.total * 100) : 0
              return (
                <div key={k}>
                  <div className="flex justify-between text-sm font-semibold text-gray-700 mb-1">
                    <span>{k}</span>
                    <span>{BRL.format(v)} <span className="text-gray-400 font-normal">({pct.toFixed(0)}%)</span></span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full">
                    <div className="h-2 bg-orange-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
            {Object.keys(stats.byPayment).length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">Nenhuma venda no período</p>
            )}
          </div>
        </div>

        {/* Top categories */}
        <div className="card p-4">
          <h2 className="font-bold text-gray-800 mb-4">Faturamento por Categoria</h2>
          {stats.catData.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Nenhuma venda no período</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.catData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `R$${(v/1000).toFixed(1)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={90} />
                <Tooltip formatter={v => [BRL.format(v), 'Receita']} />
                <Bar dataKey="revenue" fill="#ea580c" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top products table */}
      <div className="card p-4">
        <h2 className="font-bold text-gray-800 mb-4">Top 10 Produtos</h2>
        {stats.topProds.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Nenhuma venda no período</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-xs text-gray-500 font-bold uppercase tracking-wide">#</th>
                  <th className="text-left py-2 text-xs text-gray-500 font-bold uppercase tracking-wide">Produto</th>
                  <th className="text-right py-2 text-xs text-gray-500 font-bold uppercase tracking-wide">Qtd</th>
                  <th className="text-right py-2 text-xs text-gray-500 font-bold uppercase tracking-wide">Receita</th>
                  <th className="text-right py-2 text-xs text-gray-500 font-bold uppercase tracking-wide">Margem</th>
                </tr>
              </thead>
              <tbody>
                {stats.topProds.map((p, i) => {
                  const prod = productMap[p.name]
                  const costTot = prod?.cost ? p.qty * prod.cost : null
                  const margin  = costTot != null ? ((p.revenue - costTot) / p.revenue * 100) : null
                  return (
                    <tr key={p.name} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 text-gray-400 font-bold">{i + 1}</td>
                      <td className="py-2 font-semibold text-gray-800 max-w-[200px] truncate">{p.name}</td>
                      <td className="py-2 text-right text-gray-600">{p.qty}</td>
                      <td className="py-2 text-right font-bold text-gray-900">{BRL.format(p.revenue)}</td>
                      <td className="py-2 text-right">
                        {margin != null ? (
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${margin >= 20 ? 'bg-green-100 text-green-700' : margin >= 10 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'}`}>
                            {margin.toFixed(0)}%
                          </span>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary footer */}
      {stats.count > 0 && (
        <div className="card p-4 bg-gray-50">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            {[
              ['Lucro Estimado', BRL.format(stats.profit), stats.profit >= 0 ? 'text-green-600' : 'text-red-500'],
              ['Descontos', BRL.format(stats.discount), 'text-orange-600'],
              ['Ticket Médio', BRL.format(stats.ticket), 'text-blue-600'],
              ['Margem Média', `${stats.margin.toFixed(1)}%`, 'text-purple-600'],
            ].map(([label, value, color]) => (
              <div key={label}>
                <div className="text-xs text-gray-500 mb-1">{label}</div>
                <div className={`text-lg font-black ${color}`}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
