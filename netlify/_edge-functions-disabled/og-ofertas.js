/**
 * Netlify Edge Function — OG tags dinâmicos para /ofertas
 *
 * Quando WhatsApp (ou qualquer crawler) faz GET /ofertas?s=mega,
 * esta função injeta og:title e og:description específicos do fornecedor
 * antes de servir o HTML, sem afetar o cliente React em si.
 *
 * Adicionar novos fornecedores: só adicionar entrada em SUPPLIERS.
 */

const SUPPLIERS = {
  mega: {
    name:        'Mega Tudo Barato',
    description: '🛒 Confira as ofertas exclusivas de hoje e faça seu pedido agora!',
    city:        'Cotia, SP',
  },
  // Quando adicionar novos tenants no TENANTS do Fornecedor.jsx,
  // adicionar aqui também:
  // outro: { name: 'Distribuidora XYZ', description: '...', city: '...' },
}

const DEFAULT = {
  name:        'ZatendeStock',
  description: 'Confira as ofertas exclusivas do seu fornecedor e faça seu pedido agora.',
}

export default async (request, context) => {
  const url      = new URL(request.url)
  const suppId   = url.searchParams.get('s') || ''
  const supplier = SUPPLIERS[suppId] || DEFAULT

  // Deixa bots (WhatsApp, Telegram, Twitter, Google) pegar o HTML modificado
  // Cliente real (browser) também funciona — React ignora as meta tags estáticas
  const response = await context.next()

  // Só modifica respostas HTML
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('text/html')) return response

  const html = await response.text()

  const title = suppId
    ? `Ofertas — ${supplier.name}`
    : 'ZatendeStock – Portal de Ofertas'

  const desc  = supplier.description
  const ogUrl = `https://zatendestock.netlify.app/ofertas${suppId ? `?s=${suppId}` : ''}`

  const modified = html
    .replace(
      /<meta property="og:title"[^>]*>/,
      `<meta property="og:title" content="${title}" />`
    )
    .replace(
      /<meta property="og:description"[^>]*>/,
      `<meta property="og:description" content="${desc}" />`
    )
    .replace(
      /<meta property="og:url"[^>]*>/,
      `<meta property="og:url" content="${ogUrl}" />`
    )
    // Título da aba/PWA
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)

  return new Response(modified, {
    status:  response.status,
    headers: response.headers,
  })
}

export const config = { path: '/ofertas' }
