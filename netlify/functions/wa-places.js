/**
 * wa-places — Busca automática de estabelecimentos via Google Places API
 *
 * POST /api/wa-places
 * Body: { query: "mercado", city: "Itapeva SP", radius?: 5000, pageToken? }
 * Returns: { ok, results: [{name, phone, address, rating, reviews}], nextPageToken? }
 *
 * Requer: GOOGLE_PLACES_API_KEY no Netlify env
 */

const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }

function authOk(req) {
  return (req.headers.get('x-master-key') || '') === (process.env.ZS_MASTER_KEY || 'zatende2026master')
}

// ── Google Places API (New) ──────────────────────────────────────────────────
async function searchGooglePlaces(query, city, pageToken) {
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) throw new Error('NO_KEY')

  const body = {
    textQuery:      `${query} em ${city}`,
    languageCode:   'pt-BR',
    regionCode:     'BR',
    maxResultCount: 20,
    ...(pageToken ? { pageToken } : {}),
  }

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method:  'POST',
    headers: {
      'Content-Type':    'application/json',
      'X-Goog-Api-Key':  key,
      'X-Goog-FieldMask': [
        'places.displayName',
        'places.formattedAddress',
        'places.nationalPhoneNumber',
        'places.internationalPhoneNumber',
        'places.rating',
        'places.userRatingCount',
        'places.id',
        'nextPageToken',
      ].join(','),
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `Google API ${res.status}`)
  }

  const data = await res.json()
  const results = (data.places || []).map(p => ({
    id:      p.id,
    name:    p.displayName?.text || '(sem nome)',
    phone:   p.nationalPhoneNumber || p.internationalPhoneNumber || null,
    address: p.formattedAddress || '',
    rating:  p.rating || null,
    reviews: p.userRatingCount || 0,
  })).filter(r => r.phone)  // só quem tem telefone

  return { results, nextPageToken: data.nextPageToken || null }
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS })
  if (!authOk(req)) return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: CORS })

  // GET /api/wa-places?check=1 → verifica se API key está configurada
  if (req.method === 'GET') {
    const hasKey = !!process.env.GOOGLE_PLACES_API_KEY
    return new Response(JSON.stringify({ configured: hasKey }), { headers: CORS })
  }

  if (req.method !== 'POST')
    return new Response(JSON.stringify({ error: 'POST apenas' }), { status: 405, headers: CORS })

  let body
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'JSON inválido' }), { status: 400, headers: CORS })
  }

  const { query = 'mercado', city = 'Itapeva SP', pageToken } = body
  if (!city.trim()) return new Response(JSON.stringify({ error: 'city obrigatório' }), { status: 400, headers: CORS })

  try {
    const data = await searchGooglePlaces(query.trim(), city.trim(), pageToken)
    return new Response(JSON.stringify({ ok: true, ...data }), { headers: CORS })
  } catch (e) {
    if (e.message === 'NO_KEY') {
      return new Response(JSON.stringify({ ok: false, error: 'NO_KEY', message: 'GOOGLE_PLACES_API_KEY não configurada' }), { status: 200, headers: CORS })
    }
    console.error('wa-places error:', e.message)
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500, headers: CORS })
  }
}

export const config = { path: '/api/wa-places' }
