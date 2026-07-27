import { useState, useEffect } from 'react'

/**
 * Captures the browser's beforeinstallprompt event so we can
 * show a custom install button instead of (or in addition to)
 * the browser's default address-bar prompt.
 *
 * Returns:
 *   canInstall  — true when the deferred prompt is ready
 *   installed   — true after the user accepts the install
 *   install()   — call to show the native Chrome install dialog
 */
export function useInstallPWA() {
  const [prompt, setPrompt]       = useState(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setPrompt(e) }
    const onInstalled = () => { setInstalled(true); setPrompt(null) }

    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = async () => {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setPrompt(null)
  }

  return { canInstall: !!prompt && !installed, installed, install }
}
