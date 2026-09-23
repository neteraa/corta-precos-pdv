/**
 * /home — Tela inicial do admin: launcher de ícones estilo ERP.
 * Fundo claro, ícones outline laranja, label acima, grid 5 colunas.
 */
import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShoppingCart, LayoutDashboard, Package, Receipt,
  Warehouse, Users, HandCoins, BarChart2, Tag,
  Printer, CalendarClock, Megaphone, QrCode, Star, Settings,
  Monitor, Camera, Truck, Sparkles,
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
  { to: '/promocoes',   icon: Tag,             label: 'Promoções',       roles: ['admin','gerente'] },
  { to: '/scan',        icon: Camera,          label: 'Scanner Celular', roles: null,      target: '_blank', scanUrl: true },
  // Gestão
  { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard',       roles: ['admin','gerente'] },
  { to: '/produtos',    icon: Package,         label: 'Produtos',        roles: ['admin'] },
  { to: '/vendas',      icon: Receipt,         label: 'Vendas',          roles: ['admin','gerente'] },
  { to: '/estoque',     icon: Warehouse,       label: 'Estoque',         roles: ['admin','gerente'] },
  { to: '/clientes',    icon: Users,           label: 'Clientes',        roles: ['admin','gerente'] },
  { to: '/fiado',       icon: HandCoins,       label: 'Fiado',           roles: null },
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
  const { supplierOffers } = useStore()
  const role         = getRole()
  const session      = (() => { try { return JSON.parse(localStorage.getItem('cp_session') || '{}') } catch { return {} } })()
  const storeName    = session.storeName || settings.storeName || 'MEU MERCADO'
  const themeColor   = settings.themeColor || '#f97316'
  const nicheMeta    = getNicheMeta(session.niche || 'mercado')
  const logoImg      = settings.logoImage

  const pendingOffers = (supplierOffers || []).filter(o => o.status === 'pending').length

  const modules = useMemo(() => {
    return ALL_MODULES
      .filter(m => !m.roles || m.roles.includes(role))
      .map(m => {
        if (m.to === '/ofertas' && pendingOffers > 0) return { ...m, badge: String(pendingOffers) }
        return m
      })
  }, [role, pendingOffers])

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
    </div>
  )
}
