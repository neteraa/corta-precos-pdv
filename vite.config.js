import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const BUILD_TS = Date.now()
const BUILD_VERSION = `v${BUILD_TS}`

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
      .replace('__CACHE_VERSION__', `corta-precos-${BUILD_VERSION}`)
    writeFileSync(swPath, content)
    console.info(`[sw-version] cache = corta-precos-${BUILD_VERSION}`)
  },
}

/**
 * Injeta versão no index.html E cria version.json para check remoto
 */
const versionPlugin = {
  name: 'build-version',
  closeBundle() {
    // Injeta versão no HTML
    const htmlPath = resolve(__dirname, 'dist/index.html')
    if (existsSync(htmlPath)) {
      const html = readFileSync(htmlPath, 'utf-8')
        .replace('__BUILD_VERSION__', BUILD_VERSION)
      writeFileSync(htmlPath, html)
    }
    
    // Cria version.json para check remoto
    const versionPath = resolve(__dirname, 'dist/version.json')
    writeFileSync(versionPath, JSON.stringify({ 
      version: BUILD_VERSION, 
      timestamp: BUILD_TS,
      date: new Date(BUILD_TS).toISOString()
    }, null, 2))
    
    console.info(`[version] build = ${BUILD_VERSION}`)
  },
}

export default defineConfig({
  plugins: [react(), swVersionPlugin, versionPlugin],
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
  // TF.js uses dynamic WASM backends — exclude from Vite pre-bundling
  optimizeDeps: {
    exclude: ['@tensorflow/tfjs', '@tensorflow-models/coco-ssd'],
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
          'vendor-tfjs':     ['@tensorflow/tfjs', '@tensorflow-models/coco-ssd'],
        },
      },
    },
  },
})
