import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Copy, Check, Search, MessageCircle, Phone, Plus, Flame, ExternalLink, Wifi, WifiOff, Bot, Users, List, RefreshCw, AlertTriangle, Send } from 'lucide-react'
import { useStore, BRL } from '../store.jsx'
import { getConfiguredStoreId } from '../utils/auth.js'

/* ── helpers ─────────────────────────────────────────────── */
const cleanPhone = p =>
  '55' + (p || '').replace(/\D/g, '').replace(/^0/, '').slice(-11)

const hasPhone = c => /\d{8,}/.test((c.phone || '').replace(/\D/g, ''))

const renderMsg = (template, customer, store = 'MEU MERCADO') =>
  template
    .replace(/\{\{nome\}\}/gi,  customer?.name?.split(' ')[0] || 'cliente')
    .replace(/\{\{loja\}\}/gi,  store)
    .replace(/\{\{saldo\}\}/gi, customer?.saldo ? BRL.format(customer.saldo) : 'R$ 0,00')
    .replace(/\{\{data\}\}/gi,  new Date().toLocaleDateString('pt-BR'))

/* ── send via nosso proxy (Evolution API server-side) ─────── */
async function sendViaBot(instance, number, text) {
  const res = await fetch('/api/wa-send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instance, number, text }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const d = await res.json()
  if (!d.ok) throw new Error(d.error || 'Erro ao enviar')
  return d
}

/* ── random delay anti-ban: 1.5s–4s ─────────────────────── */
const randDelay = () => new Promise(r => setTimeout(r, 1500 + Math.random() * 2500))

/* ── WhatsApp bubble preview ─────────────────────────────── */
function WaBubble({ text }) {
  if (!text) return null
  return (
    <div className="bg-[#0b141a] rounded-2xl p-4 max-w-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
          <MessageCircle className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="text-green-400 text-xs font-bold">ZatendeStok</div>
          <div className="text-gray-500 text-[10px]">WhatsApp Business</div>
        </div>
      </div>
      <div className="bg-[#202c33] rounded-xl rounded-tl-sm p-3 max-w-[260px]">
        <p className="text-[#e9edef] text-sm whitespace-pre-wrap leading-relaxed">{text}</p>
        <div className="text-[#8696a0] text-[10px] text-right mt-1.5">
          {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} ✓✓
        </div>
      </div>
    </div>
  )
}

/* ── variable chip ───────────────────────────────────────── */
function VarChip({ label, value, onInsert }) {
  return (
    <button onClick={() => onInsert(value)}
      className="inline-flex items-center gap-1 text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200 px-2 py-1 rounded-full hover:bg-orange-100 transition-colors">
      <Plus className="w-3 h-3" /> {label}
    </button>
  )
}

/* ── product search result row ───────────────────────────── */
function ProductRow({ p, onAdd }) {
  return (
    <button onClick={() => onAdd(p)}
      className="w-full flex items-center justify-between px-3 py-2 hover:bg-orange-50 text-left transition-colors border-b border-gray-100 last:border-0">
      <div>
        <div className="text-sm font-semibold text-gray-800 truncate max-w-[200px]">{p.name}</div>
        <div className="text-xs text-gray-400 font-mono">{p.sku}</div>
      </div>
      <span className="text-sm font-black text-orange-600 flex-shrink-0">{BRL.format(p.price)}</span>
    </button>
  )
}

/* ══════════════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════════════ */
export default function Campanhas() {
  const { products, customers, sales, promos } = useStore()
  const instance = getConfiguredStoreId() || 'zatendestok'

  // bot connection status
  const [botStatus, setBotStatus] = useState(null) // null | 'open' | 'connecting'
  useEffect(() => {
    fetch(`/api/wa-status?instance=${instance}`)
      .then(r => r.json())
      .then(d => setBotStatus(d.exists ? d.status : 'disconnected'))
      .catch(() => setBotStatus('disconnected'))
  }, [instance])
  const botConnected = botStatus === 'open'

  // tabs: 'contatos' | 'grupo' | 'lista'
  const [activeTab, setActiveTab] = useState('contatos')

  // message template
  const [template, setTemplate] = useState(
    'Olá {{nome}}! 👋\n\nTemos ofertas imperdíveis hoje no *{{loja}}*!\n\n'
  )
  const [productSearch, setProductSearch] = useState('')
  const [showSearch, setShowSearch]       = useState(false)

  // audience
  const [audience, setAudience] = useState('phone') // 'all' | 'phone' | 'fiado'
  const [previewIdx, setPreviewIdx] = useState(0)

  // send state
  const [sending, setSending]         = useState(false)
  const [sendProgress, setSendProgress] = useState({ done: 0, total: 0, pausing: false, pauseSec: 0 })
  const [results, setResults]         = useState(null) // { ok, fail }
  const [copied, setCopied]           = useState(false)
  const [copiedMsg, setCopiedMsg]     = useState(false)
  const abortRef = useRef(false)

  // local wa.me sequential dispatch
  const [localMode, setLocalMode]   = useState(false)
  const [localIdx,  setLocalIdx]    = useState(0)

  // importação CSV/TXT de contatos externos
  const [importedContacts, setImportedContacts] = useState([])  // [{name, phone}]
  const [useImported, setUseImported]           = useState(false)
  const [importError, setImportError]           = useState(null)
  const fileRef = useRef(null)

  const parseContactFile = useCallback((file) => {
    if (!file) return
    setImportError(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target.result
        const lines = text.split(/\r?\n/).filter(l => l.trim())
        const contacts = []
        for (const line of lines) {
          // Aceita vírgula ou ponto-e-vírgula como separador
          const cols = line.split(/[,;|\t]/).map(s => s.trim().replace(/^["']|["']$/g, ''))
          if (!cols.length) continue
          // Se 2+ colunas: tenta nome,telefone ou telefone,nome
          let name = '', phone = ''
          if (cols.length >= 2) {
            const a = cols[0], b = cols[1]
            // Se a parece telefone (só dígitos), inverte
            if (/^\+?[\d\s()-]{7,}$/.test(a) && !/^\+?[\d\s()-]{7,}$/.test(b)) {
              phone = a; name = b
            } else {
              name = a; phone = b
            }
          } else {
            phone = cols[0]; name = ''
          }
          // Pula headers
          if (/^(nome|name|telefone|phone|cel|celular|numero|número)$/i.test(phone.replace(/\D/g,''))) continue
          const digits = phone.replace(/\D/g, '').replace(/^0/, '')
          if (digits.length < 8) continue
          contacts.push({ name: name || 'Contato', phone: digits.slice(-11) })
        }
        if (!contacts.length) { setImportError('Nenhum contato válido encontrado no arquivo.'); return }
        setImportedContacts(contacts)
        setUseImported(true)
        setImportError(null)
      } catch { setImportError('Erro ao ler o arquivo. Use CSV com colunas: nome,telefone') }
    }
    reader.readAsText(file, 'utf-8')
  }, [])

  // grupos do zap
  const [groups, setGroups]           = useState([])
  const [fetchingGroups, setFetchingGroups] = useState(false)
  const [groupsError, setGroupsError] = useState(null)
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [sendingGroup, setSendingGroup]   = useState(false)
  const [groupResult, setGroupResult]     = useState(null)

  /* ── active promos (from store — created in Validade page) ── */
  const activePromos = useMemo(() =>
    (promos || []).filter(p => p.active !== false).slice(0, 6)
  , [promos])

  /* load a promo as campaign template */
  const loadPromo = useCallback((promo) => {
    const lines = [
      '🚨 *OFERTA ANTIVENCIMENTO — {{loja}}*',
      '',
      promo.name ? `*${promo.name}*` : '',
      promo.totalPrice ? `💰 por apenas ${BRL.format(promo.totalPrice)}` : '',
      '⚡ Quantidade limitada! Corre antes que acabe.',
      '',
      '📍 Venha já ou fale com a gente! — {{data}}',
    ].filter(Boolean).join('\n')
    setTemplate(lines)
    setShowSearch(false)
  }, [])

  /* ── audience list ── */
  const fiados = useMemo(() => {
    const map = {}
    sales.forEach(s => s.items?.forEach(it => {
      if (!it.fiado) return
      if (!map[it.customerId]) map[it.customerId] = 0
      map[it.customerId] += it.price * it.qty
    }))
    return map
  }, [sales])

  const audienceList = useMemo(() => {
    if (useImported && importedContacts.length > 0) {
      return importedContacts.map((c, i) => ({ id: `imp_${i}`, name: c.name, phone: c.phone, saldo: 0 }))
    }
    let list = customers
    if (audience === 'phone') list = list.filter(hasPhone)
    if (audience === 'fiado') list = list.filter(c => hasPhone(c) && fiados[c.id])
    return list.map(c => ({ ...c, saldo: fiados[c.id] || 0 }))
  }, [customers, audience, fiados, useImported, importedContacts])

  /* ── product search results ── */
  const prodResults = useMemo(() => {
    if (!productSearch.trim()) return []
    const q = productSearch.toLowerCase()
    return products.filter(p => p.name?.toLowerCase().includes(q)).slice(0, 8)
  }, [products, productSearch])

  /* ── insert at cursor / append ── */
  const insertAtEnd = useCallback((text) => {
    setTemplate(prev => prev + text)
  }, [])

  const insertVar = useCallback((v) => {
    setTemplate(prev => prev + v)
  }, [])

  const addProduct = useCallback((p) => {
    const block = `\n*${p.name}*\n💰 ${BRL.format(p.price)}${p.promo ? `\n🏷️ ${p.promo}` : ''}\n`
    insertAtEnd(block)
    setProductSearch('')
    setShowSearch(false)
  }, [insertAtEnd])

  /* ── preview ── */
  const previewCustomer = audienceList[previewIdx] || { name: 'Cliente', saldo: 0 }
  const previewText = renderMsg(template, previewCustomer)

  /* ── copy numbers ── */
  const copyNumbers = () => {
    const nums = audienceList.filter(hasPhone).map(c => cleanPhone(c.phone)).join('\n')
    navigator.clipboard.writeText(nums)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  /* ── open single wa.me ── */
  const openWaMe = (customer) => {
    const text = encodeURIComponent(renderMsg(template, customer))
    const phone = cleanPhone(customer.phone)
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank')
  }

  /* ── buscar grupos do WhatsApp via Evolution API ─────── */
  const fetchGroups = useCallback(async () => {
    if (!botConnected) { setGroupsError('Bot não conectado'); return }
    setFetchingGroups(true)
    setGroupsError(null)
    try {
      const res = await fetch(`/api/wa-groups?instance=${instance}`)
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      setGroups(data.groups)
      if (!data.groups.length) setGroupsError('Nenhum grupo encontrado. Crie ou entre em um grupo com o número do bot.')
    } catch (e) {
      setGroupsError(e.message || 'Erro ao buscar grupos')
    }
    setFetchingGroups(false)
  }, [botConnected, instance])

  /* ── enviar para grupo ───────────────────────────────── */
  const sendToGroup = useCallback(async () => {
    if (!selectedGroup) return
    setSendingGroup(true)
    setGroupResult(null)
    const text = template
      .replace(/\{\{nome\}\}/gi, 'pessoal')
      .replace(/\{\{loja\}\}/gi, instance)
      .replace(/\{\{saldo\}\}/gi, 'R$ 0,00')
      .replace(/\{\{data\}\}/gi,  new Date().toLocaleDateString('pt-BR'))
    try {
      await sendViaBot(instance, selectedGroup.jid, text)
      setGroupResult({ ok: true, name: selectedGroup.name })
    } catch (e) {
      setGroupResult({ ok: false, error: e.message })
    }
    setSendingGroup(false)
  }, [selectedGroup, template, instance])

  /* ── contador diário anti-ban ────────────────────────────── */
  const DAILY_KEY = `zs_daily_sends_${new Date().toISOString().slice(0,10)}_${instance}`
  const DAILY_LIMIT = 80

  const getDailyCount = () => {
    try { return parseInt(localStorage.getItem(DAILY_KEY) || '0', 10) } catch { return 0 }
  }
  const addDailyCount = (n) => {
    try { localStorage.setItem(DAILY_KEY, String(getDailyCount() + n)) } catch {}
  }

  const [dailyCount, setDailyCount] = useState(() => getDailyCount())
  const dailyRemaining = Math.max(0, DAILY_LIMIT - dailyCount)

  /* ── send via nosso bot com anti-ban avançado ─────────── */
  // Batch: 30 msgs → pausa 5min → repete. Delay aleatório 1.5s-4s entre msgs.
  const BATCH_SIZE = 30
  const PAUSE_SECS = 300 // 5 minutos

  const sendAll = async () => {
    if (!botConnected) {
      alert('Bot WhatsApp não conectado. Vá em Configurações → Bot WhatsApp para escanear o QR.')
      return
    }
    const list = audienceList.filter(hasPhone)
    if (!list.length) return

    const currentDaily = getDailyCount()
    if (currentDaily >= DAILY_LIMIT) {
      alert(`⚠️ Limite diário de ${DAILY_LIMIT} mensagens atingido para hoje. Aguarde amanhã para proteger seu número.`)
      return
    }
    const canSend = Math.min(list.length, DAILY_LIMIT - currentDaily)
    if (canSend < list.length) {
      const ok = confirm(`Limite diário: você pode enviar mais ${canSend} de ${list.length} mensagens hoje.\n\nEnviar para os primeiros ${canSend} contatos?`)
      if (!ok) return
    }

    setSending(true)
    setResults(null)
    abortRef.current = false
    setSendProgress({ done: 0, total: canSend, pausing: false, pauseSec: 0 })

    let ok = 0, fail = 0

    for (let i = 0; i < canSend; i++) {
      if (abortRef.current) break

      // Pausa de batch a cada BATCH_SIZE mensagens
      if (i > 0 && i % BATCH_SIZE === 0) {
        setSendProgress(p => ({ ...p, pausing: true, pauseSec: PAUSE_SECS }))
        for (let s = PAUSE_SECS; s > 0; s--) {
          if (abortRef.current) break
          setSendProgress(p => ({ ...p, pauseSec: s }))
          await new Promise(r => setTimeout(r, 1000))
        }
        setSendProgress(p => ({ ...p, pausing: false }))
        if (abortRef.current) break
      }

      const c = list[i]
      try {
        await sendViaBot(instance, cleanPhone(c.phone), renderMsg(template, c))
        ok++
      } catch {
        fail++
      }
      setSendProgress(p => ({ ...p, done: i + 1 }))
      if (i < canSend - 1) await randDelay()
    }

    addDailyCount(ok)
    setDailyCount(getDailyCount())
    setResults({ ok, fail })
    setSending(false)
    abortRef.current = false
  }

  /* open wa.me for one customer at a time (local mode) */
  const openNextWaMe = useCallback((idx) => {
    const list = audienceList.filter(hasPhone)
    if (idx >= list.length) { setLocalMode(false); setLocalIdx(0); return }
    const c = list[idx]
    window.open(`https://wa.me/${cleanPhone(c.phone)}?text=${encodeURIComponent(renderMsg(template, c))}`, '_blank')
    setLocalIdx(idx + 1)
  }, [audienceList, template])

  /* ── ImportBlock — reutilizável nos 3 tabs ───────────────── */
  const ImportBlock = (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black text-gray-900 uppercase tracking-wide">📂 Importar Contatos</h2>
        {importedContacts.length > 0 && (
          <button onClick={() => { setImportedContacts([]); setUseImported(false) }}
            className="text-xs text-red-400 hover:text-red-600 font-bold">Limpar importação</button>
        )}
      </div>
      <p className="text-xs text-gray-500">
        Importe um arquivo <strong>.csv</strong>, <strong>.txt</strong> ou planilha exportada como CSV.
        Formatos aceitos: <code className="bg-gray-100 px-1 rounded">nome,telefone</code> · <code className="bg-gray-100 px-1 rounded">nome;telefone</code> · só telefone (1 por linha)
      </p>

      {/* Download template */}
      <button onClick={() => {
        const csv = 'nome,telefone\nJoão Silva,11999990001\nMaria Santos,11988880002\n'
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
        const a = document.createElement('a'); a.href = url; a.download = 'modelo_contatos.csv'; a.click()
        URL.revokeObjectURL(url)
      }} className="text-xs text-orange-600 font-bold hover:underline flex items-center gap-1">
        ⬇ Baixar modelo CSV
      </button>

      <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" className="hidden"
        onChange={e => parseContactFile(e.target.files[0])} />

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl border-2 border-dashed border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors">
          <Plus className="w-4 h-4" /> Selecionar arquivo
        </button>
        {importedContacts.length > 0 && (
          <label className="flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl border border-gray-200 cursor-pointer">
            <input type="checkbox" checked={useImported} onChange={e => setUseImported(e.target.checked)} className="accent-orange-500" />
            Usar {importedContacts.length} contatos importados
          </label>
        )}
      </div>

      {importError && (
        <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{importError}</p>
      )}
      {importedContacts.length > 0 && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2">
          <p className="text-xs text-green-700 font-bold">✅ {importedContacts.length} contatos importados</p>
          <div className="text-[11px] text-green-600 mt-1 max-h-20 overflow-y-auto space-y-0.5">
            {importedContacts.slice(0, 5).map((c, i) => (
              <div key={i}>{c.name} · {c.phone}</div>
            ))}
            {importedContacts.length > 5 && <div>+ {importedContacts.length - 5} mais...</div>}
          </div>
        </div>
      )}
    </div>
  )

  const groupText = template
    .replace(/\{\{nome\}\}/gi, 'pessoal')
    .replace(/\{\{loja\}\}/gi, instance)
    .replace(/\{\{saldo\}\}/gi, 'R$ 0,00')
    .replace(/\{\{data\}\}/gi, new Date().toLocaleDateString('pt-BR'))

  const phoneList = audienceList.filter(hasPhone)
  const formattedNumbers = phoneList.map(c => cleanPhone(c.phone)).join('\n')

  return (
    <div className="space-y-5 animate-pop max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Campanhas WhatsApp</h1>
          <p className="text-gray-500 text-sm">Dispare ofertas para contatos, grupos ou lista de transmissão</p>
        </div>
        <div className={`flex items-center gap-2 text-sm font-bold px-3 py-2 rounded-xl border ${
          botStatus === null ? 'border-gray-200 bg-gray-50 text-gray-400'
          : botConnected ? 'border-green-300 bg-green-50 text-green-700'
          : 'border-amber-300 bg-amber-50 text-amber-700'
        }`}>
          {botConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          {botStatus === null ? 'Verificando bot...' : botConnected ? 'Bot conectado' : 'Bot desconectado'}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { id: 'contatos', label: 'Contatos individuais', icon: Users },
          { id: 'grupo',    label: 'Grupo do Zap',         icon: MessageCircle },
          { id: 'lista',    label: 'Lista de Transmissão', icon: List },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{label.split(' ')[0]}</span>
          </button>
        ))}
      </div>

      {/* ════ TAB: GRUPO DO ZAP ════════════════════════════ */}
      {activeTab === 'grupo' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Left: editor de msg */}
          <div className="lg:col-span-3 space-y-4">
            <div className="card p-4 space-y-3">
              <h2 className="text-sm font-black text-gray-900 uppercase tracking-wide">Mensagem para o Grupo</h2>
              <div className="flex flex-wrap gap-1.5">
                <VarChip label="Nome da loja" value="{{loja}}" onInsert={insertVar} />
                <VarChip label="Data" value="{{data}}" onInsert={insertVar} />
              </div>
              <textarea value={template} onChange={e => setTemplate(e.target.value)} rows={8}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 font-mono focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none leading-relaxed"
                placeholder="Mensagem para o grupo... Use {{loja}} e {{data}}" />
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Grupos têm risco menor de ban — mas evite links encurtados e palavras suspeitas. Máx. 1–2 msgs/dia por grupo.</span>
              </p>
            </div>

            {/* Buscar grupos */}
            <div className="card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-gray-900 uppercase tracking-wide">Selecionar Grupo</h2>
                <button onClick={fetchGroups} disabled={fetchingGroups || !botConnected}
                  className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-xl bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40 transition-colors">
                  {fetchingGroups ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  {fetchingGroups ? 'Buscando...' : 'Buscar meus grupos'}
                </button>
              </div>
              {!botConnected && (
                <p className="text-xs text-amber-600">Bot não conectado — conecte em Configurações primeiro.</p>
              )}
              {groupsError && (
                <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{groupsError}</p>
              )}
              {groups.length > 0 && (
                <div className="max-h-60 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100">
                  {groups.map(g => (
                    <button key={g.jid} onClick={() => setSelectedGroup(g)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-orange-50 transition-colors ${
                        selectedGroup?.jid === g.jid ? 'bg-orange-50 border-l-2 border-orange-500' : ''
                      }`}>
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 text-green-700 font-black text-xs">
                        {g.name[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-800 truncate">{g.name}</div>
                        {g.size > 0 && <div className="text-xs text-gray-400">{g.size} participantes</div>}
                      </div>
                      {selectedGroup?.jid === g.jid && <Check className="w-4 h-4 text-orange-500 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
              {groups.length === 0 && !fetchingGroups && !groupsError && botConnected && (
                <p className="text-xs text-gray-400 text-center py-4">Clique em "Buscar meus grupos" para listar os grupos do bot.</p>
              )}
            </div>

            {ImportBlock}

            {/* Ações */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { navigator.clipboard.writeText(groupText); setCopiedMsg(true); setTimeout(() => setCopiedMsg(false), 2000) }}
                className="flex items-center gap-2 btn-ghost text-sm px-4 py-2.5 rounded-xl border border-gray-200">
                {copiedMsg ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                {copiedMsg ? 'Mensagem copiada!' : 'Copiar mensagem (colar manual no grupo)'}
              </button>
              <button onClick={sendToGroup} disabled={!selectedGroup || sendingGroup || !botConnected}
                className="flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white disabled:opacity-40 transition-colors">
                {sendingGroup ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sendingGroup ? 'Enviando...' : `Enviar via bot${selectedGroup ? ` — ${selectedGroup.name}` : ''}`}
              </button>
            </div>
            {groupResult && (
              <div className={`rounded-xl px-4 py-3 text-sm font-semibold animate-pop ${
                groupResult.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {groupResult.ok ? `✅ Enviado para "${groupResult.name}" com sucesso!` : `❌ Erro: ${groupResult.error}`}
              </div>
            )}
          </div>

          {/* Right: preview */}
          <div className="lg:col-span-2 space-y-3">
            <div className="card p-4 space-y-3">
              <h2 className="text-sm font-black text-gray-900 uppercase tracking-wide">Preview no grupo</h2>
              <WaBubble text={groupText} />
            </div>
            <div className="card p-4 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 space-y-2">
              <h3 className="text-xs font-black text-green-800 uppercase tracking-wide">💡 Dicas de grupo</h3>
              {[
                '✅ Grupo é mais seguro que lista — contatos já te conhecem',
                '✅ 1–2 msgs por dia por grupo é o ideal',
                '✅ Marque produtos em oferta com * negrito *',
                '✅ Sempre coloque o nome da loja e o contato',
                '⚠️ Evite links bit.ly — use o número direto',
                '⚠️ Não envie a mesma msg várias vezes seguidas',
              ].map(t => (
                <div key={t} className="text-[11px] text-gray-600 flex items-start gap-2">
                  <span className="flex-shrink-0">{t.slice(0, 2)}</span>
                  <span>{t.slice(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ════ TAB: LISTA DE TRANSMISSÃO ════════════════════ */}
      {activeTab === 'lista' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-3 space-y-4">
            {/* Mensagem */}
            <div className="card p-4 space-y-3">
              <h2 className="text-sm font-black text-gray-900 uppercase tracking-wide">Mensagem da Lista</h2>
              <div className="flex flex-wrap gap-1.5">
                <VarChip label="Loja" value="{{loja}}" onInsert={insertVar} />
                <VarChip label="Data" value="{{data}}" onInsert={insertVar} />
              </div>
              <textarea value={template} onChange={e => setTemplate(e.target.value)} rows={8}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 font-mono focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none leading-relaxed"
                placeholder="Mensagem da lista... Em lista de transmissão não use {{nome}} pois todos recebem a mesma msg" />
            </div>

            {/* Audiência */}
            <div className="card p-4 space-y-3">
              <h2 className="text-sm font-black text-gray-900 uppercase tracking-wide">Contatos ({phoneList.length} com WhatsApp)</h2>
              <div className="space-y-2">
                {[
                  { id: 'phone', label: 'Com WhatsApp cadastrado', count: customers.filter(hasPhone).length },
                  { id: 'fiado', label: 'Com fiado em aberto', count: customers.filter(c => hasPhone(c) && fiados[c.id]).length },
                ].map(o => (
                  <label key={o.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    audience === o.id ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <input type="radio" name="aud-lista" value={o.id} checked={audience === o.id}
                      onChange={() => setAudience(o.id)} className="accent-orange-500" />
                    <span className="text-sm font-semibold text-gray-700 flex-1">{o.label}</span>
                    <span className="text-xs font-black bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{o.count}</span>
                  </label>
                ))}
              </div>
            </div>

            {ImportBlock}

            {/* Números copiáveis */}
            <div className="card p-4 space-y-3">
              <h2 className="text-sm font-black text-gray-900 uppercase tracking-wide">Números para a lista</h2>
              <div className="bg-gray-900 rounded-xl p-3 max-h-40 overflow-y-auto">
                <pre className="text-xs text-green-400 font-mono leading-loose">{formattedNumbers || '— Nenhum contato com WhatsApp —'}</pre>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { navigator.clipboard.writeText(formattedNumbers); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                  className="flex-1 flex items-center justify-center gap-2 btn-ghost text-sm px-4 py-2.5 rounded-xl border border-gray-200">
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copiado!' : `Copiar ${phoneList.length} números`}
                </button>
                <button onClick={() => { navigator.clipboard.writeText(groupText); setCopiedMsg(true); setTimeout(() => setCopiedMsg(false), 2000) }}
                  className="flex-1 flex items-center justify-center gap-2 btn-ghost text-sm px-4 py-2.5 rounded-xl border border-gray-200">
                  {copiedMsg ? <Check className="w-4 h-4 text-green-600" /> : <MessageCircle className="w-4 h-4" />}
                  {copiedMsg ? 'Mensagem copiada!' : 'Copiar mensagem'}
                </button>
              </div>
            </div>
          </div>

          {/* Right: instruções passo a passo */}
          <div className="lg:col-span-2 space-y-3">
            <div className="card p-4 space-y-4">
              <h2 className="text-sm font-black text-gray-900 uppercase tracking-wide">📋 Como usar a lista</h2>
              {[
                { n: '1', t: 'Copie os números', d: 'Clique em "Copiar números" acima — eles já estão no formato correto com DDI 55.' },
                { n: '2', t: 'Abra o WhatsApp no celular', d: 'Vá em ⋮ → Nova transmissão (Android) ou em Listas → Nova lista (iPhone).' },
                { n: '3', t: 'Adicione os contatos', d: 'Cole os números um a um ou selecione os contatos salvos. ⚠️ IMPORTANTE: os contatos precisam ter o seu número salvo para receber a msg.' },
                { n: '4', t: 'Copie e envie a mensagem', d: 'Clique em "Copiar mensagem" e cole na lista de transmissão. Pronto!' },
              ].map(({ n, t, d }) => (
                <div key={n} className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center font-black text-xs flex-shrink-0 mt-0.5">{n}</div>
                  <div>
                    <div className="text-sm font-black text-gray-800">{t}</div>
                    <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">{d}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="card p-4 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 space-y-2">
              <h3 className="text-xs font-black text-amber-800 uppercase tracking-wide">⚡ Lista de transmissão vs Grupo</h3>
              <div className="space-y-1.5 text-[11px] text-gray-600">
                <div><strong>Lista de transmissão:</strong> cada um recebe como msg individual — mais pessoal, sem expor números. Contato precisa ter você salvo.</div>
                <div><strong>Grupo:</strong> todos veem a msg e uns aos outros — mais interação, sem necessidade de estar salvo. Ideal para promoções abertas.</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════ TAB: CONTATOS INDIVIDUAIS ════════════════════ */}
      {activeTab === 'contatos' && <>

      {/* ── Promoções Prontas (de vencimento) ── */}
      {activePromos.length > 0 && (
        <div className="card p-4 border-l-4 border-red-400 bg-red-50/40 space-y-3">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-red-500" />
            <h2 className="text-sm font-black text-red-700 uppercase tracking-wide">
              Promoções Prontas para Disparar
            </h2>
            <span className="text-xs bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full">{activePromos.length}</span>
          </div>
          <p className="text-xs text-red-600">Criadas na aba Validade — clique para carregar no template e disparar</p>
          <div className="flex flex-wrap gap-2">
            {activePromos.map(promo => (
              <button key={promo.id} onClick={() => loadPromo(promo)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-red-200 bg-white hover:bg-red-50 transition-colors text-left group">
                <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                  <Flame className="w-3.5 h-3.5 text-red-500" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-black text-gray-800 truncate max-w-[180px]">{promo.name}</div>
                  {promo.totalPrice && (
                    <div className="text-[11px] text-red-600 font-bold">{BRL.format(promo.totalPrice)}</div>
                  )}
                </div>
                <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded group-hover:bg-orange-100 flex-shrink-0">
                  Carregar →
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Local dispatch overlay (no Zatende) ── */}
      {localMode && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="text-center mb-5">
              <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-3">
                <MessageCircle className="w-7 h-7 text-green-600" />
              </div>
              <h3 className="font-black text-lg text-gray-900">Disparo Local (wa.me)</h3>
              <p className="text-sm text-gray-500 mt-1">Sem servidor — abre o WhatsApp no celular</p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Progresso</span>
                <span className="font-black text-green-600">{localIdx} / {audienceList.filter(hasPhone).length}</span>
              </div>
              <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-2 bg-green-500 rounded-full transition-all"
                  style={{ width: `${audienceList.filter(hasPhone).length > 0 ? (localIdx / audienceList.filter(hasPhone).length) * 100 : 0}%` }} />
              </div>
              {localIdx < audienceList.filter(hasPhone).length && (
                <div className="text-xs text-gray-500 mt-2 text-center">
                  Próximo: <strong>{audienceList.filter(hasPhone)[localIdx]?.name}</strong>
                </div>
              )}
            </div>

            {localIdx < audienceList.filter(hasPhone).length ? (
              <button onClick={() => openNextWaMe(localIdx)}
                className="w-full py-3.5 rounded-xl font-black text-white text-base flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg,#25d366,#128c7e)' }}>
                <ExternalLink className="w-5 h-5" />
                Abrir WhatsApp #{localIdx + 1} — {audienceList.filter(hasPhone)[localIdx]?.name}
              </button>
            ) : (
              <div className="text-center">
                <div className="text-green-600 font-black text-lg mb-3">✅ Todos enviados!</div>
                <button onClick={() => { setLocalMode(false); setLocalIdx(0) }}
                  className="btn-ghost w-full">Fechar</button>
              </div>
            )}
            <button onClick={() => { setLocalMode(false); setLocalIdx(0) }}
              className="w-full mt-2 text-sm text-gray-400 hover:text-gray-600 transition-colors py-2">
              Cancelar disparo
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* ── Left: editor ── */}
        <div className="lg:col-span-3 space-y-4">

          {/* Message template */}
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-gray-900 uppercase tracking-wide">1. Mensagem</h2>
              <span className="text-xs text-gray-400">{template.length} chars</span>
            </div>

            {/* Variable chips */}
            <div className="flex flex-wrap gap-1.5">
              <VarChip label="Nome" value="{{nome}}" onInsert={insertVar} />
              <VarChip label="Loja" value="{{loja}}" onInsert={insertVar} />
              <VarChip label="Saldo fiado" value="{{saldo}}" onInsert={insertVar} />
              <VarChip label="Data" value="{{data}}" onInsert={insertVar} />
            </div>

            {/* Text area */}
            <textarea
              value={template}
              onChange={e => setTemplate(e.target.value)}
              rows={8}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 font-mono focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none leading-relaxed"
              placeholder="Digite sua mensagem... Use {{nome}} para personalizar"
            />

            {/* Add product block */}
            <div>
              <button onClick={() => setShowSearch(v => !v)}
                className="flex items-center gap-2 text-xs font-bold text-orange-600 hover:text-orange-700 transition-colors">
                <Plus className="w-3.5 h-3.5" />
                {showSearch ? 'Fechar busca de produto' : 'Adicionar produto na mensagem'}
              </button>

              {showSearch && (
                <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input value={productSearch} onChange={e => setProductSearch(e.target.value)} autoFocus
                      className="w-full pl-9 pr-4 py-2.5 text-sm border-b border-gray-100 focus:outline-none"
                      placeholder="Buscar produto para incluir na mensagem…" />
                  </div>
                  {prodResults.length > 0
                    ? prodResults.map(p => <ProductRow key={p.id} p={p} onAdd={addProduct} />)
                    : productSearch && <p className="text-xs text-gray-400 p-3 text-center">Nenhum resultado</p>
                  }
                </div>
              )}
            </div>
          </div>

          {/* Audience */}
          <div className="card p-4 space-y-3">
            <h2 className="text-sm font-black text-gray-900 uppercase tracking-wide">2. Destinatários</h2>
            <div className="space-y-2">
              {[
                { id: 'phone', label: 'Com WhatsApp cadastrado', count: customers.filter(hasPhone).length },
                { id: 'fiado', label: 'Com fiado em aberto + WhatsApp', count: customers.filter(c => hasPhone(c) && fiados[c.id]).length },
                { id: 'all',   label: 'Todos os clientes (inclui sem tel.)', count: customers.length },
              ].map(o => (
                <label key={o.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  audience === o.id ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <input type="radio" name="audience" value={o.id} checked={audience === o.id}
                    onChange={() => setAudience(o.id)} className="accent-orange-500" />
                  <span className="text-sm font-semibold text-gray-700 flex-1">{o.label}</span>
                  <span className="text-xs font-black bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{o.count}</span>
                </label>
              ))}
            </div>

            {/* Audience table */}
            {audienceList.length > 0 && (
              <div className="mt-3 rounded-xl border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-3 py-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-600">{audienceList.length} contatos selecionados</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400">Prévia:</span>
                    {audienceList.map((_, i) => (
                      <button key={i} onClick={() => setPreviewIdx(i)}
                        className={`w-5 h-5 rounded-full text-[9px] font-black transition-colors ${
                          previewIdx === i ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        }`}>{i + 1}</button>
                    )).slice(0, 5)}
                    {audienceList.length > 5 && <span className="text-[10px] text-gray-400">+{audienceList.length - 5}</span>}
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto divide-y divide-gray-100">
                  {audienceList.map((c, i) => (
                    <div key={c.id} className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors cursor-pointer ${
                      previewIdx === i ? 'bg-orange-50' : 'hover:bg-gray-50'
                    }`} onClick={() => setPreviewIdx(i)}>
                      <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-black text-xs flex-shrink-0">
                        {c.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-800 truncate">{c.name}</div>
                        <div className="text-xs text-gray-400">{c.phone || 'Sem telefone'}</div>
                      </div>
                      {hasPhone(c) && (
                        <button onClick={e => { e.stopPropagation(); openWaMe(c) }}
                          className="flex-shrink-0 p-1.5 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors"
                          title="Abrir WhatsApp">
                          <Phone className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {ImportBlock}

          {/* Contador diário anti-ban */}
          <div className={`rounded-xl px-4 py-2.5 flex items-center justify-between text-xs border ${
            dailyRemaining <= 10 ? 'bg-red-50 border-red-200 text-red-700'
            : dailyRemaining <= 30 ? 'bg-amber-50 border-amber-200 text-amber-700'
            : 'bg-gray-50 border-gray-200 text-gray-600'
          }`}>
            <span className="font-bold">
              {dailyRemaining <= 0 ? '🚫 Limite diário atingido'
               : `📊 Enviadas hoje: ${dailyCount}/${DAILY_LIMIT}`}
            </span>
            <span>{dailyRemaining > 0 ? `${dailyRemaining} restantes` : 'Reinicia amanhã'}</span>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button onClick={copyNumbers}
              className="flex items-center gap-2 btn-ghost text-sm justify-center px-3 py-2 rounded-xl border border-gray-200">
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copiado!' : 'Copiar números'}
            </button>

            {/* Manual — wa.me 1 por vez */}
            <button
              onClick={() => { setLocalIdx(0); setLocalMode(true) }}
              disabled={!audienceList.filter(hasPhone).length}
              className="flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl transition-colors justify-center text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#25d366,#128c7e)' }}>
              <MessageCircle className="w-4 h-4" />
              Enviar um a um ({audienceList.filter(hasPhone).length})
            </button>

            {/* Automático — via nosso bot */}
            {!sending ? (
              <button
                onClick={sendAll}
                disabled={!audienceList.filter(hasPhone).length || !botConnected}
                title={!botConnected ? 'Bot não conectado — vá em Configurações para escanear o QR' : ''}
                className={`flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl transition-colors justify-center
                  ${botConnected
                    ? 'bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                <Bot className="w-4 h-4" /> Disparar via Bot ({audienceList.filter(hasPhone).length})
              </button>
            ) : (
              <button onClick={() => { abortRef.current = true }}
                className="flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl bg-red-100 text-red-600 hover:bg-red-200 transition-colors">
                <span className="w-4 h-4 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
                Parar disparo
              </button>
            )}
          </div>

          {/* Progresso de envio */}
          {sending && (
            <div className="card p-4 space-y-3">
              {sendProgress.pausing ? (
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm font-bold text-amber-700">⏸ Pausa anti-ban — {Math.floor(sendProgress.pauseSec / 60)}:{String(sendProgress.pauseSec % 60).padStart(2,'0')} restantes</div>
                    <div className="text-xs text-gray-500">Aguardando para retomar o lote. Isso protege seu número de ban.</div>
                  </div>
                </div>
              ) : (
                <div className="text-sm font-semibold text-gray-700">
                  🚀 Disparando... {sendProgress.done}/{sendProgress.total}
                  <span className="text-xs text-gray-400 ml-2">· delay aleatório 1.5–4s entre msgs</span>
                </div>
              )}
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-2 bg-orange-500 rounded-full transition-all"
                  style={{ width: `${sendProgress.total > 0 ? (sendProgress.done / sendProgress.total) * 100 : 0}%` }} />
              </div>
              <div className="text-xs text-gray-500">
                Lote {Math.floor(sendProgress.done / 30) + 1} · Próxima pausa após {30 - (sendProgress.done % 30)} msgs
              </div>
            </div>
          )}

          {/* Result banner */}
          {results && !sending && (
            <div className={`rounded-xl px-4 py-3 text-sm font-semibold animate-pop ${
              results.fail === 0 ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              ✓ {results.ok} enviadas · {results.fail > 0 ? `⚠ ${results.fail} falharam` : 'Todas com sucesso! 🎉'}
            </div>
          )}
        </div>

        {/* ── Right: preview ── */}
        <div className="lg:col-span-2 space-y-3">
          <div className="card p-4 space-y-3">
            <h2 className="text-sm font-black text-gray-900 uppercase tracking-wide">Preview</h2>
            <p className="text-xs text-gray-400">
              Prévia para: <span className="font-bold text-gray-600">{previewCustomer.name}</span>
            </p>
            <WaBubble text={previewText} />
          </div>

          {/* Tips */}
          <div className="card p-4 space-y-2">
            <h3 className="text-xs font-black text-gray-700 uppercase tracking-wide">Como usar</h3>
            <div className="space-y-1.5 text-xs text-gray-500">
              <div className="flex items-start gap-2"><span className="text-orange-500 font-bold flex-shrink-0">1.</span>Escreva a mensagem com variáveis (ex: <code className="bg-orange-50 text-orange-700 px-1 rounded">{'{{nome}}'}</code>)</div>
              <div className="flex items-start gap-2"><span className="text-orange-500 font-bold flex-shrink-0">2.</span>Adicione produtos com o preço para mostrar as ofertas</div>
              <div className="flex items-start gap-2"><span className="text-orange-500 font-bold flex-shrink-0">3.</span>Selecione quem vai receber</div>
              <div className="flex items-start gap-2"><span className="text-orange-500 font-bold flex-shrink-0">4.</span><span><b>Disparar via Bot</b> — envia automático (bot precisa estar conectado em Configurações) · ou <b>Enviar um a um</b> para abrir o WhatsApp manualmente</span></div>
            </div>
          </div>

          {/* Tráfego pago tip */}
          <div className="card p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <h3 className="text-xs font-black text-blue-800 uppercase tracking-wide mb-2">💡 Tráfego Pago</h3>
            <p className="text-xs text-blue-700 leading-relaxed">
              Para rodar anúncios que caem no WhatsApp, use o link direto da sua loja:
            </p>
            <div className="mt-2 bg-white rounded-lg px-2.5 py-1.5 border border-blue-200 flex items-center justify-between gap-2">
              <code className="text-xs text-blue-600 font-mono truncate">
                wa.me/55{customers[0]?.phone?.replace(/\D/g,'') || '15999660407'}
              </code>
              <button onClick={() => {
                const num = '55' + (customers[0]?.phone || '(15)99660-4075').replace(/\D/g,'')
                navigator.clipboard.writeText(`https://wa.me/${num}`)
                setCopied(true); setTimeout(() => setCopied(false), 2000)
              }} className="text-blue-500 hover:text-blue-700">
                <Copy className="w-3.5 h-3.5 flex-shrink-0" />
              </button>
            </div>
            <p className="text-[10px] text-blue-500 mt-1.5">Cole no Meta Ads como URL de destino do anúncio</p>
          </div>

          {/* ── Anti-ban tips ── */}
          <div className="card p-4 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 space-y-2">
            <h3 className="text-xs font-black text-amber-800 uppercase tracking-wide">⚡ Regras Anti-Ban</h3>
            <div className="space-y-1">
              {[
                ['✅','Delay aleatório 1.5–4s entre mensagens (automático)'],
                ['✅','Pausa automática de 5 min a cada 30 msgs enviadas'],
                ['✅','Máx. 80–100 mensagens por número por dia'],
                ['✅','Varie sempre com {{nome}}, {{saldo}}, {{data}} — mensagem idêntica = ban'],
                ['✅','Envie só para quem te conhece — clientes reais da sua loja'],
                ['⚠️','Use número dedicado para disparos — nunca o pessoal'],
                ['⚠️','Não dispare todos os dias — 2–3x por semana é o ideal'],
                ['❌','Nunca dispare para lista comprada — ban imediato garantido'],
              ].map(([icon, tip]) => (
                <div key={tip} className="flex items-start gap-2 text-[11px] text-gray-600">
                  <span className="flex-shrink-0 font-bold">{icon}</span>
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      </> }
    </div>
  )
}
