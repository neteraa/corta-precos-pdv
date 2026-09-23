import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const BUILD_TS = Date.now()

/**
 * Injeta a versão de build no service worker após o bundle.
 * Garante que o browser detecte um SW diferente a cada deploy →
 * dispara o update automático no PWA instalado.
 */
const swVersionPlugin = {
  name: 'sw-cache-version',
  closeBundle() {
    const swPath = resolve(__dirname, 'dist/sw.js')
    if (!existsSync(swPath)) return
    const content = readFileSync(swPath, 'utf-8')
      .replace('__CACHE_VERSION__', `corta-precos-v${BUILD_TS}`)
    writeFileSync(swPath, content)
    console.info(`[sw-version] cache = corta-precos-v${BUILD_TS}`)
  },
}

export default defineConfig({
  plugins: [react(), swVersionPlugin],
  server: {
    host: '0.0.0.0',
    port: 8011,
    proxy: {
      '/api': { target: 'https://zatendestock.netlify.app', changeOrigin: true },
      '/.netlify/functions': { target: 'https://zatendestock.netlify.app', changeOrigin: true },
    },
  },
  define: {
    '__BUILD_TS__': JSON.stringify(Date.now()),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':    ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts':   ['recharts'],
          'vendor-pdf':      ['jspdf', 'html2canvas'],
          'vendor-qr':       ['qrcode.react'],
          'vendor-dompurify': ['dompurify'],
        },
      },
    },
  },
})
