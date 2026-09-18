/**
 * ZatendeStokLogo — identidade visual ZatendeStok.
 * variant="full"     → logo completa: ícone + wordmark + tagline (login/splash)
 * variant="wordmark" → compacto: ícone pequeno + wordmark (headers/sidebars)
 *
 * Marca: "ZatendeStok" — K em destaque (cor accent + tamanho maior).
 */

const C  = '#5462D8'  // azul primário
const CK = '#22c55e'  // verde accent — K em destaque

/* ── Ícone ───────────────────────────────────────────────── */
function BasketIcon({ size = 80 }) {
  const s = size
  return (
    <svg width={s} height={Math.round(s * 1.15)} viewBox="0 0 100 115" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M18,46 C18,22 34,10 50,10 C66,10 82,22 82,46" fill={C} />
      <rect x="10" y="44" width="80" height="30" fill={C} rx="2" />
      <polyline points="18,70 34,54 52,64 72,42" stroke={CK} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <polygon points="64,36 77,42 70,55" fill={CK} />
      <line x1="8"  y1="82"  x2="92" y2="82"  stroke={C} strokeWidth="7.5" strokeLinecap="round" />
      <line x1="15" y1="93"  x2="85" y2="93"  stroke={C} strokeWidth="6.5" strokeLinecap="round" />
      <line x1="24" y1="103" x2="76" y2="103" stroke={C} strokeWidth="5.5" strokeLinecap="round" />
      <line x1="33" y1="112" x2="67" y2="112" stroke={C} strokeWidth="4.5" strokeLinecap="round" />
    </svg>
  )
}

/* ── Wordmark text ──────────────────────────────────────── */
function Word({ size = 52, gap = 0 }) {
  return (
    <span style={{ fontWeight: 900, fontSize: size, letterSpacing: '-0.02em', lineHeight: 1, fontFamily: "'Segoe UI Black', 'Arial Black', sans-serif", display: 'inline-flex', alignItems: 'baseline', gap }}>
      <span style={{ color: C }}>ZatendeSto</span>
      <span style={{ color: CK, fontSize: size * 1.22, lineHeight: 1, letterSpacing: '-0.01em' }}>k</span>
    </span>
  )
}

export default function ZatendeStokLogo({ variant = 'wordmark', style = {} }) {

  /* full — stacked so it never overflows narrow containers (login left panel = ~320px) */
  if (variant === 'full') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10, ...style }}>
        <BasketIcon size={52} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Word size={36} />
          <span style={{ color: '#7b82c8', fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
            Gestão Inteligente de Estoque
          </span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, ...style }}>
      <BasketIcon size={26} />
      <Word size={15} />
    </div>
  )
}
