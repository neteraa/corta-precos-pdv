# Corta Preços MVP — Project Notes

## What this is
React + Vite + Tailwind MVP platform for retail management (PDV/automação comercial), inspired by Gdoor and gdoor.com.br.

## Stack
- React 18, React Router 6, Recharts, Lucide React
- Tailwind CSS (orange/black brand theme)
- Vite build tool

## Running the app
```bash
# Static production build (currently running)
cd /workspace/project
npm run build
nohup python3 -m http.server 8011 --bind 0.0.0.0 > /tmp/server.log 2>&1 &

# Dev server with HMR
nohup npm run dev > /tmp/vite.log 2>&1 &
```

## 🚀 PRODUCTION URL (PERMANENT — always online, no laptop needed)
**https://corta-precos-pdv.netlify.app**
- Hosted on Netlify free tier (agn.girardi@gmail.com)
- Admin: https://app.netlify.com/projects/corta-precos-pdv
- Site ID: abd4863b-ef7b-4d7c-b3f2-85547f519485
- Data persists in Netlify Blobs (keys: cp_products, cp_sales, cp_customers, cp_promos, cp_fiado)
- To redeploy: `cd /workspace/project && ./node_modules/.bin/netlify deploy --prod --dir=dist --functions=netlify/functions`

## Development / Local Access
- Container internal: http://localhost:8011
- User browser (host): http://localhost:36537  (maps to container port 8011)
- PM2 manages local server + cloudflared tunnel (auto-restart)

## Project structure
```
src/
  App.jsx           — routes
  store.jsx         — context/state + seed data + BRL formatter
  index.css         — tailwind + custom component classes
  pages/
    Dashboard.jsx   — KPIs, charts (area, bar, pie)
    PDV.jsx         — Point of Sale, cart, F2/F4/F10 shortcuts
    Produtos.jsx    — CRUD + CSV import button
    Vendas.jsx      — sales history with expandable line items
    Estoque.jsx     — stock with quick +10/+100 adjustments
    Clientes.jsx    — customer CRUD (cards layout)
    Configuracoes.jsx — import CSV, backup JSON, reset
  components/
    Layout.jsx      — dark sidebar nav
  utils/
    importCsv.js    — Gdoor CSV parser (Mac Roman, pipe-delimited, BR numbers)
```

## Real product data
2795 real products imported from `G_RELATORIO - cadastros de produtos.csv` (Gdoor export).
Stored in `src/utils/products_seed.json` (468 KB).
Auto-categorized into 19 categories using keyword rules in the Python parser script.

## Gdoor CSV import
The `parseGdoorCsv(buffer)` function in `src/utils/importCsv.js`:
- Accepts an ArrayBuffer from a file input
- Decodes Mac Roman / Windows-1252 encoding
- Handles pipe `|` separator
- Parses Brazilian number format (1.875,50)
- Maps: Código, Cód. Barras → sku; Descrição → name; Grupo/Família → category;
  Preço Custo / Custo Médio → cost; Preço Venda → price; Qtd Saldo → stock

## Data persistence
All data saved to localStorage (keys: cp_products, cp_sales, cp_customers).
After importing CSV, data persists across page reloads.

## PDV shortcuts
- F2: focus search input
- F4: toggle HID barcode scanner mode (keyboard input capture)
- F10: open finalize sale modal
- ESC: close modal / disable scanner
