import React, { useState, useMemo } from 'react'
import { Search, ChevronDown, ChevronRight, Printer, HandCoins, Plus, X } from 'lucide-react'
import { useStore, BRL, fmtDate } from '../store.jsx'
import { usePrinter } from '../hooks/usePrinter.js'

function payBadge(payment = '') {
  if (payment.startsWith('Fiado'))   return 'bg-red-100 text-red-700'
  if (payment === 'PIX')             return 'bg-orange-100 text-orange-700'
  if (payment === 'Crédito')         return 'bg-blue-100 text-blue-700'
  if (payment === 'Débito')          return 'bg-indigo-100 text-indigo-700'
  if (payment === 'Dinheiro')        return 'bg-green-100 text-green-700'
  return 'bg-gray-100 text-gray-600'
}

const PAYMENTS = ['PIX', 'Débito', 'Crédito', 'Dinheiro', 'Fiado']
const PAY_BADGE_MAP = { PIX: 'bg-orange-100 text-orange-700', Débito: 'bg-indigo-100 text-indigo-700', Crédito: 'bg-blue-100 text-blue-700', Dinheiro: 'bg-green-100 text-green-700', Fiado: 'bg-red-100 text-red-700' }

function nowLocal() {
  const d = new Date(); const pad = n => String(n).padStart(2,'0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function Vendas() {
  const { sales, registerSale } = useStore()
  const printer = usePrinter()
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(null)

  // ── Manual sale entry ────────────────────────────────────
  const [showModal, setShowModal]   = useState(false)
  const [mTotal,    setMTotal]      = useState('')
  const [mPay,      setMPay]        = useState('PIX')
  const [mTime,     setMTime]       = useState(nowLocal)
  const [mObs,      setMObs]        = useState('')
  const [mQty,      setMQty]        = useState('1')

  const openModal = () => { setMTotal(''); setMPay('PIX'); setMTime(nowLocal()); setMObs(''); setMQty('1'); setShowModal(true) }

  const saveSale = () => {
    const total = parseFloat(mTotal.replace(',', '.'))
    if (!total || total <= 0) return
    const date = mTime ? new Date(mTime).toISOString() : new Date().toISOString()
    const qty  = parseInt(mQty) || 1
    registerSale({
      items:   [{ productId: 'manual', name: mObs || 'Venda avulsa', price: total / qty, qty }],
      subtotal: total, discount: 0, promoDiscount: 0,
      total, payment: mPay, troco: 0, date, manual: true,
    })
    setShowModal(false)
  }

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return [...sales]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .filter(s =>
        !query ||
        s.payment?.toLowerCase().includes(q) ||
        fmtDate(s.date).includes(q) ||
        s.items?.some(i => i.name?.toLowerCase().includes(q))
      )
  }, [sales, query])

  const totalRevenue = filtered.reduce((a, s) => a + s.total, 0)

  // KPI totals per method from ALL sales today
  const today = new Date().toDateString()
  const todaySales = useMemo(() => sales.filter(s => new Date(s.date).toDateString() === today), [sales])
  const kpis = useMemo(() => {
    const methods = ['PIX', 'Crédito', 'Débito', 'Dinheiro']
    return methods.map(m => ({
      label: m,
      total: todaySales.filter(s => s.payment === m).reduce((a, s) => a + s.total, 0),
      count: todaySales.filter(s => s.payment === m).length,
    })).filter(k => k.count > 0)
  }, [todaySales])

  const fiadoHoje = useMemo(() =>
    todaySales.filter(s => s.payment?.startsWith('Fiado')).reduce((a, s) => a + s.total, 0),
    [todaySales])

  return (
    <div className="space-y-4 animate-pop">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Vendas</h1>
          <p className="text-gray-500 text-sm">{filtered.length} vendas · {BRL.format(totalRevenue)}</p>
        </div>
        <button onClick={openModal} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Lançar venda
        </button>
      </div>

      {/* KPI por método hoje */}
      {(kpis.length > 0 || fiadoHoje > 0) && (
        <div className="flex flex-wrap gap-2">
          {kpis.map(k => (
            <div key={k.label} className={`px-3 py-2 rounded-xl border text-sm font-semibold ${payBadge(k.label)}`}>
              {k.label} · <span className="font-black">{BRL.format(k.total)}</span>
              <span className="text-[10px] opacity-60 ml-1">({k.count}x)</span>
            </div>
          ))}
          {fiadoHoje > 0 && (
            <div className="px-3 py-2 rounded-xl border text-sm font-semibold bg-red-100 text-red-700 flex items-center gap-1.5">
              <HandCoins className="w-3.5 h-3.5" />
              Fiado · <span className="font-black">{BRL.format(fiadoHoje)}</span>
            </div>
          )}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Buscar por produto, data ou forma de pagamento..."
          className="input pl-9" />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['#', 'Data / Hora', 'Itens', 'Pagamento', 'Desconto', 'Total', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((s, idx) => (
                <React.Fragment key={s.id}>
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">#{filtered.length - idx}</td>
                    <td className="px-4 py-3 text-gray-700">
                      <div className="font-semibold">{fmtDate(s.date)}</div>
                      <div className="text-xs text-gray-400">{new Date(s.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{s.items?.reduce((a, i) => a + i.qty, 0) ?? 0} un.</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap inline-flex items-center gap-1 ${payBadge(s.payment)}`}>
                        {s.payment?.startsWith('Fiado') && <HandCoins className="w-3 h-3" />}
                        {s.payment?.startsWith('Fiado') ? s.payment.replace('Fiado — ', '💳 ') : s.payment}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-green-600 text-xs font-semibold">
                      {(s.discount || 0) + (s.promoDiscount || 0) > 0
                        ? `- ${BRL.format((s.discount || 0) + (s.promoDiscount || 0))}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 font-black text-brand-600 text-base">{BRL.format(s.total)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => printer.printReceipt(s)}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                          title="Reimprimir">
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                          {expanded === s.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expanded === s.id && s.items?.length > 0 && (
                    <tr>
                      <td colSpan={7} className="px-8 py-3 bg-gray-50">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-400">
                              <th className="text-left pb-1">Produto</th>
                              <th className="text-right pb-1">Qtd</th>
                              <th className="text-right pb-1">Preço un.</th>
                              <th className="text-right pb-1">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {s.items.map((it, j) => (
                              <tr key={j} className="border-t border-gray-200">
                                <td className="py-1.5 text-gray-700 font-medium">{it.name}</td>
                                <td className="py-1.5 text-right text-gray-600">{it.qty}</td>
                                <td className="py-1.5 text-right text-gray-600">{BRL.format(it.price)}</td>
                                <td className="py-1.5 text-right font-bold text-gray-800">{BRL.format(it.price * it.qty)}</td>
                              </tr>
                            ))}
                            <tr className="border-t-2 border-gray-300">
                              <td colSpan={3} className="pt-2 text-right font-black text-gray-700">TOTAL</td>
                              <td className="pt-2 text-right font-black text-brand-600">{BRL.format(s.total)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">Nenhuma venda encontrada</div>
          )}
        </div>
      </div>

      {/* ── Modal: lançar venda avulsa ─────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-md animate-pop">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-black text-gray-900">Lançar venda</h2>
                <p className="text-xs text-gray-400 mt-0.5">Para vendas que já foram feitas hoje sem passar pelo terminal</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><X className="w-5 h-5" /></button>
            </div>

            {/* Total */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Total da venda (R$) *</label>
              <input
                autoFocus type="text" inputMode="decimal"
                value={mTotal} onChange={e => setMTotal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveSale()}
                placeholder="0,00"
                className="input text-2xl font-black text-brand-600"
              />
            </div>

            {/* Pagamento */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Forma de pagamento</label>
              <div className="flex flex-wrap gap-2">
                {PAYMENTS.map(p => (
                  <button key={p} onClick={() => setMPay(p)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-all ${mPay === p ? PAY_BADGE_MAP[p] + ' border-current ring-2 ring-offset-1 ring-current' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Horário + Qtd */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Data / Hora</label>
                <input type="datetime-local" value={mTime} onChange={e => setMTime(e.target.value)} className="input text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Nº de itens</label>
                <input type="number" min="1" value={mQty} onChange={e => setMQty(e.target.value)} placeholder="1" className="input text-sm" />
              </div>
            </div>

            {/* Observação */}
            <div className="mb-5">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Descrição (opcional)</label>
              <input type="text" value={mObs} onChange={e => setMObs(e.target.value)}
                placeholder="Ex: Cesta básica, Bebidas, Cliente João…"
                className="input text-sm" />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowModal(false)} className="btn-ghost flex-1">Cancelar</button>
              <button
                onClick={saveSale}
                disabled={!mTotal}
                className={`flex-1 btn-primary ${!mTotal ? 'opacity-40 cursor-not-allowed' : ''}`}>
                Registrar venda
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
