import React, { useState, useRef, useMemo } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Printer, Copy, Check, MessageCircle, Users, Phone, ExternalLink, QrCode, Gift, Megaphone, MapPin, Clock } from 'lucide-react'
import { usePrinter } from '../hooks/usePrinter.js'
import { useStore } from '../store.jsx'

/* ── Ícone WA ───────────────────────────────────────────── */
const WaIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)

const CAMPAIGNS = (storeName) => [
  {
    id: 'promo',
    label: '🏷️ Promoções da Semana',
    badge: 'Mais usado',
    badgeColor: 'bg-green-100 text-green-700',
    msg: `Oi, ${storeName}! 👋 Quero receber as promoções da semana 🛒`,
    tip: 'Coloque no caixa — cliente escaneia na hora de pagar.',
  },
  {
    id: 'fidelidade',
    label: '🎁 Clube de Fidelidade',
    badge: '+5% desconto',
    badgeColor: 'bg-purple-100 text-purple-700',
    msg: `Oi, ${storeName}! Quero entrar no Clube Fidelidade e ganhar desconto nas compras 🎉`,
    tip: 'Ofereça 5% na próxima compra para quem entrar — capture o WhatsApp e crie o relacionamento.',
  },
  {
    id: 'atacado',
    label: '📦 Preço de Atacado',
    badge: 'Revenda',
    badgeColor: 'bg-blue-100 text-blue-700',
    msg: `Oi, ${storeName}! Quero receber a lista de preços de atacado 📦`,
    tip: 'Para donos de bar, lanchonete e quem compra em quantidade.',
  },
  {
    id: 'aniversario',
    label: '🎂 Cupom Aniversário',
    badge: 'Fideliza',
    badgeColor: 'bg-amber-100 text-amber-700',
    msg: `Oi, ${storeName}! Quero meu cupom especial de aniversário 🎂`,
    tip: 'Capture nome + data de aniversário e envie desconto no mês — cliente volta garantido.',
  },
]

function WaQR({ value, size = 180 }) {
  return (
    <div className="bg-white p-4 rounded-2xl border-4 border-green-400 shadow-lg inline-block">
      {value && value !== '#'
        ? <QRCodeSVG value={value} size={size} fgColor="#111827" bgColor="#ffffff" level="M" />
        : <div style={{ width: size, height: size }} className="flex items-center justify-center bg-gray-50 rounded-xl">
            <div className="text-center p-4">
              <QrCode className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-400 leading-tight">Configure seu<br/>WhatsApp em<br/>Configurações</p>
            </div>
          </div>
      }
    </div>
  )
}

export default function Fidelidade() {
  const { settings }  = usePrinter()
  const { customers } = useStore()
  const storeName     = settings.storeName || 'Meu Mercado'
  const phone         = settings.phone || ''
  const waPhone       = phone.replace(/\D/g, '').replace(/^0+/, '')
  const campaigns     = useMemo(() => CAMPAIGNS(storeName), [storeName])

  const [activeCampaign, setActiveCampaign] = useState(() => campaigns[0])
  const [copied,  setCopied]  = useState(false)
  const [copiedGroup, setCopiedGroup] = useState(false)
  const printRef = useRef(null)

  const hasPhone  = waPhone.length >= 8
  const waLink  = hasPhone ? `https://wa.me/55${waPhone}?text=${encodeURIComponent(activeCampaign.msg)}` : '#'
  const waShort = hasPhone ? `wa.me/55${waPhone}` : 'Configure seu WhatsApp em Configurações'

  // Stats reais
  const withPhone   = customers.filter(c => c.phone?.replace(/\D/g,'').length >= 8).length
  const totalCustomers = customers.length
  const withoutPhone = totalCustomers - withPhone

  const copy = () => {
    if (!hasPhone) return
    navigator.clipboard.writeText(waLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const print = () => {
    const win = window.open('', '_blank')
    win.document.write(`
      <html><head><title>QR ${storeName}</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box }
        body { font-family: Arial, sans-serif; text-align: center; padding: 48px 32px; background:#fff; }
        .store { font-size: 28px; font-weight: 900; color: #15803d; margin-bottom: 4px; }
        .sub { font-size: 13px; color: #6b7280; margin-bottom: 28px; }
        .qr-wrap { display: inline-block; padding: 20px; border: 4px solid #22c55e; border-radius: 20px; background:#fff; }
        .cta { font-size: 18px; font-weight: 900; color: #111; margin-top: 24px; }
        .campaign { font-size: 13px; color: #374151; margin-top: 8px; max-width: 320px; margin-left:auto; margin-right:auto; }
        .wwa { font-size: 12px; font-weight: 700; color: #22c55e; margin-top: 14px; }
        .footer { font-size: 11px; color: #9ca3af; margin-top: 28px; }
      </style></head><body>
      <div class="store">📲 ${storeName}</div>
      <div class="sub">Escaneie para receber nossas ofertas no WhatsApp</div>
      <div class="qr-wrap">${printRef.current?.innerHTML || ''}</div>
      <div class="cta">🎁 ${activeCampaign.label}</div>
      <div class="campaign">"${activeCampaign.msg}"</div>
      ${hasPhone ? `<div class="wwa">${waShort}</div>` : ''}
      <div class="footer">Powered by ZatendeStok · zatendestok.com.br</div>
      </body></html>
    `)
    win.document.close()
    win.print()
  }

  const groupMsgTemplate = `🛒 *${storeName} — Grupo VIP de Ofertas*

Oi! Seja bem-vindo ao grupo de ofertas do ${storeName}! 🎉

Aqui você recebe:
✅ Promoções da semana toda segunda-feira
✅ Liquidações relâmpago
✅ Ofertas exclusivas para membros do grupo

Fique de olho — só compartilhamos o que vale a pena! 👀

Boas compras! 🛍️`

  return (
    <div className="space-y-6 animate-pop max-w-4xl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-gray-900">Fidelidade & Marketing</h1>
        <p className="text-gray-500 text-sm mt-0.5">QR code WhatsApp, Grupo VIP e estratégias para fidelizar seus clientes</p>
      </div>

      {/* Alerta se telefone não configurado */}
      {!hasPhone && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 px-5 py-4 flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="font-black text-amber-800 text-sm">Telefone/WhatsApp não configurado</p>
            <p className="text-xs text-amber-700 mt-1">O QR code precisa do seu número de WhatsApp para funcionar. Vá em <strong>Configurações → Dados da Loja</strong> e cadastre o telefone com DDD.</p>
          </div>
        </div>
      )}

      {/* KPI strip — dados reais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: Users,         label: 'Clientes cadastrados', value: totalCustomers,  sub: 'na sua base', color: 'text-blue-600' },
          { icon: Phone,         label: 'Com WhatsApp',         value: withPhone,       sub: 'recebem campanhas', color: 'text-green-600' },
          { icon: MessageCircle, label: 'Sem WhatsApp',         value: withoutPhone,    sub: 'potencial a capturar', color: 'text-amber-600' },
          { icon: QrCode,        label: 'Campanha ativa',       value: '1',             sub: activeCampaign.label.replace(/^.{2}\s/,''), color: 'text-purple-600' },
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

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ── QR Generator ── */}
        <div className="lg:col-span-3 card p-6 space-y-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-green-500 flex items-center justify-center">
              <WaIcon className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-black text-gray-900 text-base">QR Code WhatsApp</h2>
              <p className="text-xs text-gray-400">Cliente escaneia → abre o WhatsApp → já manda a mensagem para você</p>
            </div>
          </div>

          {/* Campanhas */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Tipo de campanha:</p>
            {campaigns.map(c => (
              <button key={c.id} onClick={() => setActiveCampaign(c)}
                className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
                  activeCampaign.id === c.id ? 'border-green-500 bg-green-50' : 'border-gray-100 hover:border-gray-200 bg-white'
                }`}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-sm font-black text-gray-800">{c.label}</span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${c.badgeColor}`}>{c.badge}</span>
                </div>
                <div className="text-xs text-gray-400 leading-snug">{c.tip}</div>
              </button>
            ))}
          </div>

          {/* QR Display */}
          <div className="flex flex-col items-center gap-4 py-5 bg-gradient-to-b from-gray-50 to-white rounded-2xl border border-gray-100">
            <div ref={printRef}>
              <WaQR value={waLink} size={180} />
            </div>
            <div className="text-center px-4">
              <p className="text-xs font-black text-gray-700 uppercase tracking-widest">📲 Escaneie e receba nossas promoções!</p>
              <p className="text-[11px] text-gray-400 mt-1 font-mono">{waShort}</p>
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={copy} disabled={!hasPhone}
              className={`flex-1 flex items-center justify-center gap-2 text-sm font-bold py-2.5 rounded-xl border-2 transition-all disabled:opacity-40 ${
                copied ? 'border-green-400 bg-green-50 text-green-700' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Link copiado!' : 'Copiar link'}
            </button>
            <button onClick={print} disabled={!hasPhone}
              className="flex-1 flex items-center justify-center gap-2 text-sm font-bold py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-40 transition-colors">
              <Printer className="w-4 h-4" /> Imprimir QR
            </button>
          </div>

          {hasPhone && (
            <a href={waLink} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 bg-green-500 hover:bg-green-600 text-white font-black rounded-xl transition-colors text-sm">
              <WaIcon className="w-4 h-4 text-white" /> Testar o link agora
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </a>
          )}
        </div>

        {/* ── Dicas onde colocar o QR ── */}
        <div className="lg:col-span-2 space-y-4">

          <div className="card p-5 space-y-4">
            <h3 className="font-black text-gray-900 text-sm uppercase tracking-wide">📍 Onde colocar o QR</h3>
            {[
              { icon: '🖨️', title: 'Impresso no caixa', desc: 'Plastifique e cole na frente do caixa. Quando o cliente for pagar, ofereça: "Escaneia aí pra receber nossas ofertas!"' },
              { icon: '🛍️', title: 'Na sacola / embalagem', desc: 'Imprima pequeno e cole na sacola. O cliente leva para casa e lembra depois.' },
              { icon: '🚪', title: 'Entrada da loja', desc: 'A4 plastificado na porta. Clientes que esperam na fila têm tempo para escanear.' },
              { icon: '📊', title: 'Banner / banner digital', desc: 'TV de 24 pol. na frente do caixa mostrando o QR e as promoções do dia é altamente eficiente.' },
            ].map(d => (
              <div key={d.title} className="flex gap-3">
                <span className="text-xl flex-shrink-0 mt-0.5">{d.icon}</span>
                <div>
                  <p className="text-sm font-black text-gray-800">{d.title}</p>
                  <p className="text-xs text-gray-500 leading-snug mt-0.5">{d.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="card p-5 space-y-3 border-green-200 bg-green-50/50">
            <h3 className="font-black text-green-800 text-sm uppercase tracking-wide">💬 O que falar pro cliente</h3>
            <div className="space-y-2">
              {[
                '"Escaneia esse QR que você recebe as promoções da semana pelo WhatsApp!"',
                '"A gente tem clube de fidelidade — escaneia e já entra no grupo!"',
                '"Toda segunda-feira a gente manda as ofertas no zap — quer receber?"',
              ].map(t => (
                <div key={t} className="bg-white rounded-xl px-3 py-2 border border-green-200">
                  <p className="text-xs text-gray-700 italic leading-relaxed">{t}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Grupo VIP ── */}
      <div className="card p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-green-500 flex items-center justify-center flex-shrink-0">
            <Users className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="font-black text-gray-900 text-base">Grupo VIP de Ofertas no WhatsApp</h2>
            <p className="text-xs text-gray-400">A forma mais simples e barata de fidelizar clientes — sem custo extra</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Como criar */}
          <div className="space-y-3">
            <p className="text-xs font-black text-gray-700 uppercase tracking-wide">Como criar em 5 minutos:</p>
            {[
              { n: '1', title: 'Crie o grupo no WhatsApp', desc: `Nome sugerido: "Ofertinhas ${storeName} 🛒" — soa amigável e informal.` },
              { n: '2', title: 'Configure o grupo', desc: 'Só admins podem postar. Coloque sua foto do mercado como avatar do grupo.' },
              { n: '3', title: 'Adicione clientes', desc: 'Use a aba Campanhas → Grupos do Zap para enviar via bot, ou adicione manualmente.' },
              { n: '4', title: 'Boas-vindas + primeiras ofertas', desc: 'Copie a mensagem ao lado e mande no grupo na hora que criar!' },
            ].map(s => (
              <div key={s.n} className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-green-500 text-white text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">{s.n}</div>
                <div>
                  <p className="text-sm font-black text-gray-800">{s.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-snug">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Mensagem de boas-vindas */}
          <div className="space-y-3">
            <p className="text-xs font-black text-gray-700 uppercase tracking-wide">Mensagem de boas-vindas:</p>
            <div className="bg-[#075E54] rounded-2xl p-4 space-y-2">
              <div className="bg-[#128C7E] rounded-xl rounded-tl-none px-4 py-3">
                <pre className="text-white text-xs leading-relaxed font-sans whitespace-pre-wrap">{groupMsgTemplate}</pre>
              </div>
            </div>
            <button onClick={() => { navigator.clipboard.writeText(groupMsgTemplate); setCopiedGroup(true); setTimeout(() => setCopiedGroup(false), 2500) }}
              className={`w-full flex items-center justify-center gap-2 text-sm font-bold py-2.5 rounded-xl border-2 transition-all ${
                copiedGroup ? 'border-green-400 bg-green-50 text-green-700' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}>
              {copiedGroup ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedGroup ? 'Mensagem copiada!' : 'Copiar mensagem de boas-vindas'}
            </button>
          </div>
        </div>

        {/* Calendário de conteúdo */}
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-black text-gray-700 uppercase tracking-wide mb-3">📅 Calendário de conteúdo semanal:</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { day: 'Segunda', icon: Megaphone, color: 'bg-orange-50 border-orange-200', textColor: 'text-orange-700', action: 'Promoções da semana' },
              { day: 'Quarta',  icon: Gift,      color: 'bg-purple-50 border-purple-200', textColor: 'text-purple-700', action: 'Oferta relâmpago (24h)' },
              { day: 'Sexta',   icon: Clock,     color: 'bg-blue-50 border-blue-200',     textColor: 'text-blue-700',   action: 'Pré-fim de semana' },
              { day: 'Domingo', icon: MapPin,    color: 'bg-green-50 border-green-200',   textColor: 'text-green-700',  action: 'Lembrete de abertura' },
            ].map(d => (
              <div key={d.day} className={`rounded-xl border p-3 ${d.color}`}>
                <div className={`text-xs font-black uppercase tracking-wide ${d.textColor}`}>{d.day}</div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <d.icon className={`w-3.5 h-3.5 ${d.textColor}`} />
                  <span className="text-xs text-gray-700">{d.action}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">💡 Dica: poste foto de verdade dos produtos (câmera do celular já basta), não use imagens genéricas da internet — gera muito mais engajamento.</p>
        </div>
      </div>

    </div>
  )
}
