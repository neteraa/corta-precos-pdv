/**
 * ZatendeStokLogo — identidade visual ZatendeStok.
 * variant="mark"     → só o ícone quadrado (favicon, app icon)
 * variant="full"     → ícone + wordmark + tagline (splash/login)
 * variant="wordmark" → ícone pequeno + wordmark inline (nav/sidebar)
 */

/* ── Ícone principal ─────────────────────────────────────── */
export function ZSMark({ size = 40, rounded = 10 }) {
  const id = `zs_${size}`
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0, borderRadius: rounded }}>
      <defs>
        <linearGradient id={`${id}_bg`} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#0d0b07"/>
          <stop offset="100%" stopColor="#1a1307"/>
        </linearGradient>
        <linearGradient id={`${id}_z`} x1="8" y1="10" x2="40" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#f97316"/>
          <stop offset="55%"  stopColor="#fb923c"/>
          <stop offset="100%" stopColor="#fbbf24"/>
        </linearGradient>
        <filter id={`${id}_glow`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.5" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {/* background */}
      <rect width="48" height="48" rx="11" fill={`url(#${id}_bg)`}/>
      {/* subtle inner border */}
      <rect x=".5" y=".5" width="47" height="47" rx="10.5" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1"/>
      {/* Z bolt shape */}
      <path
        filter={`url(#${id}_glow)`}
        fill={`url(#${id}_z)`}
        d="M9 11h24l-2.5 4H14L28 28h-5.5L9 14.5V11z M39 34H15l2.5-4H31L17 17h5.5L39 30.5V34z"
      />
      {/* connector diagonal accent */}
      <line x1="14" y1="15" x2="32" y2="29" stroke="rgba(251,191,36,0.25)" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

/* ── Wordmark text ──────────────────────────────────────── */
function Word({ size = 18, lightMode = false }) {
  const base = lightMode ? '#0a0a12' : '#ffffff'
  return (
    <span style={{ fontWeight: 900, fontSize: size, letterSpacing: '-0.03em', lineHeight: 1, fontFamily: "'Inter','Segoe UI Black','Arial Black',sans-serif", display: 'inline-flex', alignItems: 'baseline' }}>
      <span style={{ color: base }}>Zatende</span>
      <span style={{ color: '#f97316' }}>Sto</span>
      <span style={{ color: '#fbbf24', fontSize: size * 1.12 }}>k</span>
    </span>
  )
}

export default function ZatendeStokLogo({ variant = 'wordmark', style = {}, lightMode = false }) {
  if (variant === 'mark') return <ZSMark size={40} {...(style ? { style } : {})} />

  if (variant === 'full') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12, ...style }}>
        <ZSMark size={56} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Word size={32} lightMode={lightMode} />
          <span style={{ color: lightMode ? '#6b7280' : 'rgba(255,255,255,0.4)', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            PDV · BOT WHATSAPP · ESTOQUE
          </span>
        </div>
      </div>
    )
  }

  // wordmark (default)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...style }}>
      <ZSMark size={28} rounded={7} />
      <Word size={15} lightMode={lightMode} />
    </div>
  )
}
