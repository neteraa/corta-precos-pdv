/**
 * wa-chat-history — API para buscar histórico de conversas WhatsApp
 *
 * GET /api/wa-chat-history?mk=MASTER_KEY              → lista todos os clientes com histórico
 * GET /api/wa-chat-history?mk=MASTER_KEY&phone=55...  → histórico de mensagens de um cliente
 */

import { getStore } from '@netlify/blobs'

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
}

function leadsStore() {
  return getStore({ name: 'wa-leads', consistency: 'strong' })
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS })

  const url = new URL(req.url)
  const mk    = url.searchParams.get('mk')
  const phone = url.searchParams.get('phone')

  // Apenas master key pode acessar
  if (mk !== process.env.ZS_MASTER_KEY) {
    return new Response(JSON.stringify({ ok: false, error: 'Não autorizado' }), { status: 401, headers: CORS })
  }

  const store = leadsStore()

  // ── GET histórico de um cliente específico ────────────────────────────────────
  if (phone) {
    const key = `chat_history:${phone}`
    const messages = await store.get(key, { type: 'json' }).catch(() => null)
    
    // Busca também os dados do lead
    const leadData = await store.get(phone, { type: 'json' }).catch(() => null)
    
    return new Response(JSON.stringify({
      ok: true,
      phone,
      lead: leadData,
      messages: messages || [],
      count: (messages || []).length
    }), { headers: CORS })
  }

  // ── GET lista de todos os clientes com histórico ──────────────────────────────
  const { blobs } = await store.list()
  
  // Filtrar apenas chaves de histórico (chat_history:*)
  const historyBlobs = blobs.filter(b => b.key.startsWith('chat_history:'))
  
  const clients = await Promise.all(
    historyBlobs.map(async b => {
      try {
        const phone = b.key.replace('chat_history:', '')
        const messages = await store.get(b.key, { type: 'json' })
        const leadData = await store.get(phone, { type: 'json' }).catch(() => null)
        
        if (!messages || messages.length === 0) return null
        
        const lastMessage = messages[messages.length - 1]
        
        return {
          phone,
          name: leadData?.name || leadData?.waName || null,
          market: leadData?.market || null,
          city: leadData?.city || null,
          stage: leadData?.stage || 'novo',
          messageCount: messages.length,
          lastMessage: lastMessage.content,
          lastMessageRole: lastMessage.role,
          lastMessageTime: lastMessage.timestamp,
          updatedAt: lastMessage.timestamp,
        }
      } catch {
        return null
      }
    })
  )

  // Filtrar nulos e ordenar por última mensagem
  const sorted = clients
    .filter(Boolean)
    .sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime))

  return new Response(JSON.stringify({
    ok: true,
    total: sorted.length,
    clients: sorted
  }), { headers: CORS })
}

export const config = { path: '/api/wa-chat-history' }
