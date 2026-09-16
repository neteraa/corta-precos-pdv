import { useState, useEffect } from 'react'
import { RefreshCw, X } from 'lucide-react'

export default function UpdateBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const handler = () => setShow(true)
    window.addEventListener('sw-update-ready', handler)
    return () => window.removeEventListener('sw-update-ready', handler)
  }, [])

  if (!show) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between gap-3 px-4 py-3 bg-orange-500 text-white shadow-lg">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <RefreshCw className="w-4 h-4 shrink-0" />
        Nova versão disponível — clique para atualizar o sistema
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => window.location.reload()}
          className="px-3 py-1 rounded-lg bg-white text-orange-600 font-bold text-sm hover:bg-orange-50 transition-colors">
          Atualizar agora
        </button>
        <button onClick={() => setShow(false)} className="opacity-75 hover:opacity-100">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
