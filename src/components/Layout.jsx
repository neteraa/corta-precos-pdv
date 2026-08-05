import React, { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import Footer from './Footer.jsx'
import ZatendeStockLogo from './ZatendeStockLogo.jsx'
import {
  LayoutDashboard, ShoppingCart, Package, Receipt,
  Warehouse, Users, Settings, Menu, Phone, Instagram,
  QrCode, Tag, Star, Download, Monitor, Camera, Scissors, HandCoins, LogOut,
  BarChart2, Printer, CalendarClock, Megaphone, RefreshCw, Truck
} from 'lucide-react'
import { useInstallPWA } from '../hooks/useInstallPWA.js'
import { logout } from '../utils/auth.js'
import { useStore } from '../store.jsx'

function SyncBar() {
  const { syncNow, lastSync, syncing } = useStore()
  const [ago, setAgo] = useState('')

  useEffect(() => {
    const update = () => {
      if (!lastSync) { setAgo(''); return }
      const s = Math.floor((Date.now() - lastSync) / 1000)
      if (s < 5)  setAgo('agora mesmo')
      else if (s < 60)  setAgo(`há ${s}s`)
      else setAgo(`há ${Math.floor(s / 60)}min`)
    }
    update()
    const t = setInterval(update, 5000)
    return () => clearInterval(t)
  }, [lastSync])

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${syncing ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`} />
      <span className="text-[10px] text-gray-500 flex-1 truncate">
        {syncing ? 'Sincronizando...' : ago ? `Sync ${ago}` : 'Conectando...'}
      </span>
      <button onClick={syncNow} disabled={syncing}
        className="text-gray-600 hover:text-green-400 transition-colors disabled:opacity-30">
        <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
      </button>
    </div>
  )
}

/* ── nav sections ─────────────────────────────────────────── */
const CAIXA = [
  { to: '/pdv',       icon: ShoppingCart, label: 'PDV / Caixa',   hot: true },
  { to: '/promocoes', icon: Tag,          label: 'Promoções' },
]
const GESTAO = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/produtos',      icon: Package,         label: 'Produtos' },
  { to: '/vendas',        icon: Receipt,         label: 'Vendas' },
  { to: '/estoque',       icon: Warehouse,       label: 'Estoque' },
  { to: '/clientes',      icon: Users,           label: 'Clientes' },
  { to: '/fiado',         icon: HandCoins,       label: 'Fiado' },
  { to: '/relatorio',     icon: BarChart2,        label: 'Relatório' },
]
const EXTRAS = [
  { to: '/etiquetas',     icon: Printer,         label: 'Etiquetas' },
  { to: '/validade',      icon: CalendarClock,   label: 'Validade' },
  { to: '/campanhas',     icon: Megaphone,       label: 'Campanhas / ZAP', badge: 'NOVO' },
  { to: '/fidelidade',    icon: QrCode,          label: 'Fidelidade / ZAP' },
  { to: '/flyer',         icon: Star,            label: 'Flyer Sorteio' },
  { to: '/configuracoes', icon: Settings,        label: 'Configurações' },
]

/* ── logo ─────────────────────────────────────────────────── */
function SidebarLogo() {
  return (
    <div className="px-4 pt-5 pb-4">
      {/* ZatendeStock platform brand */}
      <div className="mb-3 flex items-center justify-center py-2 px-3 rounded-xl bg-gray-900/60 border border-gray-800">
        <ZatendeStockLogo variant="wordmark" />
      </div>

      {/* Corta Preço brand block */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 to-orange-700 p-4 shadow-lg shadow-orange-900/40">
        {/* decorative scissors watermark */}
        <svg className="absolute -right-3 -top-3 w-20 h-20 text-black/10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
          <line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/>
          <line x1="8.12" y1="8.12" x2="12" y2="12"/>
        </svg>
        <div className="relative">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 bg-black/20 rounded-lg flex items-center justify-center">
              <Scissors className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-black text-xl tracking-tight leading-none">
              CORTA PREÇO<span className="text-black/80">$</span>
            </span>
          </div>
          <p className="text-orange-100/80 text-[10px] font-medium tracking-wide pl-9">
            Economia de verdade • Variedades todo dia
          </p>
        </div>
      </div>
      {/* contact strip */}
      <div className="flex items-center justify-between mt-3 px-1">
        <span className="flex items-center gap-1.5 text-gray-500 text-[10px]">
          <Phone className="w-2.5 h-2.5" />(15) 99660-4075
        </span>
        <span className="flex items-center gap-1.5 text-gray-500 text-[10px]">
          <Instagram className="w-2.5 h-2.5" />@mercadocortaprecos
        </span>
      </div>
    </div>
  )
}

/* ── nav section ──────────────────────────────────────────── */
function NavSection({ title, items, onClose }) {
  return (
    <div className="mb-1">
      <div className="px-4 mb-1 text-[9px] font-black text-gray-600 tracking-[0.15em] uppercase">
        {title}
      </div>
      {items.map(({ to, icon: Icon, label, badge, hot }) => (
        <NavLink
          key={to} to={to} onClick={onClose}
          className={({ isActive }) =>
            'group relative flex items-center gap-3 mx-2 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150 ' +
            (isActive
              ? 'bg-orange-500/15 text-orange-400 shadow-[inset_0_0_0_1px_rgba(249,115,22,0.25)]'
              : 'text-gray-400 hover:text-gray-100 hover:bg-white/5')
          }
        >
          {({ isActive }) => (
            <>
              {/* active left bar */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-orange-500 rounded-r-full" />
              )}
              <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${isActive ? 'text-orange-400' : 'text-gray-500 group-hover:text-gray-300'}`} />
              <span className="flex-1">{label}</span>
              {hot && !badge && (
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
              )}
              {badge && (
                <span className="text-[9px] font-black bg-green-500/20 text-green-400 border border-green-500/30 px-1.5 py-0.5 rounded-full leading-none">
                  {badge}
                </span>
              )}
            </>
          )}
        </NavLink>
      ))}
    </div>
  )
}

export default function Layout() {
  const [open, setOpen]   = useState(false)
  const { canInstall, install } = useInstallPWA()
  const { supplierOffers } = useStore()
  const navigate          = useNavigate()

  const pendingOffersCount = (supplierOffers || []).filter(o => o.status === 'pending').length

  const dynamicExtras = [
    ...EXTRAS,
    {
      to: '/ofertas',
      icon: Truck,
      label: 'Ofertas Distribuidor',
      badge: pendingOffersCount > 0 ? String(pendingOffersCount) : undefined,
    },
  ]

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">

      {/* ── Sidebar ───────────────────────────────────────── */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-[228px] flex flex-col transition-transform duration-200
        lg:static lg:translate-x-0
        ${open ? 'translate-x-0' : '-translate-x-full'}
      `} style={{ background: '#09090b', borderRight: '1px solid rgba(255,255,255,0.06)' }}>

        <SidebarLogo />

        {/* divider */}
        <div className="mx-4 mb-3 h-px bg-white/5" />

        {/* nav */}
        <nav className="flex-1 overflow-y-auto pb-2 space-y-3">
          <NavSection title="Caixa"   items={CAIXA}         onClose={() => setOpen(false)} />
          <NavSection title="Gestão"  items={GESTAO}        onClose={() => setOpen(false)} />
          <NavSection title="Extras"  items={dynamicExtras} onClose={() => setOpen(false)} />
        </nav>

        {/* ── bottom shortcuts ──────────────────────────── */}
        <div className="px-3 py-3 space-y-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>

          <a href="/terminal" target="_blank" rel="noreferrer"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all group"
            style={{ background: 'rgba(234,88,12,0.1)', border: '1px solid rgba(234,88,12,0.2)' }}>
            <Monitor className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
            <span className="text-orange-300 text-[11px] font-black flex-1 group-hover:text-orange-200">Terminal do Caixa</span>
            <span className="text-[8px] bg-orange-500 text-black font-black px-1.5 py-0.5 rounded-full">ABRIR</span>
          </a>

          <a href="/scan" target="_blank" rel="noreferrer"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all group"
            style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)' }}>
            <Camera className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
            <span className="text-green-400 text-[11px] font-black flex-1 group-hover:text-green-300">Scanner Celular</span>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          </a>

          {canInstall && (
            <button onClick={install}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 transition-colors">
              <Download className="w-3.5 h-3.5 text-black flex-shrink-0" />
              <span className="text-black text-[11px] font-black">Instalar App (PWA)</span>
            </button>
          )}

          <SyncBar />

          <a href="/guia"
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-orange-400/70 hover:text-orange-400 hover:bg-orange-500/10 transition-all"
            style={{ textDecoration: 'none' }}>
            <span className="text-[13px]">📖</span>
            <span className="text-[11px] font-semibold">Guia do sistema</span>
          </a>

          <button onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all group">
            <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="text-[11px] font-semibold">Sair do sistema</span>
          </button>

          <div className="pt-1 text-center">
            <div className="text-gray-600 text-[9px] font-bold tracking-widest uppercase">🙏 Deus é bom o tempo todo</div>
            <div className="text-gray-700 text-[9px] mt-0.5">PDV v3.1 · Corta Preços</div>
          </div>
        </div>

        <Footer variant="mkt" />
      </aside>

      {/* overlay mobile */}
      {open && <div className="fixed inset-0 z-30 bg-black/70 lg:hidden" onClick={() => setOpen(false)} />}

      {/* ── Main area ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* mobile topbar */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
          <button onClick={() => setOpen(true)} className="p-1.5 rounded-lg hover:bg-gray-100 active:scale-95 transition-transform">
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-2">
            <img src="/icon.svg" alt="logo" className="w-6 h-6" />
            <span className="font-black text-orange-600 text-base tracking-tight">CORTA PREÇO$</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
