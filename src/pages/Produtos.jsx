import React, { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, Search, X, Upload } from 'lucide-react'
import { useStore, BRL } from '../store.jsx'
import { parseGdoorCsv } from '../utils/importCsv.js'

const EMPTY = { sku: '', name: '', category: '', cost: '', price: '', stock: '', unit: 'UN' }
const CATEGORIES = ['Alimentos', 'Bebidas', 'Laticínios', 'Limpeza', 'Higiene', 'Outros']

export default function Produtos() {
  const { products, upsertProduct, deleteProduct, importProducts } = useStore()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null)
  const [importing, setImporting] = useState(false)

  const filtered = useMemo(() =>
    products.filter(p =>
      !query || p.name?.toLowerCase().includes(query.toLowerCase()) || p.sku?.includes(query)
    ), [products, query])

  const save = (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    upsertProduct({
      ...(editing.id ? { id: editing.id } : {}),
      sku: fd.get('sku'), name: fd.get('name'),
      category: fd.get('category'), unit: fd.get('unit'),
      cost: Number(fd.get('cost')), price: Number(fd.get('price')),
      stock: Number(fd.get('stock')),
    })
    setEditing(null)
  }

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const buf = await file.arrayBuffer()
      const list = parseGdoorCsv(buf)
      importProducts(list)
      alert(`✅ ${list.length} produtos importados com sucesso!`)
    } catch (err) {
      alert('Erro ao importar: ' + err.message)
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  const margin = (p) => p.price > 0 ? ((p.price - p.cost) / p.price * 100).toFixed(1) : '0.0'

  return (
    <div className="space-y-4 animate-pop">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Produtos</h1>
          <p className="text-gray-500 text-sm">{products.length} produtos cadastrados</p>
        </div>
        <div className="flex items-center gap-2">
          <label className={`btn-ghost cursor-pointer ${importing ? 'opacity-60 pointer-events-none' : ''}`}>
            <Upload className="w-4 h-4" />
            {importing ? 'Importando…' : 'Importar CSV (Gdoor)'}
            <input type="file" accept=".csv,.txt" className="hidden" onChange={handleImport} />
          </label>
          <button onClick={() => setEditing(EMPTY)} className="btn-primary">
            <Plus className="w-4 h-4" /> Novo produto
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar produto..." className="input pl-9" />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Código', 'Produto', 'Categoria', 'Custo', 'Preço', 'Margem', 'Estoque', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.sku}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-800">{p.name}</div>
                    <div className="text-xs text-gray-400">{p.unit}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block bg-brand-100 text-brand-700 text-xs font-semibold px-2 py-0.5 rounded-full">{p.category}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{BRL.format(p.cost)}</td>
                  <td className="px-4 py-3 font-bold text-gray-800">{BRL.format(p.price)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold ${parseFloat(margin(p)) > 20 ? 'text-green-600' : 'text-amber-500'}`}>
                      {margin(p)}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-bold ${p.stock === 0 ? 'text-red-600' : p.stock <= 5 ? 'text-amber-500' : 'text-gray-800'}`}>
                      {p.stock}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditing(p)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-brand-600">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { if (confirm(`Excluir ${p.name}?`)) deleteProduct(p.id) }} className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">Nenhum produto encontrado</div>
          )}
        </div>
      </div>

      {/* edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="card p-6 w-full max-w-lg mx-4 animate-pop">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black text-gray-900">{editing.id ? 'Editar' : 'Novo'} Produto</h2>
              <button onClick={() => setEditing(null)}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
            </div>
            <form onSubmit={save} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Código / Barras</label>
                  <input name="sku" defaultValue={editing.sku} className="input" />
                </div>
                <div>
                  <label className="label">Unidade</label>
                  <select name="unit" defaultValue={editing.unit} className="input">
                    {['UN', 'KG', 'LT', 'CX', 'PC', 'MT'].map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Descrição / Nome *</label>
                <input name="name" required defaultValue={editing.name} className="input" />
              </div>
              <div>
                <label className="label">Categoria</label>
                <select name="category" defaultValue={editing.category} className="input">
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Custo (R$)</label>
                  <input name="cost" type="number" step="0.01" min="0" required defaultValue={editing.cost} className="input" />
                </div>
                <div>
                  <label className="label">Preço Venda (R$)</label>
                  <input name="price" type="number" step="0.01" min="0" required defaultValue={editing.price} className="input" />
                </div>
                <div>
                  <label className="label">Estoque</label>
                  <input name="stock" type="number" min="0" required defaultValue={editing.stock} className="input" />
                </div>
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
