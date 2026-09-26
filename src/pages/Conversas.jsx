/**
 * /conversas — Histórico de conversas WhatsApp da Zara
 * Mostra todas as conversas com clientes, organizadas por cliente
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { MessageCircle, RefreshCw, Search, Phone, MapPin, Building2, Clock, ExternalLink, User, Bot, AlertCircle } from 'lucide-react'

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function timeAgo(iso) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'agora'
  if (mins < 60) return `${mins}min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

export default function Conversas() {
  const [clients,       setClients]       = useState([])
  const [loading,       setLoading]       = useState(true)
  const [selectedPhone, setSelectedPhone] = useState(null)
  const [messages,      setMessages]      = useState([])
  const [msgLoading,    setMsgLoading]    = useState(false)
  const [searchQuery,   setSearchQuery]   = useState('')
  const [debugInfo,     setDebugInfo]     = useState(null) // DEBUG: info da API
  const [filterStore,   setFilterStore]   = useState('all') // NOVO: filtro por storeId
  const messagesEndRef = useRef(null)

  // AUTH: usa master key (admin) OU storeId+token (mercado específico)
  const getMK = () => localStorage.getItem('zs_master_key') || ''
  const getStoreId = () => {
    try {
      const session = JSON.parse(localStorage.getItem('cp_session') || '{}')
      return session.storeId || 'default'
    } catch { return 'default' }
  }
  const getStoreToken = () => {
    try {
      const storeId = getStoreId()
      if (storeId === 'default') return null
      const mkt = JSON.parse(localStorage.getItem(`mkt:${storeId}:cp_session`) || '{}')
      return mkt.storeToken || null
    } catch { return null }
  }

  const loadClients = useCallback(async () => {
    setLoading(true)
    try {
      const mk = getMK()
      const storeId = getStoreId()
      const token = getStoreToken()
      
      // Log básico
      console.log('[Conversas] Carregando - storeId:', storeId || 'master')
      
      // Admin (master key) OU mercado específico (storeId)
      let url
      if (mk) {
        url = `/api/wa-chat-history?mk=${encodeURIComponent(mk)}`
      } else if (storeId && storeId !== 'default') {
        // Token é opcional (login local não tem token)
        url = token 
          ? `/api/wa-chat-history?storeId=${encodeURIComponent(storeId)}&token=${encodeURIComponent(token)}`
          : `/api/wa-chat-history?storeId=${encodeURIComponent(storeId)}`
      } else {
        console.error('[Conversas] Sem credenciais')
        setClients([])
        return
      }
      
      // Cache-bust para evitar cache do navegador
      const cacheBust = `${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`
      const res = await fetch(cacheBust, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      })
      const data = await res.json()
      
      if (data.ok) {
        setClients(data.clients || [])
      } else {
        console.error('[Conversas] Erro ao carregar:', data.error)
        setClients([])
      }
    } catch (e) {
      console.error('❌ loadClients EXCEPTION:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadMessages = useCallback(async (phone, blobKey = null) => {
    setMsgLoading(true)
    setSelectedPhone(phone)
    setMessages([]) // Limpa mensagens antigas primeiro
    setDebugInfo(null)
    try {
      const mk = getMK()
      const storeId = getStoreId()
      const token = getStoreToken()
      
      // NOVO: usa blobKey se disponível (ELIMINA problema de match!)
      let url
      if (mk) {
        url = blobKey 
          ? `/api/wa-chat-history?mk=${encodeURIComponent(mk)}&blobKey=${encodeURIComponent(blobKey)}`
          : `/api/wa-chat-history?mk=${encodeURIComponent(mk)}&phone=${phone}`
      } else if (storeId && storeId !== 'default') {
        // Token é opcional
        const baseParams = token 
          ? `storeId=${encodeURIComponent(storeId)}&token=${encodeURIComponent(token)}`
          : `storeId=${encodeURIComponent(storeId)}`
        url = blobKey 
          ? `/api/wa-chat-history?${baseParams}&blobKey=${encodeURIComponent(blobKey)}`
          : `/api/wa-chat-history?${baseParams}&phone=${phone}`
      }
      
      console.log('Carregando mensagens - phone:', phone, 'blobKey:', blobKey)
      // FORÇA Chrome a NÃO cachear
      const cacheBust = `${url}&_t=${Date.now()}`
      const res = await fetch(cacheBust, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      })
      const data = await res.json()
      console.log('Resposta:', data)
      
      // DEBUG: salva info completa da API
      setDebugInfo({
        phone,
        blobKey,
        foundKey: data.foundKey,
        count: data.count,
        messagesLength: (data.messages || []).length,
        ok: data.ok,
      })
      
      if (data.ok) {
        const msgs = data.messages || []
        console.log('Mensagens carregadas:', msgs.length)
        setMessages(msgs)
      } else {
        console.error('Erro na API:', data.error)
        setMessages([])
      }
    } catch (e) {
      console.error('loadMessages erro:', e)
      setMessages([])
      setDebugInfo({ error: e.message })
    } finally {
      setMsgLoading(false)
    }
  }, [])

  useEffect(() => {
    loadClients()
    setFilterStore('all')
    const interval = setInterval(loadClients, 10000)
    return () => clearInterval(interval)
  }, [loadClients])

  // Auto-scroll quando mensagens carregarem
  useEffect(() => {
    if (messages.length > 0 && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const filteredClients = clients.filter(c => {
    // Filtro por storeId (separa Zara, Corta Preços, etc)
    if (filterStore !== 'all') {
      if (c.storeId !== filterStore) return false
    }
    
    // Filtro por busca
    const q = searchQuery.toLowerCase()
    return (
      (c.name || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q) ||
      (c.market || '').toLowerCase().includes(q) ||
      (c.city || '').toLowerCase().includes(q)
    )
  })
  

  
  // Extrai storeIds únicos para as abas (SÓ QUANDO TEM MASTER KEY!)
  const mk = getMK()
  const loggedStoreId = getStoreId()
  
  // CRÍTICO: Se tem storeId válido (não 'default'), SEMPRE é modo store (ignora master key!)
  // Isso resolve cache de navegador com master key residual
  const hasValidStoreId = loggedStoreId && loggedStoreId !== 'default'
  const isMasterMode = !hasValidStoreId && !!mk  // Admin SOMENTE se não tiver storeId
  const isStoreMode = hasValidStoreId  // Se tem storeId válido, é modo store
  
  const uniqueStores = [...new Set(clients.map(c => c.storeId))].filter(Boolean).sort()
  const storeLabels = {
    'zara': 'Zara (Vendas)',
    'cortaprecos': 'Corta Preços',
    'cortaprecos_1789770018182': 'Corta Preços',
  }
  
  // Helper: pega label do storeId (aceita com/sem timestamp)
  const getStoreLabel = (sid) => {
    if (!sid) return sid
    // Tenta exato
    if (storeLabels[sid]) return storeLabels[sid]
    // Tenta sem timestamp (cortaprecos_123 → cortaprecos)
    const base = sid.split('_')[0]
    return storeLabels[base] || sid
  }

  const selectedClient = clients.find(c => c.phone === selectedPhone)

  return (
    <div className="min-h-screen bg-gray-50" style={{ paddingBottom: 24 }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
              <MessageCircle className="w-6 h-6 text-green-600" />
              Conversas WhatsApp
              {isMasterMode && (
                <span className="ml-2 px-2 py-0.5 text-xs font-bold bg-purple-100 text-purple-700 rounded-full">
                  ADMIN
                </span>
              )}
              {isStoreMode && (
                <span className="ml-2 px-2 py-0.5 text-xs font-bold bg-blue-100 text-blue-700 rounded-full">
                  {getStoreLabel(loggedStoreId)}
                </span>
              )}
            </h1>
            <p className="text-gray-600 text-sm mt-0.5 flex items-center gap-2">
              {isMasterMode ? 'Histórico de TODOS os mercados (modo admin)' : `Histórico do ${getStoreLabel(loggedStoreId)}`}
              <span className="text-xs text-gray-400 font-mono">
                v{new Date().toISOString().slice(0,10)}
              </span>
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={loadClients} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold text-sm transition-all disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
            </button>
          </div>
        </div>
      </div>

      {/* Grid: Lista + Chat */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 lg:divide-x divide-gray-200 h-[calc(100vh-120px)]">
        
        {/* ── LISTA DE CLIENTES ────────────────────────────────── */}
        {/* No mobile: esconde lista quando chat está aberto */}
        <div className={`lg:col-span-1 bg-white overflow-y-auto ${selectedPhone ? 'hidden lg:block' : 'block'}`}>
          {/* Search */}
          <div className="sticky top-0 bg-white p-4 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar cliente..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Abas de filtro por storeId (SÓ APARECE NO MODO MASTER!) */}
          {isMasterMode && uniqueStores.length > 1 && (
            <div className="sticky top-[72px] bg-gray-50 p-3 border-b border-gray-200 flex gap-2 overflow-x-auto">
              <button
                onClick={() => setFilterStore('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  filterStore === 'all' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
                }`}
              >
                Todos ({clients.length})
              </button>
              {uniqueStores.map(storeId => {
                const count = clients.filter(c => c.storeId === storeId).length
                const label = getStoreLabel(storeId)
                return (
                  <button
                    key={storeId}
                    onClick={() => setFilterStore(storeId)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                      filterStore === storeId 
                        ? 'bg-green-600 text-white' 
                        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
                    }`}
                  >
                    {label} ({count})
                  </button>
                )
              })}
            </div>
          )}

          {/* Clients List */}
          {loading && (
            <div className="p-8 text-center text-gray-500">
              <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin opacity-40" />
              <p className="text-sm">Carregando conversas...</p>
            </div>
          )}

          {!loading && filteredClients.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="font-semibold">Nenhuma conversa ainda</p>
              <p className="text-xs mt-1">As conversas aparecem automaticamente quando alguém conversa com a Zara</p>
            </div>
          )}

          {!loading && filteredClients.map((client) => (
            <button
              key={client.phone}
              onClick={() => loadMessages(client.phone, client.blobKey)}
              className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                selectedPhone === client.phone ? 'bg-green-50 border-l-4 border-l-green-600' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <User className="w-4 h-4 text-green-600" />
                  </div>
                  {/* Mostra nome real, ou telefone se não tiver nome válido */}
                  {(client.name && client.name !== 'LEAD' && client.name !== '(sem nome)') 
                    ? client.name 
                    : client.phone 
                      ? `+${client.phone.slice(0,2)} (${client.phone.slice(2,4)}) ${client.phone.slice(4,9)}-${client.phone.slice(9)}`
                      : '(sem identificação)'}
                </div>
                <span className="text-xs text-gray-500">{timeAgo(client.lastMessageTime)}</span>
              </div>

              {(client.market || client.city) && (
                <div className="flex gap-2 text-xs text-gray-600 mb-1">
                  {client.market && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{client.market}</span>}
                  {client.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{client.city}</span>}
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Phone className="w-3 h-3" />
                <span>{client.phone ? `+${client.phone.slice(0,2)} (${client.phone.slice(2,4)}) ${client.phone.slice(4,9)}-${client.phone.slice(9)}` : '—'}</span>
              </div>

              {/* NOVO: Histórico de compras (só para customers do Corta Preços) */}
              {client.type === 'customer' && client.totalOrders > 0 && (
                <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-orange-900">🛒 {client.totalOrders} pedido{client.totalOrders !== 1 ? 's' : ''}</span>
                    <span className="font-bold text-orange-700">{BRL.format(client.totalSpent)}</span>
                  </div>
                  {client.lastOrderDate && (
                    <div className="text-xs text-orange-700 mt-1">
                      Último: {timeAgo(client.lastOrderDate)}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-2 text-xs text-gray-600 truncate">
                <span className={`font-semibold ${client.lastMessageRole === 'user' ? 'text-gray-700' : 'text-green-600'}`}>
                  {client.lastMessageRole === 'user' ? 'Cliente:' : 'Zara:'}
                </span> {client.lastMessage}
              </div>

              <div className="mt-1 text-xs text-gray-500">
                {client.messageCount} mensagem{client.messageCount !== 1 ? 's' : ''}
              </div>
            </button>
          ))}
        </div>

        {/* ── CHAT / MENSAGENS ───────────────────────────────────── */}
        {/* No mobile: mostra chat fullscreen quando selecionado */}
        <div className={`lg:col-span-2 bg-gray-50 flex flex-col ${!selectedPhone ? 'hidden lg:flex' : 'flex'}`}>
          {!selectedPhone && (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-gray-500">
              <div>
                <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="font-semibold text-lg">Selecione uma conversa</p>
                <p className="text-sm mt-1">Clique em um cliente na lista à esquerda para ver o histórico completo</p>
              </div>
            </div>
          )}

          {selectedPhone && (
            <>
              {/* Header do Chat */}
              <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-3 flex-1">
                  {/* Botão Voltar (só mobile) */}
                  <button
                    onClick={() => setSelectedPhone(null)}
                    className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-all"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  
                  <div className="flex-1">
                    <div className="font-black text-gray-900 flex items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                        <User className="w-5 h-5 text-green-600" />
                      </div>
                      {selectedClient?.name || '(sem nome)'}
                    </div>
                    <div className="text-xs text-gray-600 mt-1 flex items-center gap-2">
                      <Phone className="w-3 h-3" />
                      {selectedPhone ? `+${selectedPhone.slice(0,2)} (${selectedPhone.slice(2,4)}) ${selectedPhone.slice(4,9)}-${selectedPhone.slice(9)}` : ''}
                    </div>
                  </div>
                </div>
                
                <a
                  href={`https://wa.me/${selectedPhone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden lg:flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold text-sm transition-all">
                  <ExternalLink className="w-4 h-4" /> Abrir no WhatsApp
                </a>
              </div>

              {/* NOVO: Histórico de Pedidos (só para customers) */}
              {selectedClient?.type === 'customer' && selectedClient?.orders && selectedClient.orders.length > 0 && (
                <div className="bg-orange-50 border-b border-orange-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-orange-900 text-sm">📦 Histórico de Pedidos</h3>
                    <div className="text-xs text-orange-700">
                      <span className="font-bold">{selectedClient.totalOrders}</span> pedidos · 
                      <span className="font-bold ml-1">{BRL.format(selectedClient.totalSpent)}</span> total
                    </div>
                  </div>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {selectedClient.orders.slice(0, 5).map((order, i) => (
                      <div key={i} className="bg-white rounded-lg p-2 text-xs border border-orange-200">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-semibold text-gray-700 truncate flex-1">{order.items}</span>
                          <span className="font-bold text-orange-700 ml-2">{BRL.format(order.total)}</span>
                        </div>
                        <div className="flex justify-between text-gray-500">
                          <span>{timeAgo(order.date)}</span>
                          <span className={`font-semibold ${
                            order.status === 'delivered' ? 'text-green-600' : 
                            order.status === 'awaiting_pix' ? 'text-yellow-600' : 'text-gray-500'
                          }`}>
                            {order.status === 'delivered' ? '✅ Entregue' : 
                             order.status === 'awaiting_pix' ? '⏳ Aguardando' : order.status}
                          </span>
                        </div>
                      </div>
                    ))}
                    {selectedClient.orders.length > 5 && (
                      <p className="text-xs text-center text-orange-600 font-semibold pt-1">
                        + {selectedClient.orders.length - 5} pedidos anteriores
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Mensagens */}
              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {msgLoading && (
                  <div className="text-center py-8 text-gray-500">
                    <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin opacity-40" />
                    <p className="text-sm">Carregando mensagens...</p>
                  </div>
                )}

                {!msgLoading && messages.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-bold">Nenhuma mensagem encontrada</p>
                    
                    {/* DEBUG INFO VISUAL */}
                    {debugInfo && (
                      <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-left max-w-md mx-auto">
                        <p className="font-bold text-yellow-800 mb-2">🔍 Debug Info:</p>
                        <p className="text-xs"><strong>Phone buscado:</strong> {debugInfo.phone}</p>
                        <p className="text-xs"><strong>Key encontrada:</strong> {debugInfo.foundKey || '❌ NENHUMA!'}</p>
                        <p className="text-xs"><strong>Count da API:</strong> {debugInfo.count}</p>
                        <p className="text-xs"><strong>Messages length:</strong> {debugInfo.messagesLength}</p>
                        <p className="text-xs"><strong>API ok:</strong> {debugInfo.ok ? '✅' : '❌'}</p>
                        {debugInfo.error && <p className="text-xs text-red-600"><strong>Erro:</strong> {debugInfo.error}</p>}
                      </div>
                    )}
                    
                    <p className="text-xs text-red-600 mt-4 font-bold">
                      ⚠️ Se a lista da esquerda mostra mensagens mas aqui não aparece,<br/>
                      é porque a API não encontrou a key correta no blob!
                    </p>
                  </div>
                )}

                {!msgLoading && messages.map((msg, i) => {
                  const isUser = msg.role === 'user'
                  return (
                    <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] ${isUser ? 'order-2' : 'order-1'}`}>
                        <div className={`flex items-start gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isUser ? 'bg-blue-100' : 'bg-green-100'
                          }`}>
                            {isUser ? <User className="w-4 h-4 text-blue-600" /> : <Bot className="w-4 h-4 text-green-600" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`px-4 py-2.5 rounded-2xl ${
                              isUser
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-gray-900 border border-gray-200'
                            }`}>
                              <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                            </div>
                            <div className={`text-xs text-gray-500 mt-1 px-1 ${isUser ? 'text-right' : 'text-left'}`}>
                              {new Date(msg.timestamp).toLocaleString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
