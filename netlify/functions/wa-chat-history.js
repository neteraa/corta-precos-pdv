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
  const blobKey = url.searchParams.get('blobKey')  // NOVO: key direta do blob!

  // Autenticação: MASTER KEY (admin vê tudo) ou STOREID+TOKEN (cliente vê só suas conversas)
  const isMaster = mk === process.env.ZS_MASTER_KEY
  const isStore  = !isMaster && storeId && await validateStoreAuth(storeId, token)

  if (!isMaster && !isStore) {
    return new Response(JSON.stringify({ ok: false, error: 'Não autorizado' }), { status: 401, headers: CORS })
  }

  const store = leadsStore()

  // ── GET histórico de um cliente específico ────────────────────────────────────
  if (phone || blobKey) {
    console.log('[wa-chat-history] Buscando - phone:', phone, 'blobKey:', blobKey)
    console.log('[wa-chat-history] isMaster:', isMaster, 'isStore:', isStore)
    
    let messages = null
    let foundKey = null
    let actualPhone = phone
    
    // NOVO: Se veio blobKey, usa DIRETO!
    if (blobKey) {
      console.log('[wa-chat-history] Usando blobKey direto:', blobKey)
      foundKey = blobKey
      messages = await store.get(blobKey, { type: 'json' }).catch(() => null)
      // Extrai phone da key: chat_history:storeId:PHONE ou chat_history:PHONE
      const parts = blobKey.split(':')
      actualPhone = parts[parts.length - 1]
      console.log('[wa-chat-history] Phone extraído da key:', actualPhone)
      console.log('[wa-chat-history] Mensagens carregadas:', messages?.length || 0)
    } 
    // Fallback: busca por phone (mantém retrocompatibilidade)
    else if (phone) {
      if (isStore) {
        // Cliente: busca APENAS suas próprias conversas
        const key = `chat_history:${storeId}:${phone}`
        console.log('[wa-chat-history] Tentando key (store):', key)
        messages = await store.get(key, { type: 'json' }).catch(() => null)
        
        // CRÍTICO: Se não achou, tenta com storeId_timestamp (ex: cortaprecos → cortaprecos_*)
        if (!messages) {
          console.log('[wa-chat-history] Key exata não encontrada, tentando com storeId_*')
          const { blobs } = await store.list()
          const matchingBlob = blobs.find(b => 
            (b.key.startsWith(`chat_history:${storeId}:`) || b.key.startsWith(`chat_history:${storeId}_`)) &&
            b.key.endsWith(`:${phone}`)
          )
          if (matchingBlob) {
            foundKey = matchingBlob.key
            console.log('[wa-chat-history] Key com timestamp encontrada:', foundKey)
            messages = await store.get(matchingBlob.key, { type: 'json' }).catch(() => null)
          }
        }
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
    }
    
    // Busca também os dados do lead
    const leadData = await store.get(actualPhone, { type: 'json' }).catch(() => null)
    
    return new Response(JSON.stringify({
      ok: true,
      phone: actualPhone,
      foundKey,  // DEBUG: mostra qual key foi usada
      lead: leadData,
      messages: messages || [],
      count: (messages || []).length
    }), { headers: CORS })
  }

  // ── GET lista de todos os clientes com histórico ──────────────────────────────
  const { blobs } = await store.list()
  
  console.log('[wa-chat-history] Listando clientes - isStore:', isStore, 'storeId:', storeId, 'isMaster:', isMaster)
  console.log('[wa-chat-history] Total blobs:', blobs.length)
  
  // Filtrar chaves de histórico: aceita AMBOS formatos (retrocompatibilidade)
  // Formato antigo: chat_history:{phone}
  // Formato novo: chat_history:{storeId}:{phone}
  let historyBlobs
  if (isStore) {
    // Cliente: APENAS histórico deste storeId
    // CRÍTICO: Aceita storeId exato OU storeId com timestamp (ex: cortaprecos → cortaprecos_*)
    historyBlobs = blobs.filter(b => {
      if (b.key.startsWith(`chat_history:${storeId}:`)) return true
      // Fallback: aceita storeId base (sem timestamp) matching com storeId_timestamp
      if (b.key.startsWith(`chat_history:${storeId}_`)) return true
      return false
    })
    console.log('[wa-chat-history] Filtrado para storeId:', storeId, '→', historyBlobs.length, 'conversas')
    if (historyBlobs.length > 0) {
      console.log('[wa-chat-history] Primeiras 3 keys encontradas:', historyBlobs.slice(0, 3).map(b => b.key))
    }
  } else {
    // Master: TODOS os históricos (ambos formatos)
    historyBlobs = blobs.filter(b => b.key.startsWith('chat_history:'))
    console.log('[wa-chat-history] Master mode → todas conversas:', historyBlobs.length)
  }
  
  // CRÍTICO: Deduplica conversas por telefone (pega mais recente)
  const clientsRaw = await Promise.all(
    historyBlobs.map(async b => {
      try {
        // Key format: chat_history:{storeId}:{phone}
        const parts = b.key.split(':')
        const phone = parts[parts.length - 1] // último segmento é o phone
        const chatStoreId = parts.length === 3 ? parts[1] : 'unknown' // extrai storeId da key
        const messages = await store.get(b.key, { type: 'json' })
        const leadData = await store.get(phone, { type: 'json' }).catch(() => null)
        
        if (!messages || messages.length === 0) return null
        
        const lastMessage = messages[messages.length - 1]
        
        return {
          phone,
          blobKey: b.key,  // ADICIONA A KEY COMPLETA!
          storeId: chatStoreId,  // NOVO: storeId da conversa (zara, cortaprecos_123, etc)
          name: leadData?.name || leadData?.waName || null,
          market: leadData?.market || null,
          city: leadData?.city || null,
          stage: leadData?.stage || 'novo',
          type: leadData?.type || null,  // 'customer' ou 'lead'
          
          // NOVO: Histórico de compras
          lastOrderDate: leadData?.lastOrderDate || null,
          totalOrders: leadData?.totalOrders || 0,
          totalSpent: leadData?.totalSpent || 0,
          orders: leadData?.orders || [],
          
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

  // DEDUPLICAÇÃO: Agrupa por telefone e pega conversa mais recente
  const phoneMap = new Map()
  clientsRaw.filter(Boolean).forEach(client => {
    const existing = phoneMap.get(client.phone)
    // Se não existe OU a nova é mais recente → substitui
    if (!existing || new Date(client.lastMessageTime) > new Date(existing.lastMessageTime)) {
      phoneMap.set(client.phone, client)
    }
  })
  
  console.log('[wa-chat-history] Antes deduplica:', clientsRaw.filter(Boolean).length, '| Depois:', phoneMap.size)
  
  // Converte Map pra array e ordena por última mensagem
  const clients = Array.from(phoneMap.values())
  const sorted = clients
    .sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime))

  return new Response(JSON.stringify({
    ok: true,
    total: sorted.length,
    clients: sorted
  }), { headers: CORS })
}

export const config = { path: '/api/wa-chat-history' }
