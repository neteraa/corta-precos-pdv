import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { buildPixPayload } from '../utils/pix.js'

/**
 * Renders a PIX QR code for a given amount + key.
 * Falls back to a copy-text button if canvas fails.
 */
export default function PixQR({ amount, pixKey, name, city, txid, size = 200 }) {
  const canvasRef = useRef(null)
  const [payload, setPayload] = useState('')
  const [copied, setCopied]   = useState(false)
  const [error, setError]     = useState(false)

  useEffect(() => {
    if (!pixKey || amount <= 0) return
    try {
      const p = buildPixPayload({ key: pixKey, amount, name, city, txid })
      setPayload(p)
      QRCode.toCanvas(canvasRef.current, p, {
        width: size,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      }).catch(() => setError(true))
    } catch {
      setError(true)
    }
  }, [amount, pixKey, name, city, txid, size])

  const copy = () => {
    navigator.clipboard?.writeText(payload).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (!pixKey) return (
    <div className="text-center text-xs text-gray-400 py-4">
      Configure a chave PIX em Configurações para exibir o QR.
    </div>
  )

  return (
    <div className="flex flex-col items-center gap-2">
      {!error
        ? <canvas ref={canvasRef} style={{ borderRadius: 8, display: 'block' }} />
        : <div className="text-xs text-red-500">Erro ao gerar QR. Use o código abaixo.</div>
      }
      <button
        onClick={copy}
        className="text-xs text-brand-600 hover:text-brand-700 font-semibold transition-colors"
        title="Copiar código PIX Copia e Cola"
      >
        {copied ? '✅ Copiado!' : '📋 Copiar código PIX'}
      </button>
    </div>
  )
}
