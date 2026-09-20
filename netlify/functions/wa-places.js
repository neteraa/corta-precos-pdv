/**
 * wa-places — Busca automática de estabelecimentos via Google Places API (Legacy)
 *
 * POST /api/wa-places
 * Body: { query: "mercado", city: "Itapeva SP", pageToken? }
 * Returns: { ok, results: [{name, phone, address, rating, reviews}], nextPageToken? }
 *
 * Usa Places API Legacy (Text Search + Place Details) — compatível com chaves
 * restritas a "Places API" no Google Cloud Console.
 * Requer: GOOGLE_PLACES_API_KEY no Netlify env
 */

const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
const BASE  = 'https://maps.googleapis.com/maps/api/place'

function authOk(req) {
  return (req.headers.get('x-master-key') || '') === (process.env.ZS_MASTER_KEY || 'zatende2026master')
}

// ── Google Places API Legacy: Text Search + Place Details ────────────────────
async function searchGooglePlaces(query, city, pageToken) {
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) throw new Error('NO_KEY')

  // 1) Text Search — retorna lista de lugares (sem telefone)
  const searchUrl = new URL(`${BASE}/textsearch/json`)
  searchUrl.searchParams.set('query',    `${query} em ${city}`)
  searchUrl.searchParams.set('key',      key)
  searchUrl.searchParams.set('language', 'pt-BR')
  searchUrl.searchParams.set('region',   'br')
  if (pageToken) searchUrl.searchParams.set('pagetoken', pageToken)

  const searchRes = await fetch(searchUrl.toString())
  if (!searchRes.ok) throw new Error(`TextSearch HTTP ${searchRes.status}`)

  const searchData = await searchRes.json()
  if (searchData.status !== 'OK' && searchData.status !== 'ZERO_RESULTS') {
    throw new Error(searchData.error_message || searchData.status || 'SEARCH_ERROR')
  }

  const places = searchData.results || []

  // 2) Place Details em paralelo — busca telefone de cada lugar
  const withDetails = await Promise.all(
    places.map(async (place) => {
      try {
        const detailUrl = new URL(`${BASE}/details/json`)
        detailUrl.searchParams.set('place_id', place.place_id)
        detailUrl.searchParams.set('fields',   'formatted_phone_number,international_phone_number')
        detailUrl.searchParams.set('key',      key)
        detailUrl.searchParams.set('language', 'pt-BR')

        const detailRes  = await fetch(detailUrl.toString())
        const detailData = await detailRes.json()
        const r          = detailData.result || {}

        // Normaliza telefone: remove tudo que não for dígito, adiciona 55 se não tiver
        let phone = (r.formatted_phone_number || r.international_phone_number || '').replace(/\D/g, '')
        if (phone && !phone.startsWith('55')) phone = '55' + phone

        return {
          id:      place.place_id,
          name:    place.name || '(sem nome)',
          phone:   phone || null,
          address: place.formatted_address || '',
          rating:  place.rating  || null,
          reviews: place.user_ratings_total || 0,
        }
      } catch {
        return null
      }
    })
  )

  const results = withDetails
    .filter(Boolean)
    .filter(r => r.phone && r.phone.length >= 12) // só quem tem telefone válido

  return { results, nextPageToken: searchData.next_page_token || null }
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
