import { useState, useCallback, useRef, useEffect } from 'react'
import { buildReceipt, buildPromoCoupon } from '../utils/escpos.js'

// Promo raffle coupon is only printed for sales >= R$100
const PROMO_THRESHOLD = 100

/**
 * Hook for Web Serial API (Chrome/Edge ≥ 89) thermal receipt printing.
 * Falls back to window.print() for unsupported browsers.
 * Baud rate: 9600 — works for Knup KP-1020/1021 via USB-CDC.
 */

const BAUD = 9600
const STORAGE_KEY = 'cp_printer_settings'

function loadSettings() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {} } catch { return {} }
}
export function savePrinterSettings(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch {}
}

export function usePrinter() {
  const portRef   = useRef(null)

  const [status, setStatus]     = useState('disconnected') // 'disconnected'|'connecting'|'connected'|'printing'|'error'
  const [settings, setSettings] = useState(loadSettings)

  useEffect(() => { savePrinterSettings(settings) }, [settings])

  const isSupported = typeof navigator !== 'undefined' && 'serial' in navigator

  // ── Auto-reconnect to previously granted port on mount ───────
  useEffect(() => {
    if (!isSupported) return
    let cancelled = false
    ;(async () => {
      try {
        const ports = await navigator.serial.getPorts()
        if (ports.length === 0 || cancelled) return
        const port = ports[0]
        await port.open({ baudRate: BAUD })
        if (cancelled) { try { await port.close() } catch {} return }
        portRef.current = port
        setStatus('connected')
      } catch {
        // port busy or unavailable — silently stay disconnected
      }
    })()
    return () => { cancelled = true }
  }, [isSupported]) // eslint-disable-line

  const connect = useCallback(async () => {
    if (!isSupported) { setStatus('error'); return false }
    setStatus('connecting')
    try {
      const port = await navigator.serial.requestPort()
      await port.open({ baudRate: BAUD })
      portRef.current = port
      setStatus('connected')
      return true
    } catch (err) {
      // User cancelled the picker → back to disconnected, not error
      setStatus(err.name === 'NotFoundError' ? 'disconnected' : 'error')
      return false
    }
  }, [isSupported])

  const disconnect = useCallback(async () => {
    try {
      if (portRef.current) { await portRef.current.close(); portRef.current = null }
    } catch {}
    setStatus('disconnected')
  }, [])

  const _sendBytes = useCallback(async (bytes) => {
    if (!portRef.current) return false
    setStatus('printing')
    try {
      const writer = portRef.current.writable.getWriter()
      await writer.write(bytes)
      writer.releaseLock()
      setStatus('connected')
      return true
    } catch (err) {
      console.error('[Printer] write error:', err)
      portRef.current = null
      setStatus('error')
      return false
    }
  }, [])

  /**
   * Print a receipt. Uses ESC/POS via Web Serial if connected,
   * otherwise a single silent iframe (receipt + coupon combined = ONE print dialog).
   */
  const printReceipt = useCallback(async (sale) => {
    const needsCoupon = (sale.total || 0) >= PROMO_THRESHOLD

    if (isSupported && portRef.current) {
      const ok = await _sendBytes(buildReceipt(sale, settings))
      if (ok && needsCoupon) {
        // Minimal pause for physical paper-cut mechanism
        await new Promise(r => setTimeout(r, 350))
        await _sendBytes(buildPromoCoupon(sale, settings))
      }
      return ok
    }

    // HTML fallback — combine into ONE iframe → ONE print dialog, no waiting
    _printCombinedHTML(sale, settings, needsCoupon)
    return true
  }, [_sendBytes, isSupported, settings])

  /**
   * Print ONLY the promo coupon (called when USB not connected and total >= R$100).
   */
  const printCoupon = useCallback((sale) => {
    _printCombinedHTML(sale, settings, true, /* receiptOnly= */ false)
  }, [settings])

  return {
    isSupported,
    status,
    isConnected: status === 'connected' || status === 'printing',
    connect,
    disconnect,
    printReceipt,
    printCoupon,
    settings,
    setSettings,
  }
}

/* ─────────────────────────────────────────────────────────────
   Silent iframe print — single dialog, no popup.
   Injects a hidden iframe, writes the HTML, calls print(), removes itself.
───────────────────────────────────────────────────────────── */
function _printViaIframe(html) {
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;border:none;'
  document.body.appendChild(iframe)
  const cleanup = () => { try { document.body.removeChild(iframe) } catch {} }

  iframe.onload = () => {
    try {
      iframe.contentWindow.focus()
      iframe.contentWindow.print()
    } catch (e) {
      const w = window.open('', '_blank', 'width=340,height=700')
      if (w) { w.document.write(html); w.document.close(); w.print(); w.close() }
    }
    iframe.contentWindow?.addEventListener('afterprint', cleanup)
    setTimeout(cleanup, 30_000)
  }

  const doc = iframe.contentDocument || iframe.contentWindow.document
  doc.open('text/html', 'replace')
  doc.write(html)
  doc.close()
}

/* ─────────────────────────────────────────────────────────────
   Combined HTML: receipt + optional coupon in ONE document
   → single print dialog, fastest possible for HTML path.
   withReceipt=true  → include receipt section
   withCoupon=true   → include promo coupon section (page break between)
───────────────────────────────────────────────────────────── */
function _printCombinedHTML(sale, settings, withCoupon = false, withReceipt = true) {
  const BRL   = (n) => 'R$\u00a0' + Number(n).toFixed(2).replace('.', ',')
  const store = settings.storeName || 'CORTA PRECOS'
  const phone = settings.phone     || '(15) 99660-4075'
  const insta = settings.instagram ? '@' + settings.instagram.replace(/^@/, '') : '@mercadocortaprecos'
  const date  = new Date(sale.date || Date.now())
  const dateStr = date.toLocaleDateString('pt-BR')
  const timeStr = date.toLocaleTimeString('pt-BR')
  const num     = String(date.getTime()).slice(-8)

  /* ── receipt block ──────────────────────────────────────── */
  const itemRows = (sale.items || []).map(i =>
    `<tr>
       <td class="name">${i.name}</td>
       <td class="r">${i.qty}×${BRL(i.price)}</td>
       <td class="r">${BRL(i.qty * i.price)}</td>
     </tr>`
  ).join('')

  const promoRows = (sale.promos || []).filter(p => p.saving > 0).map(p =>
    `<tr class="promo"><td colspan="2">&#127991; ${p.name}</td><td class="r">-${BRL(p.saving)}</td></tr>`
  ).join('')

  const receiptHTML = withReceipt ? `
<section class="receipt">
  <h1>${store}</h1>
  <div class="sub">${phone} ${insta !== '@' ? '· ' + insta : ''}</div>
  <hr><div class="sub">${dateStr} ${timeStr}</div><hr>
  <table>
    ${itemRows}
    ${promoRows ? `<tr><td colspan="3"><hr></td></tr>${promoRows}` : ''}
    <tr><td colspan="3"><hr></td></tr>
    ${sale.promoDiscount > 0 ? `<tr><td colspan="2">Desc. promo</td><td class="r">-${BRL(sale.promoDiscount)}</td></tr>` : ''}
    ${sale.discount > 0      ? `<tr><td colspan="2">Desc. extra</td><td class="r">-${BRL(sale.discount)}</td></tr>` : ''}
    <tr class="total"><td colspan="2">TOTAL</td><td class="r">${BRL(sale.total)}</td></tr>
    <tr><td colspan="2">Pagamento</td><td class="r">${sale.payment || ''}</td></tr>
  </table>
  <hr>
  <div class="footer">Obrigado pela preferencia!</div>
  <div class="godmsg">DEUS E BOM O TEMPO TODO</div>
</section>` : ''

  /* ── coupon block ───────────────────────────────────────── */
  const couponHTML = withCoupon ? `
<section class="coupon">
  <div class="dbl"></div>
  <div class="ctitle">CUPOM<br>PREMIADO</div>
  <div class="trophies">&#127942;&#127942;&#127942;</div>
  <div class="csub">SORTEIO MENSAL</div>
  <div class="cstore">${store}</div>
  <div class="sgl"></div>
  <div class="clabel">CONCORRA A</div>
  <div class="prize-val">R$ 150</div>
  <div class="prize-sub">EM COMPRAS NO MERCADO!</div>
  <div class="sgl"></div>
  <div class="info">
    <div class="row"><span>Cupom:</span><span>#${num}</span></div>
    <div class="row"><span>Data:</span><span>${dateStr}</span></div>
    <div class="row"><span>Compra:</span><span>${BRL(sale.total)}</span></div>
  </div>
  <div class="sgl"></div>
  <div class="fields">
    <p>&#9997; Preencha e deposite na urna:</p>
    <p>Nome:</p><div class="line"></div>
    <p>Fone:</p><div class="line"></div>
    <p>Assinatura:</p><div class="line"></div>
  </div>
  <div class="sgl"></div>
  <div class="ft">Sorteio: ultimo sabado do mes</div>
  <div class="ft">${phone} &middot; ${insta}</div>
  <div class="god">DEUS E BOM O TEMPO TODO</div>
  <div class="dbl"></div>
</section>` : ''

  _printViaIframe(`<!doctype html><html><head><meta charset="utf-8"><title>Impressao</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Courier New',monospace;font-size:11px;width:58mm}
  /* receipt */
  .receipt{padding:3mm;page-break-after:${withCoupon ? 'always' : 'auto'}}
  h1{font-size:14px;text-align:center;font-weight:900;letter-spacing:1px}
  .sub{font-size:9px;text-align:center;color:#444;margin-bottom:2px}
  hr{border:none;border-top:1px dashed #555;margin:4px 0}
  table{width:100%;border-collapse:collapse}
  td{padding:1px 0;vertical-align:top}
  td.name{font-size:10px;max-width:26mm;word-break:break-word}
  td.r{text-align:right;white-space:nowrap;font-size:10px}
  .promo td{color:#1a7a1a;font-size:9px}
  .total td{font-weight:900;font-size:13px;padding-top:3px}
  .footer,.godmsg{text-align:center;font-size:9px;margin-top:5px}
  .godmsg{font-weight:900;font-size:10px}
  /* coupon */
  .coupon{padding:3mm;text-align:center}
  .dbl{border-top:3px double #000;margin:4px 0}
  .sgl{border-top:1.5px solid #000;margin:4px 0}
  .ctitle{font-size:20px;font-weight:900;letter-spacing:1px;line-height:1.15}
  .trophies{font-size:16px;margin:3px 0}
  .csub{font-size:9px;letter-spacing:2px;margin-bottom:3px}
  .cstore{font-weight:700;font-size:11px}
  .clabel{font-size:9px;letter-spacing:3px}
  .prize-val{font-size:26px;font-weight:900;line-height:1}
  .prize-sub{font-size:9px;margin-bottom:3px}
  .info{text-align:left;margin:3px 0}
  .row{display:flex;justify-content:space-between;font-size:10px;font-weight:700}
  .fields{text-align:left;margin:4px 0}
  .fields p{font-size:9px;font-weight:700;margin-bottom:1px}
  .line{border-bottom:1px solid #000;height:14px;margin-bottom:6px}
  .ft{font-size:9px;color:#333;margin:2px 0}
  .god{font-weight:900;font-size:10px;margin-top:3px}
  @media print{@page{margin:0;size:58mm auto}}
</style></head><body>
${receiptHTML}
${couponHTML}
</body></html>`)
}
