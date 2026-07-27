import React, { useState, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Printer, Copy, Check, MessageCircle, TrendingUp, Users, Zap, ShoppingBag, Star, Gift } from 'lucide-react'

const PHONE = '5515996604075'
const NOME  = 'Corta Preços'

const CAMPAIGNS = [
  {
    id: 'promo',
    label: '🏷️ Promoção da Semana',
    msg: `Oi ${NOME}! Quero receber as promoções da semana 🛒`,
    tip: 'Use na entrada do caixa — cada cliente escaneia antes de pagar.',
  },
  {
    id: 'fidelidade',
    label: '🎁 Clube de Fidelidade',
    msg: `Oi ${NOME}! Quero entrar no Clube Fidelidade e ganhar desconto 🎉`,
    tip: 'Ofereça 5% de desconto na próxima compra para quem se cadastrar.',
  },
  {
    id: 'atacado',
    label: '📦 Lista de Atacado',
    msg: `Oi ${NOME}! Quero receber a lista de preços de atacado 📦`,
    tip: 'Ideal para clientes que compram em quantidade (donos de bar, lanchonete).',
  },
  {
    id: 'aniversario',
    label: '🎂 Cupom Aniversário',
    msg: `Oi ${NOME}! Quero meu cupom de aniversário 🎂`,
    tip: 'Você captura o nome e a data de aniversário do cliente via WhatsApp.',
  },
]

const ROADMAP = [
  {
    phase: '⚡ Fase 1 — Captura',
    color: 'bg-green-50 border-green-200',
    title: 'Hoje (já funciona)',
    items: [
      'QR no caixa após cada venda → cliente abre o ZAP',
      'QR em display físico na entrada / balcão',
      'QR impresso na sacola / embalagem',
      'Criação de grupo VIP "Ofertinhas Corta Preços"',
    ],
  },
  {
    phase: '🚀 Fase 2 — Relacionamento',
    color: 'bg-blue-50 border-blue-200',
    title: 'Próximas 4 semanas',
    items: [
      'Enviar foto das promoções toda segunda-feira às 8h',
      'Lista de transmissão segmentada (atacado / varejo)',
      'Responder "preço?" com catálogo automático (Wppconnect / Z-API)',
      'Pedir feedback: "O que faltou na sua compra hoje?"',
    ],
  },
  {
    phase: '💰 Fase 3 — Tráfego Pago',
    color: 'bg-purple-50 border-purple-200',
    title: 'Escalando',
    items: [
      'Exportar lista de contatos → subir como Público Personalizado no Meta Ads',
      'Criar Lookalike Audience: "pessoas parecidas com meus clientes"',
      'Campanha de remarketing: "Você comprou X, a oferta de Y está incrível!"',
      'Google Ads local: raio de 3km do mercado',
    ],
  },
  {
    phase: '🏆 Fase 4 — Produto SaaS',
    color: 'bg-brand-50 border-brand-200',
    title: 'Vendendo para redes',
    items: [
      'Multi-loja: 1 login, várias filiais no mesmo painel',
      'App do cliente: fidelidade com pontos e missões',
      'NFC-e integrado: nota fiscal automática na venda',
      'BI de rentabilidade: % margem por categoria, hora, operador',
      'Integração EDI com fornecedores (P&G, Ambev, Nestlé)',
      'API pública: outros devs pagam para integrar',
    ],
  },
]

function WaQR({ value, size = 160 }) {
  return (
    <div className="bg-white p-3 rounded-xl border-2 border-green-400 inline-block">
      <QRCodeSVG value={value} size={size} fgColor="#111827" bgColor="#ffffff" level="M" />
    </div>
  )
}

export default function Fidelidade() {
  const [activeCampaign, setActiveCampaign] = useState(CAMPAIGNS[0])
  const [copied, setCopied] = useState(false)
  const printRef = useRef(null)

  const waLink = `https://wa.me/${PHONE}?text=${encodeURIComponent(activeCampaign.msg)}`
  const waLinkShort = `wa.me/${PHONE}`

  const copy = () => {
    navigator.clipboard.writeText(waLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const print = () => {
    const win = window.open('', '_blank')
    win.document.write(`
      <html><head><title>QR Corta Preços</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 40px; background: #fff; }
        .logo { font-size: 32px; font-weight: 900; color: #ea580c; margin-bottom: 4px; }
        .tagline { font-size: 13px; color: #555; margin-bottom: 24px; }
        .qr-wrap { display: inline-block; padding: 16px; border: 3px solid #22c55e; border-radius: 16px; }
        .cta { font-size: 16px; font-weight: 800; color: #111; margin-top: 20px; }
        .sub { font-size: 12px; color: #777; margin-top: 6px; }
        .phone { font-size: 14px; font-weight: 700; color: #22c55e; margin-top: 10px; }
      </style></head><body>
      <div class="logo">✂ CORTA PREÇO$</div>
      <div class="tagline">Economia de verdade, variedades todo dia</div>
      <div class="qr-wrap">${printRef.current?.innerHTML || ''}</div>
      <div class="cta">📲 Escaneie e receba nossas PROMOÇÕES!</div>
      <div class="sub">${activeCampaign.msg}</div>
      <div class="phone">WhatsApp: (15) 99660-4075</div>
      </body></html>
    `)
    win.document.close()
    win.print()
  }

  return (
    <div className="space-y-6 animate-pop">
      {/* header */}
      <div>
        <h1 className="text-2xl font-black text-gray-900">Fidelidade & Marketing</h1>
        <p className="text-gray-500 text-sm mt-0.5">QR code WhatsApp para capturar clientes, criar tráfego pago e crescer</p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: Users,       label: 'Clientes capturados', value: '0',    sub: 'Comece hoje!', color: 'text-blue-600' },
          { icon: MessageCircle, label: 'Leads pelo QR',    value: '0',    sub: 'Escaneie = +1', color: 'text-green-600' },
          { icon: TrendingUp,  label: 'Ticket médio',       value: 'R$ —', sub: 'Em breve',      color: 'text-brand-600' },
          { icon: Zap,         label: 'Campanha ativa',     value: '1',    sub: activeCampaign.label, color: 'text-purple-600' },
        ].map(c => (
          <div key={c.label} className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400 font-semibold uppercase tracking-wide leading-tight">{c.label}</span>
              <c.icon className={`w-4 h-4 ${c.color}`} />
            </div>
            <div className={`text-2xl font-black ${c.color}`}>{c.value}</div>
            <div className="text-[11px] text-gray-400 mt-0.5 truncate">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* QR generator */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center">
              <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </div>
            <h2 className="font-black text-gray-900 text-lg">QR WhatsApp</h2>
          </div>

          {/* campaign selector */}
          <div>
            <label className="label mb-2">Selecione a campanha:</label>
            <div className="space-y-2">
              {CAMPAIGNS.map(c => (
                <button
                  key={c.id}
                  onClick={() => setActiveCampaign(c)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border-2 transition-all ${
                    activeCampaign.id === c.id
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="text-sm font-bold text-gray-800">{c.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5 leading-tight">{c.tip}</div>
                </button>
              ))}
            </div>
          </div>

          {/* QR display */}
          <div className="flex flex-col items-center gap-3 py-4 bg-gray-50 rounded-xl">
            <div ref={printRef}>
              <WaQR value={waLink} size={180} />
            </div>
            <div className="text-center">
              <div className="text-xs font-black text-gray-700 uppercase tracking-wide">📲 Escaneie e receba nossas promoções!</div>
              <div className="text-[11px] text-gray-400 mt-0.5">{waLinkShort}</div>
            </div>
          </div>

          {/* actions */}
          <div className="flex gap-2">
            <button onClick={copy} className={`btn-ghost flex-1 justify-center gap-2 ${copied ? '!text-green-600 !border-green-400' : ''}`}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copiado!' : 'Copiar link'}
            </button>
            <button onClick={print} className="btn-primary flex-1 justify-center gap-2">
              <Printer className="w-4 h-4" /> Imprimir QR
            </button>
          </div>

          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 bg-green-500 hover:bg-green-600 text-white font-black rounded-xl transition-colors text-sm"
          >
            <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Testar link agora
          </a>
        </div>

        {/* roadmap */}
        <div className="space-y-4">
          {ROADMAP.map(r => (
            <div key={r.phase} className={`rounded-2xl border p-4 ${r.color}`}>
              <div className="font-black text-gray-900 text-sm mb-0.5">{r.phase}</div>
              <div className="text-xs text-gray-500 font-semibold mb-3">{r.title}</div>
              <ul className="space-y-1.5">
                {r.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                    <span className="text-gray-400 font-bold flex-shrink-0">{i + 1}.</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* differentiators section */}
      <div className="card p-6">
        <h2 className="font-black text-gray-900 text-lg mb-4">🏆 O que te torna diferente para vender a redes grandes</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              icon: Zap, color: 'text-brand-600 bg-brand-50',
              title: 'Onboarding em 1h',
              desc: 'Importa o XML da nota fiscal do fornecedor e já cadastra todos os produtos automaticamente. Zero digitação.',
            },
            {
              icon: ShoppingBag, color: 'text-blue-600 bg-blue-50',
              title: 'PDV no celular',
              desc: 'Redes grandes precisam de inventário feito no corredor com celular. Scanner de câmera + app PWA funciona em qualquer Android barato.',
            },
            {
              icon: TrendingUp, color: 'text-green-600 bg-green-50',
              title: 'BI de margem real',
              desc: 'Mostra qual categoria está sangrand o lucro. Maioria dos sistemas só mostra faturamento — você mostra LUCRO por produto, hora e operador.',
            },
            {
              icon: Star, color: 'text-purple-600 bg-purple-50',
              title: 'Anti-fraude no caixa',
              desc: 'Alerta quando operador dá muito desconto, cancela muitas vendas ou tem ticket médio diferente dos outros operadores.',
            },
            {
              icon: Gift, color: 'text-amber-600 bg-amber-50',
              title: 'Fidelidade nativa',
              desc: 'Nenhum sistema popular tem WhatsApp + QR integrado no PDV. Você já tem. Rede de 10 lojas = 10x mais leads por mês.',
            },
            {
              icon: Users, color: 'text-rose-600 bg-rose-50',
              title: 'Modelo SaaS lucrativo',
              desc: 'R$197/mês por loja. Rede com 20 lojas = R$3.940/mês recorrentes. 100 lojas = R$19.700/mês. Custo de infra: ~R$50.',
            },
          ].map(d => (
            <div key={d.title} className="flex gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${d.color}`}>
                <d.icon className="w-4 h-4" />
              </div>
              <div>
                <div className="font-black text-gray-900 text-sm">{d.title}</div>
                <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">{d.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
