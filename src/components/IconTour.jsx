/**
 * IconTour — onboarding visual que mostra todos os ícones do sistema com
 * descrição do que cada um faz. Aparece automaticamente no primeiro login
 * e pode ser reaberto pelo botão ? no icon rail.
 */
import React, { useState, useEffect, useCallback } from 'react'
import {
  ShoppingCart, Tag, LayoutDashboard, Package, Receipt,
  Warehouse, Users, HandCoins, BarChart2,
  Printer, CalendarClock, Megaphone, QrCode, Star, Settings, Truck,
  Monitor, Camera, X, Sparkles, ChevronRight,
} from 'lucide-react'

const TOUR_KEY = 'zs_tour_v2_seen'

const SECTIONS = [
  {
    label: '🛒 Caixa',
    color: '#f97316',
    items: [
      { icon: ShoppingCart, title: 'PDV / Caixa',    desc: 'Registre vendas, escaneie produtos e receba em dinheiro, pix ou cartão. Centro de operação do caixa.' },
      { icon: Tag,          title: 'Promoções',       desc: 'Mix-and-match: 4 Danones quaisquer por R$10. O sistema desconta sozinho ao escanear.' },
    ],
  },
  {
    label: '📊 Gestão',
    color: '#8b5cf6',
    items: [
      { icon: LayoutDashboard, title: 'Dashboard',   desc: 'Visão geral: faturamento hoje, ticket médio, produtos mais vendidos e estoque crítico.' },
      { icon: Package,         title: 'Produtos',    desc: 'Catálogo completo — preço, custo, estoque, código de barras, foto e categoria.' },
      { icon: Receipt,         title: 'Vendas',      desc: 'Histórico com filtros por data, operador, produto e forma de pagamento.' },
      { icon: Warehouse,       title: 'Estoque',     desc: 'Entradas e saídas com alerta automático quando o estoque cai abaixo do mínimo.' },
      { icon: Users,           title: 'Clientes',    desc: 'Cadastro de clientes, histórico de compras e segmentação para campanhas.' },
      { icon: HandCoins,       title: 'Fiado',       desc: 'Controle de crédito — quem deve, quanto e quando. Registro direto no caixa.' },
      { icon: BarChart2,       title: 'Relatório',   desc: 'Análises por operador, produto e período. Exporta para impressão.' },
    ],
  },
  {
    label: '⚡ Extras',
    color: '#06b6d4',
    items: [
      { icon: Printer,       title: 'Etiquetas',        desc: 'Imprima etiquetas de preço em qualquer impressora — A4 ou térmica.' },
      { icon: CalendarClock, title: 'Validade',         desc: 'Alerta de produtos próximos do vencimento. Evite perdas e multas da vigilância.' },
      { icon: Megaphone,     title: 'Campanhas / ZAP',  desc: 'Envie promoções para clientes via WhatsApp com a IA Zara. Automático.' },
      { icon: QrCode,        title: 'Fidelidade / ZAP', desc: 'Programa de pontos via WhatsApp. Cliente acumula e resgata pelo celular.' },
      { icon: Star,          title: 'Flyer Sorteio',    desc: 'Gere flyers de sorteio para engajamento nas redes sociais.' },
      { icon: Truck,         title: 'Ofertas Distrib.', desc: 'Receba e gerencie ofertas do seu distribuidor diretamente no sistema.' },
      { icon: Settings,      title: 'Configurações',    desc: 'Logo, tema de cor, operadores, impressora, ID do mercado e troca de senha.' },
    ],
  },
  {
    label: '🛠 Ferramentas',
    color: '#22c55e',
    items: [
      { icon: Monitor, title: 'Terminal PDV',    desc: 'Caixa em tela cheia — ideal para balcão. Suporta leitor de código de barras USB e câmera.' },
      { icon: Camera,  title: 'Scanner Celular', desc: 'Transforme qualquer celular em scanner de código de barras. Abre via QR code.' },
    ],
  },
]

export function shouldShowTour() {
  try { return !localStorage.getItem(TOUR_KEY) } catch { return false }
}

export function markTourSeen() {
  try { localStorage.setItem(TOUR_KEY, '1') } catch {}
}

export default function IconTour({ onClose }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Pequeno delay para a animação de entrada aparecer
    const t = setTimeout(() => setVisible(true), 30)
    return () => clearTimeout(t)
  }, [])

  const close = useCallback(() => {
    markTourSeen()
    setVisible(false)
    setTimeout(onClose, 250)
  }, [onClose])

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(4,6,14,0.96)',
        overflowY: 'auto',
        transition: 'opacity .25s',
        opacity: visible ? 1 : 0,
      }}
      onClick={e => e.target === e.currentTarget && close()}
    >
      <div style={{
        minHeight: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '48px 20px 64px',
        transition: 'transform .25s',
        transform: visible ? 'none' : 'scale(.97)',
      }}>

        {/* ── Header ── */}
        <div style={{ textAlign: 'center', marginBottom: 40, position: 'relative', width: '100%', maxWidth: 860 }}>
          <button onClick={close} style={{ position: 'absolute', top: 0, right: 0, width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X style={{ width: 16, height: 16, color: '#71717a' }} />
          </button>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '6px 18px', borderRadius: 100, background: 'rgba(249,115,22,.1)', border: '1px solid rgba(249,115,22,.25)' }}>
            <Sparkles style={{ width: 14, height: 14, color: '#f97316' }} />
            <span style={{ color: '#f97316', fontSize: 12, fontWeight: 800, letterSpacing: 1 }}>GUIA DO SISTEMA</span>
          </div>
          <h1 style={{ color: '#f4f4f5', fontSize: 28, fontWeight: 900, margin: '0 0 10px', lineHeight: 1.2 }}>
            Tudo que você pode fazer aqui
          </h1>
          <p style={{ color: '#52525b', fontSize: 15, maxWidth: 480, margin: '0 auto' }}>
            Passe o mouse em qualquer ícone da barra lateral para ver o nome. Este guia mostra o que cada um faz.
          </p>
        </div>

        {/* ── Sections grid ── */}
        <div style={{ width: '100%', maxWidth: 900, display: 'flex', flexDirection: 'column', gap: 40 }}>
          {SECTIONS.map(section => (
            <div key={section.label}>
              {/* Section title */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ height: 1, flex: 1, background: 'rgba(255,255,255,0.06)' }} />
                <span style={{ color: section.color, fontSize: 12, fontWeight: 900, letterSpacing: 2, textTransform: 'uppercase' }}>
                  {section.label}
                </span>
                <div style={{ height: 1, flex: 1, background: 'rgba(255,255,255,0.06)' }} />
              </div>

              {/* Items grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: 12,
              }}>
                {section.items.map(({ icon: Icon, title, desc }) => (
                  <div key={title} style={{
                    display: 'flex', gap: 14, padding: '16px 18px', borderRadius: 16,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    transition: 'border-color .15s, background .15s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = section.color + '33'; e.currentTarget.style.background = section.color + '0a' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                  >
                    {/* icon */}
                    <div style={{
                      width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: section.color + '18',
                      border: `1px solid ${section.color}33`,
                    }}>
                      <Icon style={{ width: 18, height: 18, color: section.color }} />
                    </div>
                    {/* text */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: '#e4e4e7', fontWeight: 800, fontSize: 14, marginBottom: 4 }}>{title}</div>
                      <div style={{ color: '#52525b', fontSize: 12, lineHeight: 1.5 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ── CTA ── */}
        <div style={{ marginTop: 48, textAlign: 'center' }}>
          <button
            onClick={close}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '14px 36px', borderRadius: 16,
              background: 'linear-gradient(135deg, #f97316, #ea580c)',
              color: '#fff', fontWeight: 900, fontSize: 16,
              border: 'none', cursor: 'pointer',
              boxShadow: '0 8px 28px rgba(249,115,22,0.35)',
              transition: 'transform .1s, box-shadow .1s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 36px rgba(249,115,22,0.45)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 8px 28px rgba(249,115,22,0.35)' }}
          >
            Entendido, vamos lá!
            <ChevronRight style={{ width: 20, height: 20 }} />
          </button>
          <p style={{ color: '#3f3f46', fontSize: 12, marginTop: 12 }}>
            Pode reabrir este guia clicando no ícone <strong style={{ color: '#52525b' }}>?</strong> no menu lateral
          </p>
        </div>
      </div>
    </div>
  )
}
