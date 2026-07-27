/**
 * ESC/POS receipt builder for 58 mm thermal printers (Knup KP-1020/1021 etc.)
 * Paper width: 58 mm = 32 chars at normal font
 */

const ESC = 0x1b
const GS  = 0x1d
const LF  = 0x0a

// Common ESC/POS byte sequences
const CMD = {
  INIT:           [ESC, 0x40],
  LF:             [LF],
  ALIGN_LEFT:     [ESC, 0x61, 0x00],
  ALIGN_CENTER:   [ESC, 0x61, 0x01],
  BOLD_ON:        [ESC, 0x45, 0x01],
  BOLD_OFF:       [ESC, 0x45, 0x00],
  SIZE_NORMAL:    [GS,  0x21, 0x00],
  SIZE_2H:        [GS,  0x21, 0x01],   // double height
  SIZE_2W2H:      [GS,  0x21, 0x11],   // double width + height
  FEED:           (n) => [ESC, 0x64, n],
  CUT_FULL:       [GS,  0x56, 0x00],
  CUT_PARTIAL:    [GS,  0x56, 0x01],
}

const COLS = 32

// Strip Portuguese accents so CP850 printers don't garble them
function norm(str = '') {
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x00-\x7F]/g, '?')
}

// Pad / truncate to fixed width
function fixed(str, len, align = 'left') {
  const s = norm(str).slice(0, len)
  return align === 'right' ? s.padStart(len) : s.padEnd(len)
}

// Two-column row: left text + right text aligned to COLS
function row(left, right) {
  const r = norm(right)
  const l = norm(left).slice(0, COLS - r.length - 1)
  return l + ' '.repeat(Math.max(1, COLS - l.length - r.length)) + r + '\n'
}

function divider(ch = '-') { return ch.repeat(COLS) + '\n' }
function center(text)       { return norm(text).padStart(Math.floor((COLS + norm(text).length) / 2)).padEnd(COLS) + '\n' }
function line(text = '')    { return norm(text) + '\n' }

const BRL  = (n) => 'R$' + Number(n).toFixed(2)
const DASHES = '='.repeat(COLS)    // bold divider for coupons

/**
 * Build the full receipt as a Uint8Array ready to write to the serial port.
 * @param {Object} sale      - sale object from store
 * @param {Object} settings  - { storeName, phone, address, instagram }
 */
export function buildReceipt(sale, settings = {}) {
  const parts = []    // array of byte arrays + strings

  const push = (...items) => items.forEach(x => parts.push(x))
  const enc  = new TextEncoder()   // UTF-8, but we've stripped non-ASCII above

  // ── Header ────────────────────────────────────────────────
  push(CMD.INIT)
  push(CMD.ALIGN_CENTER, CMD.BOLD_ON, CMD.SIZE_2W2H)
  push(line(settings.storeName || 'CORTA PRECOS'))
  push(CMD.SIZE_NORMAL, CMD.BOLD_OFF)
  if (settings.phone)     push(line(settings.phone))
  if (settings.address)   push(line(settings.address))
  if (settings.instagram) push(line('@' + settings.instagram.replace(/^@/, '')))
  push(CMD.ALIGN_LEFT)
  push(divider())

  // ── Date / time ────────────────────────────────────────────
  const now = new Date(sale.date || Date.now())
  const dateStr = now.toLocaleDateString('pt-BR') + '  ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  push(row('Pedido: ' + (sale.id || ''), dateStr))
  push(divider())

  // ── Items ──────────────────────────────────────────────────
  sale.items.forEach(item => {
    const nameLines = []
    const n = norm(item.name || '')
    for (let i = 0; i < n.length; i += COLS) nameLines.push(n.slice(i, i + COLS))
    nameLines.forEach((nl, idx) => push(line(nl)))
    push(row('  ' + item.qty + 'x ' + BRL(item.price), BRL(item.qty * item.price)))
  })

  push(divider())

  // ── Promo discounts ────────────────────────────────────────
  const activePromos = (sale.promos || []).filter(p => p.saving > 0)
  if (activePromos.length > 0) {
    push(CMD.BOLD_ON)
    activePromos.forEach(p => {
      push(row('PROMO: ' + norm(p.name).slice(0, 18), '-' + BRL(p.saving)))
    })
    push(CMD.BOLD_OFF)
    push(divider('-'))
  }

  // ── Totals ─────────────────────────────────────────────────
  const subtotal = sale.items.reduce((s, i) => s + i.qty * i.price, 0)
  push(row('Subtotal', BRL(subtotal)))
  if ((sale.promoDiscount || 0) > 0)
    push(row('Desconto promo', '-' + BRL(sale.promoDiscount)))
  if ((sale.discount || 0) > 0)
    push(row('Desconto extra', '-' + BRL(sale.discount)))

  push(CMD.BOLD_ON, CMD.SIZE_2H)
  push(row('TOTAL', BRL(sale.total)))
  push(CMD.SIZE_NORMAL, CMD.BOLD_OFF)

  push(row('Pagamento', norm(sale.payment || '')))
  push(divider())

  // ── Footer ─────────────────────────────────────────────────
  push(CMD.ALIGN_CENTER)
  push(line('Obrigado pela preferencia!'))
  push(CMD.BOLD_ON)
  push(line('DEUS E BOM O TEMPO TODO'))
  push(CMD.BOLD_OFF)
  push(CMD.FEED(4))
  push(CMD.CUT_PARTIAL)

  // ── Flatten to Uint8Array ──────────────────────────────────
  const byteArrays = parts.map(p =>
    Array.isArray(p) ? new Uint8Array(p) : enc.encode(p)
  )
  const total = byteArrays.reduce((s, a) => s + a.length, 0)
  const out   = new Uint8Array(total)
  let offset  = 0
  byteArrays.forEach(a => { out.set(a, offset); offset += a.length })
  return out
}

/**
 * Build a promotional raffle coupon for sales >= R$100.
 * Prints immediately after the receipt; customer fills name/phone and drops
 * the coupon in the raffle box.
 *
 * @param {Object} sale      - same sale object used in buildReceipt
 * @param {Object} settings  - { storeName, phone, instagram }
 * @returns {Uint8Array}
 */
export function buildPromoCoupon(sale, settings = {}) {
  const parts = []
  const push  = (...items) => items.forEach(x => parts.push(x))
  const enc   = new TextEncoder()

  // Generate a short coupon number from the timestamp
  const now = new Date(sale.date || Date.now())
  const couponNum = String(now.getTime()).slice(-8)    // e.g. 47382910
  const dateStr   = now.toLocaleDateString('pt-BR')

  push(CMD.INIT)

  // ── Decorative top border ──────────────────────────────────
  push(CMD.ALIGN_CENTER)
  push(DASHES + '\n')
  push(line())

  // Big bold title
  push(CMD.BOLD_ON, CMD.SIZE_2W2H)
  push(line('CUPOM'))
  push(line('PREMIADO'))
  push(CMD.SIZE_NORMAL, CMD.BOLD_OFF)
  push(line())

  // Trophy decoration
  push(CMD.SIZE_2H)
  push(line('*** SORTEIO MENSAL ***'))
  push(CMD.SIZE_NORMAL)
  push(line())

  // Store name
  push(CMD.BOLD_ON)
  push(line(settings.storeName || 'CORTA PRECOS'))
  push(CMD.BOLD_OFF)
  push(DASHES + '\n')

  // ── Prize highlight ────────────────────────────────────────
  push(line())
  push(line('CONCORRA A'))
  push(CMD.BOLD_ON, CMD.SIZE_2W2H)
  push(line('R$ 150'))
  push(CMD.SIZE_NORMAL, CMD.BOLD_OFF)
  push(line('EM COMPRAS NO MERCADO'))
  push(line())
  push(DASHES + '\n')

  // ── Sale info ──────────────────────────────────────────────
  push(CMD.ALIGN_LEFT)
  push(CMD.BOLD_ON)
  push(row('Cupom nr:', '#' + couponNum))
  push(row('Data:', dateStr))
  push(row('Compra:', BRL(sale.total)))
  push(CMD.BOLD_OFF)
  push(divider())

  // ── Fill-in fields ─────────────────────────────────────────
  push(line())
  push(CMD.BOLD_ON)
  push(line('Preencha e deposite na urna:'))
  push(CMD.BOLD_OFF)
  push(line())
  push(line('Nome: ' + '_'.repeat(COLS - 6)))
  push(line())
  push(line('Fone: ' + '_'.repeat(COLS - 6)))
  push(line())
  push(line('Ass.:' + '_'.repeat(COLS - 5)))
  push(line())
  push(divider())

  // ── Footer ─────────────────────────────────────────────────
  push(CMD.ALIGN_CENTER)
  push(line('Sorteio: ult. sabado do mes'))
  if (settings.phone)     push(line(settings.phone))
  if (settings.instagram) push(line('@' + settings.instagram.replace(/^@/, '')))
  push(line())
  push(CMD.BOLD_ON)
  push(line('DEUS E BOM O TEMPO TODO'))
  push(CMD.BOLD_OFF)
  push(DASHES + '\n')
  push(CMD.FEED(4))
  push(CMD.CUT_FULL)    // full cut — separate from receipt

  // ── Flatten ────────────────────────────────────────────────
  const byteArrays = parts.map(p =>
    Array.isArray(p) ? new Uint8Array(p) : enc.encode(p)
  )
  const size = byteArrays.reduce((s, a) => s + a.length, 0)
  const out  = new Uint8Array(size)
  let offset = 0
  byteArrays.forEach(a => { out.set(a, offset); offset += a.length })
  return out
}
