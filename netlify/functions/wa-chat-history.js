/**
 * wa-chat-history — API para buscar histórico de conversas WhatsApp (ISOLADO POR CLIENTE)
 *
 * GET /api/wa-chat-history?storeId=X&token=Y              → lista clientes deste storeId
 * GET /api/wa-chat-history?storeId=X&token=Y&phone=55...  → histórico de um cliente específico
 * GET /api/wa-chat-history?mk=MASTER_KEY                  → admin: todos os clientes de TODOS os stores
 */

import { getStore } from '@netlify/blobs'

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
}

function leadsStore() {
  return getStore({ name: 'wa-leads', consistency: 'strong' })
}

async function validateStoreAuth(storeId, token) {
  if (!storeId || !token) return false
  try {
    const authStore = getStore({ name: 'zs-auth', consistency: 'strong' })
    const raw = await authStore.get(`${storeId}:token`)
    return raw === token
  } catch {
    return false
  }
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS })

  const url = new URL(req.url)
  const mk      = url.searchParams.get('mk')
  const storeId = url.searchParams.get('storeId')
  const token   = url.searchParams.get('token')
  const phone   = url.searchParams.get('phone')

  // Autenticação: MASTER KEY (admin vê tudo) ou STOREID+TOKEN (cliente vê só suas conversas)
  const isMaster = mk === process.env.ZS_MASTER_KEY
  const isStore  = !isMaster && storeId && await validateStoreAuth(storeId, token)

  if (!isMaster && !isStore) {
    return new Response(JSON.stringify({ ok: false, error: 'Não autorizado' }), { status: 401, headers: CORS })
  }

  const store = leadsStore()

  // ── GET histórico de um cliente específico ────────────────────────────────────
  if (phone) {
    console.log('[wa-chat-history] Buscando phone:', phone)
    console.log('[wa-chat-history] isMaster:', isMaster, 'isStore:', isStore)
    
    let messages = null
    let foundKey = null
    
    if (isStore) {
      // Cliente: busca APENAS suas próprias conversas
      const key = `chat_history:${storeId}:${phone}`
      console.log('[wa-chat-history] Tentando key (store):', key)
      messages = await store.get(key, { type: 'json' }).catch(() => null)
    } else if (isMaster) {
      // Master: busca em AMBOS formatos (retrocompatibilidade)
      console.log('[wa-chat-history] Listando blobs...')
      const { blobs } = await store.list()
      const chatBlobs = blobs.filter(b => b.key.startsWith('chat_history:'))
      console.log('[wa-chat-history] Total chat_history blobs:', chatBlobs.length)
      console.log('[wa-chat-history] Primeiras 5 keys:', chatBlobs.slice(0, 5).map(b => b.key))
      
      const matchingBlob = blobs.find(b => 
        b.key.startsWith('chat_history:') && 
        (b.key.endsWith(`:${phone}`) || b.key === `chat_history:${phone}`)
      )
      
      if (matchingBlob) {
        foundKey = matchingBlob.key
        console.log('[wa-chat-history] Key encontrada:', foundKey)
        messages = await store.get(matchingBlob.key, { type: 'json' }).catch(() => null)
        console.log('[wa-chat-history] Mensagens carregadas:', messages?.length || 0)
      } else {
        console.log('[wa-chat-history] NENHUMA key encontrada para phone:', phone)
      }
    }
    
    // Busca também os dados do lead
    const leadData = await store.get(phone, { type: 'json' }).catch(() => null)
    
    return new Response(JSON.stringify({
      ok: true,
      phone,
      foundKey,  // DEBUG: mostra qual key foi usada
      lead: leadData,
      messages: messages || [],
      count: (messages || []).length
    }), { headers: CORS })
  }

  // ── GET lista de todos os clientes com histórico ──────────────────────────────
  const { blobs } = await store.list()
  
  // Filtrar chaves de histórico: aceita AMBOS formatos (retrocompatibilidade)
  // Formato antigo: chat_history:{phone}
  // Formato novo: chat_history:{storeId}:{phone}
  let historyBlobs
  if (isStore) {
    // Cliente: APENAS histórico deste storeId
    historyBlobs = blobs.filter(b => b.key.startsWith(`chat_history:${storeId}:`))
  } else {
    // Master: TODOS os históricos (ambos formatos)
    historyBlobs = blobs.filter(b => b.key.startsWith('chat_history:'))
  }
  
  const clients = await Promise.all(
    historyBlobs.map(async b => {
      try {
        // Key format: chat_history:{storeId}:{phone}
        const parts = b.key.split(':')
        const phone = parts[parts.length - 1] // último segmento é o phone
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
