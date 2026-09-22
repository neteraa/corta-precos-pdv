/**
 * ZaraMascot — mascote da Zara, bot do ZatendeStok.
 * SVG flat illustration com gradientes de profundidade e animações CSS.
 * Props: width (px), className, style
 */
export default function ZaraMascot({ width = 280, className = '', style = {} }) {
  const h = Math.round(width * 390 / 280)
  return (
    <svg
      width={width}
      height={h}
      viewBox="0 0 280 390"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ overflow: 'visible', ...style }}
    >
      <defs>
        {/* Face — radial para dar volume esférico */}
        <radialGradient id="zr_face" cx="38%" cy="30%" r="68%">
          <stop offset="0%"   stopColor="#DCA472"/>
          <stop offset="52%"  stopColor="#C47A48"/>
          <stop offset="100%" stopColor="#96572E"/>
        </radialGradient>

        {/* Jacket — linear sutil */}
        <linearGradient id="zr_jkt" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#241A08"/>
          <stop offset="100%" stopColor="#180E04"/>
        </linearGradient>

        {/* Arm skin left */}
        <linearGradient id="zr_aL" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#96572E"/>
          <stop offset="100%" stopColor="#C47A48"/>
        </linearGradient>

        {/* Arm skin right */}
        <linearGradient id="zr_aR" x1="100%" y1="0%" x2="0%" y2="0%">
          <stop offset="0%"   stopColor="#96572E"/>
          <stop offset="100%" stopColor="#C47A48"/>
        </linearGradient>

        {/* Ground shadow */}
        <radialGradient id="zr_gnd" cx="50%" cy="50%">
          <stop offset="0%"   stopColor="#000" stopOpacity="0.32"/>
          <stop offset="100%" stopColor="#000" stopOpacity="0"/>
        </radialGradient>

        {/* Phone screen */}
        <linearGradient id="zr_scr" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="#f97316"/>
          <stop offset="100%" stopColor="#ea6c10"/>
        </linearGradient>

        {/* Z badge */}
        <linearGradient id="zr_bdg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#fb923c"/>
          <stop offset="100%" stopColor="#f97316"/>
        </linearGradient>

        {/* Clip for phone screen */}
        <clipPath id="zr_phone_clip">
          <rect x="42" y="276" width="24" height="38" rx="3"/>
        </clipPath>

        {/* CSS animations */}
        <style>{`
          .zm-root { animation: zm-float 3.8s ease-in-out infinite; transform-origin: bottom center; }
          .zm-eyes { animation: zm-blink 5s ease-in-out infinite; transform-origin: center 75px; }
          .zm-badge { animation: zm-pulse-o 2.5s ease-in-out infinite; }
          .zm-notif { animation: zm-pulse-g 2.2s ease-in-out infinite; }
          .zm-arm-r { animation: zm-wave 3.8s ease-in-out infinite; transform-origin: 215px 152px; }
          @keyframes zm-float {
            0%,100%{ transform:translateY(0) }
            50%    { transform:translateY(-11px) }
          }
          @keyframes zm-blink {
            0%,88%,100%{ transform:scaleY(1) }
            91%        { transform:scaleY(0.08) }
          }
          @keyframes zm-pulse-o {
            0%,100%{ filter:drop-shadow(0 0 0px #f97316) }
            50%    { filter:drop-shadow(0 0 6px #f97316) }
          }
          @keyframes zm-pulse-g {
            0%,100%{ opacity:1 }
            50%    { opacity:.5 }
          }
          @keyframes zm-wave {
            0%,100%{ transform:rotate(0deg) }
            20%    { transform:rotate(-12deg) }
            40%    { transform:rotate(6deg) }
            60%    { transform:rotate(-8deg) }
            80%    { transform:rotate(4deg) }
          }
        `}</style>
      </defs>

      {/* === GROUND SHADOW === */}
      <ellipse cx="140" cy="382" rx="74" ry="9" fill="url(#zr_gnd)"/>

      <g className="zm-root">

        {/* ══════ LEGS ══════ */}
        {/* Left leg */}
        <path d="M98 282 C95 318 92 348 90 364 Q96 372 110 370 Q114 368 114 364 C115 348 116 318 114 282 Z"
          fill="#120D06"/>
        {/* Right leg */}
        <path d="M158 282 C162 318 165 348 168 364 Q165 372 178 370 Q182 368 180 364 C178 348 174 318 168 282 Z"
          fill="#0F0B05"/>

        {/* ══════ SHOES ══════ */}
        {/* Left shoe */}
        <path d="M87 357 C78 359 74 367 76 375 L116 375 C118 368 113 359 103 357 Z" fill="#0C0905"/>
        <path d="M80 365 Q87 360 98 361" stroke="#231A07" strokeWidth="1.5" fill="none" opacity="0.55"/>
        {/* Right shoe */}
        <path d="M164 358 C157 360 159 368 163 375 L194 375 C196 367 191 360 183 358 Z" fill="#0C0905"/>
        <path d="M167 363 Q174 360 182 362" stroke="#231A07" strokeWidth="1.5" fill="none" opacity="0.5"/>

        {/* ══════ JACKET BODY ══════ */}
        <path d="M56 148 C44 178 48 238 52 282 L228 282 C232 238 236 178 224 148 C204 128 176 118 150 116 L130 116 C104 118 76 128 56 148 Z"
          fill="url(#zr_jkt)"/>

        {/* Center seam */}
        <path d="M140 120 L140 278" stroke="#2C1C08" strokeWidth="1" opacity="0.45"/>

        {/* Lapel left */}
        <path d="M130 120 C126 132 122 148 128 162 L140 148 L140 120 Z" fill="#1C1107" opacity="0.65"/>
        {/* Lapel right */}
        <path d="M150 120 C154 132 158 148 152 162 L140 148 L140 120 Z" fill="#1C1107" opacity="0.45"/>

        {/* ORANGE shoulder stripe — left */}
        <path d="M56 154 C50 180 52 228 56 264 L74 260 C74 224 76 180 84 158 Z" fill="#f97316"/>
        {/* stripe highlight */}
        <path d="M60 162 C56 192 57 228 60 258 L65 255 C64 224 63 192 68 166 Z" fill="#fb923c" opacity="0.38"/>

        {/* Pocket detail */}
        <rect x="157" y="192" width="20" height="14" rx="2" fill="none"
          stroke="#2C1C08" strokeWidth="1" opacity="0.5"/>

        {/* ══════ Z BADGE ══════ */}
        <g className="zm-badge">
          <rect x="114" y="174" width="28" height="28" rx="7" fill="url(#zr_bdg)"/>
          <rect x="116" y="176" width="24" height="24" rx="6" fill="#fb923c"/>
          {/* Z letter */}
          <path d="M119 181 L139 181 L119 195 L139 195"
            stroke="white" strokeWidth="2.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </g>

        {/* ══════ LEFT ARM (phone) ══════ */}
        {/* Upper arm */}
        <path d="M56 158 C40 180 34 222 38 260 C44 268 56 265 60 256 C60 224 64 186 78 162 Z"
          fill="url(#zr_aL)"/>
        {/* Forearm */}
        <path d="M38 260 C35 278 42 292 53 295 C60 285 60 272 60 256 Z" fill="#C47A48"/>
        {/* Hand */}
        <ellipse cx="50" cy="298" rx="14" ry="16" fill="#C47A48"/>
        {/* Thumb */}
        <ellipse cx="38" cy="300" rx="9" ry="8" fill="#C47A48"/>

        {/* PHONE */}
        <rect x="30" y="274" width="30" height="52" rx="6" fill="#120D06"/>
        {/* Screen bezels */}
        <rect x="33" y="278" width="24" height="42" rx="4" fill="#1A1208"/>
        {/* App zone orange */}
        <rect x="35" y="281" width="20" height="20" rx="3" fill="url(#zr_scr)" clipPath="url(#zr_phone_clip)"/>
        {/* Z on phone */}
        <path d="M38 285 L52 285 L38 295 L52 295"
          stroke="white" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        {/* Green notification dot */}
        <circle cx="53" cy="281" r="5" fill="#1A1208"/>
        <circle cx="53" cy="281" r="3.5" fill="#22c55e" className="zm-notif"/>
        {/* App icon row */}
        <rect x="36" y="305" width="6" height="6" rx="1.5" fill="#2A1C08"/>
        <rect x="45" y="305" width="6" height="6" rx="1.5" fill="#2A1C08"/>
        <rect x="54" y="305" width="6" height="6" rx="1.5" fill="#f97316" opacity="0.6"/>
        {/* Notch */}
        <rect x="38" y="276" width="14" height="3" rx="1.5" fill="#120D06"/>

        {/* ══════ RIGHT ARM (waving — animada) ══════ */}
        <g className="zm-arm-r">
          {/* Upper arm going up-right */}
          <path d="M224 152 C236 140 244 124 238 112 C232 100 218 104 214 118 C218 130 218 144 224 152 Z"
            fill="url(#zr_aR)"/>
          {/* Forearm */}
          <path d="M238 112 C244 98 240 84 230 80 C220 82 214 96 214 112 Z" fill="#C47A48"/>
          {/* Hand / fist */}
          <ellipse cx="228" cy="76" rx="16" ry="17" fill="#C47A48"/>
          {/* Thumb up */}
          <path d="M222 62 C218 52 222 42 230 42 C238 42 240 54 234 62 L228 68 Z" fill="#C47A48"/>
          {/* Knuckle hint */}
          <path d="M218 74 Q224 70 230 74" stroke="#96572E" strokeWidth="1.5" fill="none" opacity="0.55"/>
          <path d="M216 80 Q224 77 232 80" stroke="#96572E" strokeWidth="1.5" fill="none" opacity="0.4"/>
          {/* Nail on thumb */}
          <ellipse cx="230" cy="46" rx="5" ry="4" fill="#E08A50" opacity="0.5"/>
        </g>

        {/* ══════ NECK ══════ */}
        <path d="M126 116 L126 142 C130 149 138 153 142 153 C146 153 154 149 158 142 L158 116 C152 112 146 110 140 110 C134 110 132 112 126 116 Z"
          fill="#C47A48"/>
        {/* Shadow at collar */}
        <path d="M126 136 C130 148 138 152 142 152 C146 152 154 148 158 136 L158 142 C154 149 146 153 142 153 C138 153 130 149 126 142 Z"
          fill="#96572E" opacity="0.5"/>

        {/* ══════ HEAD ══════ */}
        {/* Hair mass */}
        <ellipse cx="140" cy="62" rx="60" ry="67" fill="#1E0E05"/>

        {/* Face */}
        <ellipse cx="140" cy="70" rx="52" ry="57" fill="url(#zr_face)"/>

        {/* Hair top — volume com swoosh */}
        <path d="M84 46 C90 16 112 4 138 2 C164 4 188 16 196 46 C180 30 162 24 140 22 C118 24 100 30 84 46 Z"
          fill="#1E0E05"/>
        <path d="M84 44 C80 56 80 72 86 82 C88 68 90 52 94 44 Z" fill="#1E0E05"/>
        <path d="M196 44 C200 56 200 72 194 82 C192 68 190 52 186 44 Z" fill="#1E0E05"/>
        {/* Hair texture line */}
        <path d="M114 18 Q130 11 148 14" stroke="#2E1408" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.45"/>
        <path d="M120 10 Q136 5 154 9" stroke="#3A1A0A" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.3"/>

        {/* ══════ EARS ══════ */}
        {/* Left */}
        <ellipse cx="90" cy="76" rx="12" ry="15" fill="#A66638"/>
        <ellipse cx="93" cy="76" rx="8" ry="11" fill="#C47A48"/>
        <path d="M92 70 Q90 76 92 82" stroke="#96572E" strokeWidth="1.5" fill="none" opacity="0.5"/>
        {/* Right */}
        <ellipse cx="190" cy="76" rx="12" ry="15" fill="#A66638"/>
        <ellipse cx="187" cy="76" rx="8" ry="11" fill="#C47A48"/>

        {/* ══════ EYES ══════ */}
        <g className="zm-eyes">
          {/* Socket shadows */}
          <ellipse cx="122" cy="72" rx="18" ry="15" fill="#96572E" opacity="0.18"/>
          <ellipse cx="158" cy="72" rx="18" ry="15" fill="#96572E" opacity="0.18"/>
          {/* Whites */}
          <ellipse cx="122" cy="72" rx="15" ry="13" fill="#F5F0E8"/>
          <ellipse cx="158" cy="72" rx="15" ry="13" fill="#F5F0E8"/>
          {/* Iris */}
          <circle cx="124" cy="73" r="9" fill="#3D1F08"/>
          <circle cx="160" cy="73" r="9" fill="#3D1F08"/>
          {/* Pupils */}
          <circle cx="124" cy="73" r="6" fill="#0A0500"/>
          <circle cx="160" cy="73" r="6" fill="#0A0500"/>
          {/* Main highlight */}
          <circle cx="126" cy="69" r="3" fill="white" opacity="0.95"/>
          <circle cx="162" cy="69" r="3" fill="white" opacity="0.95"/>
          {/* Secondary highlight */}
          <circle cx="120" cy="76" r="1.5" fill="white" opacity="0.55"/>
          <circle cx="156" cy="76" r="1.5" fill="white" opacity="0.55"/>
          {/* Bottom lash line */}
          <path d="M108 80 Q122 86 136 82" stroke="#96572E" strokeWidth="1" fill="none" opacity="0.35"/>
          <path d="M144 82 Q158 86 172 80" stroke="#96572E" strokeWidth="1" fill="none" opacity="0.35"/>
        </g>

        {/* ══════ EYEBROWS ══════ */}
        <path d="M106 56 C113 50 123 48 134 52"
          stroke="#1E0E05" strokeWidth="4" fill="none" strokeLinecap="round"/>
        <path d="M146 52 C157 48 167 50 174 56"
          stroke="#1E0E05" strokeWidth="4" fill="none" strokeLinecap="round"/>

        {/* ══════ NOSE ══════ */}
        <path d="M136 85 C133 93 133 100 136 104 Q140 107 144 104 C147 100 147 93 144 85"
          stroke="#A66638" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.5"/>
        <ellipse cx="140" cy="104" rx="5" ry="4" fill="#DCA472" opacity="0.28"/>

        {/* ══════ SMILE ══════ */}
        {/* Mouth arc */}
        <path d="M112 108 C118 126 162 128 168 108"
          stroke="#7A3812" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        {/* Teeth */}
        <path d="M116 112 C120 126 160 126 164 112 C158 120 148 122 140 122 C132 122 122 120 116 112 Z"
          fill="white" opacity="0.88"/>
        {/* Lower lip */}
        <path d="M122 122 Q140 127 158 122" stroke="#A66638" strokeWidth="1" fill="none" opacity="0.45"/>
        {/* Dimples */}
        <circle cx="111" cy="110" r="3.5" fill="#96572E" opacity="0.22"/>
        <circle cx="169" cy="110" r="3.5" fill="#96572E" opacity="0.22"/>

        {/* ══════ BLUSH ══════ */}
        <ellipse cx="98"  cy="92" rx="16" ry="10" fill="#DE6F50" opacity="0.18"/>
        <ellipse cx="182" cy="92" rx="16" ry="10" fill="#DE6F50" opacity="0.18"/>

        {/* ══════ COLLAR HINT ══════ */}
        <path d="M128 142 Q134 156 140 158 Q146 156 152 142"
          stroke="#f97316" strokeWidth="2" fill="none" opacity="0.65"/>

        {/* ══════ BELT ══════ */}
        <rect x="82" y="267" width="116" height="8" rx="4" fill="#0A0805"/>
        {/* Buckle */}
        <rect x="130" y="265" width="20" height="12" rx="3" fill="#f97316"/>
        <path d="M133 268 L146 268 L133 274 L146 274"
          stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>

      </g>{/* end zm-root */}
    </svg>
  )
}
