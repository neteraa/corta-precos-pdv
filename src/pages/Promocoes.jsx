import React, { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, Search, ToggleLeft, ToggleRight, Tag, X, ChevronDown, ChevronUp } from 'lucide-react'
import { useStore, BRL } from '../store.jsx'

const EMPTY_RULE = { name: '', group: '', qty: 4, totalPrice: 0, active: true }

/* slugify: "4 Danones por R$10" → "DANONE_4x10" */
const slugify = (s) => s.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '')

export default function Promocoes() {
  const { products, promos, upsertPromo, deletePromo, assignPromoGroup } = useStore()

  const [editing, setEditing]         = useState(null)        // promo rule being created/edited
  const [expanded, setExpanded]       = useState(null)        // promo id showing product list
  const [productSearch, setProductSearch] = useState('')      // search inside assign panel
  const [confirmDel, setConfirmDel]   = useState(null)        // id to confirm delete

  /* ── stats per promo group ─────────────────────────────── */
  const promoStats = useMemo(() => {
    return promos.map(rule => ({
      ...rule,
      productCount: products.filter(p => p.promoGroup === rule.group).length,
    }))
  }, [promos, products])

  /* ── products shown inside the assign panel ─────────────── */
  const assignCandidates = useMemo(() => {
    if (!expanded) return []
    const rule = promos.find(r => r.id === expanded)
    if (!rule) return []
    const q = productSearch.trim().toLowerCase()
    return products
      .filter(p => !q || p.name?.toLowerCase().includes(q) || p.sku?.includes(q))
      .sort((a, b) => {
        // products already in this group come first
        const aIn = a.promoGroup === rule.group
        const bIn = b.promoGroup === rule.group
        if (aIn !== bIn) return aIn ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      .slice(0, 80)
  }, [expanded, products, promos, productSearch])

  const activeRule = promos.find(r => r.id === expanded)

  /* ── save rule ──────────────────────────────────────────── */
  const save = () => {
    if (!editing.name.trim() || !editing.group.trim() || editing.qty < 2 || editing.totalPrice <= 0) return
    upsertPromo(editing)
    setEditing(null)
  }

  /* ── auto-fill group from name ──────────────────────────── */
  const handleNameChange = (name) => {
    setEditing(prev => ({
      ...prev,
      name,
      group: prev.id ? prev.group : slugify(name), // only auto-fill for new rules
    }))
  }

  return (
    <div className="space-y-5 animate-pop">

      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Promoções Mix-and-Match</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Crie regras como "4 Danones quaisquer por R$10" — o sistema desconta e controla o estoque por variante.
          </p>
        </div>
        <button onClick={() => setEditing({ ...EMPTY_RULE })} className="btn-primary gap-2">
          <Plus className="w-4 h-4" /> Nova Promoção
        </button>
      </div>

      {/* explanation banner */}
      <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 text-sm text-brand-900 space-y-1">
        <p className="font-black">Como funciona:</p>
        <ol className="list-decimal list-inside space-y-1 text-brand-800 text-xs">
          <li>Crie uma regra aqui (ex: "4 unidades do grupo DANONE_4x10 = R$10")</li>
          <li>Atribua produtos ao grupo — clique em <strong>Ver produtos</strong> e marque os Danones</li>
          <li>No PDV, ao escanear 4 Danones quaisquer, o desconto entra automaticamente</li>
          <li>O estoque de cada sabor (Coco, Morango, Nata...) é descontado individualmente</li>
        </ol>
      </div>

      {/* rules list */}
      {promoStats.length === 0 ? (
        <div className="card py-16 text-center text-gray-400 text-sm">
          Nenhuma promoção cadastrada. Clique em "Nova Promoção" para começar.
        </div>
      ) : (
        <div className="space-y-3">
          {promoStats.map(rule => (
            <div key={rule.id} className={`card overflow-hidden border-l-4 ${rule.active ? 'border-l-green-500' : 'border-l-gray-300'}`}>

              {/* rule header row */}
              <div className="flex flex-wrap items-center gap-3 p-4">
                {/* toggle active */}
                <button
                  onClick={() => upsertPromo({ ...rule, active: !rule.active })}
                  title={rule.active ? 'Desativar' : 'Ativar'}
                  className={`flex-shrink-0 ${rule.active ? 'text-green-500' : 'text-gray-300'}`}
                >
                  {rule.active
                    ? <ToggleRight className="w-7 h-7" />
                    : <ToggleLeft  className="w-7 h-7" />}
                </button>

                {/* info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-gray-900">{rule.name}</span>
                    {!rule.active && (
                      <span className="text-[10px] font-bold bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">INATIVA</span>
                    )}
                    {rule.active && (
                      <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">ATIVA</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                    <span>
                      <span className="font-semibold text-gray-700">{rule.qty} unidades</span> por{' '}
                      <span className="font-semibold text-brand-600">{BRL.format(rule.totalPrice)}</span>
                    </span>
                    <span>Grupo: <code className="bg-gray-100 px-1 rounded text-gray-600">{rule.group}</code></span>
                    <span className={`font-semibold ${rule.productCount === 0 ? 'text-red-500' : 'text-green-600'}`}>
                      {rule.productCount === 0
                        ? '⚠️ Nenhum produto atribuído'
                        : `${rule.productCount} produto${rule.productCount !== 1 ? 's' : ''}`}
                    </span>
                    <span className="text-gray-400">
                      Preço/un na promo: <strong className="text-gray-600">{BRL.format(rule.totalPrice / rule.qty)}</strong>
                    </span>
                  </div>
                </div>

                {/* actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => { setExpanded(expanded === rule.id ? null : rule.id); setProductSearch('') }}
                    className={`btn-ghost text-xs gap-1 ${expanded === rule.id ? '!bg-brand-50 !border-brand-300 !text-brand-700' : ''}`}
                  >
                    <Tag className="w-3.5 h-3.5" />
                    {expanded === rule.id ? 'Fechar' : 'Ver produtos'}
                    {expanded === rule.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  <button onClick={() => setEditing({ ...rule })} className="btn-ghost text-xs gap-1">
                    <Pencil className="w-3.5 h-3.5" /> Editar
                  </button>
                  <button onClick={() => setConfirmDel(rule.id)} className="btn-ghost text-xs gap-1 !text-red-500 hover:!bg-red-50 hover:!border-red-300">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* product assignment panel */}
              {expanded === rule.id && (
                <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <p className="text-xs font-semibold text-gray-600">
                      Marque os produtos que participam desta promoção:
                    </p>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input
                        value={productSearch}
                        onChange={e => setProductSearch(e.target.value)}
                        placeholder="Buscar produto..."
                        className="input pl-8 py-1.5 text-xs w-56"
                      />
                    </div>
                  </div>

                  <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
                    {assignCandidates.map(p => {
                      const inGroup = p.promoGroup === activeRule?.group
                      return (
                        <label
                          key={p.id}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                            inGroup ? 'bg-green-50 border border-green-200' : 'bg-white border border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={inGroup}
                            onChange={() => assignPromoGroup(p.id, inGroup ? null : activeRule.group)}
                            className="accent-green-500 w-4 h-4 flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-gray-800 truncate">{p.name}</div>
                            <div className="text-[10px] text-gray-400 font-mono">{p.sku} · {p.category} · {BRL.format(p.price)}</div>
                          </div>
                          {inGroup && (
                            <span className="text-[10px] font-black text-green-700 bg-green-100 px-1.5 py-0.5 rounded flex-shrink-0">
                              NA PROMO
                            </span>
                          )}
                        </label>
                      )
                    })}
                    {assignCandidates.length === 0 && (
                      <div className="text-center py-8 text-gray-400 text-xs">Nenhum produto encontrado</div>
                    )}
                  </div>

                  <div className="text-[11px] text-gray-400 pt-1 border-t border-gray-200">
                    {products.filter(p => p.promoGroup === activeRule?.group).length} produto(s) nesta promoção · mostrando {assignCandidates.length} resultados
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* create / edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="card p-6 w-full max-w-md animate-pop space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-black text-gray-900 text-lg">
                {editing.id ? 'Editar Promoção' : 'Nova Promoção'}
              </h2>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="label">Nome da promoção *</label>
                <input
                  autoFocus
                  value={editing.name}
                  onChange={e => handleNameChange(e.target.value)}
                  placeholder="ex: 4 Danones por R$10"
                  className="input"
                />
              </div>

              <div>
                <label className="label">
                  Código do grupo *
                  <span className="font-normal text-gray-400 ml-1">(identificador único, letras e números)</span>
                </label>
                <input
                  value={editing.group}
                  onChange={e => setEditing(p => ({ ...p, group: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g,'') }))}
                  placeholder="ex: DANONE_4x10"
                  className="input font-mono"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Este código é colocado nos produtos para agrupá-los. Não pode ter espaços.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Qtd. mínima para ativar *</label>
                  <input
                    type="number" min="2" max="50"
                    value={editing.qty}
                    onChange={e => setEditing(p => ({ ...p, qty: Math.max(2, Number(e.target.value)) }))}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Preço total do grupo *</label>
                  <input
                    type="number" min="0.01" step="0.01"
                    value={editing.totalPrice}
                    onChange={e => setEditing(p => ({ ...p, totalPrice: Number(e.target.value) }))}
                    placeholder="ex: 10.00"
                    className="input"
                  />
                </div>
              </div>

              {editing.qty >= 2 && editing.totalPrice > 0 && (
                <div className="bg-brand-50 border border-brand-200 rounded-xl p-3 text-xs text-brand-800 space-y-0.5">
                  <div className="font-black">Resumo da promoção:</div>
                  <div>"{editing.qty} unidades do grupo <code className="bg-white px-1 rounded">{editing.group || '...'}</code> por {BRL.format(editing.totalPrice)}"</div>
                  <div className="text-brand-600">Preço por unidade na promo: {BRL.format(editing.totalPrice / editing.qty)}</div>
                </div>
              )}

              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setEditing(p => ({ ...p, active: !p.active }))}
                  className={`w-10 h-6 rounded-full transition-colors ${editing.active ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full mt-1 transition-all shadow ${editing.active ? 'ml-5' : 'ml-1'}`} />
                </div>
                <span className="text-sm text-gray-700 font-semibold">
                  {editing.active ? 'Promoção ativa' : 'Promoção inativa'}
                </span>
              </label>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditing(null)} className="btn-ghost flex-1 justify-center">Cancelar</button>
              <button
                onClick={save}
                disabled={!editing.name.trim() || !editing.group.trim() || editing.qty < 2 || editing.totalPrice <= 0}
                className="btn-primary flex-1 justify-center disabled:opacity-40"
              >
                {editing.id ? 'Salvar alterações' : 'Criar promoção'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* delete confirm */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="card p-6 w-full max-w-xs animate-pop text-center space-y-4">
            <div className="text-3xl">🗑️</div>
            <p className="font-black text-gray-900">Excluir esta promoção?</p>
            <p className="text-xs text-gray-500">Os produtos continuarão cadastrados, mas perderão o grupo de promoção atribuído.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDel(null)} className="btn-ghost flex-1 justify-center">Cancelar</button>
              <button
                onClick={() => { deletePromo(confirmDel); setConfirmDel(null); if (expanded === confirmDel) setExpanded(null) }}
                className="flex-1 justify-center py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" /> Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
