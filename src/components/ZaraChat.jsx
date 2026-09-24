/**
 * ZaraChat — widget flutuante de suporte IA.
 * Aparece em todas as páginas do sistema autenticado.
 * IA: Groq llama-3.1-8b (via /api/zara-chat).
 */
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { MessageCircle, X, Send, ChevronDown } from 'lucide-react'

const QUICK = [
  '📦 Como faço backup dos produtos?',
  '➗ Como dividir pagamento?',
  '🖨️ Como configurar impressora?',
  '❌ Como cancelar uma venda?',
  '📱 Como instalar o terminal como app?',
  '🔐 Os dados de cada loja são separados?',
]

const WELCOME = 'Oi! 👋 Sou a **Zara**, sua assistente do ZatendeStok. Pode perguntar sobre qualquer funcionalidade do sistema!'

function parseMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:#1f2937;padding:1px 5px;border-radius:4px;font-size:11px">$1</code>')
    .replace(/\n/g, '<br>')
}

// Zara avatar — simplified inline SVG bust (no external import needed)
function ZaraAvatar({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="20" fill="#1a0a00"/>
      {/* face */}
      <ellipse cx="20" cy="17" rx="8" ry="8.5" fill="#C47A48"/>
      {/* hair */}
      <ellipse cx="20" cy="11" rx="8.5" ry="5" fill="#1a0a00"/>
      {/* eyes */}
      <circle cx="17" cy="17" r="1.2" fill="#1a0a00"/>
      <circle cx="23" cy="17" r="1.2" fill="#1a0a00"/>
      {/* smile */}
      <path d="M17 20.5 Q20 22.5 23 20.5" stroke="#1a0a00" strokeWidth="1" fill="none" strokeLinecap="round"/>
      {/* body */}
      <path d="M10 40 Q12 30 20 28 Q28 30 30 40" fill="#1a0800"/>
    </svg>
  )
}

export default function ZaraChat() {
  const [open,    setOpen]    = useState(false)
  const [msgs,    setMsgs]    = useState([{ role: 'assistant', content: WELCOME }])
  const [input,   setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const [unread,  setUnread]  = useState(0)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  useEffect(() => {
    if (open) {
      setUnread(0)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, loading])

  const send = useCallback(async (text) => {
    const q = (text ?? input).trim()
    if (!q || loading) return
    setInput('')

    const newMsgs = [...msgs, { role: 'user', content: q }]
    setMsgs(newMsgs)
    setLoading(true)

    try {
      const res = await fetch('/api/zara-chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          messages: newMsgs
            .filter((m, i) => i > 0) // skip welcome
            .map(m => ({ role: m.role, content: m.content }))
            .slice(-8),
        }),
      })
      const data = await res.json()
      setMsgs(prev => [...prev, { role: 'assistant', content: data.reply }])
      if (!open) setUnread(u => u + 1)
    } catch {
      setMsgs(prev => [...prev, { role: 'assistant', content: 'Erro de conexão. Tente novamente. 😔' }])
    }
    setLoading(false)
  }, [input, msgs, loading, open])

  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }

  const showQuick = msgs.length <= 1

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9000, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>

      {/* ── Chat window ── */}
      {open && (
        <div style={{
          width: 348, height: 480, background: '#08090a',
          border: '1px solid #1f2937', borderRadius: 18,
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 60px rgba(0,0,0,.7)',
          overflow: 'hidden',
        }}>
          {/* header */}
          <div style={{ background: '#0f1117', borderBottom: '1px solid #1f2937', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <ZaraAvatar size={34} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: 14, color: '#f1f5f9' }}>Zara</div>
              <div style={{ fontSize: 10, color: '#4ade80', fontWeight: 700 }}>● Online — Assistente ZatendeStok</div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#4b5563', cursor: 'pointer', padding: 4, display: 'flex', borderRadius: 6 }}>
              <ChevronDown style={{ width: 18, height: 18 }} />
            </button>
          </div>

          {/* messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {msgs.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
                {m.role === 'assistant' && <ZaraAvatar size={24} />}
                <div style={{
                  maxWidth: '80%', padding: '9px 12px', borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: m.role === 'user' ? '#ea580c' : '#111827',
                  color: m.role === 'user' ? '#000' : '#e2e8f0',
                  fontSize: 13, lineHeight: 1.45, fontWeight: m.role === 'user' ? 700 : 400,
                }}
                  dangerouslySetInnerHTML={{ __html: parseMarkdown(m.content) }}
                />
              </div>
            ))}

            {/* typing dots */}
            {loading && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <ZaraAvatar size={24} />
                <div style={{ background: '#111827', borderRadius: '14px 14px 14px 4px', padding: '10px 14px', display: 'flex', gap: 5 }}>
                  {[0, 1, 2].map(d => (
                    <span key={d} style={{ width: 6, height: 6, borderRadius: '50%', background: '#4b5563', display: 'inline-block', animation: `zaraDot .9s ${d * .2}s ease-in-out infinite alternate` }} />
                  ))}
                </div>
              </div>
            )}

            {/* quick chips (only at start) */}
            {showQuick && !loading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 4 }}>
                <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 700, letterSpacing: 1 }}>PERGUNTAS RÁPIDAS</div>
                {QUICK.map(q => (
                  <button key={q} onClick={() => send(q)}
                    style={{ textAlign: 'left', background: '#111827', border: '1px solid #1f2937', borderRadius: 8, padding: '7px 10px', color: '#d1d5db', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    {q}
                  </button>
                ))}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* input */}
          <div style={{ flexShrink: 0, padding: '10px 12px', borderTop: '1px solid #1f2937', display: 'flex', gap: 8 }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Pergunte qualquer coisa…"
              disabled={loading}
              style={{ flex: 1, background: '#111827', border: '1px solid #1f2937', borderRadius: 8, padding: '8px 12px', color: '#f1f5f9', fontSize: 13, outline: 'none' }}
            />
            <button onClick={() => send()} disabled={!input.trim() || loading}
              style={{ width: 36, height: 36, borderRadius: 8, background: input.trim() && !loading ? '#ea580c' : '#1f2937', border: 'none', color: input.trim() && !loading ? '#000' : '#374151', cursor: input.trim() && !loading ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background .15s' }}>
              <Send style={{ width: 15, height: 15 }} />
            </button>
          </div>
        </div>
      )}

      {/* ── FAB button ── */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Falar com a Zara"
        style={{
          width: 52, height: 52, borderRadius: '50%',
          background: open ? '#1f2937' : 'linear-gradient(135deg, #ea580c, #c2410c)',
          border: open ? '1px solid #374151' : 'none',
          boxShadow: open ? 'none' : '0 4px 20px rgba(234,88,12,.5)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all .2s', position: 'relative',
        }}>
        {open
          ? <X style={{ width: 20, height: 20, color: '#9ca3af' }} />
          : <MessageCircle style={{ width: 22, height: 22, color: '#fff' }} />
        }
        {!open && unread > 0 && (
          <span style={{ position: 'absolute', top: -2, right: -2, width: 18, height: 18, borderRadius: '50%', background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {unread}
          </span>
        )}
      </button>

      {/* typing animation keyframes */}
      <style>{`
        @keyframes zaraDot {
          from { opacity: .3; transform: translateY(0); }
          to   { opacity: 1;  transform: translateY(-4px); }
        }
      `}</style>
    </div>
  )
}
