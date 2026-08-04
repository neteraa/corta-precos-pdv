/**
 * Netlify Function — OG tags dinâmicos por fornecedor para /ofertas
 *
 * WhatsApp / Telegram / Google crawlers fazem GET /ofertas?s=TENANT_ID.
 * Esta função serve o HTML correto com og:title/og:image do fornecedor,
 * modificando o index.html do servidor em tempo real.
 *
 * Adicionar novos fornecedores: só adicionar entrada em SUPPLIERS.
 */

import https from 'https'

const BASE = 'https://zatendestock.netlify.app'

const SUPPLIERS = {
  mega: {
    name:        'Mega Tudo Barato',
    description: '🛒 Ofertas exclusivas de hoje — Cotia, SP. Peça direto pelo celular!',
    ogUrl:       `${BASE}/ofertas?s=mega`,
    ogImage:     `${BASE}/og-mega.png`,
  },
}

const DEFAULT = {
  name:        'ZatendeStock – Portal de Ofertas',
  description: 'Confira as ofertas exclusivas do seu fornecedor e faça seu pedido agora.',
  ogUrl:       `${BASE}/ofertas`,
  ogImage:     `${BASE}/og-image.png`,
}

/* Busca index.html do CDN (é o shell React, não tem conteúdo dinâmico) */
function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => resolve(data))
    }).on('error', reject)
  })
}

export const handler = async (event) => {
  const s        = (event.queryStringParameters || {}).s || ''
  const supplier = SUPPLIERS[s] || DEFAULT
  const title    = s && SUPPLIERS[s] ? `Ofertas — ${supplier.name}` : DEFAULT.name

  try {
    /* Usa o index.html como base — sempre existe, sem "pretty URL" conflict */
    const html = await fetchHtml(`${BASE}/index.html`)

    const modified = html
      .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
      .replace(
        /(<meta property="og:title"\s+content=")[^"]*(")/,
        `$1${title}$2`
      )
      .replace(
        /(<meta property="og:description"\s+content=")[^"]*(")/,
        `$1${supplier.description}$2`
      )
      .replace(
        /(<meta property="og:url"\s+content=")[^"]*(")/,
        `$1${supplier.ogUrl}$2`
      )
      .replace(
        /(<meta property="og:image"\s+content=")[^"]*(")/,
        `$1${supplier.ogImage}$2`
      )

    return {
      statusCode: 200,
      headers: {
        'Content-Type':  'text/html; charset=UTF-8',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
      body: modified,
    }
  } catch {
    return { statusCode: 302, headers: { Location: '/' }, body: '' }
  }
}
