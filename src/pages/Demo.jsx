import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ShoppingCart, Search, Plus, Minus, Trash2, Check, X,
  CreditCard, Banknote, Smartphone, LayoutDashboard, Package,
  Users, TrendingUp, FileText, Tag, Settings, Zap, MessageCircle,
  ChevronRight, Store, LogOut, Star, BarChart2, BadgePercent,
  Scissors, Receipt, Truck, Clock, ArrowLeft, QrCode
} from 'lucide-react'

/* ─── Niche catalogue ───────────────────────────────────────── */
const NICHES = {
  mercado: {
    color: '#f97316', emoji: '🏪', label: 'Mercado',
    storeName: 'Mercado do João',
    owner: 'João Silva',
    tagline: 'Do bairro pra todo o Brasil — sem planilha, sem papel',
    highlights: ['🔥 Promoção 3x2 automática', '📦 Estoque em tempo real', '📲 Cupom via WhatsApp', '📊 Relatório diário'],
    promoTrigger: { productId: 2, qty: 3, label: 'Leve 3, Pague 2 — Óleo de Soja!', savings: 7.99 },
    products: [
      { id:1, name:'Arroz Tio João 5kg',   price:28.90, emoji:'🍚', unit:'un' },
      { id:2, name:'Óleo de Soja 900ml',    price: 7.99, emoji:'🫙', unit:'un' },
      { id:3, name:'Feijão Carioca 1kg',    price: 8.49, emoji:'🫘', unit:'un' },
      { id:4, name:'Leite Integral 1L',     price: 4.89, emoji:'🥛', unit:'un' },
      { id:5, name:'Açúcar Refinado 1kg',   price: 4.29, emoji:'🍬', unit:'un' },
      { id:6, name:'Café 3 Corações 500g',  price:14.99, emoji:'☕', unit:'un' },
      { id:7, name:'Macarrão 500g',         price: 3.79, emoji:'🍝', unit:'un' },
      { id:8, name:'Coca-Cola 2L',          price: 9.99, emoji:'🥤', unit:'un' },
    ],
  },
  padaria: {
    color: '#d97706', emoji: '🥖', label: 'Padaria',
    storeName: 'Padaria Dona Ana',
    owner: 'Ana Beatriz',
    tagline: 'Fresquinho na ponta dos dedos — do balcão ao WhatsApp',
    highlights: ['🥐 5 pães por R$5,90 automático', '⚖️ Venda por peso', '☕ Combo café+salgado', '📋 Fiado do cliente'],
    promoTrigger: { productId: 1, qty: 5, label: '5 Pães Francês por R$5,90!', savings: 0.55 },
    products: [
      { id:1, name:'Pão Francês (un)',      price: 1.29, emoji:'🥖', unit:'un' },
      { id:2, name:'Pão de Queijo',         price: 3.50, emoji:'🧀', unit:'un' },
      { id:3, name:'Croissant de Chocolate',price: 6.90, emoji:'🥐', unit:'un' },
      { id:4, name:'Bolo de Cenoura (fatia)',price:8.00, emoji:'🎂', unit:'un' },
      { id:5, name:'Pão de Forma',          price: 9.90, emoji:'🍞', unit:'un' },
      { id:6, name:'Café com Leite',        price: 6.00, emoji:'☕', unit:'un' },
      { id:7, name:'Coxinha',               price: 5.50, emoji:'🍗', unit:'un' },
      { id:8, name:'Torta de Frango (fatia)',price:14.90,emoji:'🥧', unit:'un' },
    ],
  },
  acougue: {
    color: '#dc2626', emoji: '🥩', label: 'Açougue',
    storeName: 'Açougue do Zé',
    owner: 'José Carlos',
    tagline: 'Corte na balança, venda no celular — é o futuro do açougue',
    highlights: ['⚖️ Venda por kg com balança', '🔪 Corte especial no pedido', '📲 Cardápio via WhatsApp', '💳 Fiado controlado'],
    promoTrigger: { productId: 2, qty: 2, label: '2kg Frango + Linguiça = R$29,90!', savings: 7.88 },
    products: [
      { id:1, name:'Picanha (kg)',           price:89.90, emoji:'🥩', unit:'kg' },
      { id:2, name:'Frango Inteiro (kg)',    price:12.90, emoji:'🍗', unit:'kg' },
      { id:3, name:'Costela Bovina (kg)',    price:42.90, emoji:'🦴', unit:'kg' },
      { id:4, name:'Linguiça Calabresa (kg)',price:24.90, emoji:'🌭', unit:'kg' },
      { id:5, name:'Alcatra (kg)',           price:49.90, emoji:'🥩', unit:'kg' },
      { id:6, name:'Filé de Frango (kg)',    price:19.90, emoji:'🍗', unit:'kg' },
      { id:7, name:'Carne Moída (kg)',       price:32.90, emoji:'🥩', unit:'kg' },
      { id:8, name:'Contrafilé (kg)',        price:52.90, emoji:'🥩', unit:'kg' },
    ],
  },
  restaurante: {
    color: '#0891b2', emoji: '🍽️', label: 'Restaurante',
    storeName: 'Restaurante Sabor da Terra',
    owner: 'Maria Fernanda',
    tagline: 'Da comanda ao caixa em segundos — mesa a mesa sem papel',
    highlights: ['🍽️ Comanda por mesa', '🛵 Pedido de delivery', '📱 Cardápio QR Code', '📊 Ranking de pratos'],
    promoTrigger: { productId: 8, qty: 1, label: 'Combo Executivo — Prato+Suco+Sobremesa!', savings: 4.00 },
    products: [
      { id:1, name:'Prato Feito Completo',  price:18.00, emoji:'🍛', unit:'un' },
      { id:2, name:'Marmitex Pequena',      price:12.00, emoji:'📦', unit:'un' },
      { id:3, name:'Marmitex Grande',       price:16.00, emoji:'📦', unit:'un' },
      { id:4, name:'Frango Grelhado',       price:22.00, emoji:'🍗', unit:'un' },
      { id:5, name:'Suco Natural 300ml',    price: 6.00, emoji:'🧃', unit:'un' },
      { id:6, name:'Refrigerante Lata',     price: 5.00, emoji:'🥤', unit:'un' },
      { id:7, name:'Sobremesa do Dia',      price: 8.00, emoji:'🍮', unit:'un' },
      { id:8, name:'Combo Executivo',       price:28.00, emoji:'⭐', unit:'un' },
    ],
  },
  lanchonete: {
    color: '#16a34a', emoji: '🌯', label: 'Lanchonete',
    storeName: 'Lanche do Gordo',
    owner: 'Roberto Souza',
    tagline: 'Fila andando, caixa girando — lanchonete do século',
    highlights: ['🍔 Adicional automático (+bacon, +queijo)', '⚡ Fila de pedidos em tempo real', '🎁 Combo desconto instantâneo', '📲 Pedido pelo WhatsApp'],
    promoTrigger: { productId: 2, qty: 1, label: 'X-Bacon + Batata G = R$32,00!', savings: 4.00 },
    products: [
      { id:1, name:'X-Burguer',             price:18.00, emoji:'🍔', unit:'un' },
      { id:2, name:'X-Bacon',               price:22.00, emoji:'🥓', unit:'un' },
      { id:3, name:'Hot Dog Completo',       price:15.00, emoji:'🌭', unit:'un' },
      { id:4, name:'Pastel (un)',            price: 7.00, emoji:'🥟', unit:'un' },
      { id:5, name:'Batata Frita P',        price: 8.00, emoji:'🍟', unit:'un' },
      { id:6, name:'Batata Frita G',        price:14.00, emoji:'🍟', unit:'un' },
      { id:7, name:'Suco de Laranja',       price: 7.00, emoji:'🍊', unit:'un' },
      { id:8, name:'Misto Quente',          price:10.00, emoji:'🥪', unit:'un' },
    ],
  },
  distribuidora: {
    color: '#1d4ed8', emoji: '🚚', label: 'Distribuidora',
    storeName: 'Distribuidora Irmãos Lima',
    owner: 'Carlos Lima',
    tagline: 'Pedido, estoque e entrega — tudo numa tela, tudo no controle',
    highlights: ['📦 Venda por caixa/grade', '🏦 Limite de crédito por cliente', '🚚 Rota de entrega integrada', '📊 Faturamento por cliente'],
    promoTrigger: { productId: 1, qty: 2, label: '2 CX Cerveja por R$169,00!', savings: 10.80 },
    products: [
      { id:1, name:'Cerveja Brahma CX/24',  price:89.90, emoji:'🍺', unit:'cx' },
      { id:2, name:'Coca-Cola 2L CX/6',     price:39.90, emoji:'🥤', unit:'cx' },
      { id:3, name:'Água Mineral CX/12',    price:24.90, emoji:'💧', unit:'cx' },
      { id:4, name:'Biscoito Trakinas CX',  price:45.00, emoji:'🍪', unit:'cx' },
      { id:5, name:'Fandangos CX',          price:38.00, emoji:'🍿', unit:'cx' },
      { id:6, name:'Suco Del Valle CX',     price:52.00, emoji:'🧃', unit:'cx' },
      { id:7, name:'Achocolatado CX',       price:68.00, emoji:'🍫', unit:'cx' },
      { id:8, name:'Leite Integral CX/12',  price:42.90, emoji:'🥛', unit:'cx' },
    ],
  },
}

const NAV = [
  { icon: LayoutDashboard, label: 'Dashboard' },
  { icon: ShoppingCart,    label: 'PDV', active: true },
  { icon: Package,         label: 'Produtos' },
  { icon: TrendingUp,      label: 'Vendas' },
  { icon: BarChart2,       label: 'Estoque' },
  { icon: Users,           label: 'Clientes' },
  { icon: Star,            label: 'Fidelidade' },
  { icon: FileText,        label: 'Relatório' },
  { icon: BadgePercent,    label: 'Promoções' },
  { icon: Settings,        label: 'Configurações' },
]

const PAYMENTS = [
  { key: 'dinheiro', label: 'Dinheiro',  Icon: Banknote,    cls: 'border-green-300  bg-green-50  text-green-800'  },
  { key: 'credito',  label: 'Crédito',   Icon: CreditCard,  cls: 'border-blue-300   bg-blue-50   text-blue-800'   },
  { key: 'debito',   label: 'Débito',    Icon: CreditCard,  cls: 'border-indigo-300 bg-indigo-50 text-indigo-800' },
  { key: 'pix',      label: 'PIX',       Icon: Smartphone,  cls: 'border-teal-300   bg-teal-50   text-teal-800'   },
]

const fmt = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/* ─── Confetti ─────────────────────────────────────────────── */
function Confetti({ color }) {
  const pieces = Array.from({ length: 28 }, (_, i) => i)
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map(i => {
        const left  = Math.random() * 100
        const delay = Math.random() * 0.6
        const dur   = 1.2 + Math.random() * 0.8
        const col   = [color, '#facc15', '#4ade80', '#60a5fa', '#f472b6'][i % 5]
        return (
          <div key={i} style={{
            position:'absolute', left:`${left}%`, top:'-10px',
            width: 8, height: 8, borderRadius: i%3===0?'50%':'2px',
            background: col, opacity: 0,
            animation: `fall ${dur}s ${delay}s ease-in forwards`,
          }} />
        )
      })}
      <style>{`@keyframes fall{0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(340px) rotate(720deg);opacity:0}}`}</style>
    </div>
  )
}

/* ─── Demo Hub (/demo) ─────────────────────────────────────── */
function DemoHub() {
  return (
    <div className="min-h-screen" style={{ background:'linear-gradient(135deg,#0a0a0f 0%,#111827 60%,#0a0a0f 100%)' }}>
      {/* header */}
      <div className="text-center pt-14 pb-8 px-4">
        <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-6 text-xs text-gray-400 font-semibold tracking-widest uppercase">
          <Zap className="w-3 h-3 text-yellow-400" /> Demo Interativo — ZatendeStok
        </div>
        <h1 className="text-white font-black text-3xl md:text-5xl leading-tight mb-3">
          Veja como fica<br />
          <span style={{ background:'linear-gradient(90deg,#f97316,#facc15)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
            para o seu negócio
          </span>
        </h1>
        <p className="text-gray-400 text-base md:text-lg max-w-lg mx-auto">
          Escolha o segmento e explore o sistema completo em tempo real — sem cadastro, sem senha.
        </p>
      </div>

      {/* niche grid */}
      <div className="max-w-5xl mx-auto px-4 pb-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(NICHES).map(([key, n]) => (
          <Link key={key} to={`/demo/${key}`}
            className="group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl"
            style={{ background:'rgba(255,255,255,0.03)', borderColor:'rgba(255,255,255,0.08)' }}>
            {/* glow */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
              style={{ background:`radial-gradient(circle at 50% 0%,${n.color}22,transparent 70%)` }} />
            <div className="p-5">
              {/* top row */}
              <div className="flex items-start justify-between mb-4">
                <div className="text-4xl">{n.emoji}</div>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background:`${n.color}22`, color:n.color }}>
                  DEMO GRÁTIS
                </span>
              </div>
              <div className="font-black text-white text-xl mb-1">{n.label}</div>
              <div className="text-gray-400 text-xs mb-4 leading-relaxed">{n.tagline}</div>
              {/* highlights */}
              <div className="space-y-1 mb-5">
                {n.highlights.slice(0,3).map((h, i) => (
                  <div key={i} className="text-[11px] text-gray-300">{h}</div>
                ))}
              </div>
              {/* CTA */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{n.products.length} produtos de exemplo</span>
                <div className="flex items-center gap-1 font-black text-sm transition-all group-hover:gap-2" style={{ color:n.color }}>
                  Abrir Demo <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </div>
            {/* color bar bottom */}
            <div className="h-0.5 w-0 group-hover:w-full transition-all duration-500" style={{ background:n.color }} />
          </Link>
        ))}
      </div>

      {/* footer CTA */}
      <div className="border-t border-white/5 py-10 text-center">
        <p className="text-gray-400 text-sm mb-4">Ficou interessado? Fale com um consultor agora.</p>
        <a href="https://wa.me/5515997969303?text=Oi!+Quero+ver+uma+demonstra%C3%A7%C3%A3o+do+ZatendeStok+para+o+meu+neg%C3%B3cio"
          target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-400 text-white font-black px-6 py-3 rounded-xl transition-colors text-sm">
          <MessageCircle className="w-4 h-4" /> Quero para meu negócio → WhatsApp
        </a>
      </div>
    </div>
  )
}

/* ─── Demo PDV (/demo/:niche) ──────────────────────────────── */
function DemoPDV({ niche }) {
  const n = NICHES[niche] || NICHES.mercado
  const { color, emoji, label, storeName, owner, products, promoTrigger } = n

  const [search,   setSearch]   = useState('')
  const [cart,     setCart]     = useState([])
  const [payment,  setPayment]  = useState(null)
  const [stage,    setStage]    = useState('pdv') // pdv | processing | success
  const [saleNum,  setSaleNum]  = useState(47)
  const [cartOpen, setCartOpen] = useState(false)
  const [promoFired, setPromoFired] = useState(false)

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  const cartItem = (id) => cart.find(i => i.id === id)
  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const cartCount = cart.reduce((s, i) => s + i.qty, 0)

  // Promo check
  const promoItem  = cart.find(i => i.id === promoTrigger.productId)
  const promoActive = promoItem && promoItem.qty >= promoTrigger.qty
  const promoDiscount = promoActive ? promoTrigger.savings : 0
  const total = Math.max(0, cartTotal - promoDiscount)

  const addItem = useCallback((p) => {
    setCart(c => {
      const ex = c.find(i => i.id === p.id)
      return ex ? c.map(i => i.id===p.id ? {...i, qty:i.qty+1} : i) : [...c, {...p, qty:1}]
    })
  }, [])

  const removeItem = useCallback((id) => {
    setCart(c => {
      const ex = c.find(i => i.id === id)
      if (!ex) return c
      return ex.qty === 1 ? c.filter(i => i.id !== id) : c.map(i => i.id===id ? {...i, qty:i.qty-1} : i)
    })
  }, [])

  const deleteItem = useCallback((id) => setCart(c => c.filter(i => i.id !== id)), [])

  const checkout = () => {
    if (!payment || !cart.length) return
    setStage('processing')
    setTimeout(() => {
      setSaleNum(n => n + 1)
      setStage('success')
    }, 1400)
  }

  const reset = () => {
    setCart([])
    setPayment(null)
    setStage('pdv')
    setCartOpen(false)
    setPromoFired(false)
  }

  // Promo toast
  useEffect(() => {
    if (promoActive && !promoFired) setPromoFired(true)
  }, [promoActive, promoFired])

  /* ── Sidebar ── */
  const Sidebar = ({ mobile }) => (
    <aside className={mobile
      ? 'fixed inset-y-0 left-0 z-50 w-[220px] flex flex-col md:hidden'
      : 'hidden md:flex w-[210px] shrink-0 flex-col'
    } style={{ background:'#09090b', borderRight:'1px solid rgba(255,255,255,0.06)' }}>
      {/* logo */}
      <div className="px-3 pt-3 pb-2">
        <div className="mb-2 flex items-center justify-center py-1.5 px-3 rounded-xl bg-gray-900/60 border border-gray-800">
          <span className="font-black text-white text-sm tracking-widest">ZATENDE<span style={{color}}>STOK</span></span>
        </div>
        <div className="relative overflow-hidden rounded-xl px-3 py-2.5"
          style={{ background:`linear-gradient(135deg,${color},color-mix(in srgb,${color} 70%,black))`, boxShadow:`0 8px 24px ${color}55` }}>
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">{emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="text-white font-black text-sm truncate leading-none">{storeName}</div>
              <div className="text-white/50 font-semibold text-[9px] tracking-widest uppercase mt-0.5">{label}</div>
            </div>
          </div>
        </div>
      </div>

      {/* operator */}
      <div className="mx-3 mb-2 px-3 py-1.5 rounded-xl flex items-center gap-2 shrink-0"
        style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)' }}>
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0"
          style={{ background:`${color}22`, border:`1.5px solid ${color}`, color }}>
          {owner[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-gray-200 truncate">{owner}</div>
          <div className="text-[10px] font-semibold text-orange-400">Admin</div>
        </div>
      </div>
      <div className="mx-4 mb-2 h-px bg-white/5" />

      {/* nav */}
      <nav className="flex-1 min-h-0 overflow-y-auto px-2 space-y-0.5">
        {NAV.map(({ icon: Icon, label: l, active: a }) => (
          <div key={l} className="flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer transition-all"
            style={a ? { background:`${color}18`, border:`1px solid ${color}33` } : { color:'#9ca3af' }}>
            <Icon className="w-3.5 h-3.5 shrink-0" style={a ? { color } : {}} />
            <span className="text-[12px] font-bold" style={a ? { color } : {}}>{l}</span>
            {a && <div className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background:color }} />}
          </div>
        ))}
      </nav>

      {/* logout */}
      <div className="px-3 py-3 border-t border-white/5">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-gray-600 cursor-pointer hover:text-red-400 hover:bg-red-500/10">
          <LogOut className="w-3.5 h-3.5" />
          <span className="text-[11px] font-semibold">Sair do sistema</span>
        </div>
      </div>
    </aside>
  )

  /* ── Processing overlay ── */
  if (stage === 'processing') return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center" style={{ background:'rgba(0,0,0,0.85)' }}>
      <div className="w-16 h-16 border-4 border-gray-700 rounded-full mb-6"
        style={{ borderTopColor:color, animation:'spin 0.7s linear infinite' }} />
      <div className="text-white font-black text-xl">Processando pagamento…</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  /* ── Success overlay ── */
  if (stage === 'success') return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-4" style={{ background:'rgba(0,0,0,0.9)' }}>
      <Confetti color={color} />
      <div className="relative text-center max-w-sm w-full bg-white rounded-3xl p-8 shadow-2xl">
        {/* check */}
        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg"
          style={{ background:color }}>
          <Check className="w-10 h-10 text-white" strokeWidth={3} />
        </div>
        <div className="font-black text-gray-900 text-2xl mb-1">Venda #{String(saleNum).padStart(4,'0')}</div>
        <div className="text-gray-500 text-sm mb-4">Finalizada com sucesso!</div>
        <div className="bg-gray-50 rounded-2xl p-4 mb-4 text-left space-y-2">
          {cart.map(i => (
            <div key={i.id} className="flex justify-between text-sm">
              <span className="text-gray-600">{i.qty}x {i.name}</span>
              <span className="font-bold text-gray-800">{fmt(i.price * i.qty)}</span>
            </div>
          ))}
          {promoActive && (
            <div className="flex justify-between text-sm font-bold text-green-600 border-t border-green-100 pt-2">
              <span>✂️ Desconto promoção</span>
              <span>- {fmt(promoDiscount)}</span>
            </div>
          )}
          <div className="flex justify-between font-black text-lg border-t border-gray-200 pt-2" style={{ color }}>
            <span>Total</span>
            <span>{fmt(total)}</span>
          </div>
        </div>
        {/* WhatsApp notification mock */}
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl px-4 py-3 mb-5 text-left">
          <MessageCircle className="w-5 h-5 text-green-600 shrink-0" />
          <div>
            <div className="text-xs font-black text-green-700">WhatsApp enviado!</div>
            <div className="text-[11px] text-green-600 leading-snug">Cupom da venda #{String(saleNum).padStart(4,'0')} enviado ao cliente.</div>
          </div>
        </div>
        <button onClick={reset}
          className="w-full py-3 rounded-xl font-black text-white text-base transition-all active:scale-95"
          style={{ background:color }}>
          Nova Venda
        </button>
      </div>
    </div>
  )

  /* ── Main PDV ── */
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />

      {/* mobile sidebar overlay */}
      {cartOpen && <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setCartOpen(false)} />}

      {/* main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* topbar */}
        <header className="flex items-center gap-3 px-4 py-2.5 bg-white border-b border-gray-200 shadow-sm shrink-0">
          <Link to="/demo" className="p-1.5 rounded-lg hover:bg-gray-100">
            <ArrowLeft className="w-4 h-4 text-gray-500" />
          </Link>
          <span className="text-base leading-none">{emoji}</span>
          <span className="font-black text-base tracking-tight" style={{ color }}>{storeName}</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden sm:block text-[10px] font-black px-2 py-1 rounded-full border"
              style={{ background:`${color}15`, borderColor:`${color}40`, color }}>
              DEMO INTERATIVO
            </span>
            {/* mobile cart button */}
            <button onClick={() => setCartOpen(o => !o)}
              className="relative md:hidden p-2 rounded-xl text-white transition-all"
              style={{ background:color }}>
              <ShoppingCart className="w-4 h-4" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* ── Products panel ── */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* search + promo */}
            <div className="px-4 py-3 space-y-2 bg-white border-b border-gray-100">
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                <Search className="w-4 h-4 text-gray-400 shrink-0" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar produto ou código…"
                  className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400" />
                {search && <button onClick={() => setSearch('')}><X className="w-3.5 h-3.5 text-gray-400" /></button>}
              </div>
              {/* promo banner */}
              {promoActive && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold animate-pulse"
                  style={{ background:`${color}15`, border:`1px solid ${color}40`, color }}>
                  <Scissors className="w-4 h-4 shrink-0" />
                  {promoTrigger.label} — economia de {fmt(promoDiscount)}!
                </div>
              )}
              {!promoActive && promoItem && promoItem.qty < promoTrigger.qty && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-500 bg-gray-50 border border-gray-100">
                  <Tag className="w-3.5 h-3.5" />
                  Adicione mais {promoTrigger.qty - promoItem.qty} para ativar: {promoTrigger.label}
                </div>
              )}
            </div>

            {/* highlights chips */}
            <div className="flex gap-1.5 px-4 py-2 overflow-x-auto shrink-0 scrollbar-none">
              {n.highlights.map((h, i) => (
                <span key={i} className="whitespace-nowrap text-[10px] font-bold px-2.5 py-1 rounded-full border"
                  style={{ background:`${color}0d`, borderColor:`${color}30`, color }}>
                  {h}
                </span>
              ))}
            </div>

            {/* product grid */}
            <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 content-start">
              {filtered.map(p => {
                const inCart = cartItem(p.id)
                return (
                  <div key={p.id}
                    onClick={() => addItem(p)}
                    className="relative bg-white rounded-2xl p-3 border cursor-pointer select-none transition-all active:scale-95 hover:shadow-md"
                    style={{ borderColor: inCart ? color : '#e5e7eb' }}>
                    {inCart && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full text-[10px] font-black text-white flex items-center justify-center"
                        style={{ background:color }}>
                        {inCart.qty}
                      </div>
                    )}
                    <div className="text-3xl mb-1.5 leading-none">{p.emoji}</div>
                    <div className="font-bold text-gray-800 text-[12px] leading-tight mb-1">{p.name}</div>
                    <div className="font-black text-base" style={{ color }}>{fmt(p.price)}</div>
                    {p.unit !== 'un' && <div className="text-[10px] text-gray-400">por {p.unit}</div>}
                  </div>
                )
              })}
              {!filtered.length && (
                <div className="col-span-full text-center py-12 text-gray-400 text-sm">
                  Nenhum produto encontrado
                </div>
              )}
            </div>
          </div>

          {/* ── Cart panel (desktop) ── */}
          <div className="hidden md:flex w-[280px] shrink-0 flex-col bg-white border-l border-gray-200">
            <CartPanel {...{ cart, total, promoActive, promoDiscount, payment, setPayment, checkout, addItem, removeItem, deleteItem, fmt, color, cartCount }} />
          </div>
        </div>
      </div>

      {/* ── Cart panel (mobile slide-up) ── */}
      <div className={`fixed inset-x-0 bottom-0 z-50 md:hidden transition-transform duration-300 ${cartOpen ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ maxHeight:'80vh' }}>
        <div className="bg-white rounded-t-3xl shadow-2xl flex flex-col" style={{ maxHeight:'80vh' }}>
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <span className="font-black text-gray-800">Carrinho ({cartCount})</span>
            <button onClick={() => setCartOpen(false)}><X className="w-5 h-5 text-gray-400" /></button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <CartPanel {...{ cart, total, promoActive, promoDiscount, payment, setPayment, checkout, addItem, removeItem, deleteItem, fmt, color, cartCount }} />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Cart Panel (shared desktop+mobile) ───────────────────── */
function CartPanel({ cart, total, promoActive, promoDiscount, payment, setPayment, checkout, addItem, removeItem, deleteItem, fmt, color, cartCount }) {
  return (
    <>
      {/* items */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {!cart.length && (
          <div className="text-center py-12">
            <ShoppingCart className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Clique nos produtos para adicionar</p>
          </div>
        )}
        {cart.map(i => (
          <div key={i.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
            <span className="text-xl shrink-0">{i.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold text-gray-700 truncate leading-tight">{i.name}</div>
              <div className="text-[11px] font-black" style={{ color }}>{fmt(i.price * i.qty)}</div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => removeItem(i.id)}
                className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:border-gray-400 transition-colors">
                <Minus className="w-3 h-3" />
              </button>
              <span className="w-5 text-center text-xs font-black text-gray-700">{i.qty}</span>
              <button onClick={() => addItem(i)}
                className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:border-gray-400 transition-colors">
                <Plus className="w-3 h-3" />
              </button>
            </div>
            <button onClick={() => deleteItem(i.id)} className="p-1 text-gray-300 hover:text-red-400 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* promo discount row */}
      {promoActive && (
        <div className="mx-3 mb-2 flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-xs font-bold text-green-700">
          <span className="flex items-center gap-1"><Scissors className="w-3.5 h-3.5" /> Desconto promo</span>
          <span>- {fmt(promoDiscount)}</span>
        </div>
      )}

      {/* total */}
      <div className="px-4 py-2 border-t border-gray-100">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500 font-semibold">Total</span>
          <span className="font-black text-2xl" style={{ color }}>{fmt(total)}</span>
        </div>
      </div>

      {/* payment methods */}
      <div className="px-3 pb-2 grid grid-cols-2 gap-2">
        {PAYMENTS.map(({ key, label, Icon, cls }) => (
          <button key={key} onClick={() => setPayment(key)}
            className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-bold transition-all ${cls} ${payment===key ? '' : 'opacity-70 hover:opacity-100'}`}
            style={payment===key ? { outline:`2.5px solid ${color}`, outlineOffset:2 } : {}}>
            <Icon className="w-3.5 h-3.5 shrink-0" /> {label}
          </button>
        ))}
      </div>

      {/* checkout */}
      <div className="px-3 pb-4">
        <button onClick={checkout} disabled={!cart.length || !payment}
          className="w-full py-3.5 rounded-2xl font-black text-white text-base transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
          style={{ background: cart.length && payment ? color : '#9ca3af', boxShadow: cart.length && payment ? `0 8px 24px ${color}55` : 'none' }}>
          <Receipt className="w-4 h-4" />
          {!cart.length ? 'Adicione produtos' : !payment ? 'Selecione pagamento' : `Finalizar — ${fmt(total)}`}
        </button>
      </div>
    </>
  )
}

/* ─── Router ───────────────────────────────────────────────── */
export default function Demo() {
  const { niche } = useParams()

  if (!niche) return <DemoHub />
  if (!NICHES[niche]) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-900 text-white">
      <div className="text-5xl">🤔</div>
      <p className="font-black text-xl">Segmento não encontrado</p>
      <Link to="/demo" className="text-orange-400 underline text-sm">← Ver todos os demos</Link>
    </div>
  )
  return <DemoPDV niche={niche} />
}
