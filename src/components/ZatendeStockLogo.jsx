/**
 * ZatendeStockLogo — SVG fiel à identidade visual.
 * variant="full"     → logo completa: ícone + wordmark + tagline (telas de login/splash)
 * variant="wordmark" → versão compacta: ícone pequeno + wordmark (headers/sidebars)
 */

/* ── Ícone: cesta de compras azul com seta verde ──────────── */
function BasketIcon({ size = 80 }) {
  const s = size
  return (
    <svg width={s} height={Math.round(s * 1.15)} viewBox="0 0 100 115" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      {/* Arco superior — borda/abertura da cesta */}
      <path d="M18,46 C18,22 34,10 50,10 C66,10 82,22 82,46" fill="#5462D8" />
      {/* Corpo principal da cesta */}
      <rect x="10" y="44" width="80" height="30" fill="#5462D8" rx="2" />
      {/* Seta de tendência verde */}
      <polyline
        points="18,70 34,54 52,64 72,42"
        stroke="#4ade80" strokeWidth="6"
        strokeLinecap="round" strokeLinejoin="round"
      />
      {/* Ponta da seta */}
      <polygon points="64,36 77,42 70,55" fill="#4ade80" />
      {/* Linhas da base (pirâmide) */}
      <line x1="8"  y1="82"  x2="92" y2="82"  stroke="#5462D8" strokeWidth="7.5" strokeLinecap="round" />
      <line x1="15" y1="93"  x2="85" y2="93"  stroke="#5462D8" strokeWidth="6.5" strokeLinecap="round" />
      <line x1="24" y1="103" x2="76" y2="103" stroke="#5462D8" strokeWidth="5.5" strokeLinecap="round" />
      <line x1="33" y1="112" x2="67" y2="112" stroke="#5462D8" strokeWidth="4.5" strokeLinecap="round" />
    </svg>
  )
}

export default function ZatendeStockLogo({ variant = 'wordmark', style = {} }) {

  /* ── versão completa (login / splash) ──────────────────── */
  if (variant === 'full') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, ...style }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <BasketIcon size={88} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{
              fontWeight: 900, fontSize: 52, letterSpacing: '-0.02em',
              lineHeight: 1, fontFamily: "'Segoe UI Black', 'Arial Black', sans-serif",
            }}>
              <span style={{ color: '#5462D8' }}>Zatende</span>
              <span style={{ color: '#4ade80' }}>Stock</span>
            </span>
            <span style={{
              color: '#7b82c8', fontSize: 13, fontWeight: 600,
              letterSpacing: '0.2em', textTransform: 'uppercase',
            }}>
              Gestão Inteligente de Estoque
            </span>
          </div>
        </div>
      </div>
    )
  }

  /* ── wordmark compacto (header / sidebar) ───────────────── */
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, ...style }}>
      <BasketIcon size={26} />
      <span style={{ fontWeight: 900, fontSize: 15, letterSpacing: '-0.03em', lineHeight: 1 }}>
        <span style={{ color: '#5462D8' }}>Zatende</span>
        <span style={{ color: '#4ade80' }}>Stock</span>
      </span>
    </div>
  )
}
