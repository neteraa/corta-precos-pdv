import React, { useMemo, useState, useCallback } from 'react'
import { AlertTriangle, CheckCircle, Clock, Search, Calendar, QrCode, Tag, Settings, Zap } from 'lucide-react'
import { useStore, BRL } from '../store.jsx'

function daysUntil(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr + 'T00:00:00') - new Date()) / 86400000)
}

function statusOf(days, warnDays) {
  if (days === null) return 'none'
  if (days < 0)      return 'expired'
  if (days <= 7)     return 'critical'
  if (days <= warnDays) return 'warning'
  return 'ok'
}

const STATUS_CFG = (warnDays) => ({
  expired:  { label: 'Vencido',             bg: 'bg-red-50',    border: 'border-red-300',    text: 'text-red-600',    icon: AlertTriangle, iconColor: 'text-red-500'   },
  critical: { label: 'Crítico (≤7 dias)',   bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-600', icon: AlertTriangle, iconColor: 'text-orange-500' },
  warning:  { label: `Alerta (≤${warnDays}d)`, bg: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-700', icon: Clock, iconColor: 'text-yellow-500' },
  ok:       { label: 'OK',                  bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700',  icon: CheckCircle, iconColor: 'text-green-500'  },
})

export default function Validade() {
  const { products, upsertProduct, upsertPromo, assignPromoGroup, expiryAlertDays, setExpiryAlertDays } = useStore()
  const warnDays = expiryAlertDays || 30

  const [query,      setQuery]      = useState('')
  const [filter,     setFilter]     = useState('alert')   // alert | expired | critical | warning | ok | none | all
  const [showConfig, setShowConfig] = useState(false)
  const [daysInput,  setDaysInput]  = useState(String(warnDays))
  const [promoModal, setPromoModal] = useState(null)      // { product }
  const [promoDisc,  setPromoDisc]  = useState('20')      // % discount
  const [promoQty,   setPromoQty]   = useState('1')
  const [promoToast, setPromoToast] = useState(null)

  const cfgMap = useMemo(() => STATUS_CFG(warnDays), [warnDays])

  const allWithExpiry = useMemo(() =>
    products
      .map(p => { const d = daysUntil(p.expiryDate); return { ...p, days: d, status: statusOf(d, warnDays) } })
      .filter(p => p.expiryDate)
      .sort((a, b) => (a.days ?? 99999) - (b.days ?? 99999))
  , [products, warnDays])

  const counts = useMemo(() => {
    const c = { expired: 0, critical: 0, warning: 0, ok: 0, none: 0, alert: 0 }
    products.forEach(p => {
      const d = daysUntil(p.expiryDate)
      const s = statusOf(d, warnDays)
      if (s === 'none') { c.none++; return }
      c[s]++
      if (s === 'expired' || s === 'critical' || s === 'warning') c.alert++
    })
    return c
  }, [products, warnDays])

  const visible = useMemo(() => {
    let list =
      filter === 'all'     ? allWithExpiry :
      filter === 'alert'   ? allWithExpiry.filter(p => p.status === 'expired' || p.status === 'critical' || p.status === 'warning') :
      filter === 'none'    ? products.filter(p => !p.expiryDate).map(p => ({ ...p, days: null, status: 'none' })) :
                             allWithExpiry.filter(p => p.status === filter)
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(p => p.name?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q))
    }
    return list
  }, [allWithExpiry, products, filter, query])

  const updateExpiry = useCallback((id, date) => upsertProduct({ id, expiryDate: date || null }), [upsertProduct])

  const gerarPromocao = useCallback(() => {
    if (!promoModal) return
    const { product } = promoModal
    const disc   = Math.max(1, Math.min(90, parseFloat(promoDisc) || 20)) / 100
    const qty    = Math.max(1, parseInt(promoQty) || 1)
    const total  = parseFloat((product.price * qty * (1 - disc)).toFixed(2))
    const group  = `VENC_${product.id}_${Date.now()}`
    const label  = qty === 1
      ? `${product.name} — ${Math.round(disc*100)}% OFF (vence em breve)`
      : `${qty}× ${product.name} — ${Math.round(disc*100)}% OFF (vence em breve)`
    upsertPromo({ id: `pr_venc_${Date.now()}`, name: label, group, qty, totalPrice: total, active: true })
    assignPromoGroup(product.id, group)
    setPromoModal(null)
    setPromoToast(`✅ Promoção criada: ${label}`)
    setTimeout(() => setPromoToast(null), 4000)
  }, [promoModal, promoDisc, promoQty, upsertPromo, assignPromoGroup])

  return (
    <div className="space-y-5 animate-pop">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Controle de Validade</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {counts.expired  > 0 && <span className="text-red-600 font-bold">{counts.expired} vencido(s)! · </span>}
            {counts.critical > 0 && <span className="text-orange-600 font-bold">{counts.critical} crítico(s) ≤7d · </span>}
            Alerta ativo: <strong className="text-gray-700">{warnDays} dias</strong> antes do vencimento
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => { setShowConfig(v => !v); setDaysInput(String(warnDays)) }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-300 text-gray-600 hover:bg-gray-50 font-bold text-sm transition-colors">
            <Settings className="w-4 h-4" /> Configurar alerta
          </button>
          <a href="/scan?mode=estoque" target="_blank" rel="noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-black font-black text-sm transition-colors">
            <QrCode className="w-4 h-4" /> Escanear no celular
          </a>
        </div>
      </div>

      {/* ── Alert threshold config panel ───────────────────── */}
      {showConfig && (
        <div className="card p-4 border-2 border-orange-200 bg-orange-50 space-y-3">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-orange-600" />
            <h3 className="font-black text-gray-800 text-sm">Configurar alerta de vencimento</h3>
          </div>
          <p className="text-xs text-gray-600">
            Produtos que vencem em até <strong>{daysInput} dias</strong> aparecerão como alerta e poderão gerar promoção automática.
          </p>
          <div className="flex items-center gap-3">
            <input type="range" min="1" max="120" step="1"
              value={daysInput} onChange={e => setDaysInput(e.target.value)}
              className="flex-1 accent-orange-500" />
            <div className="flex items-center gap-1.5">
              <input type="number" min="1" max="365" value={daysInput}
                onChange={e => setDaysInput(e.target.value)}
                className="w-16 text-center font-black text-sm border border-gray-300 rounded-lg py-1.5 px-2 focus:outline-none focus:ring-2 focus:ring-orange-400" />
              <span className="text-sm text-gray-500 font-semibold">dias</span>
            </div>
            <button onClick={() => { setExpiryAlertDays(parseInt(daysInput)||30); setShowConfig(false) }}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-black font-black text-sm rounded-xl transition-colors">
              Salvar
            </button>
          </div>
          {/* Presets */}
          <div className="flex flex-wrap gap-2">
            {[7,15,30,45,60,90].map(d => (
              <button key={d} onClick={() => { setDaysInput(String(d)); setExpiryAlertDays(d); setShowConfig(false) }}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${parseInt(daysInput)===d ? 'bg-orange-500 text-black' : 'bg-white border border-gray-300 text-gray-600 hover:border-orange-300 hover:text-orange-600'}`}>
                {d} dias
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Alert summary banner ────────────────────────────── */}
      {counts.alert > 0 && (
        <div className={`rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 ${
          counts.expired > 0 ? 'bg-red-600' : counts.critical > 0 ? 'bg-orange-500' : 'bg-yellow-400'
        }`}>
          <div className="flex-1">
            <div className={`font-black text-lg ${counts.expired > 0 ? 'text-white' : 'text-gray-900'}`}>
              ⚠️ {counts.alert} produto{counts.alert > 1 ? 's' : ''} precisam de atenção!
            </div>
            <div className={`text-sm mt-0.5 ${counts.expired > 0 ? 'text-red-100' : 'text-gray-800'}`}>
              {counts.expired > 0 && `${counts.expired} vencido(s) · `}
              {counts.critical > 0 && `${counts.critical} crítico(s) ≤7 dias · `}
              {counts.warning > 0 && `${counts.warning} próximo(s) do vencimento`}
            </div>
          </div>
          <button onClick={() => setFilter('alert')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white font-black text-sm transition-colors whitespace-nowrap backdrop-blur-sm">
            <Zap className="w-4 h-4" /> Ver todos + Gerar Promoções
          </button>
        </div>
      )}

      {/* ── Filters ─────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'alert',   label: `🚨 Alertas (${counts.alert})`,   bold: true },
          { key: 'expired', label: `💀 Vencidos (${counts.expired})` },
          { key: 'critical',label: `🔴 ≤7 dias (${counts.critical})` },
          { key: 'warning', label: `⚠️ ≤${warnDays}d (${counts.warning})` },
          { key: 'ok',      label: `✅ OK (${counts.ok})` },
          { key: 'all',     label: `📋 Todos c/ data (${allWithExpiry.length})` },
          { key: 'none',    label: `❓ Sem data (${counts.none})` },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              filter === f.key
                ? f.key === 'alert'    ? 'bg-red-500 text-white ring-2 ring-offset-1 ring-red-400'
                : f.key === 'expired'  ? 'bg-red-600 text-white ring-2 ring-offset-1 ring-red-500'
                : f.key === 'critical' ? 'bg-orange-500 text-white ring-2 ring-offset-1 ring-orange-400'
                : f.key === 'warning'  ? 'bg-yellow-400 text-gray-900 ring-2 ring-offset-1 ring-yellow-300'
                : f.key === 'ok'       ? 'bg-green-500 text-white ring-2 ring-offset-1 ring-green-400'
                : 'bg-gray-700 text-white ring-2 ring-offset-1 ring-gray-500'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Search ──────────────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Buscar produto ou categoria…" className="input pl-9" />
      </div>

      {/* ── List ────────────────────────────────────────────── */}
      <div className="space-y-2">
        {visible.length === 0 && (
          <div className="card p-8 text-center text-gray-400">
            <Calendar className="w-10 h-10 mx-auto opacity-30 mb-2" />
            <p className="text-sm font-semibold">
              {filter === 'none' ? 'Todos os produtos já têm data cadastrada! 🎉' : 'Nenhum produto nesta categoria'}
            </p>
            {filter === 'alert' && counts.ok > 0 && (
              <p className="text-xs mt-1 text-green-600">✅ Ótimo! Todos os produtos com data estão dentro do prazo.</p>
            )}
          </div>
        )}
        {visible.map(p => {
          const cfg  = cfgMap[p.status] || cfgMap.ok
          const Icon = cfg.icon
          const showPromoBtn = p.status === 'expired' || p.status === 'critical' || p.status === 'warning'
          return (
            <div key={p.id} className={`${cfg.bg} ${cfg.border} border rounded-xl p-3 space-y-2`}>
              {/* top row */}
              <div className="flex items-center gap-2">
                <Icon className={`w-5 h-5 flex-shrink-0 ${cfg.iconColor}`} />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-gray-800 text-sm leading-tight truncate">{p.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{p.category} · <strong>{BRL.format(p.price||0)}</strong> · {p.stock??0} un.</div>
                </div>
                {p.days !== null && (
                  <div className="flex-shrink-0 text-right">
                    <div className={`text-sm font-black ${cfg.text}`}>
                      {p.days < 0 ? `${Math.abs(p.days)}d atrás` : p.days === 0 ? 'Hoje!' : `${p.days}d`}
                    </div>
                    <div className="text-xs text-gray-400">{new Date(p.expiryDate+'T00:00').toLocaleDateString('pt-BR')}</div>
                  </div>
                )}
              </div>
              {/* date input */}
              <input type="date" value={p.expiryDate||''}
                onChange={e => updateExpiry(p.id, e.target.value)}
                className="input w-full py-2 text-sm" />
              {/* gerar promoção */}
              {showPromoBtn && (
                <button onClick={() => { setPromoModal({ product: p }); setPromoDisc('20'); setPromoQty('1') }}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-black font-black text-xs transition-colors">
                  <Tag className="w-3.5 h-3.5" />
                  Gerar Promoção — Não perca este produto!
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Gerar Promoção modal ────────────────────────────── */}
      {promoModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-pop overflow-hidden">
            {/* header */}
            <div className="bg-orange-500 px-5 py-4">
              <div className="font-black text-gray-900 text-lg flex items-center gap-2">
                <Zap className="w-5 h-5" /> Gerar Promoção Antivencimento
              </div>
              <div className="text-sm text-gray-800 mt-1 font-semibold truncate">{promoModal.product.name}</div>
              <div className="text-xs text-gray-700 mt-0.5">
                Preço atual: <strong>{BRL.format(promoModal.product.price)}</strong> ·
                Vence em <strong className="text-red-800">
                  {promoModal.product.days < 0 ? `${Math.abs(promoModal.product.days)}d atrás` :
                   promoModal.product.days === 0 ? 'hoje' : `${promoModal.product.days} dias`}
                </strong>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* discount % */}
              <div>
                <label className="label">Desconto (%)</label>
                <div className="flex items-center gap-3">
                  <input type="range" min="5" max="80" step="5"
                    value={promoDisc} onChange={e => setPromoDisc(e.target.value)}
                    className="flex-1 accent-orange-500" />
                  <input type="number" min="1" max="90" value={promoDisc}
                    onChange={e => setPromoDisc(e.target.value)}
                    className="w-16 text-center font-black border border-gray-300 rounded-lg py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  <span className="font-bold text-gray-500">%</span>
                </div>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {[10,15,20,25,30,50].map(d => (
                    <button key={d} onClick={() => setPromoDisc(String(d))}
                      className={`px-3 py-1 rounded-full text-xs font-bold ${parseInt(promoDisc)===d ? 'bg-orange-500 text-black' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {d}% off
                    </button>
                  ))}
                </div>
              </div>

              {/* qty */}
              <div>
                <label className="label">Quantidade na promoção (ex: "3 por R$X")</label>
                <div className="flex gap-2">
                  {[1,2,3,4,5].map(q => (
                    <button key={q} onClick={() => setPromoQty(String(q))}
                      className={`flex-1 py-2 rounded-lg text-sm font-black ${parseInt(promoQty)===q ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* preview */}
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
                <div className="text-xs text-gray-500 font-semibold mb-1">Prévia da promoção</div>
                <div className="font-black text-gray-900 text-base">
                  {parseInt(promoQty) > 1
                    ? `${promoQty}× ${promoModal.product.name} por ${BRL.format(parseFloat((promoModal.product.price * parseInt(promoQty) * (1 - parseFloat(promoDisc)/100)).toFixed(2)))}`
                    : `${promoModal.product.name} por ${BRL.format(parseFloat((promoModal.product.price * (1 - parseFloat(promoDisc)/100)).toFixed(2)))}`
                  }
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Preço normal: {BRL.format(promoModal.product.price)} ·
                  Economia: {BRL.format(parseFloat((promoModal.product.price * parseInt(promoQty) * parseFloat(promoDisc)/100).toFixed(2)))}
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setPromoModal(null)} className="btn-ghost flex-1 justify-center">Cancelar</button>
                <button onClick={gerarPromocao} className="btn-primary flex-1 justify-center">
                  <Tag className="w-4 h-4" /> Criar Promoção
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ────────────────────────────────────────────── */}
      {promoToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-bold px-5 py-3 rounded-2xl shadow-xl animate-pop">
          {promoToast}
        </div>
      )}
    </div>
  )
}
