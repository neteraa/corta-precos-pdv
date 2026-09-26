import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

// eslint-disable-next-line no-undef
if (typeof __BUILD_TS__ !== 'undefined') console.info('[ZatendeStok] build', new Date(__BUILD_TS__).toISOString())

// ─── Auto-Update AGRESSIVO: Checa versão no servidor a cada 10s ───────────────
const currentVersion = document.querySelector('meta[name="app-version"]')?.content || 'unknown'
let lastKnownVersion = localStorage.getItem('app_version') || currentVersion

// Salva versão atual
localStorage.setItem('app_version', currentVersion)

console.log('[App] Versão atual:', currentVersion)

// Função que força reload com toast
function forceReload(reason = 'Nova versão disponível') {
  console.log('[App] FORÇANDO RELOAD:', reason)
  
  const toast = document.createElement('div')
  toast.style.cssText = 'position:fixed;top:20px;right:20px;background:#22c55e;color:#fff;padding:16px 24px;border-radius:12px;font-weight:700;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.15);'
  toast.innerHTML = `✅ ${reason}! Atualizando...`
  document.body.appendChild(toast)
  
  setTimeout(() => {
    // Force reload SEM cache
    window.location.reload(true)
  }, 1500)
}

// Checa versão no servidor a cada 10 segundos
async function checkVersion() {
  try {
    const res = await fetch('/version.json?' + Date.now()) // Cache bust
    const data = await res.json()
    const serverVersion = data.version
    
    console.log('[App] Check versão - Local:', currentVersion, '| Servidor:', serverVersion)
    
    if (serverVersion && serverVersion !== currentVersion) {
      console.log('[App] VERSÃO DIFERENTE DETECTADA!')
      localStorage.setItem('app_version', serverVersion)
      forceReload('Nova versão detectada')
    }
  } catch (e) {
    console.log('[App] Erro ao checar versão (normal offline):', e.message)
  }
}

// Checa imediatamente no load
setTimeout(checkVersion, 2000)

// Checa a cada 10 segundos
setInterval(checkVersion, 10000)

// Checa quando tab fica visível
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    console.log('[App] Tab visível - checando versão...')
    checkVersion()
  }
})

// Service Worker listener (fallback)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'SW_UPDATED') {
      console.log('[App] Service Worker atualizado:', event.data.cache)
      forceReload('Service Worker atualizado')
    }
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
)
