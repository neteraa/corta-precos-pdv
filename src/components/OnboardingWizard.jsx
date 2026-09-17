import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Store, Package, Users, ShoppingCart, CheckCircle2, X, ChevronRight, Copy, Check } from 'lucide-react'
import { useStore } from '../store.jsx'
import { getConfiguredStoreId } from '../utils/auth.js'

const STORAGE_KEY = 'cp_onboarding_done'

const STEPS = [
  {
    id: 'store',
    icon: Store,
    color: '#f97316',
    title: 'Nome do seu mercado',
    desc: 'Como o sistema vai identificar sua loja para clientes e relatórios.',
    action: 'Ir para Configurações',
    route: '/configuracoes',
    check: (s) => !!s.storeName,
    hint: 'Abra Configurações → "Nome da Loja" → salve',
  },
  {
    id: 'products',
    icon: Package,
    color: '#3b82f6',
    title: 'Cadastre seus produtos',
    desc: 'Adicione os produtos que você vai vender. Pode importar de uma planilha CSV ou cadastrar um a um.',
    action: 'Ir para Produtos',
    route: '/produtos',
    check: (s) => s.products.length >= 3,
    hint: 'Use "📄 Modelo CSV" para baixar a planilha, preencha e importe',
  },
  {
    id: 'operators',
    icon: Users,
    color: '#8b5cf6',
    title: 'Crie os operadores de caixa',
    desc: 'Cada funcionário tem seu próprio acesso com PIN. O caixa vê só o PDV; o gerente vê os relatórios.',
    action: 'Ir para Configurações',
    route: '/configuracoes',
    check: (s) => s.operators.length > 0,
    hint: 'Configurações → aba Operadores → "+ Adicionar operador"',
  },
  {
    id: 'sale',
    icon: ShoppingCart,
    color: '#22c55e',
    title: 'Faça uma venda teste',
    desc: 'Experimente o caixa: busque um produto, adicione ao carrinho e finalize uma venda de teste.',
    action: 'Abrir o PDV',
    route: '/pdv',
    check: (s) => s.sales.length > 0,
    hint: 'Tecla F10 finaliza a venda rapidinho',
  },
  {
    id: 'share',
    icon: CheckCircle2,
    color: '#f97316',
    title: 'Compartilhe o link do caixa',
    desc: 'Cada funcionário tem um link exclusivo para entrar pelo celular ou tablet, com PIN.',
    action: null, // handled inline
    route: null,
    check: () => false, // always allow manual completion
    hint: 'Copie e mande pro WhatsApp dos funcionários',
  },
]

function useOnboardingData() {
  const { products, sales } = useStore()
  const [storeName, setStoreName] = useState('')
  const [operators, setOperators] = useState([])

  useEffect(() => {
    const storeId = getConfiguredStoreId()
    const sn = localStorage.getItem(`mkt:${storeId}:cp_store_name`) || localStorage.getItem('cp_store_name') || ''
    const raw = localStorage.getItem(`mkt:${storeId}:cp_operators`) || localStorage.getItem('cp_operators') || '[]'
    setStoreName(sn)
    try { setOperators(JSON.parse(raw)) } catch { setOperators([]) }
  }, [])

  return { products, sales, storeName, operators }
}

export default function OnboardingWizard() {
  const navigate   = useNavigate()
  const data       = useOnboardingData()
  const [step, setStep]     = useState(0)
  const [copied, setCopied] = useState(false)
  const [hidden, setHidden] = useState(() => !!localStorage.getItem(STORAGE_KEY))

  // Auto-advance when step already done
  useEffect(() => {
    if (hidden) return
    const s = STEPS[step]
    if (s && s.check(data) && step < STEPS.length - 1) {
      setStep(v => v + 1)
    }
  }, [data, step, hidden])

  if (hidden) return null

  // Only show for stores with no sales (truly new)
  if (data.sales.length > 0 && data.products.length > 5) return null

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1')
    setHidden(true)
  }

  const storeId  = getConfiguredStoreId()
  const caixaUrl = `${window.location.origin}/caixa/${storeId}`
  const current  = STEPS[step]
  const Icon     = current.icon

  const completedCount = STEPS.slice(0, -1).filter(s => s.check(data)).length
  const progress       = Math.round((completedCount / (STEPS.length - 1)) * 100)

  return (
    <div style={{ background: '#0c1524', border: '1px solid #1a2740', borderRadius: 20, padding: '20px 24px', marginBottom: 20, position: 'relative', overflow: 'hidden' }}>
      {/* Background glow */}
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 0% 50%, ${current.color}15 0%, transparent 60%)`, pointerEvents: 'none' }} />

      <div style={{ position: 'relative' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: current.color + '20', border: `1.5px solid ${current.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={18} color={current.color} />
            </div>
            <div>
              <div style={{ color: '#f1f5f9', fontWeight: 900, fontSize: 15 }}>🚀 Configuração Inicial</div>
              <div style={{ color: '#475569', fontSize: 11 }}>Passo {step + 1} de {STEPS.length} · {progress}% concluído</div>
            </div>
          </div>
          <button onClick={dismiss}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#334155', padding: 4, borderRadius: 8 }}
            title="Fechar onboarding">
            <X size={16} />
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ height: 4, background: '#1a2740', borderRadius: 4, marginBottom: 20, overflow: 'hidden' }}>
          <div style={{ height: 4, background: current.color, borderRadius: 4, width: `${progress}%`, transition: 'width .4s' }} />
        </div>

        {/* Step dots */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {STEPS.map((s, i) => {
            const done = i < step || (i < STEPS.length - 1 && s.check(data))
            return (
              <button key={s.id} onClick={() => setStep(i)}
                style={{ width: done ? 24 : 8, height: 8, borderRadius: 4, border: 'none', cursor: 'pointer', transition: 'all .2s',
                  background: done ? s.color : i === step ? current.color : '#1a2740' }} />
            )
          })}
        </div>

        {/* Current step content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ color: '#f1f5f9', fontWeight: 900, fontSize: 17, marginBottom: 6 }}>{current.title}</div>
            <div style={{ color: '#64748b', fontSize: 13, lineHeight: 1.6 }}>{current.desc}</div>
          </div>

          {/* Hint */}
          <div style={{ background: '#131f30', border: '1px solid #1a2740', borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14 }}>💡</span>
            <span style={{ color: '#475569', fontSize: 12 }}>{current.hint}</span>
          </div>

          {/* Step-specific content */}
          {current.id === 'share' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ background: '#131f30', border: '1px solid #1a2740', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: '#22c55e', fontSize: 12, fontFamily: 'monospace', flex: 1, wordBreak: 'break-all' }}>{caixaUrl}</span>
                <button onClick={() => { navigator.clipboard.writeText(caixaUrl); setCopied(true); setTimeout(()=>setCopied(false),2000) }}
                  style={{ flexShrink: 0, background: copied ? '#22c55e' : '#1a2740', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: '#fff', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {copied ? <Check size={13}/> : <Copy size={13}/>} {copied ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
              <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Olá! Para abrir o caixa, acesse: ${caixaUrl}`)}`, '_blank')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', border: 'none', borderRadius: 12, cursor: 'pointer', background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', fontWeight: 700, fontSize: 13, boxShadow: '0 4px 16px rgba(34,197,94,.25)' }}>
                📱 Enviar pelo WhatsApp
              </button>
            </div>
          ) : (
            <button onClick={() => navigate(current.route)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', border: 'none', borderRadius: 12, cursor: 'pointer', background: `linear-gradient(135deg, ${current.color}, ${current.color}cc)`, color: '#fff', fontWeight: 900, fontSize: 14, boxShadow: `0 4px 16px ${current.color}30` }}>
              {current.action} <ChevronRight size={16} />
            </button>
          )}

          {/* Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {step > 0 && (
                <button onClick={() => setStep(v => v - 1)} style={{ background: 'none', border: '1px solid #1a2740', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', color: '#475569', fontSize: 12 }}>
                  ← Anterior
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {step < STEPS.length - 1 && (
                <button onClick={() => setStep(v => v + 1)} style={{ background: 'none', border: '1px solid #1a2740', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', color: '#475569', fontSize: 12 }}>
                  Próximo →
                </button>
              )}
              {step === STEPS.length - 1 && (
                <button onClick={dismiss} style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)', border: 'none', borderRadius: 8, padding: '6px 16px', cursor: 'pointer', color: '#fff', fontWeight: 900, fontSize: 13 }}>
                  🎉 Concluir
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
