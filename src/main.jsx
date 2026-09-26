import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

// eslint-disable-next-line no-undef
if (typeof __BUILD_TS__ !== 'undefined') console.info('[ZatendeStok] build', new Date(__BUILD_TS__).toISOString())

// ─── Auto-Update: Service Worker notifica quando atualizar ────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'SW_UPDATED') {
      console.log('[App] Nova versão detectada:', event.data.cache)
      console.log('[App] Recarregando automaticamente em 2 segundos...')
      
      // Mostra toast (opcional)
      const toast = document.createElement('div')
      toast.style.cssText = 'position:fixed;top:20px;right:20px;background:#22c55e;color:#fff;padding:16px 24px;border-radius:12px;font-weight:700;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.15);animation:slideIn 0.3s ease;'
      toast.innerHTML = '✅ Atualização disponível! Recarregando...'
      document.body.appendChild(toast)
      
      // Recarrega após 2s
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    }
  })
  
  // Check service worker update a cada 30s
  setInterval(() => {
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg) {
        console.log('[App] Verificando atualizações...')
        reg.update()
      }
    })
  }, 30000) // 30 segundos
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
)
