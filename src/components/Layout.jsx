import React, { useState, useEffect, useCallback } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { Component } from 'react'
import IconTour, { shouldShowTour } from './IconTour.jsx'

class PageErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(e) { return { error: e } }
  render() {
    if (this.state.error)
      return (
        <div className="p-8 bg-red-50 rounded-2xl border border-red-200 m-4 max-w-lg">
          <p className="font-black text-red-700 text-lg mb-1">⚠️ Erro ao carregar esta página</p>
          <p className="text-sm text-red-600 mb-4">Tente recarregar. Se o problema persistir, entre em contato com o suporte.</p>
          <div className="flex gap-3">
            <button onClick={() => this.setState({ error: null })} className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700">↺ Tentar novamente</button>
            <a href="https://wa.me/5515997969303?text=Erro+no+sistema+ZatendeStok" target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700">💬 Chamar suporte</a>
          </div>
          {process.env.NODE_ENV !== 'production' && (
            <pre className="text-xs text-red-400 mt-4 whitespace-pre-wrap opacity-70">{String(this.state.error)}</pre>
          )}
        </div>
      )
    return this.props.children
  }
}
import { ZSMark } from './ZatendeStokLogo.jsx'
import {
  LayoutDashboard, ShoppingCart, Package, Receipt,
  Warehouse, Users, Settings, Menu,
  QrCode, Tag, Star, Download, Monitor, Camera, HandCoins, LogOut,
  BarChart2, Printer, CalendarClock, Megaphone, RefreshCw, Truck, X
} from 'lucide-react'
import { useInstallPWA } from '../hooks/useInstallPWA.js'
import { useOnlineStatus } from '../hooks/useOnlineStatus.js'
import { usePrinter, seedSettingsFromSession, getNicheMeta } from '../hooks/usePrinter.js'
import { useMarketCheck } from '../hooks/useMarketCheck.js'
import BlockedScreen from './BlockedScreen.jsx'
import { logout, getRole, getOperatorName, getTerminalId } from '../utils/auth.js'
import { getMktStoreId, getMktStoreToken } from '../utils/tenantStorage.js'
import { useStore } from '../store.jsx'

/* ── nav sections ─────────────────────────────────────────── */
const CAIXA = [
  { to: '/pdv',       icon: ShoppingCart, label: 'PDV / Caixa',    hot: true },
  { to: '/promocoes', icon: Tag,          label: 'Promoções',      roles: ['admin','gerente'] },
]
const GESTAO = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard',  roles: ['admin','gerente'] },
  { to: '/produtos',   icon: Package,         label: 'Produtos',   roles: ['admin'] },
  { to: '/vendas',     icon: Receipt,         label: 'Vendas',     roles: ['admin','gerente'] },
  { to: '/estoque',    icon: Warehouse,       label: 'Estoque',    roles: ['admin','gerente'] },
  { to: '/clientes',   icon: Users,           label: 'Clientes',   roles: ['admin','gerente'] },
  { to: '/fiado',      icon: HandCoins,       label: 'Fiado' },
  { to: '/relatorio',  icon: BarChart2,       label: 'Relatório',  roles: ['admin','gerente'] },
]
const EXTRAS = [
  { to: '/etiquetas',     icon: Printer,       label: 'Etiquetas',        roles: ['admin','gerente'] },
  { to: '/validade',      icon: CalendarClock, label: 'Validade',         roles: ['admin','gerente'] },
  { to: '/campanhas',     icon: Megaphone,     label: 'Campanhas / ZAP',  badge: 'NOVO', roles: ['admin','gerente'] },
  { to: '/fidelidade',    icon: QrCode,        label: 'Fidelidade / ZAP', roles: ['admin','gerente'] },
  { to: '/flyer',         icon: Star,          label: 'Flyer Sorteio',    roles: ['admin','gerente'] },
  { to: '/configuracoes', icon: Settings,      label: 'Configurações',    roles: ['admin'] },
]

function filterByRole(items, role) {
  return items.filter(item => !item.roles || item.roles.includes(role))
}

/* ─────────────────────────────────────────────────────────────
   RAIL ICON ITEM (desktop only — com tooltip)
───────────────────────────────────────────────────────────── */
function RailItem({ to, icon: Icon, label, badge, hot, onClick }) {
  const inner = (isActive) => (
    <>
      {/* left active accent */}
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 rounded-r-full"
          style={{ background: 'var(--zs-theme)', boxShadow: '0 0 8px var(--zs-theme)' }} />
      )}
      {/* icon wrapper */}
      <span className="relative flex items-center justify-center w-10 h-10 rounded-2xl transition-all duration-150"
        style={isActive
          ? { background: 'color-mix(in srgb, var(--zs-theme) 18%, transparent)', boxShadow: '0 0 0 1px color-mix(in srgb, var(--zs-theme) 30%, transparent)' }
          : {}}>
        <Icon className="w-[18px] h-[18px] transition-transform duration-150 group-hover:scale-110"
          style={{ color: isActive ? 'var(--zs-theme)' : '#52525b' }} />
        {/* badge dot */}
        {(badge || hot) && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border-[1.5px] border-gray-950"
            style={{ background: badge ? '#22c55e' : 'var(--zs-theme)', animation: hot ? 'pulse 2s infinite' : 'none' }} />
        )}
      </span>
      {/* tooltip */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2
          flex items-center gap-2
          px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap
          opacity-0 group-hover:opacity-100
          scale-95 group-hover:scale-100
          transition-all duration-150 z-[999]"
        style={{ background: '#18181b', color: '#f4f4f5', border: '1px solid rgba(255,255,255,0.09)', boxShadow: '0 8px 28px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.5)' }}>
        {label}
        {badge && <span className="text-[9px] font-black bg-green-500/20 text-green-400 border border-green-500/30 px-1.5 py-0.5 rounded-full">{badge}</span>}
      </span>
    </>
  )

  if (onClick) return (
    <button onClick={onClick}
      className="group relative flex items-center justify-center w-full py-0.5 cursor-pointer">
      {inner(false)}
    </button>
  )

  return (
    <NavLink to={to}
      className="group relative flex items-center justify-center w-full py-0.5">
      {({ isActive }) => inner(isActive)}
    </NavLink>
  )
}

/* ─────────────────────────────────────────────────────────────
   DRAWER NAV ITEM (mobile only — ícone + label)
───────────────────────────────────────────────────────────── */
function DrawerItem({ to, icon: Icon, label, badge, hot, onClose }) {
  return (
    <NavLink to={to} onClick={onClose}
      className="group relative flex items-center gap-3 mx-2 px-3 py-2.5 rounded-xl transition-colors duration-150">
      {({ isActive }) => (
        <>
          <span className="absolute inset-0 rounded-xl pointer-events-none transition-all"
            style={isActive ? { background: 'color-mix(in srgb, var(--zs-theme) 15%, transparent)', boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--zs-theme) 30%, transparent)' } : {}} />
          {isActive && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-7 rounded-r-full"
              style={{ background: 'var(--zs-theme)' }} />
          )}
          <Icon className="w-4 h-4 flex-shrink-0" style={{ color: isActive ? 'var(--zs-theme)' : '#71717a' }} />
          <span className="flex-1 text-[13px] font-semibold" style={{ color: isActive ? 'var(--zs-theme)' : '#d4d4d8' }}>{label}</span>
          {hot && !badge && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--zs-theme)' }} />}
          {badge && <span className="text-[9px] font-black bg-green-500/20 text-green-400 border border-green-500/30 px-1.5 py-0.5 rounded-full">{badge}</span>}
        </>
      )}
    </NavLink>
  )
}

/* ─────────────────────────────────────────────────────────────
   RAIL DIVIDER
───────────────────────────────────────────────────────────── */
const RailDivider = () => (
  <div className="mx-auto w-5 h-px my-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
)

/* ─────────────────────────────────────────────────────────────
   SYNC / ONLINE INDICATOR — compact for rail
───────────────────────────────────────────────────────────── */
function SyncDot() {
  const { syncNow, lastSync, syncing } = useStore()
  const online = useOnlineStatus()
  const [ago, setAgo]       = useState('')

  useEffect(() => {
    const update = () => {
      if (!lastSync) { setAgo(''); return }
      const s = Math.floor((Date.now() - lastSync) / 1000)
      if (s < 5)        setAgo('agora mesmo')
      else if (s < 60)  setAgo(`há ${s}s`)
      else              setAgo(`há ${Math.floor(s / 60)}min`)
    }
    update()
    const t = setInterval(update, 5000)
    return () => clearInterval(t)
  }, [lastSync])

  const color = !online ? '#f59e0b' : syncing ? '#facc15' : '#22c55e'
  const tip   = !online ? 'Offline — local' : syncing ? 'Sincronizando...' : `Sincronizado ${ago}`

  return (
    <button onClick={syncNow} disabled={syncing}
      className="group relative flex items-center justify-center w-full py-0.5"
      title={tip}>
      <span className="relative flex items-center justify-center w-10 h-10 rounded-2xl hover:bg-white/5 transition-all">
        <RefreshCw className="w-[17px] h-[17px] transition-transform" style={{ color, animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border-[1.5px] border-gray-950"
          style={{ background: color, boxShadow: syncing ? 'none' : `0 0 6px ${color}` }} />
      </span>
      {/* tooltip */}
      <span className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2
        px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap
        opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100
        transition-all duration-150 z-[999]"
        style={{ background: '#18181b', color: '#f4f4f5', border: '1px solid rgba(255,255,255,0.09)', boxShadow: '0 8px 28px rgba(0,0,0,0.55)' }}>
        {tip}
      </span>
    </button>
  )
}

/* ─────────────────────────────────────────────────────────────
   STORE AVATAR — topo do rail
───────────────────────────────────────────────────────────── */
function StoreAvatar({ name, emoji, themeColor, logoImg }) {
  const initial = (name || '?')[0].toUpperCase()
  return (
    <div className="group relative flex items-center justify-center w-full py-2">
      <div className="relative w-10 h-10 rounded-2xl flex items-center justify-center font-black text-base overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${themeColor}, color-mix(in srgb, ${themeColor} 60%, #000))`, boxShadow: `0 4px 14px color-mix(in srgb, ${themeColor} 40%, transparent)` }}>
        {logoImg
          ? <img src={logoImg} alt="logo" className="w-full h-full object-cover" />
          : <span className="text-white text-sm leading-none select-none">{emoji}</span>
        }
      </div>
      {/* tooltip com nome da loja */}
      <span className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2
        px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap
        opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100
        transition-all duration-150 z-[999]"
        style={{ background: '#18181b', color: '#f4f4f5', border: '1px solid rgba(255,255,255,0.09)', boxShadow: '0 8px 28px rgba(0,0,0,0.55)' }}>
        {name}
      </span>
    </div>
  )
}

const ROLE_LABEL = { admin: 'Admin', gerente: 'Gerente', caixa: 'Caixa' }
const ROLE_COLOR = { admin: '#f97316', gerente: '#818cf8', caixa: '#22c55e' }

export default function Layout() {
  const [open, setOpen]   = useState(false)
  const { canInstall, install } = useInstallPWA()
  const { supplierOffers } = useStore()
  const online            = useOnlineStatus()
  const navigate          = useNavigate()

  // Re-run seed on mount so stale branding names (e.g. "CORTA PREÇOS") are replaced
  useEffect(() => {
    seedSettingsFromSession()
    // Notify all usePrinter instances to re-read settings from localStorage
    window.dispatchEvent(new CustomEvent('cp-settings-saved', { detail: { sourceId: '__layout_seed__' } }))
  }, [])

  const marketCheck  = useMarketCheck()
  const role         = getRole()
  const operatorName = getOperatorName()
  const terminalId   = getTerminalId()
  const { settings: storeSettings } = usePrinter()
  const _session     = (() => { try { return JSON.parse(localStorage.getItem('cp_session') || '{}') } catch { return {} } })()
  const storeName    = _session.storeName || storeSettings.storeName || 'MEU MERCADO'
  const themeColor   = storeSettings.themeColor || '#f97316'
  const nicheMeta    = getNicheMeta(_session.niche || 'mercado')

  const [sessionExpired, setSessionExpired] = useState(() => {
    try { return localStorage.getItem('zs_session_expired') === '1' } catch { return false }
  })
  const [showTour, setShowTour] = useState(() => shouldShowTour())
  const openTour  = useCallback(() => setShowTour(true),  [])
  const closeTour = useCallback(() => setShowTour(false), [])
  useEffect(() => {
    const handler = () => setSessionExpired(true)
    window.addEventListener('zs:auth-error', handler)
    return () => window.removeEventListener('zs:auth-error', handler)
  }, [])

  // Keep CSS variable in sync so ALL --zs-theme consumers (btn-primary, inputs, etc.) update instantly
  useEffect(() => {
    document.documentElement.style.setProperty('--zs-theme', themeColor)
  }, [themeColor])

  const pendingOffersCount = (supplierOffers || []).filter(o => o.status === 'pending').length

  const dynamicExtras = filterByRole([
    ...EXTRAS,
    {
      to: '/ofertas',
      icon: Truck,
      label: 'Ofertas Distribuidor',
      badge: pendingOffersCount > 0 ? String(pendingOffersCount) : undefined,
      roles: ['admin', 'gerente'],
    },
  ], role)

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  if (marketCheck.blocked)
    return <BlockedScreen reason={marketCheck.reason} daysLeft={marketCheck.daysLeft} />

  const caixaItems   = filterByRole(CAIXA,  role)
  const gestaoItems  = filterByRole(GESTAO, role)
  const extrasItems  = dynamicExtras

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">

      {/* ══════════════════════════════════════════════════
          DESKTOP: Icon Rail (56px, always visible, md+)
          Completely separate from the mobile drawer so
          there's no conflict between the two layouts.
      ══════════════════════════════════════════════════ */}
      <aside
        className="hidden md:flex flex-col shrink-0 z-40 overflow-visible"
        style={{ width: 56, background: '#09090b', borderRight: '1px solid rgba(255,255,255,0.06)' }}>

        {/* ── Store avatar (top) ── */}
        <div className="pt-3 pb-1">
          <StoreAvatar
            name={storeName}
            emoji={nicheMeta.emoji}
            themeColor={themeColor}
            logoImg={storeSettings.logoImage}
          />
        </div>

        <div className="mx-auto w-5 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />

        {/* ── Nav icons (scrollable) ── */}
        <nav className="flex-1 flex flex-col items-center min-h-0 overflow-y-auto overflow-x-visible py-1 gap-0.5 no-scrollbar">

          {/* CAIXA group */}
          {caixaItems.map(item => (
            <RailItem key={item.to} {...item} />
          ))}

          {gestaoItems.length > 0 && <RailDivider />}

          {/* GESTÃO group */}
          {gestaoItems.map(item => (
            <RailItem key={item.to} {...item} />
          ))}

          {extrasItems.length > 0 && <RailDivider />}

          {/* EXTRAS group */}
          {extrasItems.map(item => (
            <RailItem key={item.to} {...item} />
          ))}

          <RailDivider />

          {/* Tools */}
          <RailItem icon={Monitor} label="Terminal PDV 1" onClick={() => window.open('/terminal', '_blank', 'noopener,noreferrer')} />
          <RailItem icon={Monitor} label="＋ 2° Terminal"   onClick={() => window.open('/terminal', '_blank', 'noopener,noreferrer')} />
          <RailItem icon={Camera}  label="Scanner Celular" onClick={() => window.open(`/scan?storeId=${getMktStoreId()}&t=${getMktStoreToken()}`, '_blank', 'noopener,noreferrer')} />
          {canInstall && (
            <RailItem icon={Download} label="Instalar App (PWA)" onClick={install} />
          )}
        </nav>

        {/* ── Bottom strip: tour ? + sync + logout ── */}
        <div className="pb-3 pt-1 flex flex-col items-center gap-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {/* Guia / tour */}
          <button
            onClick={openTour}
            className="group relative flex items-center justify-center w-full py-0.5"
            title="Guia do sistema">
            <span className="flex items-center justify-center w-10 h-10 rounded-2xl hover:bg-white/5 transition-all">
              <span className="text-zinc-600 group-hover:text-zinc-300 transition-colors font-black text-[15px] leading-none select-none">?</span>
            </span>
            <span className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2
              px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap
              opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100
              transition-all duration-150 z-[999]"
              style={{ background: '#18181b', color: '#f4f4f5', border: '1px solid rgba(255,255,255,0.09)', boxShadow: '0 8px 28px rgba(0,0,0,0.55)' }}>
              Guia do sistema
            </span>
          </button>
          <SyncDot />
          <button
            onClick={handleLogout}
            className="group relative flex items-center justify-center w-full py-0.5"
            title="Sair do sistema">
            <span className="flex items-center justify-center w-10 h-10 rounded-2xl hover:bg-red-500/10 transition-all">
              <LogOut className="w-[17px] h-[17px] text-zinc-600 group-hover:text-red-400 transition-colors" />
            </span>
            <span className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2
              px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap
              opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100
              transition-all duration-150 z-[999]"
              style={{ background: '#18181b', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)', boxShadow: '0 8px 28px rgba(0,0,0,0.55)' }}>
              Sair do sistema
            </span>
          </button>
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════
          MOBILE: Slide-in Drawer (full width, icon + label)
      ══════════════════════════════════════════════════ */}
      <aside className={`
        md:hidden fixed inset-y-0 left-0 z-40 w-60 flex flex-col
        transition-transform duration-200
        ${open ? 'translate-x-0' : '-translate-x-full'}
      `} style={{ background: '#09090b', borderRight: '1px solid rgba(255,255,255,0.06)' }}>

        {/* drawer header */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm"
              style={{ background: `linear-gradient(135deg, ${themeColor}, color-mix(in srgb, ${themeColor} 60%, #000))` }}>
              {nicheMeta.emoji}
            </div>
            <span className="text-[13px] font-black text-white truncate max-w-[130px]">{storeName}</span>
          </div>
          <button onClick={() => setOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* operator badge */}
        <div className="mx-3 mt-2 mb-1 px-3 py-1.5 rounded-xl flex items-center gap-2 shrink-0" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: (ROLE_COLOR[role] ?? '#9ca3af') + '22', border: `1.5px solid ${ROLE_COLOR[role] ?? '#9ca3af'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: ROLE_COLOR[role] ?? '#9ca3af', flexShrink: 0 }}>
            {operatorName[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold text-gray-200 truncate">{operatorName}</div>
            <div className="text-[9px] font-semibold" style={{ color: ROLE_COLOR[role] ?? '#9ca3af' }}>
              {ROLE_LABEL[role] ?? role}{role === 'caixa' ? ` · PDV ${terminalId}` : ''}
            </div>
          </div>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto pb-3 pt-1">
          {/* CAIXA */}
          <p className="px-5 pt-2 pb-1 text-[9px] font-black tracking-widest uppercase" style={{ color: '#3f3f46' }}>Caixa</p>
          {caixaItems.map(item => <DrawerItem key={item.to} {...item} onClose={() => setOpen(false)} />)}

          {/* GESTÃO */}
          {gestaoItems.length > 0 && <>
            <p className="px-5 pt-3 pb-1 text-[9px] font-black tracking-widest uppercase" style={{ color: '#3f3f46' }}>Gestão</p>
            {gestaoItems.map(item => <DrawerItem key={item.to} {...item} onClose={() => setOpen(false)} />)}
          </>}

          {/* EXTRAS */}
          {extrasItems.length > 0 && <>
            <p className="px-5 pt-3 pb-1 text-[9px] font-black tracking-widest uppercase" style={{ color: '#3f3f46' }}>Extras</p>
            {extrasItems.map(item => <DrawerItem key={item.to} {...item} onClose={() => setOpen(false)} />)}
          </>}

          {/* Ferramentas */}
          <p className="px-5 pt-3 pb-1 text-[9px] font-black tracking-widest uppercase" style={{ color: '#3f3f46' }}>Ferramentas</p>
          <a href="/terminal" target="_blank" rel="noreferrer"
            className="flex items-center gap-3 mx-2 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-zinc-400 hover:bg-white/5 transition-colors">
            <Monitor className="w-4 h-4 shrink-0 text-zinc-600" />Terminal PDV 1
          </a>
          <button onClick={() => window.open('/terminal','_blank','noopener,noreferrer')}
            className="w-full flex items-center gap-3 mx-0 px-5 py-2.5 text-[13px] font-semibold text-zinc-400 hover:bg-white/5 transition-colors">
            <Monitor className="w-4 h-4 shrink-0 text-zinc-600" />＋ 2° Terminal
          </button>
          <a href={`/scan?storeId=${getMktStoreId()}&t=${getMktStoreToken()}`} target="_blank" rel="noreferrer"
            className="flex items-center gap-3 mx-2 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-green-500 hover:bg-white/5 transition-colors">
            <Camera className="w-4 h-4 shrink-0" />Scanner Celular
          </a>
          {canInstall && (
            <button onClick={install}
              className="mx-2 mt-1 w-[calc(100%-16px)] flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-black text-black"
              style={{ background: themeColor }}>
              <Download className="w-4 h-4 shrink-0" />Instalar App (PWA)
            </button>
          )}
        </nav>

        <div className="px-3 py-2 shrink-0 space-y-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all">
            <LogOut className="w-4 h-4 shrink-0" />Sair do sistema
          </button>
        </div>
      </aside>

      {/* mobile overlay */}
      {open && <div className="md:hidden fixed inset-0 z-30 bg-black/70" onClick={() => setOpen(false)} />}

      {/* ── Main area ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* mobile topbar */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
          <button onClick={() => setOpen(true)} className="p-1.5 rounded-lg hover:bg-gray-100 active:scale-95 transition-transform">
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-2">
            <img src="/icon.svg" alt="logo" className="w-6 h-6" />
            <span className="text-base leading-none" aria-hidden="true">{nicheMeta.emoji}</span>
            <span className="font-black text-base tracking-tight truncate" style={{ color: themeColor }}>{storeName}</span>
          </div>
        </header>

        {/* offline banner */}
        {!online && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-400 text-amber-950 text-sm font-bold shrink-0">
            <span>⚡</span>
            <span>Sem internet — operando offline. Vendas salvas localmente e sincronizadas quando voltar.</span>
          </div>
        )}

        {/* session expired banner — token inválido, dados não estão salvando no servidor */}
        {sessionExpired && (
          <div className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-bold shrink-0">
            <span>🔒</span>
            <span className="flex-1">Sessão expirada — os dados não estão sendo salvos. Faça login novamente.</span>
            <button onClick={() => { navigate('/login') }} className="underline whitespace-nowrap">Entrar →</button>
            <button onClick={() => { try { localStorage.removeItem('zs_session_expired') } catch {} setSessionExpired(false) }} className="ml-3 opacity-80 hover:opacity-100 text-base leading-none">✕</button>
          </div>
        )}

        {/* Expiry warning — shown 5 days before subscription ends */}
        {!marketCheck.blocked && marketCheck.daysLeft != null && marketCheck.daysLeft <= 5 && marketCheck.daysLeft >= 0 && (
          <div className="bg-amber-500 px-4 py-2 flex items-center justify-between gap-4 text-sm font-bold text-amber-900">
            <span>⏰ Sua assinatura vence em {marketCheck.daysLeft === 0 ? 'hoje' : `${marketCheck.daysLeft} dia${marketCheck.daysLeft !== 1 ? 's' : ''}`}!</span>
            <a href="https://wa.me/5515997969303?text=Quero+renovar+minha+assinatura" target="_blank" rel="noopener noreferrer"
              className="underline whitespace-nowrap">Renovar agora →</a>
          </div>
        )}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <PageErrorBoundary><Outlet /></PageErrorBoundary>
        </main>
      </div>

      {/* Icon tour overlay */}
      {showTour && <IconTour onClose={closeTour} />}
    </div>
  )
}
