/**
 * /scan — Standalone mobile camera scanner.
 *
 * PDV mode (default): relays scanned codes to desktop cart.
 * Estoque mode (?mode=estoque): full stock-receive form per item
 *   — qty, expiry date, lot number — with a batch list and confirm.
 */
import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ShoppingCart, Package, CheckCircle, Trash2, Check, ChevronDown } from 'lucide-react'
import CameraScanner from '../components/CameraScanner.jsx'
import { useStore, BRL } from '../store.jsx'
import { useScanSender } from '../hooks/useScanRelay.js'

/* ── styles (all panels float over the full-screen camera) ── */
const S = {
  // The camera uses fixed inset-0 z-50, so every panel needs z > 50
  topbar: {
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 60,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 16px',
    background: 'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, transparent 100%)',
  },
  brand: { color: '#fff', fontWeight: 900, fontSize: 16, letterSpacing: '-0.5px', textShadow: '0 1px 4px rgba(0,0,0,0.8)' },
  tabs:  { display: 'flex', gap: 4 },
  tab:   (active) => ({
    padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 800, border: 'none', cursor: 'pointer',
    background: active ? '#ea580c' : 'rgba(255,255,255,0.15)',
    color: active ? '#000' : '#fff',
    backdropFilter: 'blur(4px)',
  }),
  // PDV log panel — floats at bottom, max 40% height
  pdvPanel: {
    position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 60,
    background: 'rgba(9,9,11,0.92)', borderTop: '1px solid #27272a',
    maxHeight: '40vh', overflowY: 'auto',
    backdropFilter: 'blur(10px)',
  },
  // Batch summary bar — floats at bottom
  batchBar: {
    position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 60,
    background: 'rgba(9,9,11,0.95)', borderTop: '1px solid #27272a',
    maxHeight: '50vh', overflowY: 'auto',
    backdropFilter: 'blur(10px)',
  },
  batchHdr:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px 6px', gap: 8 },
  batchCount:{ fontSize: 13, fontWeight: 700, color: '#a1a1aa' },
  confirmBtn:{ padding: '9px 18px', borderRadius: 12, background: '#16a34a', border: 'none', color: '#fff', fontWeight: 900, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 },
  batchItem: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 16px', borderTop: '1px solid #27272a' },
  batchName: { fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1.3 },
  batchMeta: { fontSize: 11, color: '#71717a', marginTop: 2 },
  delBtn:    { marginLeft: 'auto', flexShrink: 0, padding: '4px 8px', borderRadius: 8, background: '#27272a', border: 'none', color: '#ef4444', cursor: 'pointer' },
  // Bottom sheet (form after scan) — z > batchBar
  sheetOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 70 },
  sheet: {
    position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 80,
    background: '#18181b', borderRadius: '20px 20px 0 0',
    paddingBottom: 'max(env(safe-area-inset-bottom, 12px), 12px)',
    maxHeight: '92vh', overflowY: 'auto',
  },
  drag:       { width: 40, height: 4, background: '#3f3f46', borderRadius: 2, margin: '12px auto 8px' },
  sheetTitle: { padding: '0 20px 4px', fontSize: 11, fontWeight: 700, color: '#71717a', letterSpacing: 1, textTransform: 'uppercase' },
  prodName:   { padding: '4px 20px 10px', fontSize: 18, fontWeight: 900, color: '#fff', lineHeight: 1.2 },
  prodSub:    { padding: '0 20px 14px', fontSize: 12, color: '#71717a', marginTop: -8 },
  field:      { padding: '0 20px 14px' },
  label:      { display: 'block', fontSize: 12, fontWeight: 700, color: '#a1a1aa', marginBottom: 6, letterSpacing: 0.3 },
  input:      { width: '100%', background: '#27272a', border: '2px solid #3f3f46', borderRadius: 12, padding: '13px 14px', fontSize: 17, color: '#fff', outline: 'none', boxSizing: 'border-box', WebkitAppearance: 'none' },
  row:        { display: 'flex', gap: 12, padding: '4px 20px 14px' },
  btnCancel:  { flex: 1, padding: '14px', borderRadius: 14, background: '#27272a', border: 'none', color: '#a1a1aa', fontWeight: 800, fontSize: 15, cursor: 'pointer' },
  btnOk:      { flex: 2, padding: '14px', borderRadius: 14, background: '#16a34a', border: 'none', color: '#fff', fontWeight: 900, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
}

export default function ScanMobile() {
  const [params]  = useSearchParams()
  const mode      = params.get('mode') || 'pdv'
  const { products, upsertProduct } = useStore()

  /* ── PDV mode state ────────────────────────────────────── */
  const [pdvFeed, setPdvFeed]       = useState([])
  const [pdvFound, setPdvFound]     = useState(null)
  const sendScan = useScanSender()

  /* ── Estoque mode state ────────────────────────────────── */
  const [sheet, setSheet]           = useState(null)   // { product } — open bottom-sheet
  const [qty, setQty]               = useState('1')
  const [vencimento, setVencimento] = useState('')
  const [lote, setLote]             = useState('')
  const [custo, setCusto]           = useState('')
  const [batch, setBatch]           = useState([])     // confirmed items
  const [batchOpen, setBatchOpen]   = useState(true)
  const [done, setDone]             = useState(false)
  const [err, setErr]               = useState(null)
  const qtyRef = useRef(null)

  /* ── New product registration sheet ────────────────────── */
  const [newProdCode,  setNewProdCode]  = useState(null)  // barcode of unknown product
  const [newProdName,  setNewProdName]  = useState('')
  const [newProdPrice, setNewProdPrice] = useState('')
  const [newProdCost,  setNewProdCost]  = useState('')
  const [newProdCat,   setNewProdCat]   = useState('')
  const nameRef = useRef(null)

  useEffect(() => {
    if (newProdCode) setTimeout(() => nameRef.current?.focus(), 350)
  }, [newProdCode])

  /* ── normalise barcode lookup (same as desktop) ────────── */
  const findProduct = useCallback((raw) => {
    const code = String(raw).trim().replace(/\0/g, '')
    if (!code) return null
    const exact = products.find(x => x.sku === code || x.barcode === code)
    if (exact) return exact
    const stripped = code.replace(/^0+/, '') || code
    return products.find(x =>
      (x.sku || '').replace(/^0+/, '') === stripped ||
      (x.barcode || '').replace(/^0+/, '') === stripped
    ) || null
  }, [products])

  /* focus qty when sheet opens */
  useEffect(() => {
    if (sheet) setTimeout(() => qtyRef.current?.focus(), 300)
  }, [sheet])

  /* ── open new-product form ──────────────────────────────── */
  const openNewProd = useCallback((code) => {
    setNewProdCode(code)
    setNewProdName(''); setNewProdPrice(''); setNewProdCost(''); setNewProdCat('')
  }, [])

  /* ── save new product ───────────────────────────────────── */
  const saveNewProd = useCallback(() => {
    if (!newProdName.trim() || !newProdPrice) return
    const p = {
      id:       `p${Date.now()}_${Math.random().toString(36).slice(2)}`,
      sku:      newProdCode,
      barcode:  newProdCode,
      name:     newProdName.trim(),
      price:    parseFloat(newProdPrice) || 0,
      cost:     parseFloat(newProdCost)  || 0,
      category: newProdCat.trim() || 'Outros',
      stock:    0,
    }
    upsertProduct(p)
    setNewProdCode(null)
    // After saving, continue the scan flow for each mode
    if (mode === 'pdv') {
      sendScan(newProdCode)
      setPdvFound(p); setTimeout(() => setPdvFound(null), 2500)
      setPdvFeed(f => [{ code: newProdCode, name: p.name, price: p.price, ts: Date.now() }, ...f].slice(0, 8))
    } else {
      setQty('1'); setVencimento(''); setLote(''); setCusto('')
      setSheet(p)
    }
  }, [newProdCode, newProdName, newProdPrice, newProdCost, newProdCat, mode, upsertProduct, sendScan])

  /* ── scan handler ──────────────────────────────────────── */
  const handleScan = useCallback((code) => {
    if (mode === 'pdv') {
      const p = findProduct(code)
      sendScan(code)   // WebSocket relay + localStorage fallback
      setPdvFeed(f => [{ code, name: p?.name, price: p?.price, ts: Date.now() }, ...f].slice(0, 8))
      if (p) { setPdvFound(p); setTimeout(() => setPdvFound(null), 2500) }
      else   { openNewProd(code) }   // ← open registration instead of error
      return
    }

    // Estoque mode
    const p = findProduct(code)
    if (!p) { openNewProd(code); return }   // ← open registration instead of error
    setQty('1'); setVencimento(''); setLote(''); setCusto(p.cost > 0 ? String(p.cost) : '')
    setSheet(p)
  }, [mode, findProduct, openNewProd])

  /* ── confirm item into batch ───────────────────────────── */
  const addToBatch = () => {
    const n = parseInt(qty, 10)
    if (!n || n <= 0) return
    setBatch(prev => [
      {
        product: sheet,
        qty: n,
        vencimento: vencimento || null,
        lote: lote || null,
        custo: parseFloat(custo) || null,
      },
      ...prev,
    ])
    setSheet(null)
  }

  /* ── confirm all batch entries ─────────────────────────── */
  const confirmAll = () => {
    batch.forEach(({ product, qty, custo }) => {
      const updates = { stock: (product.stock || 0) + qty, receivedAt: new Date().toISOString() }
      if (custo) updates.cost = custo
      upsertProduct({ ...product, ...updates })
    })
    setDone(true)
    setTimeout(() => { setBatch([]); setDone(false) }, 3000)
  }

  /* ── done screen ───────────────────────────────────────── */
  if (done) return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: '#052e16', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 32, fontFamily: 'system-ui,sans-serif' }}>
      <CheckCircle style={{ width: 72, height: 72, color: '#4ade80' }} />
      <div style={{ color: '#fff', fontWeight: 900, fontSize: 24, textAlign: 'center' }}>Estoque atualizado!</div>
      <div style={{ color: '#4ade80', fontSize: 14, textAlign: 'center' }}>
        {batch.length} produto(s) · {batch.reduce((s, e) => s + e.qty, 0)} unidades
      </div>
    </div>
  )

  // Camera fills the full viewport (CameraScanner uses fixed inset-0 z-50).
  // Every other panel floats at z > 50 on top of it.
  return (
    <>
      {/* camera — full screen background (z-50 from CameraScanner) */}
      <CameraScanner onScan={handleScan} onClose={() => {}} />

      {/* top bar — floats over camera */}
      <div style={S.topbar}>
        <div style={S.brand}>✕ CORTA PREÇO$</div>
        <div style={S.tabs}>
          <button style={S.tab(mode === 'pdv')} onClick={() => { window.location.href = '/scan' }}>
            <ShoppingCart style={{ width: 13, height: 13, display: 'inline', marginRight: 4 }} />PDV
          </button>
          <button style={S.tab(mode === 'estoque')} onClick={() => { window.location.href = '/scan?mode=estoque' }}>
            <Package style={{ width: 13, height: 13, display: 'inline', marginRight: 4 }} />Estoque
          </button>
        </div>
      </div>

      {/* PDV mode — scanned log panel at bottom */}
      {mode === 'pdv' && (
        <div style={S.pdvPanel}>
          <div style={{ padding: '8px 16px 4px', fontSize: 11, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: 1 }}>
            Enviado para o caixa
          </div>
          {pdvFeed.length === 0
            ? <div style={{ color: '#52525b', fontSize: 14, textAlign: 'center', padding: '12px 16px' }}>Aponte para um código de barras</div>
            : pdvFeed.map(({ code, name, price, ts }) => (
              <div key={ts} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', borderTop: '1px solid #27272a' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ color: '#fff', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name || code}</div>
                  {name && <div style={{ color: '#71717a', fontSize: 11, fontFamily: 'monospace' }}>{code}</div>}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                  {price > 0 && <div style={{ color: '#ea580c', fontWeight: 900, fontSize: 14 }}>{BRL.format(price)}</div>}
                  <div style={{ color: '#52525b', fontSize: 11 }}>{new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* Estoque mode — batch bar at bottom */}
      {mode === 'estoque' && batch.length > 0 && (
        <div style={S.batchBar}>
          <div style={S.batchHdr}>
            <button onClick={() => setBatchOpen(o => !o)} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', flex: 1, minWidth: 0 }}>
              <span style={S.batchCount}>{batch.length} produto(s) · {batch.reduce((s, e) => s + e.qty, 0)} un.</span>
              <ChevronDown style={{ width: 14, height: 14, color: '#71717a', transform: batchOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }} />
            </button>
            <button onClick={confirmAll} style={S.confirmBtn}>
              <Check style={{ width: 15, height: 15 }} />Confirmar Entrada
            </button>
          </div>
          {batchOpen && batch.map((e, i) => (
            <div key={i} style={S.batchItem}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={S.batchName}>{e.qty}× {e.product.name}</div>
                <div style={S.batchMeta}>
                  {[e.vencimento && `Venc: ${new Date(e.vencimento + 'T12:00').toLocaleDateString('pt-BR')}`,
                    e.lote && `Lote: ${e.lote}`,
                    e.custo && `Custo: ${BRL.format(e.custo)}`]
                    .filter(Boolean).join(' · ') || 'Sem detalhes extras'}
                </div>
              </div>
              <button onClick={() => setBatch(b => b.filter((_, j) => j !== i))} style={S.delBtn}>
                <Trash2 style={{ width: 14, height: 14 }} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── New product registration sheet ────────────────── */}
      {newProdCode && (
        <>
          <div style={S.sheetOverlay} onClick={() => setNewProdCode(null)} />
          <div style={S.sheet}>
            <div style={S.drag} />
            {/* header — orange accent for new item */}
            <div style={{ padding: '0 20px 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#431407', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Package style={{ width: 18, height: 18, color: '#ea580c' }} />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#71717a', letterSpacing: 1, textTransform: 'uppercase' }}>Código não encontrado — cadastrar</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#a1a1aa', fontFamily: 'monospace', marginTop: 2 }}>{newProdCode}</div>
              </div>
            </div>

            {/* Nome */}
            <div style={S.field}>
              <label style={S.label}>Nome do produto *</label>
              <input
                ref={nameRef}
                type="text" value={newProdName} onChange={e => setNewProdName(e.target.value)}
                style={S.input} placeholder="Ex: ARROZ TIÃO 5KG"
                onKeyDown={e => e.key === 'Enter' && document.getElementById('scanNewPrice')?.focus()}
              />
            </div>

            {/* Preço e Custo lado a lado */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '0 20px 14px' }}>
              <div>
                <label style={S.label}>Preço venda (R$) *</label>
                <input
                  id="scanNewPrice"
                  type="number" inputMode="decimal" step="0.01" min="0"
                  value={newProdPrice} onChange={e => setNewProdPrice(e.target.value)}
                  style={S.input} placeholder="0,00"
                />
              </div>
              <div>
                <label style={S.label}>Custo (R$)</label>
                <input
                  type="number" inputMode="decimal" step="0.01" min="0"
                  value={newProdCost} onChange={e => setNewProdCost(e.target.value)}
                  style={S.input} placeholder="0,00"
                />
              </div>
            </div>

            {/* Categoria */}
            <div style={S.field}>
              <label style={S.label}>Categoria</label>
              <input
                type="text" value={newProdCat} onChange={e => setNewProdCat(e.target.value)}
                style={S.input} placeholder="Ex: Mercearia, Bebidas, Carnes…"
              />
            </div>

            <div style={S.row}>
              <button style={S.btnCancel} onClick={() => setNewProdCode(null)}>Cancelar</button>
              <button
                style={{ ...S.btnOk, background: newProdName.trim() && newProdPrice ? '#ea580c' : '#52525b' }}
                onClick={saveNewProd}
                disabled={!newProdName.trim() || !newProdPrice}>
                <Check style={{ width: 18, height: 18 }} />
                Cadastrar produto
              </button>
            </div>
          </div>
        </>
      )}

      {/* Bottom sheet — form that appears after scanning a product */}
      {sheet && (
        <>
          <div style={S.sheetOverlay} onClick={() => setSheet(null)} />
          <div style={S.sheet}>
            <div style={S.drag} />
            <div style={S.sheetTitle}>Produto encontrado ✅</div>
            <div style={S.prodName}>{sheet.name}</div>
            <div style={S.prodSub}>
              Estoque atual: <strong style={{ color: '#a1a1aa' }}>{sheet.stock ?? 0} un.</strong>
              &nbsp;·&nbsp;Preço: <strong style={{ color: '#ea580c' }}>{BRL.format(sheet.price)}</strong>
            </div>

            <div style={S.field}>
              <label style={S.label}>Quantidade recebida *</label>
              <input ref={qtyRef} type="number" inputMode="numeric" min="1"
                value={qty} onChange={e => setQty(e.target.value)} onFocus={e => e.target.select()}
                style={S.input} placeholder="Ex: 24" />
            </div>

            <div style={S.field}>
              <label style={S.label}>Data de vencimento</label>
              <input type="date" value={vencimento} onChange={e => setVencimento(e.target.value)}
                style={{ ...S.input, colorScheme: 'dark' }} />
            </div>

            <div style={S.field}>
              <label style={S.label}>Número do lote</label>
              <input type="text" inputMode="text" value={lote} onChange={e => setLote(e.target.value)}
                style={S.input} placeholder="Ex: L2025-07" />
            </div>

            <div style={S.field}>
              <label style={S.label}>Custo de compra (R$) — opcional</label>
              <input type="number" inputMode="decimal" step="0.01" min="0"
                value={custo} onChange={e => setCusto(e.target.value)}
                style={S.input} placeholder={`Atual: ${BRL.format(sheet.cost || 0)}`} />
            </div>

            <div style={S.row}>
              <button style={S.btnCancel} onClick={() => setSheet(null)}>Cancelar</button>
              <button style={S.btnOk} onClick={addToBatch}>
                <Check style={{ width: 18, height: 18 }} />
                Adicionar ao lote
              </button>
            </div>
          </div>
        </>
      )}

      {/* PDV: product found toast */}
      {pdvFound && (
        <div style={{ position: 'fixed', top: 70, left: 12, right: 12, zIndex: 65, background: '#16a34a', borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Check style={{ width: 20, height: 20, color: '#fff', flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ color: '#fff', fontWeight: 900, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pdvFound.name}</div>
            <div style={{ color: '#bbf7d0', fontSize: 12 }}>Enviado ao caixa · {BRL.format(pdvFound.price)}</div>
          </div>
        </div>
      )}

      {/* Error toast — only for non-product errors (e.g. camera issues) */}
      {err && (
        <div style={{ position: 'fixed', top: 70, left: 12, right: 12, zIndex: 65, background: '#dc2626', borderRadius: 14, padding: '12px 16px' }}>
          <div style={{ color: '#fff', fontWeight: 900, fontSize: 14 }}>❌ {err}</div>
        </div>
      )}
    </>
  )
}
