import { useState, useEffect, useRef } from 'react'
import { RefreshCw, X } from 'lucide-react'

/** Dispara skipWaiting no SW em waiting e recarrega a página. */
function applyUpdate() {
  if (!('serviceWorker' in navigator)) { window.location.reload(); return }
  navigator.serviceWorker.getRegistration().then(reg => {
    const sw = reg?.waiting
    if (sw) {
      // Recarrega assim que o novo SW tomar controle
      navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true })
      sw.postMessage({ type: 'SKIP_WAITING' })
    } else {
      window.location.reload()
    }
  }).catch(() => window.location.reload())
}

export default function UpdateBanner() {
  const [show,     setShow]     = useState(false)
  const [countdown, setCountdown] = useState(null)
  const timerRef = useRef(null)

  useEffect(() => {
    const handler = () => {
      setShow(true)
      // Se instalado como PWA standalone: conta regressiva de 15s para auto-update
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches
                        || window.navigator.standalone === true
      if (isStandalone) {
        let secs = 15
        setCountdown(secs)
        timerRef.current = setInterval(() => {
          secs -= 1
          if (secs <= 0) { clearInterval(timerRef.current); applyUpdate() }
          else setCountdown(secs)
        }, 1000)
      }
    }
    window.addEventListener('sw-update-ready', handler)
    return () => {
      window.removeEventListener('sw-update-ready', handler)
      clearInterval(timerRef.current)
    }
  }, [])

  if (!show) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between gap-3 px-4 py-3 bg-orange-500 text-white shadow-lg">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
        Nova versão disponível — sistema será atualizado
        {countdown !== null && <span className="ml-1 opacity-80">em {countdown}s</span>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={applyUpdate}
          className="px-3 py-1 rounded-lg bg-white text-orange-600 font-bold text-sm hover:bg-orange-50 transition-colors">
          Atualizar agora
        </button>
        <button
          onClick={() => { setShow(false); setCountdown(null); clearInterval(timerRef.current) }}
          className="opacity-75 hover:opacity-100">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
