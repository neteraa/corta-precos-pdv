import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'
import { TrendingUp, ShoppingCart, Package, AlertTriangle, ArrowRight, Receipt, ClipboardList, X, Printer, Download, MessageCircle, Target, ArrowDownCircle, ArrowUpCircle, Plus } from 'lucide-react'
import { useStore, BRL, fmtDate } from '../store.jsx'
import { useInstallPWA } from '../hooks/useInstallPWA.js'

const COLORS = ['#ea580c', '#fb923c', '#f97316', '#c2410c', '#fed7aa', '#9a3412']

export default function Dashboard() {
  const { products, sales, cashMovements, salesGoal, setSalesGoal, addCashMovement } = useStore()
  const navigate = useNavigate()
  const [showCaixa, setShowCaixa] = useState(false)
  const [movForm, setMovForm] = useState({ type: 'sangria', amount: '', reason: '' })
  const [showGoalEdit, setShowGoalEdit] = useState(false)
  const [goalDraft, setGoalDraft] = useState('')
  const { canInstall, installed, install } = useInstallPWA()

  const { chartData, totalRevenue, todayRevenue, totalSales, lowStock } = useMemo(() => {
    const now = new Date()
    const days = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i)
      const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      const dSales = sales.filter(s => {
        const sd = new Date(s.date)
        return sd.getDate() === d.getDate() && sd.getMonth() === d.getMonth() && sd.getFullYear() === d.getFullYear()
      })
      days.push({ label, total: dSales.reduce((a, s) => a + s.total, 0), qtd: dSales.length })
    }
    const totalRevenue = sales.reduce((a, s) => a + s.total, 0)
    const today = new Date()
    const todaySales = sales.filter(s => {
      const sd = new Date(s.date)
      return sd.getDate() === today.getDate() && sd.getMonth() === today.getMonth() && sd.getFullYear() === today.getFullYear()
    })
    const lowStock = products.filter(p => p.stock <= 5)
    return { chartData: days, totalRevenue, todayRevenue: todaySales.reduce((a, s) => a + s.total, 0), totalSales: sales.length, lowStock }
  }, [products, sales])

  const topProducts = useMemo(() => {
    const map = {}
    sales.forEach(s => s.items?.forEach(i => {
      map[i.name] = (map[i.name] || 0) + i.qty * i.price
    }))
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, total]) => ({ name, total }))
  }, [sales])

  const byCategory = useMemo(() => {
    const map = {}
    products.forEach(p => { map[p.category] = (map[p.category] || 0) + 1 })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [products])

  // ── Fechamento de Caixa data ───────────────────────────────
  const caixaStats = useMemo(() => {
    const today = new Date()
    const todaySales = sales.filter(s => {
      const d = new Date(s.date)
      return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
    })

    const totalVendas   = todaySales.length
    const faturamento   = todaySales.reduce((a, s) => a + s.total, 0)
    const avgTicket     = totalVendas > 0 ? faturamento / totalVendas : 0
    const totalDesconto = todaySales.reduce((a, s) => a + (s.promoDiscount || 0) + (s.discount || 0), 0)

    // Payment breakdown
    const byPayment = {}
    todaySales.forEach(s => {
      const key = (s.payment || 'Outro').split(' ')[0]  // "PIX R$50..." → "PIX"
      byPayment[key] = (byPayment[key] || 0) + s.total
    })

    // Top products today
    const itemMap = {}
    todaySales.forEach(s => s.items?.forEach(i => {
      itemMap[i.name] = (itemMap[i.name] || { qty: 0, revenue: 0 })
      itemMap[i.name].qty     += i.qty
      itemMap[i.name].revenue += i.qty * i.price
    }))
    const topToday = Object.entries(itemMap)
      .sort((a, b) => b[1].qty - a[1].qty)
      .slice(0, 8)
      .map(([name, d]) => ({ name, ...d }))

    // Estimated margin (uses cost from product catalog)
    const productMap = Object.fromEntries(products.map(p => [p.name, p]))
    let totalCost = 0, totalSaleRev = 0
    todaySales.forEach(s => s.items?.forEach(i => {
      const p = productMap[i.name]
      if (p?.cost) totalCost += i.qty * p.cost
      totalSaleRev += i.qty * i.price
    }))
    const margem = totalSaleRev > 0 ? ((totalSaleRev - totalCost) / totalSaleRev * 100) : 0

    // Cash balance: dinheiro received minus sangria plus suprimento (today)
    const cashIn  = byPayment['Dinheiro'] || 0
    const todayMovs = cashMovements.filter(m => {
      const d = new Date(m.date)
      return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
    })
    const sangriaTotal    = todayMovs.filter(m => m.type === 'sangria').reduce((s, m) => s + m.amount, 0)
    const suprimentoTotal = todayMovs.filter(m => m.type === 'suprimento').reduce((s, m) => s + m.amount, 0)
    const cashBalance = cashIn - sangriaTotal + suprimentoTotal

    return { todaySales, totalVendas, faturamento, avgTicket, totalDesconto, byPayment, topToday, margem, date: today, todayMovs, sangriaTotal, suprimentoTotal, cashBalance }
  }, [sales, products, cashMovements, showCaixa])

  const kpis = [
    {
      label: 'Faturamento Total', value: BRL.format(totalRevenue), icon: TrendingUp,
      accent: '#ea580c', lightBg: 'rgba(234,88,12,0.07)', iconColor: '#ea580c',
      sub: `${totalSales} vendas no total`
    },
    {
      label: 'Vendas Hoje', value: BRL.format(todayRevenue), icon: ShoppingCart,
      accent: '#22c55e', lightBg: 'rgba(34,197,94,0.07)', iconColor: '#22c55e',
      sub: sales.filter(s => new Date(s.date).toDateString() === new Date().toDateString()).length + ' pedidos'
    },
    {
      label: 'Total de Vendas', value: totalSales, icon: Receipt,
      accent: '#3b82f6', lightBg: 'rgba(59,130,246,0.07)', iconColor: '#3b82f6',
      sub: 'todas as transações'
    },
    {
      label: 'Estoque Crítico', value: lowStock.length, icon: AlertTriangle,
      accent: lowStock.length > 0 ? '#ef4444' : '#22c55e',
      lightBg: lowStock.length > 0 ? 'rgba(239,68,68,0.07)' : 'rgba(34,197,94,0.07)',
      iconColor: lowStock.length > 0 ? '#ef4444' : '#22c55e',
      sub: lowStock.length > 0 ? 'produtos abaixo de 5 un.' : 'estoque saudável ✓'
    },
  ]

  return (
    <div className="space-y-6 animate-pop">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Visão geral do seu negócio</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Define meta */}
          {showGoalEdit ? (
            <div className="flex items-center gap-1.5">
              <input
                type="number" min="0" step="100"
                value={goalDraft}
                onChange={e => setGoalDraft(e.target.value)}
                placeholder="Meta diária R$"
                className="input w-36 py-1.5 text-sm"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') { setSalesGoal({ daily: parseFloat(goalDraft) || 0 }); setShowGoalEdit(false) }
                  if (e.key === 'Escape') setShowGoalEdit(false)
                }}
              />
              <button onClick={() => { setSalesGoal({ daily: parseFloat(goalDraft) || 0 }); setShowGoalEdit(false) }}
                className="btn-primary py-1.5 px-3 text-sm">OK</button>
              <button onClick={() => setShowGoalEdit(false)} className="btn-ghost py-1.5 px-3 text-sm">✕</button>
            </div>
          ) : (
            <button onClick={() => { setGoalDraft(salesGoal.daily || ''); setShowGoalEdit(true) }} className="btn-ghost">
              <Target className="w-4 h-4" /> Meta
            </button>
          )}
          <button onClick={() => setShowCaixa(true)} className="btn-ghost">
            <ClipboardList className="w-4 h-4" /> Fechar Caixa
          </button>
          <button onClick={() => navigate('/pdv')} className="btn-primary">
            <ShoppingCart className="w-4 h-4" /> Abrir Caixa
          </button>
        </div>
      </div>

      {/* PWA install banner — only shown when Chrome offers install */}
      {canInstall && (
        <div className="flex items-center justify-between bg-gray-900 text-white rounded-2xl px-5 py-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Download className="w-4 h-4 text-black" />
            </div>
            <div>
              <div className="font-black text-sm">Instalar como App no Windows</div>
              <div className="text-gray-400 text-xs">Abre sem barra do browser · atalhos funcionam · ícone na área de trabalho</div>
            </div>
          </div>
          <button
            onClick={install}
            className="bg-brand-600 hover:bg-brand-500 text-black font-black text-sm px-4 py-2 rounded-xl flex-shrink-0 ml-4 transition-colors"
          >
            Instalar
          </button>
        </div>
      )}

      {installed && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 text-green-700 rounded-2xl px-5 py-3">
          <span className="text-lg">✅</span>
          <span className="text-sm font-semibold">App instalado! Abra pelo ícone na área de trabalho.</span>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm overflow-hidden relative"
            style={{ borderLeft: `4px solid ${k.accent}` }}>
            <div className="absolute inset-0 opacity-100 pointer-events-none"
              style={{ background: k.lightBg }} />
            <div className="relative">
              <div className="flex items-start justify-between mb-3">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest leading-tight">{k.label}</span>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: k.lightBg, color: k.iconColor }}>
                  <k.icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                </div>
              </div>
              <div className="text-2xl font-black text-gray-900 leading-tight">{k.value}</div>
              <div className="text-[11px] text-gray-400 mt-1">{k.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Meta de Vendas ──────────────────────────────────── */}
      {salesGoal.daily > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-orange-500" />
              <span className="font-bold text-gray-800 text-sm">Meta do Dia</span>
            </div>
            <div className="text-sm font-black text-gray-900">
              {BRL.format(todayRevenue)} <span className="text-gray-400 font-normal">/ {BRL.format(salesGoal.daily)}</span>
            </div>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-3 rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, (todayRevenue / salesGoal.daily) * 100)}%`,
                background: todayRevenue >= salesGoal.daily ? '#22c55e' : '#ea580c',
              }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-gray-400">
              {todayRevenue >= salesGoal.daily ? '🎉 Meta batida!' : `Faltam ${BRL.format(Math.max(0, salesGoal.daily - todayRevenue))}`}
            </span>
            <span className="text-xs font-bold" style={{ color: todayRevenue >= salesGoal.daily ? '#22c55e' : '#ea580c' }}>
              {Math.min(100, ((todayRevenue / salesGoal.daily) * 100)).toFixed(0)}%
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* faturamento 14 dias */}
        <div className="card p-4 lg:col-span-2">
          <h2 className="font-bold text-gray-800 mb-4">Faturamento – últimos 14 dias</h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ea580c" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ea580c" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => [BRL.format(v), 'Total']} labelStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="total" stroke="#ea580c" strokeWidth={2} fill="url(#grad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* pizza por categoria */}
        <div className="card p-4">
          <h2 className="font-bold text-gray-800 mb-4">Produtos por Categoria</h2>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={byCategory} cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="value" paddingAngle={3}>
                {byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v, n) => [v, n]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 space-y-1">
            {byCategory.map((c, i) => (
              <div key={c.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-gray-600">{c.name}</span>
                </div>
                <span className="font-semibold text-gray-800">{c.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* top produtos */}
        <div className="card p-4">
          <h2 className="font-bold text-gray-800 mb-4">Top Produtos (Receita)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topProducts} layout="vertical" margin={{ left: 0 }}>
              <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `R$${(v/1000).toFixed(1)}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={110} />
              <Tooltip formatter={(v) => [BRL.format(v), 'Receita']} />
              <Bar dataKey="total" fill="#ea580c" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* estoque crítico */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800">Estoque Crítico</h2>
            <button onClick={() => navigate('/estoque')} className="text-xs text-brand-600 hover:underline flex items-center gap-1">
              Ver tudo <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {lowStock.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">✅ Estoque saudável!</div>
          ) : (
            <div className="space-y-2">
              {lowStock.slice(0, 6).map(p => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <div className="text-sm font-semibold text-gray-800">{p.name}</div>
                    <div className="text-xs text-gray-400">{p.category}</div>
                  </div>
                  <span className={`text-sm font-black ${p.stock === 0 ? 'text-red-600' : 'text-amber-500'}`}>
                    {p.stock === 0 ? 'SEM ESTOQUE' : `${p.stock} un.`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* ── Fechamento de Caixa modal ────────────────────────── */}
      {showCaixa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowCaixa(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-pop" onClick={e => e.stopPropagation()}>
            {/* header */}
            <div className="bg-gray-900 px-6 py-5 rounded-t-2xl flex items-center justify-between">
              <div>
                <div className="text-white font-black text-xl">📊 Fechamento de Caixa</div>
                <div className="text-gray-400 text-sm mt-0.5">
                  {caixaStats.date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                </div>
              </div>
              <button onClick={() => setShowCaixa(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {caixaStats.totalVendas === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <div className="text-4xl mb-3">🛒</div>
                  <div className="font-semibold">Nenhuma venda hoje ainda</div>
                </div>
              ) : (
                <>
                  {/* KPIs do dia */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Vendas',       value: caixaStats.totalVendas,                color: 'text-blue-600',  bg: 'bg-blue-50'  },
                      { label: 'Faturamento',  value: BRL.format(caixaStats.faturamento),    color: 'text-brand-600', bg: 'bg-brand-50' },
                      { label: 'Ticket médio', value: BRL.format(caixaStats.avgTicket),      color: 'text-green-600', bg: 'bg-green-50' },
                      { label: 'Margem est.',  value: `${caixaStats.margem.toFixed(1)}%`,    color: 'text-purple-600', bg: 'bg-purple-50' },
                    ].map(k => (
                      <div key={k.label} className={`${k.bg} rounded-xl p-4`}>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{k.label}</div>
                        <div className={`text-2xl font-black ${k.color} mt-1`}>{k.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* promos savings */}
                  {caixaStats.totalDesconto > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex justify-between items-center">
                      <div>
                        <div className="text-xs font-semibold text-green-600 uppercase">Descontos & Promoções dados</div>
                        <div className="text-xs text-green-500 mt-0.5">Economia gerada para os clientes hoje</div>
                      </div>
                      <div className="text-2xl font-black text-green-600">−{BRL.format(caixaStats.totalDesconto)}</div>
                    </div>
                  )}

                  {/* by payment */}
                  <div>
                    <div className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Por forma de pagamento</div>
                    <div className="space-y-2">
                      {Object.entries(caixaStats.byPayment)
                        .sort((a, b) => b[1] - a[1])
                        .map(([method, val]) => {
                          const pct = caixaStats.faturamento > 0 ? (val / caixaStats.faturamento * 100) : 0
                          return (
                            <div key={method}>
                              <div className="flex justify-between text-sm font-semibold text-gray-700 mb-1">
                                <span>{method}</span>
                                <span>{BRL.format(val)} <span className="text-gray-400 font-normal">({pct.toFixed(0)}%)</span></span>
                              </div>
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-2 bg-brand-500 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </div>

                  {/* top products */}
                  {caixaStats.topToday.length > 0 && (
                    <div>
                      <div className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Mais vendidos hoje</div>
                      <div className="space-y-1.5">
                        {caixaStats.topToday.map((p, i) => (
                          <div key={p.name} className="flex items-center gap-3 py-1.5 border-b border-gray-100 last:border-0">
                            <span className="text-xs font-black text-gray-300 w-4">{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-gray-800 truncate">{p.name}</div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="text-sm font-black text-gray-900">{p.qty} un.</div>
                              <div className="text-xs text-gray-400">{BRL.format(p.revenue)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── Sangria / Suprimento ─────────────────────── */}
              <div className="border border-gray-200 rounded-xl p-3 space-y-2">
                <div className="text-xs font-black text-gray-500 uppercase tracking-widest">Sangria / Suprimento</div>
                <div className="flex gap-2">
                  {['sangria', 'suprimento'].map(t => (
                    <button key={t} onClick={() => setMovForm(f => ({ ...f, type: t }))}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors capitalize ${movForm.type === t ? (t === 'sangria' ? 'bg-red-500 text-white' : 'bg-green-500 text-white') : 'bg-gray-100 text-gray-600'}`}>
                      {t === 'sangria' ? '↓ Sangria (retirada)' : '↑ Suprimento (entrada)'}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input type="number" min="0" step="0.01" placeholder="Valor R$"
                    value={movForm.amount}
                    onChange={e => setMovForm(f => ({ ...f, amount: e.target.value }))}
                    className="input flex-1 py-1.5 text-sm" />
                  <input type="text" placeholder="Motivo (opcional)"
                    value={movForm.reason}
                    onChange={e => setMovForm(f => ({ ...f, reason: e.target.value }))}
                    className="input flex-1 py-1.5 text-sm" />
                  <button
                    onClick={() => {
                      const amt = parseFloat(movForm.amount)
                      if (!amt || amt <= 0) return
                      addCashMovement({ type: movForm.type, amount: amt, reason: movForm.reason })
                      setMovForm(f => ({ ...f, amount: '', reason: '' }))
                    }}
                    disabled={!movForm.amount || parseFloat(movForm.amount) <= 0}
                    className="btn-primary py-1.5 px-3 text-sm disabled:opacity-40">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {/* today's movements */}
                {caixaStats.todayMovs?.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-gray-100">
                    {caixaStats.todayMovs.map(m => (
                      <div key={m.id} className="flex justify-between text-xs text-gray-600">
                        <span className={m.type === 'sangria' ? 'text-red-500' : 'text-green-600'}>
                          {m.type === 'sangria' ? '↓' : '↑'} {m.reason || m.type}
                        </span>
                        <span className="font-bold">{m.type === 'sangria' ? '-' : '+'}{BRL.format(m.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-black pt-1 border-t border-gray-200">
                      <span>💵 Saldo no caixa (dinheiro)</span>
                      <span className={caixaStats.cashBalance >= 0 ? 'text-green-600' : 'text-red-500'}>{BRL.format(caixaStats.cashBalance)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const w = window.open('', '_blank', 'width=400,height=700')
                    const lines = [
                      `FECHAMENTO DE CAIXA — ${caixaStats.date.toLocaleDateString('pt-BR')}`,
                      `Vendas: ${caixaStats.totalVendas}`,
                      `Faturamento: ${BRL.format(caixaStats.faturamento)}`,
                      `Ticket médio: ${BRL.format(caixaStats.avgTicket)}`,
                      `Margem estimada: ${caixaStats.margem.toFixed(1)}%`,
                      `Descontos: ${BRL.format(caixaStats.totalDesconto)}`,
                      ``, `PAGAMENTOS:`,
                      ...Object.entries(caixaStats.byPayment).map(([m, v]) => `  ${m}: ${BRL.format(v)}`),
                      ``, `TOP PRODUTOS:`,
                      ...caixaStats.topToday.map((p, i) => `  ${i+1}. ${p.name} — ${p.qty} un.`),
                      ``, `🙏 DEUS É BOM O TEMPO TODO`,
                    ]
                    w.document.write(`<pre style="font-family:monospace;font-size:12px;padding:12px">${lines.join('\n')}</pre>`)
                    w.document.close(); w.print(); w.close()
                  }}
                  className="flex-1 py-3 bg-gray-900 hover:bg-gray-800 text-white font-black rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Printer className="w-4 h-4" /> Imprimir
                </button>

                {/* WhatsApp report */}
                <button
                  onClick={() => {
                    const d = caixaStats.date.toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long' })
                    const payLines = Object.entries(caixaStats.byPayment)
                      .map(([m, v]) => `  • ${m}: ${BRL.format(v)}`).join('\n')
                    const topLines = caixaStats.topToday.slice(0, 5)
                      .map((p, i) => `  ${i+1}. ${p.name} — ${p.qty} un. · ${BRL.format(p.revenue)}`).join('\n')
                    const msg = [
                      `📊 *FECHAMENTO DE CAIXA*`,
                      `_${d}_`,
                      ``,
                      `💰 Faturamento: *${BRL.format(caixaStats.faturamento)}*`,
                      `🛒 Vendas: *${caixaStats.totalVendas}*`,
                      `🎫 Ticket médio: *${BRL.format(caixaStats.avgTicket)}*`,
                      `📈 Margem est.: *${caixaStats.margem.toFixed(1)}%*`,
                      caixaStats.totalDesconto > 0 ? `🏷️ Descontos: *${BRL.format(caixaStats.totalDesconto)}*` : '',
                      ``,
                      `💳 *Pagamentos:*`,
                      payLines,
                      caixaStats.topToday.length > 0 ? `\n🏆 *Mais vendidos:*\n${topLines}` : '',
                      ``,
                      `🙏 _Deus é bom o tempo todo!_`,
                    ].filter(Boolean).join('\n')
                    const phone = '5515996604075'
                    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
                  }}
                  className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white font-black rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <MessageCircle className="w-4 h-4" /> WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


