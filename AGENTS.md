# Corta Preços MVP — Project Notes (v4.0 — 2026-08)

## What this is
React + Vite + Tailwind MVP platform for retail management (PDV/automação comercial), Brazilian supermarket.
Live URL: **https://zatendestock.netlify.app**
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

## Sistema do Distribuidor (/fornecedor) — v3.0 (2026-08-04)
**Produto vendido separadamente para distribuidoras/atacadistas de giro rápido (leilão, danificado, contato)**

### Architecture
- URL: `/fornecedor` — standalone, SEM auth do mercado, tema verde esmeralda
- Netlify Blobs keys: `cp_supplier_offers`, `cp_fornecedor_estoque`, `cp_supplier_orders`, `cp_distribuidor_markets`
- CameraScanner: prop `onScan` OR `onDetected` (ambas funcionam)

### Tabs do Distribuidor
- **Início** — FIFO Dashboard: 🔴URGENTE(2d+) / ⚡Atenção(1d) / ✅Hoje + Balanço do dia (gastou/vendeu/lucro) + Botão Blitz
- **Receber** — Entrada de lote: sourceType (🔨Leilão/📦Danificado/👤Contato/🏭Atacadista/❓Avulso) + QuickProductInput (texto livre sem SKU) + totalPaid→unitCost automático + validade shortcuts (7/15/30/60/90d) + preço p/mercados + margem ao vivo
- **Ofertas** — OfferCard com preço editável inline + WaOverlay por mercado
- **Pedidos** — TabPedidos: Confirmar/Entregar → abre WA automático para o mercado notificando
- **Mercados** — CRM dos clientes (nome, ZAP, endereço, responsável, CNPJ)
- **Perfil** — identidade do distribuidor

### Componentes internos (Fornecedor.jsx ~1600 linhas)
- `QuickProductInput` — texto livre + scan; "Usar: [nome]" sem precisar de SKU
- `BlastScreen` — fullscreen sequential WA dispatcher; aceita `offer` ou `customMsg`
- `BlitzModal` — baixa % de todas as ofertas ativas + dispara WA combinado para todos
- `FifoRow` / `FifoPanel` — FIFO aging em TabInicio; botões -10%/-20%/-30% + ZAP direto
- `WaOverlay` — manda ZAP por mercado com histórico de pedidos
- `OfferCard` — preço editável inline, badge URGENTE ≤14d
- `BlitzModal` — seleciona % + preview + aplica em todas as ofertas

### Campos do estoque item (INTERNO — nunca vaza para offer object)
```js
{ sourceType, sourceName, totalPaid, unitCost, receivedAt, expiryDate, ... }
```

### Offer object (o que mercado vê — sem custo/origem/margem)
```js
{ supplierId, supplierName, supplierPhone, productName, sku, qty, unit, offerPrice, expiryDate, isOpportunity, note, status, publishedAt }
```

## Portal do Mercado (/ofertas) — v2.0 (2026-08-04)
- Filtros: Todas / Pendentes / **📋 Meus Pedidos** / 🔥 Oportunidade
- **Meus Pedidos**: polling de 30s em `cp_supplier_orders`; filtra por storeName/storePhone
- `OrderCard`: status badges — 🕐Aguardando / ✅Confirmado! / 🚚A Caminho / 📦Entregue!
- Badge pulsante no header quando há pedidos confirmados
- Após fazer pedido: redireciona automaticamente para tab "Meus Pedidos"
- `reduceSupplierStock`: baixa automaticamente do estoque do distribuidor ao aceitar oferta

### Fluxo completo confirmado
1. Distribuidor: Receber → produto + preço → Dar Entrada + Disparar
2. BlastScreen: abre ZAP para cada mercado com link do portal
3. Mercado: /ofertas → vê oferta → Fazer Pedido → ZAP vai para distribuidor
4. Distribuidor: Pedidos → "Confirmar + 📱 Avisar Mercado" → ZAP automático de confirmação
5. Mercado: Meus Pedidos atualiza em ≤30s mostrando "✅ Confirmado!"
6. Distribuidor: "Entreguei + 📱 Avisar Mercado" → ZAP de entrega

## TASK-8 — Multi-tenant localStorage (2026-08)

### Architecture
Two completely isolated namespaces — never mix:
- `mkt:{storeId}:{key}` → Corta Preço / mercado (B2C)
- `forn:{tenantId}:{key}` → Mega Tudo Barato / distribuidor (B2B)

Session keys (always flat — they ARE the namespace identifiers):
- `cp_session` → mercado session `{ loggedIn, user, storeId }` — storeId='default' (single-store, extendable)
- `cp_session_v1` → forn session `{ id, username }` — id = tenant.id from TENANTS array

### Files changed
- **NEW** `src/utils/tenantStorage.js` — `mktKey(base)`, `fornKey(base)`, `migrateAndGet()`, `migrateToNamespace()`
- `src/pages/Login.jsx` — adds `storeId: 'default'` to session on login
- `src/store.jsx` — all `localStorage.getItem/setItem('cp_xxx')` → `mktKey('cp_xxx')`; `persist()` uses mktKey for localStorage, flat for server (Netlify Blobs compat)
- `src/pages/Fornecedor.jsx` — all data localStorage calls → `fornKey(KEY)`; migration IIFE at function start + migration in `handleLogin`
- **NEW** `src/components/Footer.jsx` — `etc!` / Zatende / Dubai / Bay Square (placeholder)
- `src/components/Layout.jsx` — Footer at bottom of sidebar (variant='mkt')
- `Fornecedor.jsx` LoginPage — Footer at bottom (variant='forn')

### Migration strategy (zero data loss)
- Mercado: `migrateAndGet(base, mktKey)` inside each useState lazy initializer — copies flat → `mkt:default:` on first load
- Forn: IIFE at top of `Fornecedor()` for returning sessions; `migrateToNamespace()` in `handleLogin` for fresh logins
- Server keys (Netlify Blobs) remain flat — backward compat preserved

## Known issues / next possible work
- Produtos page can be slow with 2795 products loaded (no virtual scroll)
- Validade "Sem data (2795)" — products need expiry dates added via ScanMobile or Receber Mercadoria
- Photos from OpenFoodFacts API can be unstable (503 errors)
- No real auth (PIN only) — not production-safe for multi-user
- Footer `etc!` placeholder — real address/contact data to be filled by team

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
**https://zatendestock.netlify.app**
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
- URL: https://zatendestock.netlify.app
- Site ID: abd4863b-ef7b-4d7c-b3f2-85547f519485
- Deploy via: `npx netlify-cli deploy --prod --dir=dist --site=abd4863b-ef7b-4d7c-b3f2-85547f519485`
- Login: admin / 1234 (changeable in Configurações → Acesso ao Sistema)

## Fornecedor.jsx — ZAP Server (Baileys local)
- `zap-server/server.js`: Express + Baileys, GET /status, POST /send, POST /send-all (1.5s anti-ban delay)
- BlastScreen: `zapConnected=true` → botão "Disparar para todos" (POST /send-all), senão wa.me manual
- Ping a cada 8s, dot verde/cinza no header; click abre modal config URL
- Para Netlify (HTTPS): `ngrok http 3001` e colar URL HTTPS no modal
- Para local: `npm run dev` → localhost:5173 chama localhost:3001 (ambos HTTP)
- Constantes: `ZAP_SERVER_KEY='cp_zap_server_url'`, `ZAP_DEFAULT='http://localhost:3001'`
- Props passadas: zapServerUrl/zapConnected → TabInicio/TabReceber/TabOfertas/BlitzModal → BlastScreen

## Fornecedor.jsx — Profile sync (logo cross-device)
- Profile (incluindo logoUrl base64) deve ser persistido no servidor via PROFILE_SERVER_KEY
- PROFILE_SERVER_KEY = 'cp_forn_profile_v1' (Netlify Blob key)
- sync() deve restaurar profile do servidor se localStorage vazio
- saveProfile() deve persistir ao servidor além do localStorage

## Fornecedor.jsx — Keys corretas (ATENÇÃO: CORRIGI DO AGENTS ANTERIOR)
- LOCAL = 'cp_fornecedor_v1' (localStorage profile, namespaced com fornKey())
- OFFERS_KEY = 'cp_supplier_offers' (flat — shared com Ofertas.jsx)
- ESTOQUE_KEY = 'cp_fornecedor_estoque' (flat — shared)
- ORDERS_KEY = 'cp_supplier_orders' (flat — shared)
- MKTS_SERVER_KEY = 'cp_distribuidor_markets' (flat — shared)
- PROFILE_SERVER_KEY = 'cp_forn_profile_v1'
- SESSION_KEY = 'cp_session_v1'

## ⚠️ DEPLOY CRÍTICO — Netlify Functions NÃO deployadas via zip
Quando se faz deploy via zip (API Netlify), as functions em netlify/functions/ NÃO são incluídas.
O catch-all `/* /index.html 200` responde pelo /api/restore e /api/persist retornando HTML.

**FIX IMPLEMENTADO (2025-08):** persistKey() e fetchAll() em Fornecedor.jsx + loadOffers/saveOrders
em Ofertas.jsx agora usam localStorage como PRIMARY store e servidor como fallback.
- Dados sempre escritos em localStorage (chave flat, sem namespace)
- Fallback detecta resposta não-JSON (Content-Type check) antes de fazer JSON.parse
- Cross-device sync ainda funciona quando functions estão deployadas (via netlify CLI --prod)
- Para fazer deploy COM functions: `NETLIFY_AUTH_TOKEN=... NETLIFY_SITE_ID=... npx netlify deploy --prod`
  (isso roda npm run build e deploya functions — leva ~5min)

## Login credentials para demo/apresentação
- Portal Corta Preço (mercado): admin / 1234 → https://zatendestock.netlify.app/login
- Portal Distribuidor: megatudo / mega2024 → https://zatendestock.netlify.app/fornecedor
- Cadastro de novos mercados: WhatsApp (011) 98595-0956

## ZatendeStockLogo component
- Arquivo: src/components/ZatendeStockLogo.jsx
- variant="full": ícone SVG grande + wordmark + tagline (login screens)
- variant="wordmark": ícone SVG 26px + wordmark inline (headers/sidebars)
- Cores: azul #5462D8 ("Zatende"), verde #4ade80 ("Stock")
- NÃO usa og-image.png — SVG puro, nunca quebra

---

## TASK-8 — Multi-tenant localStorage (CONCLUÍDA 2026-08)

### Separação de namespaces
```
mkt:{storeId}:{key}    →  Corta Preço / mercado (B2C)
forn:{tenantId}:{key}  →  Mega Tudo Barato / distribuidor (B2B)
```

### Chaves de sessão (sempre flat — são os identificadores do namespace)
| Chave | Quem escreve | Conteúdo |
|---|---|---|
| `cp_session` | Login.jsx | `{ loggedIn, user, storeId: 'default' }` |
| `cp_session_v1` | Fornecedor.jsx | `{ id: 'mega', username: 'megatudo' }` |
| `cp_market_session_v1` | Ofertas.jsx | `{ name, phone }` (identidade sem login PDV) |

### Funções utilitárias: `src/utils/tenantStorage.js`
- `mktKey(baseKey)` → `mkt:default:baseKey`
- `fornKey(baseKey)` → `forn:mega:baseKey`
- `migrateAndGet(baseKey, keyFn)` → lê chave nova; se vazia, copia da chave legada plana
- `migrateToNamespace(baseKeys, keyFn)` → migração bulk na primeira entrada

### Chaves planas compartilhadas (cross-system, sem namespace)
Essas chaves são acessadas por AMBOS os portais para comunicação cross-system:
- `cp_supplier_offers` — Fornecedor escreve, Ofertas lê
- `cp_supplier_orders` — Ofertas escreve, Fornecedor lê
- `cp_fornecedor_estoque` — Fornecedor escreve e lê
- `cp_distribuidor_markets` — Fornecedor escreve (markets registrados)
- `cp_forn_profile_v1` — Fornecedor escreve (logo, tema, dados), Ofertas lê para exibir

### Sync em tempo real (mesmo browser, tabs diferentes)
- **Ofertas → Fornecedor**: Ofertas salva pedido (`ORDERS_KEY`) → `storage` event dispara em Fornecedor → `orders` state atualizado automaticamente + badge "Pedidos" muda
- **Fornecedor → Ofertas**: Fornecedor publica oferta (`OFFERS_KEY`) → `storage` event dispara em Ofertas → `setRefreshAt(Date.now())` recarrega lista
- Backup: `setInterval(10s)` em Fornecedor lê `ORDERS_KEY` do localStorage para cobrir edge cases

### Fluxo da demo (mesmo dispositivo, dois tabs)
1. **Tab A** → `zatendestock.netlify.app/fornecedor` (login: megatudo / mega2024)
2. **Tab B** → `zatendestock.netlify.app/ofertas?s=mega`
3. Fornecedor publica oferta no Tab A → Tab B auto-atualiza (sem reload)
4. Mercado faz pedido no Tab B → WhatsApp abre + Tab A atualiza badge "Pedidos" em ≤10s
5. Fornecedor confirma pedido no Tab A → status muda para "confirmado"

## Bugs corrigidos (2026-08 TASK-8)
1. `/ofertas` retornava 404 — `_redirects` mandava para function não deployada. Fix: `/* /index.html 200` simples
2. Modal de identidade no `/ofertas` não aparecia na primeira visita — Fix: `useState(() => !hasSession)`
3. Fornecedor não detectava novos pedidos sem reload — Fix: storage event + interval de 10s
4. Ofertas não atualizava quando Fornecedor publicava oferta — Fix: storage event + `setRefreshAt`

## Bugs corrigidos (2026-08 TASK-9/10 mobile+scanner+WA)
5. **CRÍTICO — Netlify Functions não deployadas**: Todos os deploys anteriores via ZIP só enviavam `dist/`. As funções (`netlify/functions/`) NÃO eram incluídas. Resultado: `/api/restore` retornava HTML, `/api/persist` retornava 404, OG tags eram genéricas. Fix: usar Netlify CLI (`./node_modules/.bin/netlify deploy --prod --dir dist --functions netlify/functions --site ...`)
6. **WhatsApp preview genérico**: `/ofertas?s=mega` mostrava OG tags do `index.html` em vez das do fornecedor. Fix: og-ofertas.js agora altera og:image além de og:title/og:description. Criado og-mega.png (1200x630, SVG→PNG via sharp) para Mega Tudo Barato.
7. **og-ofertas.js CommonJS em pacote ESM**: Warning de bundler. Fix: convertido de `exports.handler` para `export const handler`.
8. **WebSocket retry infinito no Netlify**: scan relay tentava reconectar a cada 3s pra sempre. Fix: backoff exponencial (3s→6s→12s→30s), para após 5 falhas.
9. **Dashboard badge supplierOffers desatualizado**: store.jsx não ouvia a chave plana `cp_supplier_offers` no storage event. Fix: adicionado listener para essa chave.
10. **Scanner inacessível no mobile**: indicador passivo "Scanner" no PDV virou botão clicável que abre /scan.
11. **manifest.json start_url errado**: `"/fornecedor"` → `"/login"` para que mercados instalando o PWA abram tela correta.

## Como deployar corretamente (com funções)
```bash
cd /workspace/project
npm run build  # gera dist/
./node_modules/.bin/netlify deploy --prod --dir dist --functions netlify/functions --site abd4863b-ef7b-4d7c-b3f2-85547f519485 --auth TOKEN
```
NÃO use deploy via ZIP API — não inclui funções!

## Scanner — comportamento correto
- **Mesmo device (PDV na aba 1 + /scan na aba 2)**: funciona via localStorage storage event ✅
- **Cross-device (celular → PC diferente)**: NÃO funciona no Netlify (sem servidor WebSocket) ❌
- **Fornecedor mobile**: CameraScanner standalone, funciona 100% sem relay ✅
- **Estoque mobile**: /scan?mode=estoque funciona 100% standalone ✅

## WhatsApp — como enviar ofertas
- **INDIVIDUAL**: TabOfertas → clicar 📤 ao lado da oferta → BlastScreen → envia essa oferta específica
- **TODAS DE UMA VEZ**: TabInicio → "📣 Disparar para todos" → usa buildDailyBlastMsg() → envia todas as offers ativas
- **Preview do link**: compartilhar `https://zatendestock.netlify.app/ofertas?s=mega` → mostra "Mega Tudo Barato" + og-mega.png
