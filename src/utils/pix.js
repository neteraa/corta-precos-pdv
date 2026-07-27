/**
 * PIX EMV QR Code payload generator (BACEN spec v2.1)
 * Supports chave PIX: CPF, CNPJ, e-mail, phone (+55...) or random key (UUID)
 */

function crc16(str) {
  let crc = 0xFFFF
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++)
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1)
  }
  return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0')
}

function tlv(id, value) {
  return id + String(value.length).padStart(2, '0') + value
}

/**
 * Build a PIX payload string ready to be encoded as QR code.
 *
 * @param {object} opts
 * @param {string} opts.key          PIX key (phone, CPF, CNPJ, e-mail, UUID)
 * @param {number} opts.amount       Transaction amount in BRL (e.g. 19.90)
 * @param {string} [opts.name]       Merchant name (max 25 chars)
 * @param {string} [opts.city]       Merchant city (max 15 chars)
 * @param {string} [opts.txid]       Transaction ID, alphanumeric, max 25 chars
 * @param {string} [opts.description] Optional description shown to payer
 */
export function buildPixPayload({ key, amount, name = 'CORTA PRECOS', city = 'SAO PAULO', txid = '***', description = '' }) {
  const pixKey    = key.trim()
  const merchant  = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').slice(0, 25).toUpperCase()
  const cityClean = city.normalize('NFD').replace(/[\u0300-\u036f]/g, '').slice(0, 15).toUpperCase()
  const safeId    = txid.replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***'

  // Merchant Account Information (tag 26)
  const gui  = tlv('00', 'br.gov.bcb.pix')
  const keyTlv = tlv('01', pixKey)
  const descTlv = description ? tlv('02', description.slice(0, 72)) : ''
  const mai  = tlv('26', gui + keyTlv + descTlv)

  // Additional Data (tag 62): reference label
  const addl = tlv('62', tlv('05', safeId))

  const amountStr = amount > 0 ? String(Number(amount).toFixed(2)) : ''

  let payload = ''
  payload += tlv('00', '01')                  // Payload Format Indicator
  payload += mai                               // Merchant Account Info
  payload += tlv('52', '0000')                // MCC
  payload += tlv('53', '986')                 // Currency BRL
  if (amountStr) payload += tlv('54', amountStr) // Amount
  payload += tlv('58', 'BR')                  // Country
  payload += tlv('59', merchant)              // Merchant Name
  payload += tlv('60', cityClean)             // Merchant City
  payload += addl                              // Additional Data

  payload += '6304'                            // CRC tag + length placeholder
  payload += crc16(payload)                    // CRC value

  return payload
}
