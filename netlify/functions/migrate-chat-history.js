/**
 * migrate-chat-history — Popula histórico de conversas com base nos leads existentes
 * 
 * POST /api/migrate-chat-history?mk=MASTER_KEY&instance=zara
 * 
 * Cria histórico inicial para leads que não tem chat_history ainda.
 * Útil para migrar conversas antigas que foram perdidas.
 * 
 * ISOLAMENTO: cria históricos no formato chat_history:{instance}:{phone}
 */

import { getStore } from '@netlify/blobs'

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
}

function leadsStore() {
  return getStore({ name: 'wa-leads', consistency: 'strong' })
}

// ─── Mapeamento Instance Name → StoreId (igual ao wa-bot.js) ──────────────────
const CORTA_PRECOS_STORE_ID = 'cortaprecos_1789770018182'
const INSTANCE_TO_STOREID = {
  'cortaprecos':   CORTA_PRECOS_STORE_ID,
  'zatendeapi':    'zara',
  'zara':          'zara',
}

function getStoreIdFromInstance(instanceName) {
  if (!instanceName) return 'zara'
  return INSTANCE_TO_STOREID[instanceName] || instanceName
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS })

  const url = new URL(req.url)
  const mk = url.searchParams.get('mk')
  const instance = url.searchParams.get('instance') || 'zara' // default: zara (bot de vendas ZatendeStok)
  const storeId = getStoreIdFromInstance(instance) // Mapeia para storeId consistente

  if (mk !== process.env.ZS_MASTER_KEY) {
    return new Response(JSON.stringify({ ok: false, error: 'Não autorizado' }), { status: 401, headers: CORS })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Apenas POST' }), { status: 405, headers: CORS })
  }

  const store = leadsStore()

  try {
    // Busca todos os leads
    const { blobs } = await store.list()
    const leadBlobs = blobs.filter(b => !b.key.startsWith('chat_history:'))
    
    let created = 0
    let skipped = 0
    const errors = []

    for (const blob of leadBlobs) {
      try {
        const phone = blob.key
        const leadData = await store.get(phone, { type: 'json' })
        
        if (!leadData || !phone) {
          skipped++
          continue
        }

        // Verifica se já tem histórico (NOVA KEY: chat_history:{storeId}:{phone})
        const historyKey = `chat_history:${storeId}:${phone}`
        const existingHistory = await store.get(historyKey, { type: 'json' }).catch(() => null)
        
        if (existingHistory && existingHistory.length > 0) {
          skipped++
          continue
        }

        // Cria histórico inicial baseado nos dados do lead
        const messages = []
        const baseTime = new Date(leadData.createdAt || Date.now())

        // Mensagem inicial do cliente (simulada)
        messages.push({
          role: 'user',
          content: `Olá! Tenho interesse no ZatendeStok.${leadData.market ? ` Tenho um mercado: ${leadData.market}` : ''}${leadData.city ? ` Estou em ${leadData.city}` : ''}`,
          timestamp: baseTime.toISOString()
        })

        // Resposta da Zara (simulada)
        const zaraResponse = leadData.stage === 'fechado' 
          ? '🎉 Que ótimo! Vou te passar mais informações sobre o sistema. Temos o plano Profissional por R$497/mês com 3 PDVs!'
          : leadData.stage === 'demo'
          ? '⭐ Legal! Posso te mostrar uma demonstração do sistema. Quando você tem um tempinho?'
          : leadData.stage === 'interessado'
          ? '🔥 Bacana! O ZatendeStok é um sistema completo de PDV para mercados. Quer saber mais sobre os planos?'
          : '😊 Olá! Prazer em conhecer! Posso te ajudar com informações sobre o ZatendeStok?'

        messages.push({
          role: 'assistant',
          content: zaraResponse,
          timestamp: new Date(baseTime.getTime() + 5000).toISOString()
        })

        // Adiciona informações extras se tiver
        if (leadData.niche) {
          messages.push({
            role: 'user',
            content: `Meu negócio é ${leadData.niche}`,
            timestamp: new Date(baseTime.getTime() + 10000).toISOString()
          })
        }

        if (leadData.employees) {
          messages.push({
            role: 'user',
            content: `Tenho ${leadData.employees} funcionários`,
            timestamp: new Date(baseTime.getTime() + 15000).toISOString()
          })
        }

        if (leadData.currentSystem) {
          messages.push({
            role: 'user',
            content: `Hoje uso ${leadData.currentSystem}`,
            timestamp: new Date(baseTime.getTime() + 20000).toISOString()
          })
        }

        // Salva histórico (NOVA KEY com instance)
        await store.set(historyKey, JSON.stringify(messages))
        created++

      } catch (e) {
        errors.push({ phone: blob.key, error: e.message })
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      created,
      skipped,
      total: leadBlobs.length,
      errors: errors.length > 0 ? errors : undefined
    }), { headers: CORS })

  } catch (e) {
    return new Response(JSON.stringify({
      ok: false,
      error: e.message
    }), { status: 500, headers: CORS })
  }
}

export const config = { path: '/api/migrate-chat-history' }
