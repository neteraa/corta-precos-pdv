/**
 * Parser for Gdoor product export CSV.
 * Format: pipe-delimited (|), Mac Roman encoding, Windows-style line endings.
 *
 * Expected columns (order may vary — resolved by header row):
 *   Código | Cód. Barras | Descrição | Grupo / Família |
 *   Preço Custo | Custo Médio | Preço Venda | Qtd Saldo | Unidade
 */

/** Decode Mac Roman (Windows-1252 superset) ArrayBuffer → string */
function decodeMacRoman(buffer) {
  try {
    return new TextDecoder('windows-1252').decode(buffer)
  } catch {
    return new TextDecoder('utf-8', { fatal: false }).decode(buffer)
  }
}

/** Parse "1.875,50" or "1875.50" → number */
function parseBR(str) {
  if (!str || str.trim() === '') return 0
  const s = str.trim()
  // Brazilian format: dots as thousand separators, comma as decimal
  if (s.includes(',')) return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0
  return parseFloat(s) || 0
}

function headerIndex(headers, ...candidates) {
  for (const c of candidates) {
    const i = headers.findIndex(h => h.toLowerCase().includes(c.toLowerCase()))
    if (i !== -1) return i
  }
  return -1
}

export function parseGdoorCsv(buffer) {
  const text = decodeMacRoman(buffer)
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []

  // find header row (first row containing 'descri' or 'código')
  let headerLineIdx = lines.findIndex(l =>
    l.toLowerCase().includes('descri') || l.toLowerCase().includes('digo')
  )
  if (headerLineIdx === -1) headerLineIdx = 0

  const sep = lines[headerLineIdx].includes('|') ? '|' : ';'
  const headers = lines[headerLineIdx].split(sep).map(h => h.trim())

  const iCodigo  = headerIndex(headers, 'código', 'codigo', 'cod.')
  const iBarras  = headerIndex(headers, 'barras', 'ean', 'gtin')
  const iDesc    = headerIndex(headers, 'descri', 'nome', 'produto')
  const iGrupo   = headerIndex(headers, 'grupo', 'família', 'familia', 'categ')
  const iCusto   = headerIndex(headers, 'preço custo', 'preco custo', 'custo médio', 'custo medio', 'custo')
  const iVenda   = headerIndex(headers, 'preço venda', 'preco venda', 'preço de venda', 'venda')
  const iSaldo   = headerIndex(headers, 'saldo', 'estoque', 'qtd')
  const iUnidade = headerIndex(headers, 'unidade', 'un.')

  const products = []

  for (let i = headerLineIdx + 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map(c => c.trim())
    if (cols.length < 3) continue

    const get = (idx) => (idx !== -1 && cols[idx] != null ? cols[idx] : '')

    const rawBarcode = get(iBarras)
    const rawCodigo  = get(iCodigo)
    // SKU = barcode preferred; fallback to internal code; last resort = line number
    const sku     = rawBarcode || rawCodigo || `SKU${i}`
    const barcode = rawBarcode || ''   // always keep barcode in its own field
    const name    = get(iDesc)
    if (!name) continue

    const cost  = parseBR(get(iCusto))
    const price = parseBR(get(iVenda))
    const stock = Math.round(parseBR(get(iSaldo)))
    const category = get(iGrupo) || 'Outros'
    const unit     = get(iUnidade) || 'UN'

    products.push({ sku, barcode, name, category, cost, price: price || cost * 1.3, stock: isNaN(stock) ? 0 : stock, unit })
  }

  return products
}
