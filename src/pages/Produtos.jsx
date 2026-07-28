import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { Plus, Pencil, Trash2, Search, X, Upload, Camera, LayoutGrid, List, ImageOff,
         Sparkles, StopCircle, Globe, Loader2 } from 'lucide-react'
import { useStore, BRL } from '../store.jsx'
import { parseGdoorCsv } from '../utils/importCsv.js'
import { compressImage, savePhoto as dbSavePhoto } from '../utils/photoDb.js'
import { autoFetchPhotos, fetchProductPhoto, searchProductPhotos, urlToDataUrl } from '../utils/openFoodFacts.js'

const EMPTY = { sku: '', name: '', category: '', cost: '', price: '', stock: '', unit: 'UN', minStock: '', expiryDate: '' }
const UNITS = ['UN', 'KG', 'G', 'LT', 'ML', 'CX', 'PC', 'DZ', 'MT']

/* ── Stock badge ─────────────────────────────────────────── */
function StockBadge({ stock }) {
  if (stock === 0) return <span className="text-[10px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded-full">SEM ESTQ</span>
  if (stock <= 5)  return <span className="text-[10px] font-black bg-amber-400 text-white px-1.5 py-0.5 rounded-full">{stock} un</span>
  return               <span className="text-[10px] font-bold bg-green-500 text-white px-1.5 py-0.5 rounded-full">{stock} un</span>
}

/* ── Product card (grid view) ────────────────────────────── */
function ProductCard({ p, photo, onEdit, onDelete }) {
  const margin = p.price > 0 ? ((p.price - p.cost) / p.price * 100).toFixed(0) : '0'
  return (
    <div className="card overflow-hidden flex flex-col hover:shadow-md transition-shadow group">
      {/* Photo */}
      <div className="relative bg-gray-100" style={{ aspectRatio: '1/1' }}>
        {photo
          ? <img src={photo} alt={p.name} className="w-full h-full object-cover" />
          : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-gray-300">
              <ImageOff className="w-8 h-8" />
              <span className="text-[10px]">sem foto</span>
            </div>
          )
        }
        <div className="absolute top-2 left-2"><StockBadge stock={p.stock} /></div>
        {p.promo && (
          <div className="absolute bottom-0 left-0 right-0 bg-orange-500/90 text-white text-[9px] font-bold text-center py-0.5 truncate px-1">
            {p.promo}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col flex-1">
        <div className="text-[10px] text-gray-400 font-mono truncate">{p.sku}</div>
        <div className="text-xs font-bold text-gray-800 leading-tight mt-0.5 line-clamp-2 flex-1">{p.name}</div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-base font-black text-orange-600">{BRL.format(p.price)}</span>
          <span className={`text-xs font-bold ${Number(margin) >= 20 ? 'text-green-600' : 'text-amber-500'}`}>{margin}%</span>
        </div>
        <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(p)} className="flex-1 btn-ghost text-xs py-1 gap-1">
            <Pencil className="w-3 h-3" /> Editar
          </button>
          <button onClick={() => onDelete(p)} className="btn-ghost text-xs py-1 px-2 text-red-400 hover:text-red-600 hover:bg-red-50">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Main component ──────────────────────────────────────── */
export default function Produtos() {
  const { products, upsertProduct, deleteProduct, importProducts, photos, saveProductPhoto } = useStore()

  const [query,     setQuery]     = useState('')
  const [editing,   setEditing]   = useState(null)
  const [viewMode,  setViewMode]  = useState('table') // 'table' | 'grid'
  const [importing, setImporting] = useState(false)

  // Photo state for form
  const [photoPreview,    setPhotoPreview]    = useState(null)
  const [photoData,       setPhotoData]       = useState(null)
  const [photoRemoved,    setPhotoRemoved]    = useState(false)
  const [photoSource,     setPhotoSource]     = useState(null) // 'camera' | 'off' | 'search'
  const photoInputRef = useRef(null)

  // Form barcode (controlled — triggers auto-fetch)
  const [skuInput,        setSkuInput]        = useState('')
  const [autoFetchingPh,  setAutoFetchingPh]  = useState(false)

  // Name-search picker
  const [showPicker,      setShowPicker]      = useState(false)
  const [pickerQuery,     setPickerQuery]      = useState('')
  const [pickerResults,   setPickerResults]   = useState([])
  const [pickerLoading,   setPickerLoading]   = useState(false)

  // Bulk auto-fetch state
  const [fetching,   setFetching]   = useState(false)
  const [fetchProg,  setFetchProg]  = useState(null)
  const abortRef = useRef(null)

  const filtered = useMemo(() =>
    products.filter(p =>
      !query || p.name?.toLowerCase().includes(query.toLowerCase()) || p.sku?.includes(query)
    ), [products, query])

  const openEdit = (p) => {
    setEditing(p)
    setPhotoPreview(null); setPhotoData(null); setPhotoRemoved(false); setPhotoSource(null)
    setSkuInput(p.sku || '')
    setShowPicker(false); setPickerQuery(''); setPickerResults([])
  }

  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compressImage(file, 400, 0.82)
    if (compressed) { setPhotoPreview(compressed); setPhotoData(compressed); setPhotoSource('camera') }
    e.target.value = ''
  }

  const removePhoto = () => {
    setPhotoPreview(null); setPhotoData(null); setPhotoRemoved(true); setPhotoSource(null)
  }

  const currentPhoto = photoPreview || (editing?.id && !photoRemoved ? photos[editing.id] : null)

  // ── Auto-fetch by barcode (debounced 700ms) ───────────────
  useEffect(() => {
    if (!editing) return
    const digits = skuInput.replace(/\D/g, '')
    if (digits.length < 8) return
    // Don't re-fetch if already have a photo for this product
    if (photoData || photoSource) return
    if (editing.id && photos[editing.id] && !photoRemoved) return

    const timer = setTimeout(async () => {
      setAutoFetchingPh(true)
      const dataUrl = await fetchProductPhoto(skuInput)
      setAutoFetchingPh(false)
      if (dataUrl) { setPhotoPreview(dataUrl); setPhotoData(dataUrl); setPhotoSource('off') }
    }, 700)
    return () => clearTimeout(timer)
  }, [skuInput, editing, photoData, photoSource, photos, photoRemoved])

  // ── Picker: search by name ────────────────────────────────
  const [pickerError,   setPickerError]   = useState(null)

  const runPickerSearch = useCallback(async (q) => {
    if (!q || q.trim().length < 3) { setPickerResults([]); setPickerError(null); return }
    setPickerLoading(true)
    setPickerError(null)
    const { results, error } = await searchProductPhotos(q, 8)
    setPickerResults(results)
    setPickerError(error || null)
    setPickerLoading(false)
  }, [])

  // Debounced picker query
  useEffect(() => {
    const t = setTimeout(() => runPickerSearch(pickerQuery), 600)
    return () => clearTimeout(t)
  }, [pickerQuery, runPickerSearch])

  const pickPhoto = useCallback(async (item) => {
    setPickerLoading(true)
    const dataUrl = await urlToDataUrl(item.url)
    setPickerLoading(false)
    if (dataUrl) {
      setPhotoPreview(dataUrl); setPhotoData(dataUrl); setPhotoSource('search')
      setShowPicker(false)
    }
  }, [])

  // When picker opens, auto-search with product name (cleaned: lowercase, no sizes/codes)
  const openPicker = useCallback(() => {
    setShowPicker(true)
    setPickerError(null)
    setPickerResults([])
    const raw = editing?.name || ''
    const cleaned = raw
      .toLowerCase()
      .replace(/\d+[xX]\d+\w*/g, '')   // remove "24X350G", "36X133"
      .replace(/\d+\s*g\b|\d+\s*kg\b|\d+\s*ml\b|\d+\s*lt?\b/gi, '') // "350g", "1kg"
      .replace(/\s{2,}/g, ' ')
      .trim()
    const q = cleaned || raw.toLowerCase()
    if (q.length >= 3) setPickerQuery(q)
  }, [editing])

  const save = async (e) => {
    e.preventDefault()
    const fd  = new FormData(e.target)
    const id  = editing.id || `p${Date.now()}`
    upsertProduct({
      id,
      sku:        skuInput,
      name:       fd.get('name'),
      category:   fd.get('category'),
      unit:       fd.get('unit'),
      cost:       Number(fd.get('cost')),
      price:      Number(fd.get('price')),
      stock:      Number(fd.get('stock')),
      minStock:   fd.get('minStock')   ? Number(fd.get('minStock'))   : 0,
      expiryDate: fd.get('expiryDate') || null,
    })
    if (photoData)    await saveProductPhoto(id, photoData)
    else if (photoRemoved && editing.id) await saveProductPhoto(editing.id, null)
    setEditing(null)
  }

  const handleDelete = (p) => {
    if (confirm(`Excluir "${p.name}"?`)) {
      deleteProduct(p.id)
      saveProductPhoto(p.id, null)
    }
  }

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const buf  = await file.arrayBuffer()
      const list = parseGdoorCsv(buf)
      importProducts(list)
      alert(`✅ ${list.length} produtos importados!`)
    } catch (err) { alert('Erro: ' + err.message) }
    finally { setImporting(false); e.target.value = '' }
  }

  /* ── auto-fetch photos from Open Food Facts ── */
  const startAutoFetch = useCallback(async () => {
    const missing = products.filter(p => !photos[p.id] && p.sku?.replace(/\D/g,'').length >= 8)
    if (missing.length === 0) { alert('Todos os produtos com código já têm foto! 🎉'); return }

    const ctrl = new AbortController()
    abortRef.current = ctrl
    setFetching(true)
    setFetchProg({ done: 0, total: missing.length, found: 0 })

    await autoFetchPhotos(
      missing,
      (done, total, found) => setFetchProg({ done, total, found }),
      ctrl.signal,
      // Save each photo immediately as it's found (real-time update)
      (id, dataUrl) => saveProductPhoto(id, dataUrl),
    )

    setFetching(false)
    setFetchProg(prev => prev ? { ...prev, finished: true } : null)
  }, [products, photos, saveProductPhoto])

  const cancelFetch = () => { abortRef.current?.abort(); setFetching(false) }

  const margin = (p) => p.price > 0 ? ((p.price - p.cost) / p.price * 100).toFixed(1) : '0.0'
  const withPhotos = products.filter(p => photos[p.id]).length
  const missingPhotos = products.filter(p => !photos[p.id] && p.sku?.replace(/\D/g,'').length >= 8).length

  return (
    <div className="space-y-4 animate-pop">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Produtos</h1>
          <p className="text-gray-500 text-sm">
            {products.length} cadastrados
            {withPhotos > 0 && <span className="ml-2 text-orange-500 font-semibold">· {withPhotos} com foto</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
            <button onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-white shadow text-orange-600' : 'text-gray-400 hover:text-gray-600'}`}>
              <List className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white shadow text-orange-600' : 'text-gray-400 hover:text-gray-600'}`}>
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          {/* Auto-fetch button */}
          {!fetching
            ? (
              <button onClick={startAutoFetch}
                className="btn-ghost text-sm gap-1.5 border border-purple-200 text-purple-700 hover:bg-purple-50">
                <Sparkles className="w-4 h-4" />
                Buscar fotos auto
                {missingPhotos > 0 && <span className="text-[10px] bg-purple-100 px-1.5 py-0.5 rounded-full">{missingPhotos}</span>}
              </button>
            ) : (
              <button onClick={cancelFetch}
                className="btn-ghost text-sm gap-1.5 border border-red-200 text-red-600 hover:bg-red-50">
                <StopCircle className="w-4 h-4" /> Cancelar
              </button>
            )
          }

          <label className={`btn-ghost cursor-pointer ${importing ? 'opacity-60 pointer-events-none' : ''}`}>
            <Upload className="w-4 h-4" />
            {importing ? 'Importando…' : 'CSV Gdoor'}
            <input type="file" accept=".csv,.txt" className="hidden" onChange={handleImport} />
          </label>
          <button onClick={() => openEdit(EMPTY)} className="btn-primary">
            <Plus className="w-4 h-4" /> Novo produto
          </button>
        </div>
      </div>

      {/* ── Progress bar (auto-fetch) ── */}
      {fetchProg && (
        <div className={`card px-4 py-3 border-2 animate-pop ${fetchProg.finished ? 'border-green-300 bg-green-50' : 'border-purple-200 bg-purple-50/50'}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {fetchProg.finished
                ? <span className="text-green-700 font-black text-sm">✅ Concluído!</span>
                : <><span className="w-3.5 h-3.5 rounded-full border-2 border-purple-400 border-t-transparent animate-spin inline-block" />
                   <span className="text-purple-800 font-bold text-sm">Buscando fotos no Open Food Facts…</span></>
              }
            </div>
            <div className="text-xs font-bold text-gray-600">
              <span className="text-green-700">{fetchProg.found} encontradas</span>
              <span className="text-gray-400 mx-1">·</span>
              {fetchProg.done}/{fetchProg.total} verificados
            </div>
          </div>
          {/* progress bar */}
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${fetchProg.finished ? 'bg-green-500' : 'bg-purple-500'}`}
              style={{ width: `${fetchProg.total > 0 ? (fetchProg.done / fetchProg.total) * 100 : 0}%` }}
            />
          </div>
          {fetchProg.finished && (
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-green-700">
                {fetchProg.found} fotos adicionadas de {fetchProg.total} produtos verificados
                {fetchProg.found > 0 && ' · Visíveis no grid e no PDV agora!'}
              </p>
              <button onClick={() => setFetchProg(null)} className="text-xs text-gray-400 hover:text-gray-600">Fechar</button>
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Buscar produto por nome ou código..." className="input pl-9" />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Grid view ── */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filtered.map(p => (
            <ProductCard key={p.id} p={p} photo={photos[p.id]}
              onEdit={openEdit} onDelete={handleDelete} />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-400 text-sm">Nenhum produto encontrado</div>
          )}
        </div>
      ) : (
        /* ── Table view ── */
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['', 'Código', 'Produto', 'Categoria', 'Custo', 'Preço', 'Margem', 'Estoque', ''].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    {/* Thumbnail */}
                    <td className="pl-4 py-2 w-10">
                      {photos[p.id]
                        ? <img src={photos[p.id]} alt="" className="w-9 h-9 rounded-lg object-cover" />
                        : <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300 text-xs">📦</div>
                      }
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.sku}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-800">{p.name}</div>
                      <div className="text-xs text-gray-400">{p.unit}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block bg-orange-50 text-orange-700 text-xs font-semibold px-2 py-0.5 rounded-full">{p.category}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{BRL.format(p.cost)}</td>
                    <td className="px-4 py-3 font-bold text-gray-800">{BRL.format(p.price)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold ${parseFloat(margin(p)) >= 20 ? 'text-green-600' : 'text-amber-500'}`}>
                        {margin(p)}%
                      </span>
                    </td>
                    <td className="px-4 py-3"><StockBadge stock={p.stock} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(p)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-orange-600">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(p)} className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-600">
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
      )}

      {/* ── Edit / New modal ── */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" onClick={e => e.target === e.currentTarget && setEditing(null)}>
          <div className="card w-full max-w-lg sm:mx-4 animate-pop overflow-hidden max-h-[95dvh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
              <h2 className="text-xl font-black text-gray-900">{editing.id ? 'Editar' : 'Novo'} Produto</h2>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 pb-5">
              {/* ── FOTO ── */}
              <div className="mb-4 space-y-2">
                {currentPhoto ? (
                  <div className="relative rounded-2xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
                    <img src={currentPhoto} alt="foto do produto" className="w-full h-full object-cover" />
                    {/* Source badge */}
                    {photoSource === 'off' && (
                      <div className="absolute top-2 left-2 bg-green-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Globe className="w-2.5 h-2.5" /> Open Food Facts
                      </div>
                    )}
                    {photoSource === 'search' && (
                      <div className="absolute top-2 left-2 bg-blue-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Search className="w-2.5 h-2.5" /> Pesquisa
                      </div>
                    )}
                    {/* Overlay buttons */}
                    <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 hover:opacity-100">
                      <label className="bg-white/90 text-gray-800 text-xs font-bold px-3 py-1.5 rounded-full cursor-pointer flex items-center gap-1.5 hover:bg-white">
                        <Camera className="w-3.5 h-3.5" /> Câmera
                        <input ref={photoInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoSelect} />
                      </label>
                      <button type="button" onClick={openPicker}
                        className="bg-blue-500/90 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 hover:bg-blue-600">
                        <Search className="w-3.5 h-3.5" /> Buscar
                      </button>
                      <button type="button" onClick={removePhoto}
                        className="bg-red-500/90 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 hover:bg-red-600">
                        <X className="w-3.5 h-3.5" /> Remover
                      </button>
                    </div>
                  </div>
                ) : autoFetchingPh ? (
                  /* Spinner while auto-fetching by barcode */
                  <div className="flex flex-col items-center justify-center gap-2 py-8 border-2 border-dashed border-blue-200 rounded-2xl bg-blue-50/50">
                    <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                    <div className="text-sm font-bold text-blue-600">Buscando foto pelo código...</div>
                    <div className="text-xs text-blue-400">Open Food Facts</div>
                  </div>
                ) : (
                  /* Empty state with 3 options */
                  <div className="border-2 border-dashed border-gray-200 rounded-2xl overflow-hidden">
                    <div className="grid grid-cols-3 divide-x divide-gray-200">
                      {/* Camera */}
                      <label className="flex flex-col items-center gap-1.5 py-5 cursor-pointer hover:bg-orange-50 transition-colors group">
                        <div className="w-10 h-10 rounded-full bg-gray-100 group-hover:bg-orange-100 flex items-center justify-center transition-colors">
                          <Camera className="w-5 h-5 text-gray-400 group-hover:text-orange-500" />
                        </div>
                        <span className="text-[11px] font-bold text-gray-500 group-hover:text-orange-600">Câmera</span>
                        <span className="text-[9px] text-gray-400">ou galeria</span>
                        <input ref={photoInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoSelect} />
                      </label>
                      {/* Search */}
                      <button type="button" onClick={openPicker}
                        className={`flex flex-col items-center gap-1.5 py-5 hover:bg-blue-50 transition-colors group ${showPicker ? 'bg-blue-50' : ''}`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${showPicker ? 'bg-blue-100' : 'bg-gray-100 group-hover:bg-blue-100'}`}>
                          <Globe className={`w-5 h-5 ${showPicker ? 'text-blue-500' : 'text-gray-400 group-hover:text-blue-500'}`} />
                        </div>
                        <span className={`text-[11px] font-bold ${showPicker ? 'text-blue-600' : 'text-gray-500 group-hover:text-blue-600'}`}>Buscar online</span>
                        <span className="text-[9px] text-gray-400">Open Food Facts</span>
                      </button>
                      {/* URL paste */}
                      <label className="flex flex-col items-center gap-1.5 py-5 cursor-pointer hover:bg-gray-50 transition-colors group">
                        <div className="w-10 h-10 rounded-full bg-gray-100 group-hover:bg-gray-200 flex items-center justify-center transition-colors">
                          <Upload className="w-5 h-5 text-gray-400" />
                        </div>
                        <span className="text-[11px] font-bold text-gray-500">Arquivo</span>
                        <span className="text-[9px] text-gray-400">JPG/PNG</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                      </label>
                    </div>
                  </div>
                )}

                {/* ── Picker: name search ── */}
                {showPicker && (
                  <div className="border border-blue-200 rounded-xl overflow-hidden bg-white animate-pop">
                    <div className="relative bg-blue-50 border-b border-blue-100">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-400" />
                      <input
                        value={pickerQuery}
                        onChange={e => setPickerQuery(e.target.value)}
                        autoFocus
                        placeholder="Buscar por nome do produto... (ex: biscoito vitarella)"
                        className="w-full pl-9 pr-4 py-2.5 text-sm bg-transparent focus:outline-none text-blue-900 placeholder-blue-300"
                      />
                      {pickerLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-400 animate-spin" />}
                    </div>
                    {pickerResults.length > 0 ? (
                      <div className="grid grid-cols-4 gap-1 p-2 max-h-48 overflow-y-auto">
                        {pickerResults.map((item, i) => (
                          <button key={i} type="button" onClick={() => pickPhoto(item)}
                            className="aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-blue-400 transition-all relative group">
                            <img src={item.url} alt={item.name} className="w-full h-full object-cover bg-gray-100" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end">
                              <p className="text-white text-[8px] font-bold p-1 leading-tight opacity-0 group-hover:opacity-100 truncate w-full">{item.name}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : pickerError ? (
                      <div className="p-4 text-center space-y-1">
                        <p className="text-xs font-bold text-amber-600">⚠ Serviço temporariamente indisponível</p>
                        <p className="text-[10px] text-gray-400">Open Food Facts está fora do ar. Tente em alguns minutos ou use câmera/arquivo.</p>
                      </div>
                    ) : pickerQuery.length >= 3 && !pickerLoading ? (
                      <div className="p-4 text-center space-y-1">
                        <p className="text-xs text-gray-500 font-semibold">Nenhuma imagem encontrada</p>
                        <p className="text-[10px] text-gray-400">Tente com menos palavras, ex: <em>"biscoito vitarella"</em></p>
                      </div>
                    ) : !pickerLoading && (
                      <p className="text-xs text-gray-400 text-center p-4">Digite ou edite o nome para buscar imagens</p>
                    )}
                  </div>
                )}
              </div>

              {/* ── Form fields ── */}
              <form id="product-form" onSubmit={save} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Código / Barras</label>
                    <input value={skuInput} onChange={e => setSkuInput(e.target.value)}
                      className="input" placeholder="Ex: 7896213006355" />
                  </div>
                  <div>
                    <label className="label">Unidade</label>
                    <select name="unit" defaultValue={editing.unit || 'UN'} className="input">
                      {UNITS.map(u => <option key={u}>{u}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label">Nome do produto *</label>
                  <input name="name" required defaultValue={editing.name} className="input" placeholder="Ex: Biscoito Vitarella 350g" />
                </div>

                <div>
                  <label className="label">Categoria</label>
                  <input name="category" list="cats" defaultValue={editing.category} className="input" placeholder="Digite ou escolha..." />
                  <datalist id="cats">
                    {['Biscoitos','Chocolates','Bebidas','Laticínios','Mercearia','Limpeza','Higiene Pessoal','Balas e Doces','Panificação','Carnes','Outros'].map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="label">Custo (R$)</label>
                    <input name="cost" type="number" step="0.01" min="0" required defaultValue={editing.cost || ''} className="input" placeholder="0,00" />
                  </div>
                  <div>
                    <label className="label">Preço Venda *</label>
                    <input name="price" type="number" step="0.01" min="0" required defaultValue={editing.price || ''} className="input" placeholder="0,00" />
                  </div>
                  <div>
                    <label className="label">Estoque</label>
                    <input name="stock" type="number" min="0" required defaultValue={editing.stock ?? ''} className="input" placeholder="0" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Estoque mínimo</label>
                    <input name="minStock" type="number" min="0" defaultValue={editing.minStock || ''} placeholder="Ex: 10" className="input" />
                  </div>
                  <div>
                    <label className="label">Validade</label>
                    <input name="expiryDate" type="date" defaultValue={editing.expiryDate || ''} className="input" />
                  </div>
                </div>
              </form>
            </div>

            {/* Footer buttons */}
            <div className="flex gap-2 px-5 pb-5 pt-3 border-t border-gray-100 flex-shrink-0">
              <button type="button" onClick={() => setEditing(null)} className="btn-ghost flex-1 justify-center">Cancelar</button>
              <button type="submit" form="product-form" className="btn-primary flex-1 justify-center">
                {editing.id ? 'Salvar alterações' : 'Cadastrar produto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
