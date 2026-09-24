/**
 * /home — Tela inicial do admin: launcher de ícones estilo ERP.
 * Fundo claro, ícones outline laranja, label acima, grid 5 colunas.
 */
import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShoppingCart, LayoutDashboard, Package, Receipt,
  Warehouse, Users, HandCoins, BarChart2, Tag,
  Printer, CalendarClock, Megaphone, QrCode, Star, Settings,
  Monitor, Camera, Truck, Sparkles, Bike, Building2,
  Check, X, AlertTriangle,
} from 'lucide-react'
import { usePrinter, getNicheMeta } from '../hooks/usePrinter.js'
import { getRole } from '../utils/auth.js'
import { getMktStoreId, getMktStoreToken } from '../utils/tenantStorage.js'
import { useStore } from '../store.jsx'

/* ── catálogo de módulos ─────────────────────────────────── */
const ALL_MODULES = [
  // Operação
  { to: '/pdv',         icon: ShoppingCart,   label: 'PDV / Caixa',     roles: null },
  { to: '/terminal',    icon: Monitor,         label: 'Terminal Caixa',  roles: null,      target: '_blank' },
  { to: '/entrega',     icon: Bike,            label: 'Entregas 🛵',     roles: ['admin','gerente'] },
  { to: '/promocoes',   icon: Tag,             label: 'Promoções',       roles: ['admin','gerente'] },
  { to: '/scan',        icon: Camera,          label: 'Scanner Celular', roles: null,      target: '_blank', scanUrl: true },
  // Gestão
  { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard',       roles: ['admin','gerente'] },
  { to: '/produtos',    icon: Package,         label: 'Produtos',        roles: ['admin'] },
  { to: '/vendas',      icon: Receipt,         label: 'Vendas',          roles: ['admin','gerente'] },
  { to: '/estoque',     icon: Warehouse,       label: 'Estoque',         roles: ['admin','gerente'] },
  { to: '/clientes',     icon: Users,      label: 'Clientes',     roles: ['admin','gerente'] },
  { to: '/fornecedores', icon: Building2,  label: 'Fornecedores', roles: ['admin','gerente'] },
  { to: '/fiado',        icon: HandCoins,  label: 'Fiado',        roles: null },
  { to: '/relatorio',   icon: BarChart2,       label: 'Relatório',       roles: ['admin','gerente'] },
  // Marketing & Extras
  { to: '/campanhas',   icon: Megaphone,       label: 'Campanhas ZAP',   roles: ['admin','gerente'], badge: 'NOVO' },
  { to: '/fidelidade',  icon: QrCode,          label: 'Fidelidade ZAP',  roles: ['admin','gerente'] },
  { to: '/etiquetas',   icon: Printer,         label: 'Etiquetas',       roles: ['admin','gerente'] },
  { to: '/validade',    icon: CalendarClock,   label: 'Validade',        roles: ['admin','gerente'] },
  { to: '/flyer',       icon: Star,            label: 'Flyer Sorteio',   roles: ['admin','gerente'] },
  { to: '/ofertas',     icon: Truck,           label: 'Ofertas Distrib.',roles: ['admin','gerente'] },
  { to: '/configuracoes', icon: Settings,      label: 'Configurações',   roles: ['admin'] },
]

function ModuleCard({ icon: Icon, label, badge, themeColor, onClick }) {
  const [hov, setHov] = React.useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
        padding: '18px 10px 20px',
        background: hov ? `${themeColor}08` : '#ffffff',
        border: `1px solid ${hov ? themeColor + '44' : '#e5e7eb'}`,
        borderRadius: 16,
        cursor: 'pointer',
        transition: 'all .15s',
        transform: hov ? 'translateY(-2px)' : 'none',
        boxShadow: hov ? `0 6px 20px ${themeColor}18` : '0 1px 3px rgba(0,0,0,0.05)',
        gap: 10,
        position: 'relative',
        minHeight: 120,
      }}
    >
      {badge && (
        <span style={{
          position: 'absolute', top: 8, right: 8,
          fontSize: 8, fontWeight: 900, letterSpacing: 0.5,
          background: '#22c55e', color: '#fff',
          padding: '2px 6px', borderRadius: 100,
        }}>
          {badge}
        </span>
      )}
      {/* label ABOVE icon (como no print) */}
      <span style={{
        fontSize: 11, fontWeight: 600, color: hov ? themeColor : '#6b7280',
        textAlign: 'center', lineHeight: 1.3, letterSpacing: 0.1,
        transition: 'color .15s',
      }}>
        {label}
      </span>
      {/* icon — outline, strokeWidth baixo para parecer line-art */}
      <Icon
        strokeWidth={1.25}
        style={{
          width: 48, height: 48,
          color: hov ? themeColor : `${themeColor}cc`,
          transition: 'color .15s, transform .15s',
          transform: hov ? 'scale(1.08)' : 'none',
        }}
      />
    </button>
  )
}

export default function Home() {
  const navigate     = useNavigate()
  const { settings } = usePrinter()
  const { supplierOffers, products, expiryAlertDays, cancelRequests, resolveCancel } = useStore()
  const role         = getRole()
  const [showCancelModal, setShowCancelModal] = useState(false)
  const session      = (() => { try { return JSON.parse(localStorage.getItem('cp_session') || '{}') } catch { return {} } })()
  const storeName    = session.storeName || settings.storeName || 'MEU MERCADO'
  const themeColor   = settings.themeColor || '#f97316'
  const nicheMeta    = getNicheMeta(session.niche || 'mercado')
  const logoImg      = settings.logoImage

  const pendingOffers   = (supplierOffers || []).filter(o => o.status === 'pending').length
  const pendingCancels  = (cancelRequests || []).filter(r => r.status === 'pending').length
  const BRL = v => v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? 'R$ 0,00'

  const expiringCount = useMemo(() => {
    const warn   = expiryAlertDays || 30
    const cutoff = Date.now() + warn * 86400000
    return (products || []).filter(p => {
      if (!p.expiryDate) return false
      return new Date(p.expiryDate + 'T00:00').getTime() <= cutoff
    }).length
  }, [products, expiryAlertDays])

  const modules = useMemo(() => {
    return ALL_MODULES
      .filter(m => !m.roles || m.roles.includes(role))
      .map(m => {
        if (m.to === '/ofertas'  && pendingOffers  > 0) return { ...m, badge: String(pendingOffers) }
        if (m.to === '/validade' && expiringCount  > 0) return { ...m, badge: String(expiringCount) }
        return m
      })
  }, [role, pendingOffers, expiringCount])

  const handleClick = (m) => {
    if (m.scanUrl) {
      window.open(`/scan?storeId=${getMktStoreId()}&t=${getMktStoreToken()}`, '_blank', 'noopener')
      return
    }
    if (m.target === '_blank') {
      window.open(m.to, '_blank', 'noopener')
      return
    }
    navigate(m.to)
  }

  return (
    <div style={{ minHeight: '100%' }}>

      {/* ── Cancel requests banner ──────────────────── */}
      {pendingCancels > 0 && (
        <button
          onClick={() => setShowCancelModal(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            background: '#1a0800', border: '1.5px solid #c2410c55',
            borderRadius: 12, padding: '12px 18px', marginBottom: 20,
            cursor: 'pointer', textAlign: 'left',
          }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertTriangle style={{ width: 18, height: 18, color: '#000' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 900, fontSize: 14, color: '#fb923c' }}>
              {pendingCancels} solicitação{pendingCancels > 1 ? 'ões' : ''} de cancelamento pendente{pendingCancels > 1 ? 's' : ''}
            </div>
            <div style={{ fontSize: 11, color: '#9a3412', marginTop: 1 }}>
              Caixa aguardando sua autorização — clique para revisar
            </div>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#fb923c', background: '#ea580c22', padding: '4px 10px', borderRadius: 6 }}>Revisar →</div>
        </button>
      )}

      {/* ── Store header ──────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 28, gap: 16, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {logoImg
            ? <img src={logoImg} alt="logo" style={{ height: 44, maxWidth: 120, objectFit: 'contain', borderRadius: 10 }} />
            : (
              <div style={{
                width: 48, height: 48, borderRadius: 14, fontSize: 24,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `linear-gradient(135deg, ${themeColor}, color-mix(in srgb, ${themeColor} 60%, #000))`,
                boxShadow: `0 4px 14px ${themeColor}44`,
              }}>
                {nicheMeta.emoji}
              </div>
            )
          }
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: '#111827', margin: 0, lineHeight: 1.1 }}>
              {storeName}
            </h1>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: 1, textTransform: 'uppercase' }}>
              {nicheMeta.label} · Painel Administrativo
            </span>
          </div>
        </div>
        {/* botão de atalho para Terminal (o mais usado) */}
        <button
          onClick={() => window.open('/terminal', '_blank', 'noopener')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 12,
            background: `linear-gradient(135deg, ${themeColor}, color-mix(in srgb, ${themeColor} 70%, #000))`,
            color: '#fff', fontWeight: 800, fontSize: 13,
            border: 'none', cursor: 'pointer',
            boxShadow: `0 4px 16px ${themeColor}44`,
          }}
        >
          <Monitor style={{ width: 16, height: 16 }} />
          Abrir Terminal de Caixa
        </button>
      </div>

      {/* ── Icon grid ───────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
        gap: 12,
      }}>
        {modules.map(m => (
          <ModuleCard
            key={m.to}
            {...m}
            themeColor={themeColor}
            onClick={() => handleClick(m)}
          />
        ))}
      </div>

      {/* ── Powered by footer ───────────────────────── */}
      <div style={{ textAlign: 'center', marginTop: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <Sparkles style={{ width: 12, height: 12, color: themeColor }} />
        <span style={{ fontSize: 11, color: '#d1d5db', fontWeight: 600, letterSpacing: 0.5 }}>
          ZatendeStok · sistema inteligente para varejo
        </span>
      </div>

      {/* ════════════════════════════════════════════════════
          CANCEL APPROVAL MODAL
      ════════════════════════════════════════════════════ */}
      {showCancelModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
             onClick={() => setShowCancelModal(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#0a0a0a', border: '1px solid #1c1c1c', borderRadius: 18, padding: 28, width: '100%', maxWidth: 520, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,.9)' }}>

            {/* header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 17, color: '#efefef' }}>Autorização de Cancelamento</div>
                <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>Revise cada solicitação e aprove ou negue</div>
              </div>
              <button onClick={() => setShowCancelModal(false)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: 4 }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            {(cancelRequests || []).length === 0 ? (
              <div style={{ textAlign: 'center', color: '#555', padding: '24px 0', fontSize: 13 }}>Nenhuma solicitação de cancelamento</div>
            ) : [...(cancelRequests || [])].sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt)).map(req => {
              const ago = Math.round((Date.now() - new Date(req.requestedAt).getTime()) / 60000)
              const isPending = req.status === 'pending'
              return (
                <div key={req.id} style={{ background: '#111', border: `1px solid ${isPending ? '#c2410c33' : '#1c1c1c'}`, borderRadius: 12, padding: '14px 16px', marginBottom: 10 }}>
                  {/* info row */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 900, fontSize: 13, color: '#efefef' }}>PDV {req.terminal} — {req.operatorName}</span>
                        <span style={{ fontSize: 9, color: '#555', fontFamily: 'monospace' }}>{ago}min atrás</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#555', marginBottom: 2 }}>Forma: {req.payment}</div>
                      {(req.items || []).slice(0, 3).map((it, i) => (
                        <div key={i} style={{ fontSize: 10, color: '#444' }}>{it.qty}× {it.name}</div>
                      ))}
                      {(req.items || []).length > 3 && <div style={{ fontSize: 10, color: '#333' }}>+{req.items.length - 3} item(s)</div>}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                      <div style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 900, color: '#ea580c' }}>{BRL(req.total)}</div>
                      <div style={{ fontSize: 10, color: isPending ? '#f59e0b' : req.status === 'approved' ? '#4ade80' : '#f87171', fontWeight: 700, marginTop: 3 }}>
                        {isPending ? '⏳ Pendente' : req.status === 'approved' ? '✅ Aprovado' : '❌ Negado'}
                        {!isPending && req.resolvedBy && <span style={{ color: '#444' }}> · {req.resolvedBy}</span>}
                      </div>
                    </div>
                  </div>

                  {/* action buttons (only for pending) */}
                  {isPending && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => resolveCancel(req.id, 'denied', session.storeName || 'Admin')}
                        style={{ flex: 1, padding: '9px', borderRadius: 8, background: 'transparent', border: '1px solid #7f1d1d', color: '#f87171', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                        <X style={{ width: 13, height: 13, display: 'inline', marginRight: 4 }} />Negar
                      </button>
                      <button
                        onClick={() => resolveCancel(req.id, 'approved', session.storeName || 'Admin')}
                        style={{ flex: 2, padding: '9px', borderRadius: 8, background: '#16a34a', border: 'none', color: '#fff', fontWeight: 900, fontSize: 13, cursor: 'pointer' }}>
                        <Check style={{ width: 13, height: 13, display: 'inline', marginRight: 4 }} />Aprovar Cancelamento
                      </button>
                    </div>
                  )}
                </div>
              )
            })}

            <button onClick={() => setShowCancelModal(false)}
              style={{ width: '100%', padding: '10px', borderRadius: 10, background: '#111', border: '1px solid #1c1c1c', color: '#555', fontWeight: 700, fontSize: 12, cursor: 'pointer', marginTop: 6 }}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
