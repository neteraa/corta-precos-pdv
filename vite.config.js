import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
