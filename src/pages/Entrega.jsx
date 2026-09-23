/**
 * /entrega — Pedidos de delivery (Corta Preços)
 * Taxa fixa R$7,00 · PIX · endereço para Uber/99 Taxi
 */
import React, { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw, MapPin, CheckCircle, XCircle, Copy, Phone,
  Clock, Package, Bike, AlertCircle, ChevronDown, ChevronUp,
} from 'lucide-react'
import { getMktStoreId } from '../utils/tenantStorage.js'

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const STATUS_CONFIG = {
  pending:   { label: 'Aguardando',   color: '#f59e0b', bg: '#fef3c7', icon: Clock },
  confirmed: { label: 'Confirmado',   color: '#3b82f6', bg: '#dbeafe', icon: Package },
  delivering:{ label: 'Em rota',      color: '#8b5cf6', bg: '#ede9fe', icon: Bike },
  delivered: { label: 'Entregue',     color: '#22c55e', bg: '#dcfce7', icon: CheckCircle },
  cancelled: { label: 'Cancelado',    color: '#ef4444', bg: '#fee2e2', icon: XCircle },
}

const STATUS_NEXT = {
  pending:    'confirmed',
  confirmed:  'delivering',
  delivering: 'delivered',
}

function copyToClipboard(text) {
  navigator.clipboard?.writeText(text).catch(() => {
    const el = document.createElement('textarea')
    el.value = text; document.body.appendChild(el); el.select()
    document.execCommand('copy'); document.body.removeChild(el)
  })
}

function OrderCard({ order, onUpdate }) {
  const [open,    setOpen]    = useState(order.status === 'pending')
  const [loading, setLoading] = useState(false)
  const [copied,  setCopied]  = useState(false)

  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
  const StatusIcon = cfg.icon

  const handleCopyAddress = () => {
    copyToClipboard(order.address || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleStatus = async (newStatus) => {
    setLoading(true)
    await onUpdate(order.id, { status: newStatus })
    setLoading(false)
  }

  const waLink = `https://wa.me/${(order.phone || '').replace(/\D/g, '')}?text=Oi+${encodeURIComponent(order.name || '')}!+Seu+pedido+está+a+caminho!+🛵`

  const timeAgo = () => {
    const diff = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000)
    if (diff < 1)  return 'agora mesmo'
    if (diff < 60) return `há ${diff} min`
    return `há ${Math.floor(diff / 60)}h`
  }

  return (
    <div style={{
      background: '#fff',
      borderRadius: 16,
      border: `1.5px solid ${order.status === 'pending' ? cfg.color + '55' : '#e5e7eb'}`,
      boxShadow: order.status === 'pending' ? `0 4px 20px ${cfg.color}20` : '0 1px 3px rgba(0,0,0,0.06)',
      transition: 'all .2s',
    }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer' }}
        onClick={() => setOpen(o => !o)}>
        {/* Status badge */}
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 800, background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>
          <StatusIcon style={{ width: 12, height: 12 }} />
          {cfg.label}
        </span>

        {/* Customer info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#111827', display: 'flex', alignItems: 'center', gap: 6 }}>
            {order.name || order.waName || order.phone || 'Cliente'}
            <span style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af' }}>{timeAgo()}</span>
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <MapPin style={{ width: 11, height: 11 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>
              {order.address || '—'}
            </span>
          </div>
        </div>

        {/* Total */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontWeight: 900, fontSize: 16, color: '#111827' }}>{BRL.format(order.total || 0)}</div>
          <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>+ R$7 entrega</div>
        </div>

        {open ? <ChevronUp style={{ width: 16, height: 16, color: '#9ca3af', flexShrink: 0 }} />
               : <ChevronDown style={{ width: 16, height: 16, color: '#9ca3af', flexShrink: 0 }} />}
      </div>

      {/* ── Expanded body ── */}
      {open && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid #f3f4f6' }}>
          {/* Items */}
          {order.items && (
            <div style={{ marginTop: 12, padding: '10px 12px', background: '#f9fafb', borderRadius: 10, fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
              <div style={{ fontWeight: 700, fontSize: 11, color: '#9ca3af', letterSpacing: 1, marginBottom: 4 }}>PEDIDO</div>
              {order.items}
            </div>
          )}

          {/* Summary */}
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 120, padding: '8px 12px', background: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', letterSpacing: 1 }}>PIX TOTAL</div>
              <div style={{ fontWeight: 900, fontSize: 18, color: '#15803d' }}>
                {BRL.format((order.total || 0) + (order.deliveryFee || 7))}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 120, padding: '8px 12px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', letterSpacing: 1 }}>ENDEREÇO</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#334155', marginTop: 2 }}>{order.address || '—'}</div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {/* Copiar endereço */}
            <button onClick={handleCopyAddress}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12, background: copied ? '#dcfce7' : '#f3f4f6', color: copied ? '#16a34a' : '#374151', transition: 'all .15s' }}>
              <Copy style={{ width: 13, height: 13 }} />
              {copied ? 'Copiado!' : 'Copiar endereço (Uber/99)'}
            </button>

            {/* WhatsApp cliente */}
            {order.phone && (
              <a href={waLink} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, textDecoration: 'none', fontWeight: 700, fontSize: 12, background: '#dcfce7', color: '#15803d' }}>
                <Phone style={{ width: 13, height: 13 }} />
                Avisar cliente
              </a>
            )}

            {/* Avançar status */}
            {STATUS_NEXT[order.status] && (
              <button onClick={() => handleStatus(STATUS_NEXT[order.status])} disabled={loading}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: 12, background: cfg.color, color: '#fff', opacity: loading ? 0.6 : 1, transition: 'all .15s', marginLeft: 'auto' }}>
                {loading ? <RefreshCw style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} /> : null}
                {order.status === 'pending'    ? '✓ Confirmar pedido'    :
                 order.status === 'confirmed'  ? '🛵 Saiu para entrega'  :
                                                  '✅ Marcar como entregue'}
              </button>
            )}

            {/* Cancelar */}
            {order.status !== 'delivered' && order.status !== 'cancelled' && (
              <button onClick={() => handleStatus('cancelled')} disabled={loading}
                style={{ padding: '8px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 11, background: '#fee2e2', color: '#dc2626' }}>
                ✕ Cancelar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Entrega() {
  const [orders,   setOrders]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState('active') // 'active' | 'all'
  const [lastFetch, setLastFetch] = useState(null)

  const storeId = getMktStoreId()

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/delivery?storeId=${storeId}`)
      const json = await res.json()
      if (json.ok) { setOrders(json.orders || []); setLastFetch(new Date()) }
    } catch (e) { console.error('Entrega fetch:', e.message) }
    setLoading(false)
  }, [storeId, token])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  // Auto-refresh every 15s + ao voltar para a aba
  useEffect(() => {
    const t = setInterval(fetchOrders, 15000)
    const onVisible = () => { if (document.visibilityState === 'visible') fetchOrders() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisible) }
  }, [fetchOrders])

  const handleUpdate = async (id, patch) => {
    try {
      const res  = await fetch(`/api/delivery?storeId=${storeId}&id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const json = await res.json()
      if (json.ok) {
        setOrders(prev => prev.map(o => o.id === id ? json.order : o))
      }
    } catch (e) { console.error('Entrega update:', e.message) }
  }

  const ACTIVE_STATUS = new Set(['pending', 'confirmed', 'delivering'])
  const shown = filter === 'active'
    ? orders.filter(o => ACTIVE_STATUS.has(o.status))
    : orders

  const pendingCount = orders.filter(o => o.status === 'pending').length

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            🛵 Pedidos de Entrega
            {pendingCount > 0 && (
              <span style={{ fontSize: 13, fontWeight: 900, background: '#f59e0b', color: '#fff', padding: '2px 10px', borderRadius: 100 }}>
                {pendingCount} aguardando
              </span>
            )}
          </h1>
          <p style={{ color: '#6b7280', fontSize: 13, margin: '4px 0 0' }}>
            Taxa R$7,00 · PIX only · {lastFetch ? `Atualizado ${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(lastFetch)}` : 'Carregando...'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Filter toggle */}
          <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 10, padding: 3 }}>
            {[['active', 'Ativos'], ['all', 'Todos']].map(([val, lbl]) => (
              <button key={val} onClick={() => setFilter(val)}
                style={{ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12, background: filter === val ? '#fff' : 'transparent', color: filter === val ? '#111827' : '#6b7280', boxShadow: filter === val ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all .15s' }}>
                {lbl}
              </button>
            ))}
          </div>
          {/* Refresh */}
          <button onClick={fetchOrders} disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 13, color: '#374151' }}>
            <RefreshCw style={{ width: 14, height: 14, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Atualizar
          </button>
        </div>
      </div>

      {/* ── How it works (if empty) ── */}
      {!loading && shown.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 24px', background: '#f9fafb', borderRadius: 16, border: '1.5px dashed #e5e7eb' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🛵</div>
          <div style={{ fontWeight: 800, fontSize: 18, color: '#374151', marginBottom: 8 }}>
            {filter === 'active' ? 'Nenhum pedido ativo no momento' : 'Nenhum pedido ainda'}
          </div>
          <div style={{ color: '#6b7280', fontSize: 14, maxWidth: 400, margin: '0 auto', lineHeight: 1.6 }}>
            Quando um cliente pedir entrega pelo WhatsApp, a Zara vai coletar o endereço e registrar aqui automaticamente.
            <br /><br />
            <strong>Taxa:</strong> R$7,00 fixo · <strong>Pagamento:</strong> PIX para (15) 9979-6930
          </div>
        </div>
      )}

      {/* ── Orders list ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {shown.map(order => (
          <OrderCard key={order.id} order={order} onUpdate={handleUpdate} />
        ))}
      </div>

      {/* ── Alert: endereço p/ Uber/99 ── */}
      {shown.some(o => o.status === 'confirmed' || o.status === 'delivering') && (
        <div style={{ marginTop: 16, padding: '12px 16px', background: '#eff6ff', borderRadius: 12, border: '1px solid #bfdbfe', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <AlertCircle style={{ width: 18, height: 18, color: '#3b82f6', flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13, color: '#1e40af' }}>
            <strong>Dica:</strong> clique em "Copiar endereço" no pedido e cole diretamente no app do Uber ou 99 Táxi para solicitar o entregador.
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
