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
  const messagesEndRef = useRef(null)

  // Pega master key do localStorage (MasterPainel)
  const getMK = () => localStorage.getItem('zs_master_key') || ''

  const loadClients = useCallback(async () => {
    setLoading(true)
    try {
      const mk = getMK()
      if (!mk) {
        setClients([])
        return
      }
      const res = await fetch(`/api/wa-chat-history?mk=${encodeURIComponent(mk)}`)
      const data = await res.json()
      if (data.ok) {
        setClients(data.clients || [])
      }
    } catch (e) {
      console.error('loadClients:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadMessages = useCallback(async (phone) => {
    setMsgLoading(true)
    setSelectedPhone(phone)
    try {
      const mk = getMK()
      const res = await fetch(`/api/wa-chat-history?mk=${encodeURIComponent(mk)}&phone=${phone}`)
      const data = await res.json()
      if (data.ok) {
        setMessages(data.messages || [])
      }
    } catch (e) {
      console.error('loadMessages:', e)
      setMessages([])
    } finally {
      setMsgLoading(false)
    }
  }, [])

  useEffect(() => {
    loadClients()
    // Auto-refresh a cada 30s
    const interval = setInterval(loadClients, 30000)
    return () => clearInterval(interval)
  }, [loadClients])

  // Scroll to bottom quando carrega mensagens
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const filteredClients = clients.filter(c => {
    const q = searchQuery.toLowerCase()
    return (
      (c.name || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q) ||
      (c.market || '').toLowerCase().includes(q) ||
      (c.city || '').toLowerCase().includes(q)
    )
  })

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
            </h1>
            <p className="text-gray-600 text-sm mt-0.5">Histórico completo das conversas da Zara</p>
          </div>
          <button onClick={loadClients} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold text-sm transition-all disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </button>
        </div>
      </div>

      {/* Grid: Lista + Chat */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 lg:divide-x divide-gray-200 h-[calc(100vh-120px)]">
        
        {/* ── LISTA DE CLIENTES ────────────────────────────────── */}
        <div className="lg:col-span-1 bg-white overflow-y-auto">
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
              onClick={() => loadMessages(client.phone)}
              className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                selectedPhone === client.phone ? 'bg-green-50 border-l-4 border-l-green-600' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <User className="w-4 h-4 text-green-600" />
                  </div>
                  {client.name || '(sem nome)'}
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
        <div className="lg:col-span-2 bg-gray-50 flex flex-col">
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
                <div>
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
                <a
                  href={`https://wa.me/${selectedPhone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold text-sm transition-all">
                  <ExternalLink className="w-4 h-4" /> Abrir no WhatsApp
                </a>
              </div>

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
                    <p className="text-sm">Nenhuma mensagem encontrada</p>
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
