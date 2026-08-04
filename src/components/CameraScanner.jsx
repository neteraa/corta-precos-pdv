import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { X, Camera, Loader } from 'lucide-react'

/**
 * Camera barcode/QR scanner using html5-qrcode.
 *
 * Props:
 *   onScan(code: string)  — called each time a code is decoded
 *   onClose()             — called when user closes the camera panel
 *   compact               — smaller inline mode (default: false = full overlay)
 */
export default function CameraScanner({ onScan, onDetected, onClose, compact = false }) {
  const [state, setState] = useState('idle')   // idle | starting | scanning | error
  const [errMsg, setErrMsg] = useState('')
  const [lastCode, setLastCode] = useState('')
  const scannerRef  = useRef(null)
  const idRef       = useRef('cs_' + Math.random().toString(36).slice(2, 8))
  const lastRef     = useRef(null)   // debounce same code within 1.5 s
  const handleRef   = useRef(null)   // always-current callback, never stale
  handleRef.current = onScan || onDetected

  useEffect(() => {
    const id = idRef.current
    setState('starting')
    const hs = new Html5Qrcode(id)
    scannerRef.current = hs

    hs.start(
      { facingMode: 'environment' },
      { fps: 12, qrbox: compact ? 200 : 280, aspectRatio: 1.0 },
      (code) => {
        if (code === lastRef.current) return   // skip duplicate within debounce
        lastRef.current = code
        setTimeout(() => { lastRef.current = null }, 1500)
        setLastCode(code)
        handleRef.current?.(code)
      },
      () => {}   // per-frame errors are normal — ignore
    )
      .then(() => setState('scanning'))
      .catch(err => {
        setState('error')
        setErrMsg(err?.message || String(err))
      })

    return () => {
      hs.isScanning && hs.stop().catch(() => {})
    }
  }, [])   // eslint-disable-line

  const wrapCls = compact
    ? 'rounded-2xl overflow-hidden bg-black'
    : 'fixed inset-0 z-50 flex flex-col bg-black'

  return (
    <div className={wrapCls}>
      {/* header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 flex-shrink-0">
        <div className="flex items-center gap-2 text-white">
          <Camera className="w-4 h-4 text-brand-400" />
          <span className="text-sm font-bold">
            {state === 'starting' && 'Iniciando câmera...'}
            {state === 'scanning' && 'Aponte para o código de barras'}
            {state === 'error'    && 'Câmera não disponível'}
          </span>
          {state === 'starting' && <Loader className="w-4 h-4 text-brand-400 animate-spin" />}
        </div>
        <button onClick={onClose}
          className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* viewfinder */}
      <div className="relative flex-1 flex items-center justify-center bg-black min-h-0">
        {state === 'error' ? (
          <div className="text-center px-6">
            <Camera className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-white font-bold text-sm mb-1">Permissão de câmera negada</p>
            <p className="text-gray-400 text-xs">{errMsg}</p>
            <p className="text-gray-500 text-xs mt-3">
              Permita o acesso à câmera nas configurações do navegador e tente novamente.
            </p>
          </div>
        ) : (
          <div id={idRef.current} style={{ width: '100%', maxWidth: compact ? 340 : 480 }} />
        )}

        {/* aiming overlay */}
        {state === 'scanning' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div style={{
              width: compact ? 200 : 280,
              height: compact ? 200 : 280,
              border: '2px solid #ea580c',
              borderRadius: 12,
              boxShadow: '0 0 0 4000px rgba(0,0,0,0.45)',
            }}>
              {/* corner accents */}
              {[['top-0 left-0','border-t-4 border-l-4'],['top-0 right-0','border-t-4 border-r-4'],
                ['bottom-0 left-0','border-b-4 border-l-4'],['bottom-0 right-0','border-b-4 border-r-4']
              ].map(([pos, border]) => (
                <div key={pos} className={`absolute ${pos} w-6 h-6 border-brand-500 ${border} rounded-sm`} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* last scanned */}
      {lastCode && (
        <div className="px-4 py-3 bg-green-900/80 text-center flex-shrink-0">
          <div className="text-green-300 text-xs font-bold uppercase tracking-wide mb-0.5">Lido</div>
          <div className="text-green-100 font-mono font-black text-sm">{lastCode}</div>
        </div>
      )}
    </div>
  )
}
