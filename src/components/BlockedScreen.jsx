import React from 'react'
import { ShieldX, Phone, Clock } from 'lucide-react'

export default function BlockedScreen({ reason, daysLeft }) {
  const suspended = reason === 'suspended'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#04080f',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 32,
    }}>
      {/* Glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 40%, rgba(239,68,68,0.12) 0%, transparent 65%)',
      }} />

      <div style={{ position: 'relative', textAlign: 'center', maxWidth: 420 }}>
        {/* Icon */}
        <div style={{
          width: 72, height: 72, borderRadius: 20, margin: '0 auto 24px',
          background: 'rgba(239,68,68,0.15)', border: '1.5px solid rgba(239,68,68,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {suspended ? <ShieldX size={36} color="#ef4444" /> : <Clock size={36} color="#f97316" />}
        </div>

        {/* Title */}
        <div style={{ color: '#f1f5f9', fontWeight: 900, fontSize: 22, marginBottom: 10 }}>
          {suspended ? 'Acesso suspenso' : 'Assinatura vencida'}
        </div>

        {/* Subtitle */}
        <div style={{ color: '#64748b', fontSize: 14, lineHeight: 1.7, marginBottom: 28 }}>
          {suspended
            ? 'Este sistema está temporariamente suspenso. Entre em contato com o suporte para regularizar sua conta.'
            : `Sua assinatura venceu${daysLeft != null ? ` há ${Math.abs(daysLeft)} dia${Math.abs(daysLeft) !== 1 ? 's' : ''}` : ''}. Renove para continuar usando o sistema.`
          }
        </div>

        {/* CTA */}
        <a
          href="https://wa.me/5500000000000?text=Preciso+renovar+minha+assinatura+do+Corta+Preços"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '14px 28px', borderRadius: 14, textDecoration: 'none',
            background: 'linear-gradient(135deg,#22c55e,#16a34a)',
            color: '#fff', fontWeight: 900, fontSize: 15,
            boxShadow: '0 4px 24px rgba(34,197,94,0.3)',
          }}>
          <Phone size={18} /> Falar com suporte no WhatsApp
        </a>

        <div style={{ color: '#1e3a5f', fontSize: 11, marginTop: 20 }}>
          Corta Preços PDV · Sistema de Gestão de Mercados
        </div>
      </div>
    </div>
  )
}
