/**
 * /fornecedor — Portal do Fornecedor
 * Standalone mobile-first app — sem auth do mercado, tema verde esmeralda
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Truck, Package, Users, Plus, Camera, Search, Check, Trash2, X,
  ChevronRight, Phone, Share2, Zap, MessageCircle, ArrowLeft,
  Clock, Star, AlertCircle, CheckCircle, BarChart3, Edit3,
  ShoppingCart, Scan, Send, ChevronDown, Info, Copy
} from 'lucide-react'
import CameraScanner from '../components/CameraScanner.jsx'
import PRODUCTS_SEED from '../utils/products_seed.json'

/* ── constants ─────────────────────────────────────────────── */
const BRL   = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const LOCAL  = 'cp_fornecedor_v1'
const OFFERS_KEY = 'cp_supplier_offers'
const API_PERSIST = '/api/persist'
const API_RESTORE = '/api/restore'

/* product lookup map: sku → product */
const SKU_MAP = Object.fromEntries(
  PRODUCTS_SEED.filter(p => p.sku && p.sku.length > 3).map(p => [p.sku, p])
)
const ID_MAP = Object.fromEntries(PRODUCTS_SEED.map(p => [p.id, p]))

/* ── helpers ────────────────────────────────────────────────── */
const cleanPhone = p => '55' + (p || '').replace(/\D/g, '').replace(/^0/, '').slice(-11)
const daysUntil  = iso => iso ? Math.ceil((new Date(iso + 'T00:00') - Date.now()) / 86400000) : null
const fmtDate    = iso => iso ? new Date(iso + 'T00:00').toLocaleDateString('pt-BR') : '—'
const uid        = () => `of_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

function expiryBadge(iso) {
  const d = daysUntil(iso)
  if (d === null) return null
  if (d < 0)  return { label: 'VENCIDO',      bg: '#7f1d1d', text: '#fca5a5' }
  if (d <= 7) return { label: `${d}d ⚠️`,     bg: '#7c2d12', text: '#fdba74' }
  if (d <= 30)return { label: `${d} dias`,     bg: '#14532d', text: '#86efac' }
  return           { label: `${d} dias`,        bg: '#1e3a5f', text: '#93c5fd' }
}

function waLink(phone, text) {
  return `https://wa.me/${cleanPhone(phone)}?text=${encodeURIComponent(text)}`
}

function buildOfferMsg(offer, supplierName) {
  const lines = [
    `🚚 *NOVA OFERTA — ${supplierName}*`,
    ``,
    `📦 *${offer.productName}*`,
    offer.sku ? `   Cód: ${offer.sku}` : '',
    `   ${offer.qty} ${offer.unit}  ·  ${BRL.format(offer.offerPrice)} /un`,
    offer.expiryDate ? `📅 Vence: ${fmtDate(offer.expiryDate)}` : '',
    offer.isOpportunity ? `🔥 *OPORTUNIDADE — estoque limitado!*` : '',
    offer.note ? `💬 ${offer.note}` : '',
    ``,
    `✅ Ver e aceitar: https://corta-precos-pdv.netlify.app/ofertas`,
  ].filter(Boolean).join('\n')
  return lines
}

/* ── persist / restore ──────────────────────────────────────── */
async function persistOffers(offers) {
  try {
    await fetch(API_PERSIST, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: OFFERS_KEY, value: JSON.stringify(offers) }),
    })
  } catch (e) { console.warn('persist failed', e) }
}

async function fetchOffers() {
  try {
    const r = await fetch(API_RESTORE)
    const j = await r.json()
    const raw = j?.data?.[OFFERS_KEY]
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

/* ── sub-components ─────────────────────────────────────────── */

function GreenBtn({ onClick, children, disabled, secondary, danger, full, small }) {
  const base = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: small ? '10px 18px' : '16px 24px',
    borderRadius: 14, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 900, fontSize: small ? 13 : 15, letterSpacing: '-0.3px',
    width: full ? '100%' : 'auto', transition: 'opacity .15s, transform .1s',
    opacity: disabled ? 0.45 : 1,
    background: danger ? '#ef4444' : secondary ? '#1a3a50' : 'linear-gradient(135deg,#10b981,#059669)',
    color: danger ? '#fff' : secondary ? '#93c5fd' : '#fff',
  }
  return <button style={base} onClick={disabled ? undefined : onClick}>{children}</button>
}

function OfferCard({ offer, onWhatsApp, onDelete, compact }) {
  const badge  = expiryBadge(offer.expiryDate)
  const pending = offer.status === 'pending'
  const accepted = offer.status === 'accepted'

  return (
    <div style={{
      background: '#0d2137', borderRadius: 16, padding: compact ? '12px 14px' : '16px',
      marginBottom: 12, border: `1px solid ${offer.isOpportunity ? '#059669' : '#1a3a50'}`,
      position: 'relative', overflow: 'hidden',
    }}>
      {offer.isOpportunity && (
        <div style={{
          position: 'absolute', top: 0, right: 0,
          background: 'linear-gradient(135deg,#d97706,#f59e0b)',
          color: '#000', fontSize: 10, fontWeight: 900,
          padding: '4px 10px', borderRadius: '0 16px 0 10px',
        }}>🔥 OPORTUNIDADE</div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: offer.isOpportunity ? '#78350f' : '#0a2540',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Package size={20} color={offer.isOpportunity ? '#fcd34d' : '#10b981'} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#f1f5f9', fontWeight: 800, fontSize: 14, lineHeight: 1.3,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {offer.productName}
          </div>
          {offer.sku && <div style={{ color: '#475569', fontSize: 11, fontFamily: 'monospace' }}>{offer.sku}</div>}

          <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ color: '#10b981', fontWeight: 900, fontSize: 16 }}>
              {BRL.format(offer.offerPrice)}/un
            </span>
            <span style={{ background: '#0a2540', color: '#93c5fd', fontSize: 11,
              fontWeight: 700, padding: '2px 8px', borderRadius: 8 }}>
              {offer.qty} {offer.unit}
            </span>
            {badge && (
              <span style={{ background: badge.bg, color: badge.text, fontSize: 11,
                fontWeight: 700, padding: '2px 8px', borderRadius: 8 }}>
                📅 {badge.label}
              </span>
            )}
          </div>

          {offer.note && (
            <div style={{ color: '#64748b', fontSize: 12, marginTop: 4, fontStyle: 'italic' }}>
              {offer.note}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
        <div style={{
          fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
          background: accepted ? '#14532d' : '#1a3a50',
          color: accepted ? '#86efac' : '#64748b',
        }}>
          {accepted ? '✓ Aceita' : '⏳ Aguardando'}
        </div>
        <div style={{ color: '#334155', fontSize: 10, marginLeft: 'auto' }}>
          {new Date(offer.publishedAt).toLocaleString('pt-BR', { day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit' })}
        </div>
        {onWhatsApp && (
          <button onClick={() => onWhatsApp(offer)} style={{
            background: '#14532d', color: '#86efac', border: 'none', cursor: 'pointer',
            padding: '5px 10px', borderRadius: 10, fontSize: 12, fontWeight: 700,
          }}>
            <MessageCircle size={12} style={{ display:'inline', marginRight:4 }} />ZAP
          </button>
        )}
        {onDelete && (
          <button onClick={() => onDelete(offer.id)} style={{
            background: '#1a0a0a', color: '#ef4444', border: 'none', cursor: 'pointer',
            padding: '5px 8px', borderRadius: 10, fontSize: 11,
          }}>
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  )
}

function MarketItem({ m, onDelete, onWhatsApp }) {
  return (
    <div style={{
      background: '#0d2137', borderRadius: 14, padding: '14px 16px', marginBottom: 10,
      display: 'flex', alignItems: 'center', gap: 12,
      border: '1px solid #1a3a50',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, background: '#0a2540',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <ShoppingCart size={18} color='#10b981' />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#f1f5f9', fontWeight: 800, fontSize: 14, lineHeight: 1.2 }}>{m.name}</div>
        <div style={{ color: '#475569', fontSize: 12, marginTop: 2 }}>{m.phone}</div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onWhatsApp(m)} style={{
          background: '#14532d', color: '#86efac', border: 'none', cursor: 'pointer',
          padding: '7px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <MessageCircle size={13} />
        </button>
        <button onClick={() => onDelete(m.id)} style={{
          background: '#1a0a0a', color: '#ef4444', border: 'none', cursor: 'pointer',
          padding: '7px 10px', borderRadius: 10,
        }}>
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

/* ── SETUP SCREEN ───────────────────────────────────────────── */
function SetupScreen({ onDone }) {
  const [name,  setName]  = useState('')
  const [phone, setPhone] = useState('')

  return (
    <div style={{ minHeight: '100dvh', background: '#060e1a', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>

      {/* Logo */}
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <div style={{
          width: 80, height: 80, borderRadius: 24, margin: '0 auto 16px',
          background: 'linear-gradient(135deg,#10b981,#0d9488)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(16,185,129,0.35)',
        }}>
          <Truck size={36} color='#fff' />
        </div>
        <h1 style={{ color: '#f0fdf4', fontWeight: 900, fontSize: 26, letterSpacing: '-1px', margin: 0 }}>
          FORNECEDOR
        </h1>
        <p style={{ color: '#4ade80', fontSize: 14, marginTop: 4 }}>
          Portal de ofertas para mercados
        </p>
      </div>

      <div style={{ width: '100%', maxWidth: 360, background: '#0d2137',
        borderRadius: 20, padding: '28px 24px', border: '1px solid #1a3a50' }}>
        <h2 style={{ color: '#f0fdf4', fontWeight: 800, fontSize: 18, margin: '0 0 20px' }}>
          Identifique-se
        </h2>

        <label style={{ display: 'block', color: '#6ee7b7', fontSize: 12, fontWeight: 700,
          letterSpacing: 1, marginBottom: 6 }}>NOME / DISTRIBUIDORA</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder='Ex: João Distribuidora'
          style={{
            width: '100%', background: '#0a1f30', border: '1.5px solid #1a3a50', borderRadius: 12,
            padding: '14px 16px', color: '#f1f5f9', fontSize: 15, marginBottom: 16, boxSizing: 'border-box',
            outline: 'none',
          }}
        />

        <label style={{ display: 'block', color: '#6ee7b7', fontSize: 12, fontWeight: 700,
          letterSpacing: 1, marginBottom: 6 }}>SEU WHATSAPP</label>
        <input
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder='(15) 99999-9999'
          type='tel'
          style={{
            width: '100%', background: '#0a1f30', border: '1.5px solid #1a3a50', borderRadius: 12,
            padding: '14px 16px', color: '#f1f5f9', fontSize: 15, marginBottom: 24, boxSizing: 'border-box',
            outline: 'none',
          }}
        />

        <GreenBtn full onClick={() => name.trim() && onDone({ name: name.trim(), phone: phone.trim() })}>
          <Check size={18} /> Entrar
        </GreenBtn>
      </div>

      <p style={{ color: '#1e3a50', fontSize: 11, marginTop: 20, textAlign: 'center' }}>
        Corta Preços PDV · Plataforma Fornecedor v1.0
      </p>
    </div>
  )
}

/* ── NOVA OFERTA SHEET ─────────────────────────────────────── */
function NovaOfertaSheet({ onClose, onPublish, supplierName, markets }) {
  const [scanning,    setScanning]    = useState(false)
  const [searchTerm,  setSearchTerm]  = useState('')
  const [searchRes,   setSearchRes]   = useState([])
  const [product,     setProduct]     = useState(null)   // { name, sku, id, category }
  const [manualName,  setManualName]  = useState('')
  const [sku,         setSku]         = useState('')
  const [qty,         setQty]         = useState('')
  const [unit,        setUnit]        = useState('CX')
  const [price,       setPrice]       = useState('')
  const [expiry,      setExpiry]      = useState('')
  const [note,        setNote]        = useState('')
  const [isOpp,       setIsOpp]       = useState(false)
  const [publishing,  setPublishing]  = useState(false)
  const [step,        setStep]        = useState('form')  // form | confirm

  /* product search */
  useEffect(() => {
    if (!searchTerm || searchTerm.length < 2) { setSearchRes([]); return }
    const t = searchTerm.toLowerCase()
    setSearchRes(
      PRODUCTS_SEED.filter(p =>
        p.name.toLowerCase().includes(t) || (p.sku || '').includes(t)
      ).slice(0, 6)
    )
  }, [searchTerm])

  const handleScan = useCallback(code => {
    setScanning(false)
    const found = SKU_MAP[code]
    if (found) {
      setProduct(found)
      setSku(found.sku)
      if (!price && found.price) setPrice(String(found.price))
    } else {
      setSku(code)
    }
  }, [price])

  const selectProduct = p => {
    setProduct(p)
    setSku(p.sku || '')
    if (!price && p.price) setPrice(String(p.price))
    setSearchTerm('')
    setSearchRes([])
  }

  const productName = product?.name || manualName

  const canPublish = productName.trim() && qty && price && markets.length > 0

  async function handlePublish() {
    if (!canPublish) return
    setPublishing(true)
    const offers = await fetchOffers()
    const newOffer = {
      id: uid(),
      supplierName,
      productName: productName.trim(),
      productId: product?.id || null,
      sku: sku.trim(),
      category: product?.category || 'Outros',
      qty: Number(qty),
      unit,
      offerPrice: parseFloat(price.replace(',', '.')),
      expiryDate: expiry || null,
      isOpportunity: isOpp,
      note: note.trim(),
      status: 'pending',
      publishedAt: new Date().toISOString(),
    }
    const updated = [newOffer, ...offers]
    await persistOffers(updated)
    setPublishing(false)
    onPublish(newOffer, updated)
  }

  if (scanning) {
    return (
      <>
        <CameraScanner onDetected={handleScan} />
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 110,
          padding: '16px 20px',
          background: 'linear-gradient(to bottom,rgba(0,0,0,.85),transparent)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <button onClick={() => setScanning(false)} style={{
            background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: 10,
            padding: '8px 12px', color: '#fff', cursor: 'pointer', display: 'flex',
          }}>
            <X size={20} />
          </button>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>
            Aponte para o código de barras
          </span>
        </div>
      </>
    )
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 90, display: 'flex', flexDirection: 'column',
      background: '#060e1a',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12,
        background: '#0d2137', borderBottom: '1px solid #1a3a50',
      }}>
        <button onClick={onClose} style={{
          background: '#0a1f30', border: 'none', borderRadius: 10,
          padding: '8px 12px', cursor: 'pointer', color: '#6ee7b7', display: 'flex',
        }}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <div style={{ color: '#f1f5f9', fontWeight: 900, fontSize: 17 }}>Nova Oferta</div>
          <div style={{ color: '#4ade80', fontSize: 12 }}>{markets.length} mercado{markets.length !== 1 ? 's' : ''} serão notificados</div>
        </div>
        <button onClick={() => setScanning(true)} style={{
          marginLeft: 'auto', background: 'linear-gradient(135deg,#10b981,#059669)',
          border: 'none', borderRadius: 12, padding: '10px 14px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6, color: '#fff', fontWeight: 800, fontSize: 13,
        }}>
          <Scan size={16} /> Escanear
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 100px' }}>

        {/* Product search */}
        {!product && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', color: '#6ee7b7', fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>
              PRODUTO
            </label>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'#475569' }} />
              <input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder='Buscar por nome ou cód. de barras...'
                style={{
                  width: '100%', background: '#0a1f30', border: '1.5px solid #1a3a50',
                  borderRadius: 12, padding: '13px 14px 13px 40px', color: '#f1f5f9', fontSize: 14,
                  boxSizing: 'border-box', outline: 'none',
                }}
              />
            </div>
            {searchRes.length > 0 && (
              <div style={{ background: '#0d2137', borderRadius: 12, marginTop: 4, overflow: 'hidden', border: '1px solid #1a3a50' }}>
                {searchRes.map(p => (
                  <button key={p.id} onClick={() => selectProduct(p)} style={{
                    width: '100%', background: 'none', border: 'none', borderBottom: '1px solid #0a1f30',
                    padding: '11px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 700 }}>{p.name}</div>
                      <div style={{ color: '#475569', fontSize: 11, fontFamily: 'monospace' }}>{p.sku}</div>
                    </div>
                    <span style={{ color: '#10b981', fontWeight: 800, fontSize: 13 }}>{BRL.format(p.price)}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Manual entry */}
            <div style={{ marginTop: 12 }}>
              <label style={{ display: 'block', color: '#4ade80', fontSize: 11, fontWeight: 700, marginBottom: 5 }}>
                Ou digitar manualmente:
              </label>
              <input
                value={manualName}
                onChange={e => setManualName(e.target.value)}
                placeholder='Nome do produto'
                style={{
                  width: '100%', background: '#0a1f30', border: '1.5px solid #1a3a50',
                  borderRadius: 12, padding: '12px 14px', color: '#f1f5f9', fontSize: 14,
                  boxSizing: 'border-box', outline: 'none',
                }}
              />
            </div>
          </div>
        )}

        {/* Selected product badge */}
        {product && (
          <div style={{ background: '#0a2a1a', border: '1.5px solid #10b981', borderRadius: 14, padding: '12px 16px', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ color: '#6ee7b7', fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>PRODUTO SELECIONADO</div>
                <div style={{ color: '#f0fdf4', fontWeight: 800, fontSize: 15, marginTop: 2 }}>{product.name}</div>
                <div style={{ color: '#4ade80', fontSize: 11, fontFamily: 'monospace', marginTop: 1 }}>{product.sku}</div>
              </div>
              <button onClick={() => { setProduct(null); setSku(''); setSearchTerm('') }} style={{
                background: '#1a2a1a', border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: '#6ee7b7',
              }}>
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Código de barras */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', color: '#6ee7b7', fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>
            CÓD. BARRAS / SKU
          </label>
          <input
            value={sku}
            onChange={e => setSku(e.target.value)}
            placeholder='7891234567890'
            style={{
              width: '100%', background: '#0a1f30', border: '1.5px solid #1a3a50',
              borderRadius: 12, padding: '13px 14px', color: '#f1f5f9', fontSize: 14,
              boxSizing: 'border-box', outline: 'none', fontFamily: 'monospace',
            }}
          />
        </div>

        {/* Qty + Unit */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ display: 'block', color: '#6ee7b7', fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>
              QUANTIDADE
            </label>
            <input
              value={qty}
              onChange={e => setQty(e.target.value)}
              placeholder='50'
              type='number'
              inputMode='numeric'
              style={{
                width: '100%', background: '#0a1f30', border: '1.5px solid #1a3a50',
                borderRadius: 12, padding: '13px 14px', color: '#f1f5f9', fontSize: 16,
                boxSizing: 'border-box', outline: 'none', fontWeight: 800,
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', color: '#6ee7b7', fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>
              UNID.
            </label>
            <select
              value={unit}
              onChange={e => setUnit(e.target.value)}
              style={{
                width: '100%', background: '#0a1f30', border: '1.5px solid #1a3a50',
                borderRadius: 12, padding: '13px 10px', color: '#f1f5f9', fontSize: 14,
                boxSizing: 'border-box', outline: 'none', fontWeight: 700,
              }}
            >
              {['CX', 'UND', 'FD', 'KG', 'LT', 'PC'].map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Preço */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', color: '#6ee7b7', fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>
            PREÇO DE OFERTA (por unidade)
          </label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
              color: '#10b981', fontWeight: 800, fontSize: 16 }}>R$</span>
            <input
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder='0,00'
              type='number'
              inputMode='decimal'
              style={{
                width: '100%', background: '#0a1f30', border: '1.5px solid #059669',
                borderRadius: 12, padding: '13px 14px 13px 42px', color: '#10b981', fontSize: 18,
                boxSizing: 'border-box', outline: 'none', fontWeight: 900,
              }}
            />
          </div>
        </div>

        {/* Vencimento */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', color: '#6ee7b7', fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>
            DATA DE VENCIMENTO <span style={{ color: '#475569', fontWeight: 400, fontSize: 11 }}>(opcional)</span>
          </label>
          <input
            value={expiry}
            onChange={e => setExpiry(e.target.value)}
            type='date'
            style={{
              width: '100%', background: '#0a1f30', border: '1.5px solid #1a3a50',
              borderRadius: 12, padding: '13px 14px', color: '#f1f5f9', fontSize: 14,
              boxSizing: 'border-box', outline: 'none', colorScheme: 'dark',
            }}
          />
        </div>

        {/* Oportunidade toggle */}
        <button
          onClick={() => setIsOpp(v => !v)}
          style={{
            width: '100%', padding: '14px 18px', borderRadius: 14, border: `2px solid ${isOpp ? '#d97706' : '#1a3a50'}`,
            background: isOpp ? '#1c1400' : 'transparent', cursor: 'pointer', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 12, transition: 'all .15s',
          }}
        >
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: isOpp ? '#78350f' : '#0a1f30',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
          }}>
            {isOpp ? '🔥' : '⭐'}
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ color: isOpp ? '#fcd34d' : '#94a3b8', fontWeight: 800, fontSize: 14 }}>
              {isOpp ? 'OPORTUNIDADE ATIVA!' : 'Marcar como Oportunidade'}
            </div>
            <div style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>
              Produto com desconto especial ou validade próxima
            </div>
          </div>
          <div style={{
            marginLeft: 'auto', width: 28, height: 28, borderRadius: 20,
            background: isOpp ? '#d97706' : '#1a3a50',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {isOpp && <Check size={14} color='#fff' />}
          </div>
        </button>

        {/* Observação */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', color: '#6ee7b7', fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>
            OBSERVAÇÃO <span style={{ color: '#475569', fontWeight: 400, fontSize: 11 }}>(opcional)</span>
          </label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder='Ex: Último lote, queimando estoque...'
            rows={2}
            style={{
              width: '100%', background: '#0a1f30', border: '1.5px solid #1a3a50',
              borderRadius: 12, padding: '12px 14px', color: '#f1f5f9', fontSize: 14,
              boxSizing: 'border-box', outline: 'none', resize: 'none', fontFamily: 'inherit',
            }}
          />
        </div>

        {markets.length === 0 && (
          <div style={{ background: '#1a0a0a', border: '1px solid #7f1d1d', borderRadius: 12,
            padding: '12px 14px', marginBottom: 16 }}>
            <div style={{ color: '#fca5a5', fontSize: 13, fontWeight: 700 }}>
              ⚠️ Nenhum mercado cadastrado
            </div>
            <div style={{ color: '#9f1239', fontSize: 11, marginTop: 2 }}>
              Adicione mercados na aba Mercados antes de publicar
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '16px 20px', background: '#0d2137', borderTop: '1px solid #1a3a50',
        paddingBottom: 'max(env(safe-area-inset-bottom,16px),16px)',
      }}>
        <GreenBtn full onClick={handlePublish} disabled={!canPublish || publishing}>
          {publishing ? (
            <><Clock size={18} className="animate-spin" /> Publicando...</>
          ) : (
            <><Send size={18} /> Publicar Oferta {markets.length > 0 ? `+ Notificar ${markets.length} mercado${markets.length>1?'s':''}` : ''}</>
          )}
        </GreenBtn>
      </div>
    </div>
  )
}

/* ── MAIN COMPONENT ─────────────────────────────────────────── */
export default function Fornecedor() {
  /* supplier profile — stored in localStorage */
  const [supplier, setSupplier] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LOCAL) || 'null') } catch { return null }
  })

  /* data */
  const [offers,   setOffers]   = useState([])
  const [markets,  setMarkets]  = useState(() => {
    if (!supplier) return []
    try { return JSON.parse(localStorage.getItem(`${LOCAL}_markets`) || '[]') } catch { return [] }
  })

  /* UI state */
  const [activeTab,     setActiveTab]     = useState('home') // home | nova | mercados
  const [showNova,      setShowNova]      = useState(false)
  const [addingMarket,  setAddingMarket]  = useState(false)
  const [newMarketName, setNewMarketName] = useState('')
  const [newMarketPhone,setNewMarketPhone]= useState('')
  const [offerToShare,  setOfferToShare]  = useState(null) // after publish → open wa
  const [loading,       setLoading]       = useState(true)
  const [waOverlay,     setWaOverlay]     = useState(null) // { offer }

  /* persist markets */
  useEffect(() => {
    if (supplier) localStorage.setItem(`${LOCAL}_markets`, JSON.stringify(markets))
  }, [markets, supplier])

  /* load offers from netlify */
  useEffect(() => {
    if (!supplier) return
    fetchOffers().then(o => { setOffers(o); setLoading(false) })
  }, [supplier])

  const myOffers = useMemo(() =>
    offers.filter(o => o.supplierName === supplier?.name)
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)),
    [offers, supplier]
  )

  /* setup done */
  function handleSetup(data) {
    const s = { ...data, id: uid() }
    setSupplier(s)
    localStorage.setItem(LOCAL, JSON.stringify(s))
    fetchOffers().then(o => { setOffers(o); setLoading(false) })
  }

  /* add market */
  function handleAddMarket() {
    if (!newMarketName.trim() || !newMarketPhone.trim()) return
    const m = { id: uid(), name: newMarketName.trim(), phone: newMarketPhone.trim() }
    setMarkets(prev => [...prev, m])
    setNewMarketName('')
    setNewMarketPhone('')
    setAddingMarket(false)
  }

  /* delete market */
  function handleDeleteMarket(id) {
    setMarkets(prev => prev.filter(m => m.id !== id))
  }

  /* delete offer */
  async function handleDeleteOffer(id) {
    const updated = offers.filter(o => o.id !== id)
    setOffers(updated)
    await persistOffers(updated)
  }

  /* after publish — show WA dispatch */
  function handlePublished(newOffer, allOffers) {
    setOffers(allOffers)
    setShowNova(false)
    setWaOverlay(newOffer)
  }

  /* send WA to all markets */
  function openWaForMarket(offer, market) {
    window.open(waLink(market.phone, buildOfferMsg(offer, supplier.name)), '_blank')
  }

  /* logout */
  function handleLogout() {
    localStorage.removeItem(LOCAL)
    setSupplier(null)
  }

  /* ── setup gate ── */
  if (!supplier) return <SetupScreen onDone={handleSetup} />

  /* ── camera overlay ── */
  if (showNova) {
    return (
      <NovaOfertaSheet
        supplierName={supplier.name}
        markets={markets}
        onClose={() => setShowNova(false)}
        onPublish={handlePublished}
      />
    )
  }

  /* ── WA dispatch overlay ── */
  if (waOverlay) {
    const offer = waOverlay
    return (
      <div style={{ minHeight: '100dvh', background: '#060e1a', display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 20px' }}>
        <div style={{
          width: 72, height: 72, borderRadius: 22, background: '#14532d',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
        }}>
          <CheckCircle size={34} color='#4ade80' />
        </div>
        <h2 style={{ color: '#f0fdf4', fontWeight: 900, fontSize: 22, margin: '0 0 6px', textAlign: 'center' }}>
          Oferta Publicada! 🎉
        </h2>
        <p style={{ color: '#4ade80', fontSize: 14, margin: '0 0 32px', textAlign: 'center' }}>
          Notifique os mercados pelo WhatsApp
        </p>

        <div style={{ width: '100%', maxWidth: 380 }}>
          {markets.length === 0 && (
            <div style={{ background: '#1a0a0a', border: '1px solid #7f1d1d', borderRadius: 12,
              padding: '14px 16px', marginBottom: 16, color: '#fca5a5', textAlign: 'center', fontSize: 13 }}>
              Nenhum mercado cadastrado. Adicione na aba Mercados.
            </div>
          )}

          {markets.map(m => (
            <button key={m.id}
              onClick={() => openWaForMarket(offer, m)}
              style={{
                width: '100%', background: '#0a2a1a', border: '1.5px solid #059669', borderRadius: 14,
                padding: '16px 18px', cursor: 'pointer', marginBottom: 10,
                display: 'flex', alignItems: 'center', gap: 14,
              }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 12, background: '#14532d',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <MessageCircle size={20} color='#4ade80' />
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ color: '#f0fdf4', fontWeight: 800, fontSize: 14 }}>{m.name}</div>
                <div style={{ color: '#4ade80', fontSize: 12 }}>Toque para abrir o WhatsApp →</div>
              </div>
            </button>
          ))}

          <GreenBtn full onClick={() => setWaOverlay(null)} secondary style={{ marginTop: 16 }}>
            <Check size={16} /> Pronto, fechar
          </GreenBtn>
        </div>
      </div>
    )
  }

  /* ── MAIN SHELL ── */
  const pending = myOffers.filter(o => o.status === 'pending').length
  const accepted = myOffers.filter(o => o.status === 'accepted').length

  return (
    <div style={{ minHeight: '100dvh', background: '#060e1a', fontFamily: 'system-ui, sans-serif' }}>
      {/* ── TOP BAR ── */}
      <div style={{
        background: '#0d2137', borderBottom: '1px solid #1a3a50',
        padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12,
        position: 'sticky', top: 0, zIndex: 40,
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 12, flexShrink: 0,
          background: 'linear-gradient(135deg,#10b981,#0d9488)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Truck size={18} color='#fff' />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#f0fdf4', fontWeight: 900, fontSize: 16, letterSpacing: '-0.5px',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {supplier.name}
          </div>
          <div style={{ color: '#4ade80', fontSize: 11 }}>Portal do Fornecedor</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#10b981', fontWeight: 900, fontSize: 18 }}>{myOffers.length}</div>
            <div style={{ color: '#475569', fontSize: 10 }}>ofertas</div>
          </div>
        </div>
      </div>

      {/* ── TAB CONTENT ── */}
      <div style={{ paddingBottom: 90 }}>

        {/* HOME TAB */}
        {activeTab === 'home' && (
          <div style={{ padding: '20px 20px' }}>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
              {[
                { label: 'Publicadas', value: myOffers.length, color: '#10b981', bg: '#0a2a1a' },
                { label: 'Aceitas',    value: accepted,        color: '#60a5fa', bg: '#0a1f38' },
                { label: 'Mercados',   value: markets.length,  color: '#a78bfa', bg: '#1a0a38' },
              ].map(s => (
                <div key={s.label} style={{
                  background: s.bg, border: `1px solid ${s.color}33`, borderRadius: 14,
                  padding: '14px 12px', textAlign: 'center',
                }}>
                  <div style={{ color: s.color, fontWeight: 900, fontSize: 22 }}>{s.value}</div>
                  <div style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <button
              onClick={() => setShowNova(true)}
              style={{
                width: '100%', padding: '20px 24px', borderRadius: 18, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg,#10b981 0%,#0d9488 50%,#059669 100%)',
                display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28,
                boxShadow: '0 8px 32px rgba(16,185,129,0.3)',
              }}
            >
              <div style={{
                width: 52, height: 52, borderRadius: 16, background: 'rgba(255,255,255,.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Plus size={26} color='#fff' />
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ color: '#fff', fontWeight: 900, fontSize: 18, lineHeight: 1.1 }}>
                  Nova Oferta
                </div>
                <div style={{ color: '#d1fae5', fontSize: 13, marginTop: 3 }}>
                  Escanear produto e notificar mercados
                </div>
              </div>
              <ChevronRight size={22} color='rgba(255,255,255,.7)' style={{ marginLeft: 'auto' }} />
            </button>

            {/* Recent offers */}
            <div style={{ color: '#6ee7b7', fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 14 }}>
              MINHAS OFERTAS RECENTES
            </div>

            {loading && (
              <div style={{ textAlign: 'center', color: '#475569', padding: '40px 0', fontSize: 14 }}>
                Carregando...
              </div>
            )}

            {!loading && myOffers.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Package size={40} color='#1a3a50' style={{ margin: '0 auto 12px' }} />
                <div style={{ color: '#334155', fontSize: 14, fontWeight: 600 }}>Nenhuma oferta publicada</div>
                <div style={{ color: '#1e3a50', fontSize: 12, marginTop: 4 }}>Toque em "Nova Oferta" para começar</div>
              </div>
            )}

            {myOffers.map(offer => (
              <OfferCard
                key={offer.id}
                offer={offer}
                onWhatsApp={o => setWaOverlay(o)}
                onDelete={handleDeleteOffer}
              />
            ))}
          </div>
        )}

        {/* MERCADOS TAB */}
        {activeTab === 'mercados' && (
          <div style={{ padding: '20px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <div style={{ color: '#f0fdf4', fontWeight: 900, fontSize: 18 }}>Meus Mercados</div>
                <div style={{ color: '#475569', fontSize: 12 }}>{markets.length} mercado{markets.length !== 1 ? 's' : ''} cadastrado{markets.length !== 1 ? 's' : ''}</div>
              </div>
              <button onClick={() => setAddingMarket(true)} style={{
                background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', borderRadius: 12,
                padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                gap: 6, color: '#fff', fontWeight: 800, fontSize: 13,
              }}>
                <Plus size={16} /> Adicionar
              </button>
            </div>

            {/* Add market form */}
            {addingMarket && (
              <div style={{ background: '#0d2137', border: '1.5px solid #059669', borderRadius: 16,
                padding: '18px 16px', marginBottom: 20 }}>
                <div style={{ color: '#6ee7b7', fontWeight: 800, fontSize: 14, marginBottom: 14 }}>
                  Novo Mercado
                </div>
                <input
                  value={newMarketName}
                  onChange={e => setNewMarketName(e.target.value)}
                  placeholder='Nome do mercado'
                  style={{
                    width: '100%', background: '#0a1f30', border: '1.5px solid #1a3a50',
                    borderRadius: 12, padding: '12px 14px', color: '#f1f5f9', fontSize: 14,
                    marginBottom: 10, boxSizing: 'border-box', outline: 'none',
                  }}
                />
                <input
                  value={newMarketPhone}
                  onChange={e => setNewMarketPhone(e.target.value)}
                  placeholder='WhatsApp (15) 99999-9999'
                  type='tel'
                  style={{
                    width: '100%', background: '#0a1f30', border: '1.5px solid #1a3a50',
                    borderRadius: 12, padding: '12px 14px', color: '#f1f5f9', fontSize: 14,
                    marginBottom: 14, boxSizing: 'border-box', outline: 'none',
                  }}
                />
                <div style={{ display: 'flex', gap: 10 }}>
                  <GreenBtn onClick={handleAddMarket} small>
                    <Check size={14} /> Salvar
                  </GreenBtn>
                  <GreenBtn onClick={() => setAddingMarket(false)} small secondary>
                    Cancelar
                  </GreenBtn>
                </div>
              </div>
            )}

            {markets.length === 0 && !addingMarket && (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <ShoppingCart size={40} color='#1a3a50' style={{ margin: '0 auto 12px' }} />
                <div style={{ color: '#334155', fontSize: 14, fontWeight: 600 }}>Nenhum mercado ainda</div>
                <div style={{ color: '#1e3a50', fontSize: 12, marginTop: 4 }}>
                  Adicione os mercados que você abastece
                </div>
              </div>
            )}

            {markets.map(m => (
              <MarketItem
                key={m.id}
                m={m}
                onDelete={handleDeleteMarket}
                onWhatsApp={m => window.open(`https://wa.me/${cleanPhone(m.phone)}`, '_blank')}
              />
            ))}

            {/* Link to share with market */}
            <div style={{ marginTop: 28, background: '#0d2137', border: '1px solid #1a3a50',
              borderRadius: 14, padding: '16px' }}>
              <div style={{ color: '#6ee7b7', fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>
                LINK DO PORTAL DE OFERTAS (para o mercado)
              </div>
              <div style={{ background: '#0a1f30', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
                <span style={{ color: '#4ade80', fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  https://corta-precos-pdv.netlify.app/ofertas
                </span>
              </div>
              <div style={{ color: '#475569', fontSize: 11 }}>
                Envie este link para o dono do mercado ver e aceitar suas ofertas
              </div>
            </div>

            {/* Logout */}
            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <button onClick={handleLogout} style={{
                background: 'none', border: '1px solid #1a3a50', borderRadius: 10,
                padding: '10px 20px', color: '#475569', cursor: 'pointer', fontSize: 12,
              }}>
                Trocar fornecedor / Sair
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── BOTTOM TABS ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: '#0d2137', borderTop: '1px solid #1a3a50',
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        paddingBottom: 'max(env(safe-area-inset-bottom,4px),4px)',
      }}>
        {[
          { tab: 'home',     icon: BarChart3,     label: 'Início',   badge: pending > 0 ? pending : 0 },
          { tab: 'nova',     icon: Plus,          label: 'Nova Oferta', action: () => setShowNova(true) },
          { tab: 'mercados', icon: Users,          label: 'Mercados', badge: markets.length },
        ].map(({ tab, icon: Icon, label, badge, action }) => {
          const active = activeTab === tab
          return (
            <button
              key={tab}
              onClick={action || (() => setActiveTab(tab))}
              style={{
                background: tab === 'nova'
                  ? 'linear-gradient(135deg,#10b981,#059669)'
                  : 'none',
                border: 'none', cursor: 'pointer', padding: '12px 8px 8px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                margin: tab === 'nova' ? '6px 16px' : 0,
                borderRadius: tab === 'nova' ? 16 : 0,
                position: 'relative',
              }}
            >
              {badge > 0 && tab !== 'nova' && (
                <div style={{
                  position: 'absolute', top: 8, right: '50%', transform: 'translateX(10px)',
                  background: '#ef4444', color: '#fff', borderRadius: 10, minWidth: 16,
                  height: 16, fontSize: 10, fontWeight: 900, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', padding: '0 4px',
                }}>
                  {badge}
                </div>
              )}
              <Icon size={tab === 'nova' ? 22 : 20}
                color={tab === 'nova' ? '#fff' : active ? '#10b981' : '#475569'} />
              <span style={{
                fontSize: 10, fontWeight: 700,
                color: tab === 'nova' ? '#fff' : active ? '#10b981' : '#475569',
              }}>
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
