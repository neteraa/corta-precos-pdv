import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Loader2, RefreshCw, UserX, Store } from 'lucide-react'
import { loginAsOperator, getConfiguredStoreId } from '../utils/auth.js'
import { getMktStoreToken } from '../utils/tenantStorage.js'

const PIN_KEYS = ['1','2','3','4','5','6','7','8','9','⌫','0','✓']
const COLORS   = ['#f97316','#22c55e','#8b5cf6','#06b6d4','#f59e0b','#ec4899','#10b981','#3b82f6']

export default function CaixaLogin() {
  const navigate        = useNavigate()
  const { storeId: sid } = useParams()
  const [searchParams]  = useSearchParams()
  // storeId: from URL param (e.g. /caixa/cortaprecos) → isolates the market
  // fallback: device-configured storeId (for /caixa without param)
  const storeId = sid || getConfiguredStoreId()

  // Patch token from URL (?t=) into session synchronously (before loadOperators runs)
  // so getMktStoreToken() returns the correct value when the restore call fires.
  const tok = searchParams.get('t')
  if (tok) {
    try {
      const s = JSON.parse(localStorage.getItem('cp_session') || '{}')
      if (s.storeToken !== tok) {
        localStorage.setItem('cp_session', JSON.stringify({ ...s, storeId: storeId, storeToken: tok }))
      }
    } catch {}
  }

  const [operators,  setOperators]  = useState([])
  const [storeName,  setStoreName]  = useState('')
  const [status,     setStatus]     = useState('loading') // loading | ok | empty | error
  const [selected,   setSelected]   = useState(null)
  const [pin,        setPin]        = useState('')
  const [pinErr,     setPinErr]     = useState(false)

  const fetchOperators = useCallback(async () => {
    setStatus('loading')
    setSelected(null)
    setPin('')

    // Local cache (works when same device as admin)
    const localRaw = localStorage.getItem(`mkt:${storeId}:cp_operators`)
    const localOps = localRaw ? JSON.parse(localRaw).filter(o => o.active !== false) : []

    try {
      const token = getMktStoreToken()
      const res  = await fetch(`/api/restore?storeId=${storeId}`, { headers: { 'x-zs-token': token } })
      const json = await res.json()
      if (!json.ok) throw new Error('server error')

      // Store name
      if (json.data?.cp_store_name) setStoreName(json.data.cp_store_name)

      const serverOps = json.data?.cp_operators
        ? JSON.parse(json.data.cp_operators).filter(o => o.active !== false)
        : []

      if (serverOps.length) {
        try { localStorage.setItem(`mkt:${storeId}:cp_operators`, json.data.cp_operators) } catch {}
        setOperators(serverOps)
        setStatus('ok')
        return
      }
    } catch { /* fall through to local */ }

    setOperators(localOps)
    setStatus(localOps.length ? 'ok' : 'empty')
  }, [storeId])

  useEffect(() => { fetchOperators() }, [fetchOperators])

  // Auto-select if only 1 active operator (skip selection screen)
  useEffect(() => {
    if (operators.length === 1 && !selected) {
      const op = operators[0]
      if (!op.pin) {
        loginAsOperator(op)
        navigate(op.role === 'caixa' ? '/terminal' : '/dashboard', { replace: true })
      } else {
        setSelected(op)
      }
    }
  }, [operators]) // eslint-disable-line

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
      navigate(selected.role === 'caixa' ? '/terminal' : '/dashboard', { replace: true })
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

  const MarketHeader = () => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
      <div style={{ width: 64, height: 64, borderRadius: 18, background: 'rgba(249,115,22,.12)', border: '2px solid rgba(249,115,22,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
        <Store style={{ width: 30, height: 30, color: '#f97316' }} />
      </div>
      {storeName
        ? <p style={{ color: '#f1f5f9', fontWeight: 900, fontSize: 20 }}>{storeName}</p>
        : <p style={{ color: '#475569', fontFamily: 'monospace', fontSize: 13 }}>{storeId}</p>
      }
      <p style={{ color: '#334155', fontSize: 11, marginTop: 4, textTransform: 'uppercase', letterSpacing: '.1em' }}>Terminal de Caixa</p>
    </div>
  )

  const BG = { minHeight: '100dvh', background: '#04080f', position: 'relative', overflow: 'hidden' }
  const GLOW = { position: 'fixed', inset: 0, background: 'radial-gradient(ellipse at 50% 110%, rgba(249,115,22,.15) 0%, transparent 65%)', pointerEvents: 'none' }

  /* ── Loading ─────────────────────────────────────────── */
  if (status === 'loading') return (
    <div style={{ ...BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={GLOW} />
      <Loader2 className="w-10 h-10 animate-spin text-orange-500" style={{ position: 'relative' }} />
      <span style={{ color: '#475569', fontSize: 14 }}>Carregando operadores…</span>
    </div>
  )

  /* ── Error / Empty ───────────────────────────────────── */
  if (status === 'empty' || status === 'error') return (
    <div style={{ ...BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 32, textAlign: 'center' }}>
      <div style={GLOW} />
      <div style={{ position: 'relative' }}><MarketHeader /></div>
      <UserX style={{ color: '#1e2a3a', width: 56, height: 56 }} />
      <div>
        <p style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 18, marginBottom: 6 }}>
          {status === 'error' ? 'Sem conexão com o servidor' : 'Nenhum operador cadastrado'}
        </p>
        <p style={{ color: '#475569', fontSize: 14 }}>
          {status === 'error' ? 'Verifique a internet e tente novamente.' : 'Peça para o admin cadastrar os operadores em Configurações.'}
        </p>
      </div>
      <button onClick={fetchOperators}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 14, background: 'linear-gradient(135deg,#f97316,#ea580c)', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer', boxShadow: '0 6px 20px rgba(249,115,22,.3)' }}>
        <RefreshCw className="w-4 h-4" /> Tentar novamente
      </button>
    </div>
  )

  /* ── PIN pad (operator selected) ─────────────────────── */
  if (selected) {
    const color = COLORS[operators.indexOf(selected) % COLORS.length]
    return (
      <div style={{ ...BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={GLOW} />
        <div style={{ position: 'relative', width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <MarketHeader />

          {/* Avatar */}
          <div style={{ width: 88, height: 88, borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38, fontWeight: 900, marginBottom: 12, background: color + '22', border: `3px solid ${color}`, color }}>
            {selected.name[0].toUpperCase()}
          </div>
          <p style={{ color: '#f1f5f9', fontWeight: 900, fontSize: 22, marginBottom: 4 }}>{selected.name}</p>
          <p style={{ color: '#475569', fontSize: 13, marginBottom: 32 }}>
            {selected.role === 'admin' ? '🔴 Admin' : selected.role === 'gerente' ? '🔵 Gerente' : '🟢 Caixa'} · Terminal {selected.terminalId ?? 1}
          </p>

          {/* PIN dots */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 8 }}>
            {Array.from({ length: Math.max(selected.pin?.length || 4, pin.length || 1) }).map((_, i) => (
              <div key={i} style={{
                width: 18, height: 18, borderRadius: '50%', transition: 'all .15s',
                background: i < pin.length ? (pinErr ? '#ef4444' : color) : 'transparent',
                border: `2px solid ${i < pin.length ? (pinErr ? '#ef4444' : color) : '#2d3f5c'}`,
              }} />
            ))}
          </div>
          {pinErr && <p style={{ color: '#f87171', fontWeight: 700, fontSize: 13, marginBottom: 8 }}>PIN incorreto — tente novamente</p>}
          {!selected.pin && <p style={{ color: '#475569', fontSize: 12, marginBottom: 8 }}>Sem PIN configurado — pressione ✓</p>}

          {/* PIN pad */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, width: '100%', maxWidth: 300, marginTop: 16, marginBottom: 24 }}>
            {PIN_KEYS.map(k => (
              <button key={k} onClick={() => handlePin(k)}
                onPointerDown={e => { e.currentTarget.style.transform = 'scale(.92)'; e.currentTarget.style.opacity = '.7' }}
                onPointerUp={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.opacity = '' }}
                onPointerLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.opacity = '' }}
                style={{
                  height: 72, borderRadius: 18, border: 'none', cursor: 'pointer', fontSize: k === '⌫' ? 22 : 26, fontWeight: 900,
                  background: k === '✓' ? color : k === '⌫' ? '#131f30' : '#0e1928',
                  color: k === '✓' ? '#fff' : '#cbd5e1',
                  outline: k !== '✓' ? '1px solid #1a2740' : 'none',
                  boxShadow: k === '✓' ? `0 6px 20px ${color}55` : 'none',
                  transition: 'transform .08s, opacity .08s',
                }}>
                {k}
              </button>
            ))}
          </div>

          <button onClick={() => { setSelected(null); setPin(''); setPinErr(false) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#334155', fontSize: 13, fontWeight: 600 }}>
            ← Trocar operador
          </button>
        </div>
      </div>
    )
  }

  /* ── Operator tiles ───────────────────────────────────── */
  return (
    <div style={{ ...BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '40px 20px 32px' }}>
      <div style={GLOW} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 480 }}>
        <MarketHeader />

        <p style={{ color: '#475569', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', textAlign: 'center', marginBottom: 24 }}>
          Quem vai usar o caixa?
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: operators.length <= 2 ? 'repeat(2,1fr)' : operators.length >= 5 ? 'repeat(3,1fr)' : 'repeat(2,1fr)',
          gap: 14,
          marginBottom: 32,
        }}>
          {operators.map((op, i) => {
            const color = COLORS[i % COLORS.length]
            return (
              <button key={op.id} onClick={() => { setSelected(op); setPin('') }}
                onPointerEnter={e => { e.currentTarget.style.borderColor = color + '66'; e.currentTarget.style.background = color + '14'; e.currentTarget.style.transform = 'translateY(-3px)' }}
                onPointerLeave={e => { e.currentTarget.style.borderColor = '#1a2740'; e.currentTarget.style.background = '#0c1524'; e.currentTarget.style.transform = '' }}
                onPointerDown={e => e.currentTarget.style.transform = 'scale(.97)'}
                onPointerUp={e => e.currentTarget.style.transform = 'translateY(-3px)'}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px 16px', borderRadius: 22, background: '#0c1524', border: '1.5px solid #1a2740', cursor: 'pointer', transition: 'all .18s' }}>
                <div style={{ width: 64, height: 64, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 900, background: color + '22', border: `2.5px solid ${color}`, color }}>
                  {op.name[0].toUpperCase()}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ color: '#f1f5f9', fontWeight: 800, fontSize: 15, lineHeight: 1.2 }}>{op.name}</p>
                  <p style={{ color: '#475569', fontSize: 11, marginTop: 4 }}>
                    {op.role === 'caixa' ? '🟢 Caixa' : op.role === 'gerente' ? '🔵 Gerente' : '🔴 Admin'}
                    {op.terminalId ? ` · Cx ${op.terminalId}` : ''}
                  </p>
                </div>
              </button>
            )
          })}
        </div>

        <div style={{ textAlign: 'center' }}>
          <button onClick={fetchOperators}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#334155', fontSize: 12, fontWeight: 600 }}>
            <RefreshCw style={{ width: 13, height: 13 }} /> Atualizar lista
          </button>
        </div>
      </div>
    </div>
  )
}
