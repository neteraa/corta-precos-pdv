import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { host: '0.0.0.0', port: 8011 },
  // Single entry: OG tags dinâmicos via og-ofertas.js (Netlify Function)
  // Para /ofertas o og:title é injetado server-side baseado em ?s=TENANT_ID
})
