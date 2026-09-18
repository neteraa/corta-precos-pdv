/**
 * wa-groups — Busca grupos do WhatsApp via Evolution API
 *
 * GET /api/wa-groups?instance=INSTANCE_NAME
 */

export default async (req) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }

  const url = process.env.EVOLUTION_API_URL?.replace(/\/$/, '')
  const key = process.env.EVOLUTION_API_KEY

  if (!url || !key)
    return new Response(JSON.stringify({ ok: false, error: 'Evolution API não configurada' }), { status: 503, headers })

  const instance = new URL(req.url).searchParams.get('instance')
  if (!instance)
    return new Response(JSON.stringify({ ok: false, error: 'instance obrigatório' }), { status: 400, headers })

  try {
    const res = await fetch(`${url}/group/fetchAllGroups/${instance}?getParticipants=false`, {
      headers: { apikey: key },
    })
    if (!res.ok)
      return new Response(JSON.stringify({ ok: false, error: `Evolution: ${res.status}` }), { status: 502, headers })

    const data = await res.json()
    // Evolution API returns array of groups
    const groups = (Array.isArray(data) ? data : []).map(g => ({
      jid:     g.id,
      name:    g.subject || g.id,
      size:    g.size ?? g.participants?.length ?? 0,
    })).sort((a, b) => a.name.localeCompare(b.name))

    return new Response(JSON.stringify({ ok: true, groups }), { headers })
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers })
  }
}

export const config = { path: '/api/wa-groups' }
