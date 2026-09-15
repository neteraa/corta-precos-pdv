import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, RefreshCw, UserX } from 'lucide-react'
import { loginAsOperator, getConfiguredStoreId } from '../utils/auth.js'

const PIN_KEYS = ['1','2','3','4','5','6','7','8','9','⌫','0','✓']
const COLORS   = ['#f97316','#22c55e','#8b5cf6','#06b6d4','#f59e0b','#ec4899','#10b981','#3b82f6']

export default function CaixaLogin() {
  const navigate = useNavigate()

  const [operators, setOperators] = useState([])
  const [status,    setStatus]    = useState('loading') // loading | ok | empty | error
  const [selected,  setSelected]  = useState(null)
  const [pin,       setPin]       = useState('')
  const [pinErr,    setPinErr]    = useState(false)

  const fetchOperators = useCallback(async () => {
    setStatus('loading')
    setSelected(null)
    setPin('')

    const storeId  = getConfiguredStoreId()
    const localRaw = localStorage.getItem(`mkt:${storeId}:cp_operators`)
                  ?? localStorage.getItem('cp_operators')
    const localOps = localRaw ? JSON.parse(localRaw).filter(o => o.active !== false) : []

    try {
      const res  = await fetch(`/api/restore?storeId=${storeId}`)
      const json = await res.json()
      if (!json.ok) throw new Error('server error')

      const serverOps = json.data?.cp_operators
        ? JSON.parse(json.data.cp_operators).filter(o => o.active !== false)
        : []

      // Server has data → use it and update local cache
      if (serverOps.length) {
        try { localStorage.setItem(`mkt:${storeId}:cp_operators`, json.data.cp_operators) } catch {}
        setOperators(serverOps)
        setStatus('ok')
        return
      }
    } catch { /* fall through to localStorage */ }

    // Use localStorage (same device as admin, server not synced yet)
    setOperators(localOps)
    setStatus(localOps.length ? 'ok' : 'empty')
  }, [])

  useEffect(() => { fetchOperators() }, [fetchOperators])

  const handlePin = (k) => {
    if (!selected) return
    if (k === '⌫') { setPin(p => p.slice(0, -1)); setPinErr(false); return }
    if (k === '✓')  { confirmPin(); return }
    if (pin.length < 6) setPin(p => p + k)
  }

  const confirmPin = () => {
    if (!selected) return
    if (!selected.pin || pin === selected.pin) {
      loginAsOperator(selected)
      navigate(selected.role === 'caixa' ? '/pdv' : '/dashboard', { replace: true })
    } else {
      setPinErr(true)
      setTimeout(() => { setPinErr(false); setPin('') }, 600)
    }
  }

  // Auto-confirm when PIN length matches
  useEffect(() => {
    if (selected?.pin && pin.length === selected.pin.length && pin.length >= 4) {
      confirmPin()
    }
  }, [pin]) // eslint-disable-line

  /* ── Loading ─────────────────────────────────────────── */
  if (status === 'loading') return (
    <div className="min-h-dvh bg-gray-950 flex flex-col items-center justify-center gap-4 text-gray-400">
      <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
      <span className="text-sm">Carregando operadores…</span>
    </div>
  )

  /* ── Error / Empty ───────────────────────────────────── */
  if (status === 'empty' || status === 'error') return (
    <div className="min-h-dvh bg-gray-950 flex flex-col items-center justify-center gap-6 p-6 text-center">
      <UserX className="w-14 h-14 text-gray-600" />
      <div>
        <p className="text-white font-bold text-lg mb-1">
          {status === 'error' ? 'Sem conexão com o servidor' : 'Nenhum operador cadastrado'}
        </p>
        <p className="text-gray-500 text-sm">
          {status === 'error'
            ? 'Verifique a internet e tente novamente.'
            : 'Peça para o admin cadastrar os operadores em Configurações.'}
        </p>
      </div>
      <button onClick={fetchOperators}
        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold transition-colors">
        <RefreshCw className="w-4 h-4" /> Tentar novamente
      </button>
    </div>
  )

  /* ── PIN pad (operator selected) ─────────────────────── */
  if (selected) {
    const color = COLORS[operators.indexOf(selected) % COLORS.length]
    return (
      <div className="min-h-dvh bg-gray-950 flex flex-col items-center justify-center p-6">
        {/* Avatar */}
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl font-black mb-3"
          style={{ background: color + '22', border: `3px solid ${color}`, color }}>
          {selected.name[0].toUpperCase()}
        </div>
        <p className="text-white font-black text-xl mb-1">{selected.name}</p>
        <p className="text-gray-500 text-sm mb-8">
          {selected.role === 'admin' ? 'Admin' : selected.role === 'gerente' ? 'Gerente' : 'Caixa'} · Terminal {selected.terminalId ?? 1}
        </p>

        {/* PIN dots */}
        <div className={`flex gap-3 mb-6 transition-all ${pinErr ? 'animate-shake' : ''}`}>
          {Array.from({ length: Math.max(selected.pin?.length || 4, pin.length || 1) }).map((_, i) => (
            <div key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all ${
                i < pin.length
                  ? pinErr ? 'bg-red-500 border-red-500' : 'border-transparent'
                  : 'border-gray-600 bg-transparent'
              }`}
              style={i < pin.length && !pinErr ? { background: color, borderColor: color } : {}}
            />
          ))}
        </div>

        {/* PIN pad */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-[260px] mb-6">
          {PIN_KEYS.map(k => (
            <button key={k} onClick={() => handlePin(k)}
              className={`h-16 rounded-2xl text-xl font-black transition-all active:scale-95 ${
                k === '✓'
                  ? 'text-white'
                  : k === '⌫'
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  : 'bg-gray-800 text-white hover:bg-gray-700'
              }`}
              style={k === '✓' ? { background: color } : {}}>
              {k}
            </button>
          ))}
        </div>

        <button onClick={() => { setSelected(null); setPin(''); setPinErr(false) }}
          className="text-gray-500 text-sm hover:text-gray-300 transition-colors">
          ← Trocar operador
        </button>
      </div>
    )
  }

  /* ── Operator tiles ───────────────────────────────────── */
  return (
    <div className="min-h-dvh bg-gray-950 flex flex-col items-center justify-start p-6 pt-12">
      <p className="text-gray-400 text-sm font-semibold uppercase tracking-widest mb-8">
        Quem vai usar o caixa?
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full max-w-sm sm:max-w-lg mb-10">
        {operators.map((op, i) => {
          const color = COLORS[i % COLORS.length]
          return (
            <button key={op.id} onClick={() => { setSelected(op); setPin('') }}
              className="flex flex-col items-center gap-3 p-5 rounded-2xl bg-gray-800/60 border border-gray-700 hover:border-orange-500/50 hover:bg-gray-800 transition-all active:scale-95">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-black"
                style={{ background: color + '22', border: `2px solid ${color}`, color }}>
                {op.name[0].toUpperCase()}
              </div>
              <div className="text-center">
                <p className="text-white font-bold text-sm leading-tight">{op.name}</p>
                <p className="text-gray-500 text-xs mt-0.5">
                  {op.role === 'caixa' ? '🟢 Caixa' : op.role === 'gerente' ? '🔵 Gerente' : '🔴 Admin'}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      <button onClick={fetchOperators}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-400 text-xs transition-colors">
        <RefreshCw className="w-3 h-3" /> Atualizar lista
      </button>
    </div>
  )
}
