/**
 * /limpar — Limpa dados locais do mercado atual neste navegador.
 * Acessível por qualquer usuário logado. Redireciona para /login após limpar.
 */
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2, ShieldAlert, CheckCircle2, RefreshCw } from 'lucide-react'
import { getMktStoreId, wipeStoreData, wipeLegacyFlatKeys } from '../utils/tenantStorage.js'

export default function ResetStore() {
  const navigate     = useNavigate()
  const storeId      = getMktStoreId()
  const [done, setDone] = useState(false)
  const [count, setCount] = useState(0)

  const session = (() => {
    try { return JSON.parse(localStorage.getItem('cp_session')) } catch { return null }
  })()

  const doReset = () => {
    const removed = wipeStoreData(storeId)
    wipeLegacyFlatKeys()
    localStorage.removeItem('cp_session')
    localStorage.removeItem('cp_market_session_v1')
    setCount(removed)
    setDone(true)
    setTimeout(() => navigate('/login', { replace: true }), 2500)
  }

  return (
    <div style={{ minHeight:'100dvh', background:'#04080f', display:'flex', alignItems:'center', justifyContent:'center', padding:24, fontFamily:"system-ui,sans-serif" }}>
      <div style={{ width:'100%', maxWidth:440, background:'#0c1524', border:'1px solid #1a2740', borderRadius:24, padding:36, textAlign:'center' }}>
        {!done ? (
          <>
            <div style={{ width:72, height:72, borderRadius:20, background:'rgba(239,68,68,.1)', border:'2px solid rgba(239,68,68,.25)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
              <Trash2 size={32} color="#ef4444" />
            </div>
            <h1 style={{ color:'#f1f5f9', fontWeight:900, fontSize:22, marginBottom:10 }}>Limpar dados locais</h1>
            <p style={{ color:'#475569', fontSize:14, lineHeight:1.7, marginBottom:8 }}>
              Isso apaga os dados deste mercado do <strong style={{ color:'#94a3b8' }}>navegador desta máquina</strong> — produtos, vendas, estoque e operadores ficam salvos no servidor e voltam ao fazer login novamente.
            </p>
            {storeId && storeId !== 'default' && (
              <div style={{ background:'rgba(239,68,68,.06)', border:'1px solid rgba(239,68,68,.15)', borderRadius:12, padding:'10px 16px', margin:'16px 0', fontSize:13 }}>
                <span style={{ color:'#64748b' }}>Mercado: </span>
                <span style={{ color:'#f87171', fontWeight:700, fontFamily:'monospace' }}>{storeId}</span>
                {session?.storeName && <><br /><span style={{ color:'#475569' }}>{session.storeName}</span></>}
              </div>
            )}
            <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(249,115,22,.06)', border:'1px solid rgba(249,115,22,.15)', borderRadius:12, padding:'10px 16px', marginBottom:24, textAlign:'left' }}>
              <ShieldAlert size={16} color="#f97316" style={{ flexShrink:0 }} />
              <span style={{ color:'#94a3b8', fontSize:12 }}>Use isto quando trocar de mercado no mesmo computador ou quando aparecerem dados de outro cliente.</span>
            </div>
            <button onClick={doReset}
              style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, width:'100%', padding:'14px', border:'none', borderRadius:14, cursor:'pointer', background:'linear-gradient(135deg,#ef4444,#dc2626)', color:'#fff', fontWeight:900, fontSize:16, boxShadow:'0 4px 20px rgba(239,68,68,.3)' }}>
              <Trash2 size={18} /> Limpar e sair
            </button>
            <button onClick={() => navigate(-1)}
              style={{ display:'block', width:'100%', marginTop:12, padding:'11px', background:'none', border:'1px solid #1a2740', borderRadius:12, color:'#475569', fontSize:13, cursor:'pointer' }}>
              Cancelar
            </button>
          </>
        ) : (
          <>
            <div style={{ width:72, height:72, borderRadius:20, background:'rgba(34,197,94,.1)', border:'2px solid rgba(34,197,94,.3)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
              <CheckCircle2 size={32} color="#22c55e" />
            </div>
            <h1 style={{ color:'#f1f5f9', fontWeight:900, fontSize:22, marginBottom:10 }}>Dados limpos!</h1>
            <p style={{ color:'#475569', fontSize:14, marginBottom:16 }}>
              {count} chaves removidas. Redirecionando para o login…
            </p>
            <div style={{ display:'flex', justifyContent:'center' }}>
              <RefreshCw size={20} color="#4ade80" style={{ animation:'spin .8s linear infinite' }} />
            </div>
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
    </div>
  )
}
