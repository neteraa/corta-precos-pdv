# Corta Preços MVP — Project Notes

## What this is
React + Vite + Tailwind MVP platform for retail management (PDV/automação comercial), Brazilian supermarket.
Live URL: **https://corta-precos-pdv.netlify.app**
GitHub Repo: **https://github.com/neteraa/corta-precos-pdv**
Netlify site ID: `abd4863b-ef7b-4d7c-b3f2-85547f519485`
Branch: `master`

## First thing to do in a NEW session
```bash
git clone https://github.com/neteraa/corta-precos-pdv.git /workspace/project
cd /workspace/project
npm install
```

## Deploy command (always use this)
```bash
npm run build && npx netlify-cli deploy --prod --dir=dist --site=abd4863b-ef7b-4d7c-b3f2-85547f519485
```

---

## Stack
- React 18 + Vite + Tailwind CSS
- Netlify hosting + Netlify Blobs (server-side persistence via `/api/persist` + `/api/restore`)
- `src/store.jsx` — single global store with localStorage + Netlify Blobs sync every 30s
- `netlify/functions/persist.js` + `restore.js` — serverless functions for cross-device sync

## Key Architecture
- **Store** (`src/store.jsx`): `StoreProvider` with `useStore()` hook
  - Products, Sales, Customers, Promos, Cash, Operators, Photos (IndexedDB)
  - `syncNow()` + `lastSync` + `syncing` — 30s auto-poll from server
  - `expiryAlertDays` (default 30) — persisted to `localStorage('cp_expiry_days')`
  - `upsertProduct`, `upsertPromo`, `assignPromoGroup` — key mutation functions
- **Auth**: `src/utils/auth.js` — simple PIN auth

## Pages
| Route | File | Notes |
|---|---|---|
| `/pdv` | PDV.jsx | POS caixa, F2/F4/F10 shortcuts, barcode scanner |
| `/produtos` | Produtos.jsx | CRUD + CSV import (Gdoor format) |
| `/estoque` | Estoque.jsx | **Pagination 100/page, sortable columns, Receber Mercadoria with expiry date** |
| `/validade` | Validade.jsx | **Full expiry control — configurable threshold, auto-alert, Gerar Promoção** |
| `/dashboard` | Dashboard.jsx | **Expiry alert banner, KPIs, charts** |
| `/scan` | ScanMobile.jsx | Mobile barcode scanner — `?mode=estoque` for stock entry with vencimento |
| `/promocoes` | Promocoes.jsx | Promo groups (qty-based pricing) |
| `/fiado` | Fiado.jsx | Credit/tab tracking |
| `/relatorio` | Relatorio.jsx | Sales report |
| `/validade` | Validade.jsx | Expiry control |
| `/etiquetas` | Etiquetas.jsx | Label printing |
| `/fidelidade` | Fidelidade.jsx | QR loyalty (WhatsApp) |
| `/campanhas` | Campanhas.jsx | WhatsApp campaigns |
| `/configuracoes` | Configuracoes.jsx | Backup, import CSV, reset |

## COMPLETED FEATURES (as of commit a91f364)
- ✅ Full PDV (caixa) with barcode scanner + keyboard shortcuts
- ✅ 2795 products imported from Gdoor CSV (pipe-delimited, MacRoman encoding)
- ✅ Estoque: pagination 100/page, sortable columns (name/category/cost/price/stock/stockValue/receivedAt)
- ✅ Receber Mercadoria modal: expiry date per product, live countdown badge (green/yellow/orange/red)
- ✅ Validade page: configurable alert threshold (slider + presets 7/15/30/45/60/90d), auto-alert banner, "Gerar Promoção" button per expiring product
- ✅ Promoção modal: discount % slider, qty picker, live preview, creates promo + assigns product in 1 click
- ✅ Dashboard: expiry alert banner showing top 3 expiring products with button to /validade
- ✅ Cross-device sync: mobile scan → desktop sees in ≤30s; SyncBar in sidebar shows last sync time
- ✅ ScanMobile: cadastro completo (nome/preço/unidade/qty/vencimento), vencimento saved to expiryDate
- ✅ Product photos via IndexedDB + OpenFoodFacts picker
- ✅ Promos, Fiado, Fidelidade/WhatsApp, Campanhas, Relatório, Etiquetas

## Promo structure (SEED_PROMOS / upsertPromo)
```js
{ id: 'pr_xxx', name: 'label', group: 'UNIQUE_GROUP_KEY', qty: 2, totalPrice: 9.99, active: true }
// products linked via: assignPromoGroup(productId, group)
// products have p.promoGroup field
```

## Expiry system
- `product.expiryDate` — ISO date string "YYYY-MM-DD"
- `expiryAlertDays` — from store, configurable, default 30
- Status: expired(<0) / critical(≤7) / warning(≤warnDays) / ok(>warnDays)
- Set at: Receber Mercadoria modal (desktop) or ScanMobile (mobile)
- Alerts shown: Validade page + Dashboard banner

## CSS / Tailwind conventions
- `btn-primary` = orange CTA button
- `btn-ghost` = ghost button
- `card` = white rounded-xl shadow card
- `input` = styled input
- `label` = styled label
- Brand color: orange-500 (#ea580c) — use `text-orange-500`, `bg-orange-500`
- `animate-pop` = entrance animation

## Portal do Fornecedor (adicionado em 2026-08-04)
- `/fornecedor` — standalone, mobile-first, tema verde esmeralda, SEM auth do mercado
  - Setup: fornecedor se identifica com nome + telefone (localStorage `cp_fornecedor_v1`)
  - Scanner de código de barras (reutiliza CameraScanner.jsx)
  - Busca produto em products_seed.json (2817 itens) por nome ou SKU
  - Form: qty, unidade (CX/UND/FD/KG/LT/PC), preço oferta, validade, nota
  - Toggle 🔥 Oportunidade
  - Publica em Netlify Blobs: `cp_supplier_offers`
  - WhatsApp dispatch: overlay mostra cada mercado cadastrado, abre wa.me
  - Aba Mercados: cadastrar contatos (nome + fone) salvos em `${LOCAL}_markets`

- `/ofertas` — dentro do app do mercado (autenticado, com sidebar)
  - Filtros: todas / pendentes / aceitas / oportunidade
  - Aceitar oferta → atualiza estoque via `upsertProduct` (qty + expiryDate + cost)
  - Badge dinâmico no sidebar com contagem de pendentes
  - Dashboard: banner verde quando há pendentes → navega para /ofertas

- Novas keys Netlify Blobs: `cp_supplier_offers`
- Store: `supplierOffers` state + `applyServerData` lida com `cp_supplier_offers`

## Known issues / next possible work
- Produtos page can be slow with 2795 products loaded (no virtual scroll)
- Validade "Sem data (2795)" — products need expiry dates added via ScanMobile or Receber Mercadoria
- Photos from OpenFoodFacts API can be unstable (503 errors)
- No real auth (PIN only) — not production-safe for multi-user

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

## Features added (session 2025-07)
**10 improvements all deployed live:**
1. **Fechamento de Caixa** — already existed, now with Sangria/Suprimento form + net cash balance
2. **Meta de Vendas** — progress bar on Dashboard, set with "Meta" button
3. **Estoque Mínimo** — `minStock` field per product; "🛒 Repor" tab in Estoque shows below-min products
4. **Etiquetas de Preço** — `/etiquetas` page; select products → generate PDF (40x20/50x25/60x30/100x50mm) via jsPDF
5. **Controle de Validade** — `/validade` page; `expiryDate` field per product; alerts: expired/critical/warning/ok
6. **Múltiplos Operadores** — in Configurações → Operadores; stored in `cp_operators` (name/role/pin)
7. **Balança por Peso** — PDV detects `unit=KG/G` and opens weight modal for decimal qty input
8. **Recibo por WhatsApp** — button in post-sale modal sends formatted receipt text via wa.me
9. **Relatório Gerencial** — `/relatorio` page; period filter, profit, margin, ticket avg, top 10, CSV export
10. **Sangria/Suprimento** — in Fechamento de Caixa modal; recorded in `cp_cash` key

## New store keys (localStorage + Netlify Blobs)
- `cp_cash` — cash movements array `[{id, type, amount, reason, date}]`
- `cp_goal` — sales goal `{daily: number}`
- `cp_operators` — operators array `[{id, name, role, pin}]`

## Product model extended
Products now support: `minStock` (number), `expiryDate` (ISO date string), `unit` (UN/KG/G/LT/CX)

## Production deployment
- URL: https://corta-precos-pdv.netlify.app
- Site ID: abd4863b-ef7b-4d7c-b3f2-85547f519485
- Deploy via: `npx netlify-cli deploy --prod --dir=dist --site=abd4863b-ef7b-4d7c-b3f2-85547f519485`
- Login: admin / 1234 (changeable in Configurações → Acesso ao Sistema)
