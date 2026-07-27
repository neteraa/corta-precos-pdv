import React, { useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'

const WA_LINK = 'https://wa.me/5515996604075?text=Oi%20Corta%20Pre%C3%A7os!%20Quero%20participar%20do%20sorteio!'
const SORTEIO_DATE = 'Todo último sábado do mês'
const VALIDADE     = 'Válido até 31/08/2025'

/* ── 3 coupons at the bottom ─────────────────────────────── */
const COUPONS = [
  { n: '001' }, { n: '002' }, { n: '003' },
]

export default function Flyer() {
  const printRef = useRef()

  const handlePrint = () => {
    document.title = 'Flyer Corta Preços'
    window.print()
  }

  return (
    <>
      {/* Print button — hidden on print */}
      <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
        <button
          onClick={handlePrint}
          className="bg-gray-900 text-white font-black px-6 py-3 rounded-xl shadow-xl hover:bg-gray-700 flex items-center gap-2 text-sm"
        >
          🖨️ Imprimir A4
        </button>
        <a href="/pdv" className="bg-gray-100 text-gray-600 font-bold px-4 py-3 rounded-xl shadow text-sm flex items-center gap-2 hover:bg-gray-200">
          ← PDV
        </a>
      </div>

      {/* A4 page */}
      <div ref={printRef} className="flyer-page">

        {/* ── TOP: main flyer ──────────────────────────────── */}
        <div className="flyer-main">

          {/* confetti dots (decorative) */}
          <div className="confetti" aria-hidden="true">
            {['🎊','⭐','🎁','💰','🎉','✨','🏆','🎊','⭐','🎁','💰','🎉','✨','🏆','🎊','⭐'].map((e, i) => (
              <span key={i} className="confetti-item" style={{ left: `${(i * 6.2) % 100}%`, animationDelay: `${i * 0.3}s`, fontSize: `${10 + (i % 4) * 4}px`, top: `${(i * 17) % 40}px` }}>{e}</span>
            ))}
          </div>

          {/* header strip */}
          <div className="flyer-header">
            <div className="flyer-logo">
              <svg className="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                <circle cx="5.5" cy="5.5" r="2.5" strokeWidth="2.5" />
                <circle cx="5.5" cy="18.5" r="2.5" strokeWidth="2.5" />
              </svg>
              <span>CORTA PREÇO$</span>
            </div>
            <div className="flyer-contact">
              <span>📍 (15) 99660-4075</span>
              <span>📱 @mercadocortaprecos</span>
            </div>
          </div>

          {/* hero */}
          <div className="flyer-hero">
            <div className="flyer-badge">🏆 GRANDE SORTEIO MENSAL 🏆</div>

            <div className="flyer-prize-label">GANHE</div>
            <div className="flyer-prize-value">
              <span className="prize-currency">R$</span>150
            </div>
            <div className="flyer-prize-sub">EM COMPRAS NO MERCADO</div>

            <div className="flyer-divider">✦ ✦ ✦</div>

            <div className="flyer-rule">
              <div className="rule-tag">COMO PARTICIPAR</div>
              <div className="rule-steps">
                <div className="step">
                  <div className="step-num">①</div>
                  <div className="step-text">Faça compras a partir de <strong>R$100</strong></div>
                </div>
                <div className="step">
                  <div className="step-num">②</div>
                  <div className="step-text">Peça seu <strong>CUPOM</strong> no caixa</div>
                </div>
                <div className="step">
                  <div className="step-num">③</div>
                  <div className="step-text">Preencha e deposite na <strong>URNA</strong></div>
                </div>
                <div className="step">
                  <div className="step-num">④</div>
                  <div className="step-text">Sorteio: <strong>{SORTEIO_DATE}</strong></div>
                </div>
              </div>
            </div>

            <div className="flyer-info-row">
              <div className="flyer-qr-block">
                <QRCodeSVG value={WA_LINK} size={90} fgColor="#111827" bgColor="#fff" level="M" />
                <div className="qr-label">Escaneie e receba<br/>as promoções!</div>
              </div>
              <div className="flyer-extra">
                <div className="extra-item">📅 {SORTEIO_DATE}</div>
                <div className="extra-item">🎫 1 cupom a cada R$100</div>
                <div className="extra-item">♾️ Sem limite de cupons</div>
                <div className="extra-item">📞 (15) 99660-4075</div>
                <div className="extra-god">🙏 Deus é bom o tempo todo</div>
              </div>
            </div>
          </div>

        </div>

        {/* ── CUT LINE ─────────────────────────────────────── */}
        <div className="cut-line">
          <span className="cut-icon">✂</span>
          <div className="cut-dash" />
          <span className="cut-icon">✂</span>
        </div>

        {/* ── BOTTOM: 3 coupons ────────────────────────────── */}
        <div className="coupons-row">
          {COUPONS.map((c) => (
            <div key={c.n} className="coupon">
              {/* left accent */}
              <div className="coupon-accent">
                <div className="coupon-logo">CORTA<br/>PREÇO$</div>
                <div className="coupon-prize-tag">R$150</div>
              </div>
              {/* main area */}
              <div className="coupon-body">
                <div className="coupon-title">CUPOM PREMIADO</div>
                <div className="coupon-field">
                  <label>Nome completo:</label>
                  <div className="field-line" />
                </div>
                <div className="coupon-field">
                  <label>Telefone:</label>
                  <div className="field-line" />
                </div>
                <div className="coupon-field-row">
                  <div>
                    <label>Data da compra:</label>
                    <div className="field-line short" />
                  </div>
                  <div>
                    <label>Valor (R$):</label>
                    <div className="field-line short" />
                  </div>
                </div>
              </div>
              {/* right seal */}
              <div className="coupon-seal">
                <div className="seal-circle">
                  <div className="seal-inner">
                    <div className="seal-line1">Concorra</div>
                    <div className="seal-line2">R$150</div>
                    <div className="seal-line3">em compras</div>
                  </div>
                </div>
                <div className="coupon-valid">{VALIDADE}</div>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* ── All styles inline so print works correctly ──────── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; padding: 0; }
          .flyer-page { box-shadow: none !important; margin: 0 !important; }
          @page { size: A4 portrait; margin: 8mm; }
        }

        body { background: #e5e7eb; margin: 0; padding: 20px; box-sizing: border-box; }

        .flyer-page {
          width: 210mm;
          min-height: 297mm;
          margin: 0 auto;
          background: white;
          box-shadow: 0 8px 40px rgba(0,0,0,.25);
          display: flex;
          flex-direction: column;
          font-family: 'Arial', sans-serif;
        }

        /* ── Main flyer section ── */
        .flyer-main {
          flex: 1;
          background: #111827;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          padding-bottom: 8mm;
        }

        .confetti { position: absolute; top: 0; left: 0; right: 0; height: 50px; overflow: hidden; }
        .confetti-item { position: absolute; opacity: .6; }

        .flyer-header {
          background: #ea580c;
          padding: 6mm 8mm;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .flyer-logo {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #000;
          font-size: 22pt;
          font-weight: 900;
          letter-spacing: -0.5px;
        }
        .logo-icon { width: 28px; height: 28px; }
        .flyer-contact {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
          color: rgba(0,0,0,.7);
          font-size: 9pt;
          font-weight: 600;
        }

        .flyer-hero {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 8mm 10mm 4mm;
          gap: 5mm;
        }

        .flyer-badge {
          background: #fbbf24;
          color: #000;
          font-size: 10pt;
          font-weight: 900;
          letter-spacing: 1px;
          padding: 3mm 8mm;
          border-radius: 20px;
          text-transform: uppercase;
        }

        .flyer-prize-label {
          color: #9ca3af;
          font-size: 14pt;
          font-weight: 700;
          letter-spacing: 6px;
          text-transform: uppercase;
          margin-bottom: -8mm;
        }
        .flyer-prize-value {
          color: #ea580c;
          font-size: 80pt;
          font-weight: 900;
          line-height: 1;
          letter-spacing: -3px;
          text-shadow: 0 4px 20px rgba(234,88,12,.5);
          display: flex;
          align-items: flex-start;
        }
        .prize-currency {
          font-size: 30pt;
          margin-top: 16pt;
          margin-right: 2px;
        }
        .flyer-prize-sub {
          color: white;
          font-size: 14pt;
          font-weight: 700;
          letter-spacing: 3px;
          text-transform: uppercase;
          margin-top: -4mm;
        }

        .flyer-divider { color: #ea580c; font-size: 14pt; letter-spacing: 8px; }

        .flyer-rule {
          background: rgba(255,255,255,.05);
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 12px;
          padding: 5mm 8mm;
          width: 100%;
          max-width: 160mm;
        }
        .rule-tag {
          color: #ea580c;
          font-size: 8pt;
          font-weight: 900;
          letter-spacing: 3px;
          text-align: center;
          margin-bottom: 4mm;
          text-transform: uppercase;
        }
        .rule-steps { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm 6mm; }
        .step { display: flex; align-items: center; gap: 3mm; }
        .step-num {
          width: 22px; height: 22px;
          background: #ea580c;
          color: #000;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 10pt; font-weight: 900;
          flex-shrink: 0;
        }
        .step-text { color: #d1d5db; font-size: 9pt; }
        .step-text strong { color: #f9fafb; }

        .flyer-info-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          width: 100%;
          max-width: 160mm;
          gap: 6mm;
          margin-top: 2mm;
        }
        .flyer-qr-block { display: flex; flex-direction: column; align-items: center; gap: 2mm; }
        .flyer-qr-block svg { background: white; padding: 4px; border-radius: 8px; }
        .qr-label { color: #9ca3af; font-size: 7.5pt; text-align: center; line-height: 1.3; }

        .flyer-extra { display: flex; flex-direction: column; gap: 2.5mm; flex: 1; }
        .extra-item { color: #d1d5db; font-size: 9pt; display: flex; align-items: center; gap: 2mm; }
        .extra-god { color: #ea580c; font-size: 9pt; font-weight: 900; margin-top: 2mm; }

        /* ── Cut line ── */
        .cut-line {
          display: flex;
          align-items: center;
          padding: 3mm 4mm;
          background: white;
          gap: 2mm;
        }
        .cut-icon { font-size: 14pt; color: #6b7280; }
        .cut-dash {
          flex: 1;
          border-top: 2px dashed #9ca3af;
        }

        /* ── Coupons ── */
        .coupons-row {
          display: flex;
          flex-direction: column;
          gap: 0;
          background: white;
        }

        .coupon {
          display: flex;
          height: 28mm;
          border: 1.5px solid #e5e7eb;
          border-left: none; border-right: none;
          border-top: none;
        }
        .coupon:last-child { border-bottom: none; }

        .coupon-accent {
          width: 24mm;
          background: #ea580c;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2mm;
          flex-shrink: 0;
        }
        .coupon-logo {
          color: #000;
          font-size: 7pt;
          font-weight: 900;
          text-align: center;
          line-height: 1.2;
          letter-spacing: -0.3px;
        }
        .coupon-prize-tag {
          background: #000;
          color: #ea580c;
          font-size: 9pt;
          font-weight: 900;
          padding: 1mm 2mm;
          border-radius: 4px;
        }

        .coupon-body {
          flex: 1;
          padding: 3mm 4mm;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .coupon-title {
          font-size: 10pt;
          font-weight: 900;
          color: #111827;
          letter-spacing: 0.5px;
        }
        .coupon-field { display: flex; flex-direction: column; gap: 0.5mm; }
        .coupon-field label { font-size: 6.5pt; color: #9ca3af; font-weight: 600; text-transform: uppercase; }
        .field-line { border-bottom: 1px solid #d1d5db; width: 100%; height: 3.5mm; }
        .field-line.short { width: 28mm; }
        .coupon-field-row { display: flex; gap: 4mm; }

        .coupon-seal {
          width: 28mm;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1.5mm;
          flex-shrink: 0;
          padding: 2mm;
        }
        .seal-circle {
          width: 20mm; height: 20mm;
          border: 2.5px solid #ea580c;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .seal-inner { text-align: center; line-height: 1.2; }
        .seal-line1 { font-size: 6pt; color: #6b7280; font-weight: 600; text-transform: uppercase; }
        .seal-line2 { font-size: 11pt; font-weight: 900; color: #ea580c; }
        .seal-line3 { font-size: 5.5pt; color: #6b7280; font-weight: 600; text-transform: uppercase; }
        .coupon-valid { font-size: 5.5pt; color: #9ca3af; text-align: center; }
      `}</style>
    </>
  )
}
