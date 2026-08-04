/**
 * ZatendeStockLogo — brand mark for platform identity.
 * variant="banner" → og-image.png (login screens, splash)
 * variant="wordmark" → CSS wordmark (headers, sidebars)
 */
export default function ZatendeStockLogo({ variant = 'wordmark', style = {} }) {
  if (variant === 'banner') {
    return (
      <img
        src="/og-image.png"
        alt="ZatendeStock"
        style={{
          width: '100%',
          maxWidth: 280,
          height: 'auto',
          objectFit: 'contain',
          display: 'block',
          margin: '0 auto',
          ...style,
        }}
      />
    )
  }

  /* ── compact wordmark ─────────────────────────────────────── */
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, ...style }}>
      {/* icon mark */}
      <svg width="22" height="22" viewBox="0 0 200 200" style={{ flexShrink: 0 }}>
        <defs>
          <linearGradient id="zsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4f46e5" />
            <stop offset="100%" stopColor="#4ade80" />
          </linearGradient>
        </defs>
        {/* cart body */}
        <rect x="30" y="60" width="120" height="80" rx="16" fill="none" stroke="#4f46e5" strokeWidth="14" />
        {/* wheels */}
        <circle cx="65"  cy="168" r="16" fill="#4f46e5" />
        <circle cx="125" cy="168" r="16" fill="#4f46e5" />
        {/* trending arrow */}
        <polyline points="50,120 90,85 120,110 160,60" stroke="#4ade80" strokeWidth="14" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <polygon points="148,45 175,55 165,82" fill="#4ade80" />
        {/* shelf lines */}
        <line x1="30" y1="158" x2="170" y2="158" stroke="url(#zsGrad)" strokeWidth="8" strokeLinecap="round" />
        <line x1="40" y1="172" x2="160" y2="172" stroke="url(#zsGrad)" strokeWidth="6" strokeLinecap="round" opacity="0.5" />
      </svg>

      {/* wordmark */}
      <span style={{ fontWeight: 900, fontSize: 15, letterSpacing: '-0.03em', lineHeight: 1 }}>
        <span style={{ color: '#818cf8' }}>Zatende</span>
        <span style={{ color: '#4ade80' }}>Stock</span>
      </span>
    </div>
  )
}
