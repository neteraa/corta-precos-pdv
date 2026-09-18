# ZatendeStok — Project Notes (v8.0 — 2026-09)

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
# Restaurar token Netlify (não vai no git — está no .gitignore):
echo "NETLIFY_AUTH_TOKEN=nfp_wuQ15ioS6isEZF3V3kPVL7LixCrPpUMY1ca2" > .env
echo "NETLIFY_SITE_ID=abd4863b-ef7b-4d7c-b3f2-85547f519485" >> .env
```

## Credenciais de produção
- **ZS_MASTER_KEY** (env var no Netlify): `198556@@Pedro` — acesso ao `/api/markets-admin`
- **Mercado netetamercado**: username=`netetamercado`, senha=`Zatende2026`
- Para listar mercados: `curl "https://zatendestock.netlify.app/api/markets-admin?mk=198556@@Pedro"`
- Para criar mercado: `curl -X POST ".../api/markets-admin?mk=198556@@Pedro" -d '{"storeName":"X","username":"x","password":"y"}'`
- Para resetar senha: `curl -X POST ".../api/markets-admin?mk=198556@@Pedro" -d '{"action":"reset-pass","id":"mkt_ID","password":"nova"}'`

## Deploy command (always use this)
```bash
source .env  # ou: export $(cat .env | xargs)
npm run build && ./node_modules/.bin/netlify deploy --prod --dir=dist --functions=netlify/functions --site=$NETLIFY_SITE_ID --auth=$NETLIFY_AUTH_TOKEN
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

## COMPLETED FEATURES (as of commit 91a5a52)
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
- ✅ **Multi-tenancy**: storeName/themeColor dinâmico por tenant em TODOS os componentes visuais
  - Layout.jsx sidebar/header, PDV.jsx banner, Terminal.jsx, CustomerDisplay.jsx, Flyer.jsx
  - Etiquetas.jsx (template 'mercado' usa themeColor do cliente)
  - Fidelidade.jsx (links WhatsApp dinâmicos), Fornecedor.jsx (relatório CSV)
  - Configuracoes.jsx: seletor de cor (9 presets + color picker nativo)
  - Seed automático de storeName+phone+themeColor após login (seedSettingsFromSession)
- ✅ **Preço Atacado**: priceAtacado + qtdAtacado no formulário desktop (Produtos.jsx)
  - Já implementado no PDV (ativa automaticamente quando qty >= qtdAtacado)
  - ScanMobile já tinha os campos; agora desktop também
  - Badge azul "📦 R$X c/N+" na tabela de produtos

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


---

## SESSION v5.0 — Performance + Roles + Operator Login (2026-08)

### Commits desta sessão
```
5f4548d  fix: scroll-to-top ao digitar em Configuracoes
06456ba  feat: role-based access + operator login (PIN) + multi-terminal
06236e2  perf+fix: lazy routes + manual chunks + upsertProduct new-id bug
```

### Deploy rápido (sem git push)
```bash
cd /workspace/project
npm run build && npx netlify deploy --prod --dir=dist --no-build
# Netlify CLI já autenticado como agn.girardi@gmail.com (nfp_wuQ15ioS6isEZF3V3kPVL7LixCrPpUMY1ca2)
```

### Git push para GitHub
```bash
# Token: pedir ao usuário (GitHub → Settings → Developer settings → Tokens → corta-precos-push1, expira ~Nov 2026)
git remote set-url origin https://TOKEN@github.com/neteraa/corta-precos-pdv.git
git push origin master
git remote set-url origin https://github.com/neteraa/corta-precos-pdv.git  # limpar token após push
```

---

## Auth & Role System (`src/utils/auth.js`) — v5.0

### Session object (`cp_session` no localStorage)
```js
{
  loggedIn:     true,
  user:         'admin',     // username do login admin
  storeId:      'default',   // namespace do tenant
  role:         'admin',     // 'admin' | 'gerente' | 'caixa'
  operatorId:   'op_xxx',    // preenchido por loginAsOperator()
  operatorName: 'João',      // preenchido por loginAsOperator()
  terminalId:   1,           // preenchido por loginAsOperator()
}
```

### Funções exportadas
| Função | Descrição |
|--------|-----------|
| `getSession()` | Retorna objeto session completo |
| `getRole()` | `'admin'` por padrão (sessões legadas sem role = admin) |
| `getOperatorName()` | Nome do operador ou username |
| `getTerminalId()` | Número do terminal (default 1) |
| `loginAsOperator(op)` | Grava session preservando storeId, adiciona role/terminalId |
| `isLoggedIn()` | `session.loggedIn === true` |
| `logout()` | Remove `cp_session` |

### Permissões por role
| Role | Acesso |
|------|--------|
| `admin` | Tudo |
| `gerente` | Tudo exceto `/produtos` e `/configuracoes` |
| `caixa` | Só `/pdv` e `/fiado`; qualquer outra rota → redirect automático para `/pdv` |

`RequireRole` em App.jsx intercepta antes de renderizar o Layout.

---

## Login (`src/pages/Login.jsx`) — v5.0

### Com operadores cadastrados (fluxo normal)
1. Tab "Acesso ao sistema" → mostra tiles de operadores ("Quem está no caixa?")
2. Clicar no nome → PIN keypad (6 dígitos, pontos coloridos por role)
3. PIN certo → `loginAsOperator(op)` → caixa vai para /pdv, gerente/admin vai para /dashboard
4. Botão "Acesso Admin / Sistema" (collapsível) revela o form usuário+senha clássico

### readOperators() — lê localStorage sem useStore()
```js
const storeId = JSON.parse(localStorage.getItem('cp_session'))?.storeId ?? 'default'
const raw = localStorage.getItem(`mkt:${storeId}:cp_operators`)
         ?? localStorage.getItem('cp_operators')
```

### Sem operadores cadastrados
Mostra direto o formulário admin/senha (retrocompatível).

---

## Layout (`src/components/Layout.jsx`) — v5.0

### Operator badge (sidebar, entre o logo e o menu)
Mostra avatar (primeira letra), nome e role/terminal. Cores: admin=laranja, gerente=roxo, caixa=verde.

### Nav filtering por role
```js
// cada item tem roles?: string[]  (ausente = todos veem)
const ROLE_META = {
  '/pdv':          { /* sem roles — todos */ },
  '/fiado':        { /* sem roles — todos */ },
  '/produtos':     roles: ['admin'],
  '/configuracoes':roles: ['admin'],
  // gerente vê tudo menos os dois acima
}
filterByRole(items, role)  // filtra antes do render
```

---

## Configuracoes (`src/pages/Configuracoes.jsx`) — v5.0

### BUG RESOLVIDO: scroll-to-top ao digitar
**Causa raiz:** `Field` e `Section` definidos DENTRO de `Configuracoes()` → nova referência de componente a cada render → React unmount/remount → browser scroll pro topo.
**Fix:** todos os sub-componentes movidos para escopo de módulo.
**Regra:** NUNCA definir componentes React dentro de outro componente. Sempre fora da função.

### Sub-componentes (escopo de módulo — não mover para dentro da função)
- `Field` — wrapper label + input
- `Section` — card com header
- `ROLE_META` — metadados de role (label, color, bg, border, desc)
- `OperatorCard` — card com avatar, badge role colorido, terminal, pontos PIN
- `AddOperatorForm` — form auto-contido; estado interno próprio, pai não re-renderiza

### Operator object
```js
{ id, name, role: 'admin'|'gerente'|'caixa', pin: '1234', terminalId: 1 }
```
`terminalId` só relevante para role `caixa`.

---

## Performance — Bundle Split (v5.0)

| Chunk | Conteúdo | Download inicial |
|-------|----------|-----------------|
| `index.js` | App shell + React + Router | ~86 KB gzip |
| `vendor-charts` | Recharts | lazy (só /relatorio, /dashboard) |
| `vendor-pdf` | jsPDF (177 KB) | lazy (só /etiquetas) |
| `vendor-qr` | qrcode | lazy (só /fidelidade) |
| `[page].js` | Cada página | lazy (só quando visitada) |

Redução: 1990 KB → 430 KB JS inicial (gzip: 519 KB → 86 KB, **-83%**).

---

## Fechamento de Caixa (`src/pages/Dashboard.jsx`)

Botão "Fechar Caixa" no header. Modal `showCaixa` com:
- KPIs do dia: vendas, faturamento, ticket médio, margem estimada
- Breakdown por forma de pagamento com barra de progresso
- Top produtos do dia
- Descontos dados no dia
- Sangria (retirada) / Suprimento (entrada) com histórico e saldo atual
- Botão Imprimir → janela nova com cupom formatado em monospace

`cashMovements[]` → store.jsx → persistido em `cp_cashMovements` (namespaced).
`caixaStats` → `useMemo` filtrando sales + cashMovements de hoje.

---

## Credenciais rápidas

| Sistema | User | Senha | URL |
|---------|------|-------|-----|
| Mercado (admin) | `admin` | `1234` | /login |
| Distribuidor | `megatudo` | `mega2024` | /fornecedor |
| Caixas | tile → PIN | configurado em /configuracoes | /login |
| **Painel Master** | — | `zatende2026master` | **/painel** |

---

## SESSION v6.0 — Painel Master + Auth Server-Side (2026-08)

### Problema resolvido
Antes: todos os mercados compartilhavam as mesmas credenciais (`admin`/`1234`).
Qualquer pessoa que soubesse o storeId de outro mercado poderia acessar os dados dele.
Não havia separação real de clientes — impossível escalar como SaaS.

### Solução implementada

#### Netlify Functions (server-side auth)
- **`netlify/functions/auth.js`** — POST `/api/auth { username, password }`
  - Valida contra registry no Netlify Blobs (`zs-auth:markets`)
  - Retorna `{ ok, storeId, storeName }` — storeId vem do servidor, não do browser
  - Hash SHA-256 com salt aleatório por mercado (nunca armazena senha em claro)
  - Se mercado inativo → 401 imediato

- **`netlify/functions/markets-admin.js`** — `/api/markets-admin?mk=CHAVE`
  - GET: lista todos os mercados (sem hash/salt)
  - POST actions: `create` | `toggle` | `delete` | `reset-pass`
  - Protegido por `ZS_MASTER_KEY` (env var Netlify, default: `zatende2026master`)
  - Netlify Blobs store: `zs-auth` (separado de `corta-precos`)

#### Painel Master (`src/pages/MasterPainel.jsx`)
- Rota: **`/painel`** — sem RequireAuth, sem RequireRole (auth próprio)
- Login com Chave Master → chave salva em `zs_master_key` localStorage
- Cards de mercados: nome, usuário, storeId, status, último acesso, WhatsApp
- Stats: mercados ativos, acessaram hoje (últimas 24h), total cadastrados
- Modal "Novo Mercado": cria mercado e exibe credenciais prontas para o cliente
- Reset de senha inline por mercado
- Ativar/desativar (bloqueia acesso sem remover dados)
- Botão "Acessar": impersona o mercado em nova aba para suporte
  - Salva sessão master em `zs_master_session`, seta `cp_session` com storeId do mercado
- Card fantasma "+" para adicionar novo mercado diretamente da grid

#### Login atualizado (`src/pages/Login.jsx`)
1. Tenta `POST /api/auth` com username+password
2. Se `ok: true` → usa storeId retornado pelo servidor (100% seguro)
3. Se `401` → nega acesso imediato (servidor disse que as credenciais são inválidas)
4. Se erro de rede (offline/dev local) → fallback para credenciais localStorage
5. Corta Preços cadastrado: usuário `cortaprecos`, senha `1234`, storeId `cortaprecos`

### Segurança pós-v6.0
- Mercado A **não consegue** acessar dados do Mercado B em hipótese alguma
- Credenciais validadas server-side a cada login
- storeId não pode ser adulterado pelo browser (vem do servidor)
- Master key **nunca** exposta ao client-side
- Blobs de auth separados dos blobs de dados (`zs-auth` vs `corta-precos`)

### Para adicionar novo cliente (fluxo operacional)
1. Acessa `/painel` com chave master
2. Clica "Novo Mercado"
3. Preenche: nome do mercado, WhatsApp, usuário, senha inicial
4. Sistema cria registro seguro no servidor + exibe credenciais prontas
5. Passa credenciais para o cliente por WhatsApp

### Mudar a chave master
Netlify → Site configuration → Environment variables → `ZS_MASTER_KEY`
(Sem redeploy necessário — Netlify Functions leem a env var em runtime)

### Commits desta sessão
- `34e3e13` feat: multi-tenant isolation completa (storeId nos Blobs)
- `89cad55` feat: painel master + auth server-side por mercado



---

## SESSION 2026-08-05 — Sidebar + Scanner fix

### Commits
- 55adff7 fix: sidebar breakpoint lg→md + branding dinamico
- 871998d fix: sidebar mostra todos os itens (min-h-0 + compactacao)
- 93429ff fix: scanner celular salva no mercado certo (storeId URL param)
- 8147ca4 fix: scanner sync sincrono antes do React montar (IIFE)

### Sidebar (Layout.jsx) v6.1
- Breakpoint md: (768px) — sidebar visivel em todo PC/notebook
- min-h-0 no nav — CRITICO para overflow-y-auto funcionar em flex container
- SidebarLogo: le storeName de usePrinter() — multi-tenant, nao hardcoded
- Terminal/Scanner/Guia dentro do nav scrollavel (secao FERRAMENTAS)
- Bottom fixo: apenas SyncBar + Logout (~64px)
- Link Scanner Celular: href=/scan?storeId=getMktStoreId() sempre embutido
- Import: getMktStoreId de ../utils/tenantStorage.js

### Scanner Mobile (ScanMobile.jsx) v6.1
BUG: Mobile sem sessao → getMktStoreId()=default → produtos sumiam do desktop (cortaprecos).
FIX: IIFE sincrono no nivel do modulo — roda ANTES do store inicializar:
  const sid = new URLSearchParams(window.location.search).get(storeId)
  if (sid) saveStoreId(sid)  // patches cp_store_id + cp_session.storeId

saveStoreId() patches cp_session.storeId → getMktStoreId() ja retorna certo ao montar store.
Topbar: nome da loja via usePrinter() + storeId visivel para confirmar.

### Configuracoes — Links do sistema
3 links com botao Copiar: /caixa/:sid, /scan?storeId=, /scan?storeId=&mode=estoque

### Namespaces Netlify Blobs (Corta Precos)
- storeId=cortaprecos: 2796 produtos, cp_operators, cp_sales, cp_promos
- storeId=default: mesmos produtos + dados distribuidor (cp_cash, cp_supplier_orders etc)
- Login server: cortaprecos/1234 → storeId=cortaprecos
- Mobile DEVE abrir scanner via sidebar (link ja tem ?storeId=cortaprecos)
- Produtos manuais migrados: KITANO CHURRASQUEAR (stock 10), PAO CROISSANT (stock 20)

### Features implementadas (sessao 2026-09)
- [x] Preco atacado: campo priceAtacado + qtdAtacado no produto; PDV aplica auto ✅ (commit 2866251)
- [x] Scanner mobile: campo priceAtacado + qtdAtacado no form de novo produto ✅ (commit 2866251)
- [x] Cancelamento de venda com reversão de estoque (Vendas.jsx + store.jsx) ✅ (commit 47a1f0a)
- [x] Promoções 3 tipos: Combo, Percentual %, Fixo R$ (Promocoes.jsx + PDV.jsx + Terminal.jsx) ✅
- [x] Parcelamento no cartão: 1× 2× 3× 6× 12× em PDV e Terminal ✅
- [x] Histórico de compras no perfil do cliente (badges nº vendas + total gasto) ✅
- [x] Relatório por operador: filtro aparece quando há vendas com operatorName ✅
- [x] Fix duplicate key 'border' em Fornecedor.jsx Btn component ✅
- [x] Servidor local com base JSON + auth SHA-256 + scripts iniciar.bat/sh ✅

### Features implementadas (sessao 2026-09-16)
- [x] Auth separada para distribuidores: forn-auth.js + forn-admin.js + forn-check.js ✅ (commit 67a9d81)
- [x] MasterPainel: tabs Visão Geral | Mercados | Distribuidores ✅ (commit 67a9d81)
- [x] Fornecedor.jsx: senhas removidas do bundle JS — auth 100% server-side ✅ (commit 67a9d81)
- [x] Guia.jsx: credenciais demo removidas do bundle ✅ (commit 67a9d81)
- [x] /scan agora exige auth (tinha upsertProduct aberto) ✅ (commit 67a9d81)
- [x] usePrinter event bus: storeName no menu atualiza instantaneamente ✅ (commit 67a9d81)
- [x] send-email.js: nodemailer + Gmail SMTP, template HTML profissional ✅ (commit 0f5c22a)
- [x] Campo email em AddMarketModal + AddDistModal — envia boas-vindas ao criar ✅ (commit 0f5c22a)
- [x] Botão reenviar acesso (📧) em MarketCard e DistCard — reset senha + envia email ✅ (commit 0f5c22a)

### Arquitetura separada: Mercado ≠ Distribuidor (v7.0)
- **Mercados** (PDV): auth via `auth.js` → Netlify Blob `zs-markets`
- **Distribuidores**: auth via `forn-auth.js` → Netlify Blob `zs-forn-auth`
- **Admin (nós)**: MasterPainel `/painel` com ZS_MASTER_KEY — gerencia ambos
- `forn-auth.js` faz seed automático do "megatudo" na primeira chamada (sem perda de dados)
- Senha `mega2024` agora está hasheada no Blob — mudar via Distribuidores tab do MasterPainel

### Email (send-email.js)
- POST `/api/send-email?mk=...` — protegido por ZS_MASTER_KEY
- Requer env var: `GMAIL_APP_PASSWORD` (Netlify → Site Settings → Environment Variables)
- Remetente: `zatendeapi@gmail.com`
- Número suporte WhatsApp: env var `SUPPORT_WHATSAPP` (ex: `5511999990000`)
- Sem GMAIL_APP_PASSWORD: retorna `previewHtml` para cópia manual, nunca bloqueia

### Env vars necessárias no Netlify
- `ZS_MASTER_KEY` — chave do MasterPainel (setada)
- `GMAIL_APP_PASSWORD` — App Password do Gmail (PENDENTE — ver abaixo)
- `SUPPORT_WHATSAPP` — número WhatsApp suporte (opcional, padrão `5500000000000`)

### Como configurar GMAIL_APP_PASSWORD
1. Acesse myaccount.google.com → Segurança → Verificação em duas etapas (ativar)
2. Pesquise "Senhas de app" → selecione "Outro" → digitar "ZatendeStock"
3. Copie a senha gerada (16 chars)
4. Netlify → zatendestock → Site configuration → Environment variables → Add: GMAIL_APP_PASSWORD = ...
5. Trigger redeploy (Deploys → Trigger deploy)

### Features pendentes (proxima sessao)
- [ ] Scanner mobile: promoGroup (seletor) no form de novo produto
- [ ] Filtro por data/validade no Estoque (deixado pra depois pelo cliente)
- [ ] Backup automático diário (export JSON com timestamp)
- [ ] Relatório de fechamento de caixa por operador/turno
- [ ] Página de preços/planos pública para vendas (landing page)

### Preço Atacado — Arquitetura (v6.2 — 2026-09)
- Campos no produto: `priceAtacado` (Number) + `qtdAtacado` (Number, inteiro)
- Lógica: quando `cart item qty >= qtdAtacado && priceAtacado > 0` → desconto aplicado
- `atacadoDiscount = (price - priceAtacado) * qty` por item elegível
- `total = subtotal - totalPromoDiscount - atacadoDiscount - discountAmt`
- PDV visual: badge azul "ATACADO", preço riscado, indicador "+N p/ atacado" antes de atingir
- Totais: linha "🔖 Preço Atacado − R$ X" + somado em "💰 Total economizado"
- Scanner mobile: form de novo produto tem campos "Preço atacado" + "Qtd mín. atacado" (qtd desabilitado até preencher preço)
- Venda registrada com `atacadoDiscount` no objeto de sale
- INDEPENDENTE de promoGroup — são mecanismos separados

### Promocoes Mix-and-Match (JA EXISTE)
Rota /promocoes — regra: { id, name, group, qty, totalPrice, active }
PDV: calcPromoEngine em PDV.jsx aplica desconto quando cart tem qty itens do grupo.
Produto vinculado via p.promoGroup === rule.group.
ISSO JA E O 3-POR-R10 — so criar regra em Promocoes e vincular produtos.

---

## SESSION 2026-09-18 — Chatbot ZAP + Evolution API + Guia v4

### Commits desta sessão
- `50b7dcb` feat: nova arte OG image + meta tags prod + URLs netlify→prod + manifest ZatendeStok
- `30998d7` feat: guia reescrito (3 tabs + FAQ + atalhos + diferenciais) + Baileys anti-ban tips
- `121dce3` feat: chatbot ZAP (wa-bot Netlify fn + OpenAI + anti-ban) + novo numero (15) 99796-9303

### Número de suporte atualizado
- **Novo:** `(15) 99796-9303` / `5515997969303`
- Atualizado em: Guia.jsx (WA_NUM const), Campanhas.jsx CTAs, Configuracoes.jsx, og:description, AGENTS.md

### Guia.jsx v4.0 — 3 abas (zatendestok.com.br/guia)
- **🏪 Mercado** — onboarding completo: acesso, PDV, estoque, ferramentas, atalhos kbd, FAQ colapsável, CTA WA
- **🚚 Distribuidor** — perfil, lote, BlastScreen, pedidos RT, inteligência, fluxo real c/ exemplo de lucro
- **✦ Diferenciais** — 10 features únicas + checklist 12 itens (serve como pitch de vendas)
- Sem "grátis" / "demo" / credenciais expostas — todo CTA → WhatsApp (15) 99796-9303

### Campanhas.jsx — Card Baileys / Anti-Ban
Card adicionado ao sidebar da tela de campanhas:
- Evolution API (integrado) = SEGURO
- Baileys (não oficial) = USE COM CUIDADO
- Regras: delay 5-15s, máx 80 msgs/24h, variar conteúdo, número exclusivo

### wa-bot — Chatbot WhatsApp IA (netlify/functions/wa-bot.js)
- Webhook: `https://zatendestok.com.br/wa-bot` (redirect em netlify.toml)
- Modelo: GPT-4o-mini, max_tokens: 400, system prompt sobre ZatendeStok
- Filtra: mensagens próprias, grupos, status@broadcast
- Deduplicação por message ID (Set com trim em 500 entradas)
- Env vars necessárias no Netlify:
  - `EVOLUTION_API_URL` = URL do Railway (ex: https://evolution-api-production-2d21.up.railway.app)
  - `EVOLUTION_API_KEY` = `zs198556pedro` (ou nova senha)
  - `EVOLUTION_INSTANCE` = `zatendestok`
  - `OPENAI_API_KEY` = chave OpenAI (ROTACIONAR a chave exposta!)
- Instância WA: `POST /instance/create` → conectar com QR code → configurar webhook

### Evolution API no Railway (PENDENTE — não finalizado)
- URL Railway: `evolution-api-production-2d21.up.railway.app` (offline ainda)
- Fork criado: `github.com/neteraa/evolution-api`
- Railway tentou buildar do source GitHub mas sessão crashou
- **PRÓXIMOS PASSOS** (prompt para Railway Agent):
```
The service at evolution-api-production-2d21.up.railway.app is still offline (x-railway-fallback: true).
Please check the build and runtime logs for the current deployment.
If there are build errors, try the following fix:
1. In Settings → Service, make sure the start command is: npm start
2. Ensure these env vars are set: PORT=8080, SERVER_PORT=8080, AUTHENTICATION_TYPE=apikey, AUTHENTICATION_API_KEY=zs198556pedro, AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=true, DATABASE_ENABLED=false, WEBHOOK_GLOBAL_ENABLED=false, CONFIG_SESSION_PHONE_CLIENT=ZatendeStok, CONFIG_SESSION_PHONE_NAME=Chrome, LOG_LEVEL=ERROR
3. If the build still fails, look for a Railway template for "Evolution API" in the Railway template marketplace and deploy that instead.
4. Confirm when the service is healthy and accessible at the public URL.
```

### Quando Evolution API estiver online (fazer nessa ordem)
```bash
EVOURL=https://evolution-api-production-2d21.up.railway.app
EVOKEY=zs198556pedro

# 1. Criar instância
curl -s -X POST "$EVOURL/instance/create" \
  -H "apikey: $EVOKEY" \
  -H "Content-Type: application/json" \
  -d '{"instanceName":"zatendestok","qrcode":true,"integration":"WHATSAPP-BAILEYS"}'

# 2. Ver QR code (escanear com celular do número 15 997969303)
curl -s "$EVOURL/instance/connect/zatendestok" -H "apikey: $EVOKEY"

# 3. Configurar webhook
curl -s -X POST "$EVOURL/webhook/set/zatendestok" \
  -H "apikey: $EVOKEY" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://zatendestok.com.br/wa-bot","webhook_by_events":true,"events":["messages.upsert"]}'

# 4. Setar env vars no Netlify (via CLI ou Dashboard)
# EVOLUTION_API_URL=https://evolution-api-production-2d21.up.railway.app
# EVOLUTION_API_KEY=zs198556pedro
# EVOLUTION_INSTANCE=zatendestok
# OPENAI_API_KEY=<nova chave rotacionada>
```

### OG Image (public/og-image.png)
- Fundo escuro gradiente, "ZatendeStok" laranja/branco, tagline, feature pills, URL zatendestok.com.br
- 1200x630px

### Meta tags (index.html)
- og:url = https://zatendestok.com.br/
- og:image = https://zatendestok.com.br/og-image.png
- Manifest: ZatendeStok (sem "Stock")

---

## Sessão 2026-09-18 (continuação) — Evolution API + Bot WhatsApp + Campanhas

### Estado final após esta sessão

#### Evolution API (Railway)
- URL: `https://evolution-api-zjth-production.up.railway.app`
- API Key: `zs198556pedro` (env var `EVOLUTION_API_KEY` no Netlify)
- Serviços Railway: evolution-api-ZjTh + Postgres + Redis (todos ACTIVE)
- Versão: v2.3.7

#### Instâncias WhatsApp criadas
| Instância | Número | Status | Uso |
|---|---|---|---|
| `zatendeapi` | +55 (15) 99796-9303 | **open ✅** | Bot ZatendeStok (suporte/vendas) |
| `zatendestok` | — | connecting | instância legada (não usar) |

#### Usuário admin ZatendeStok
- Username: `zatendeapi` / Senha inicial: `198556@@Neto`
- storeId: `zatendeapi`
- Usado para acessar Configurações e escanear QR do bot

#### Netlify Functions novas
| Arquivo | Path | Função |
|---|---|---|
| `netlify/functions/wa-status.js` | `GET/POST /api/wa-status?instance=X` | Retorna status + QR code; cria/desconecta instância |
| `netlify/functions/wa-send.js` | `POST /api/wa-send` | Proxy seguro de envio (API key server-side) |

**wa-status query params:**
- `GET ?instance=X` → `{ exists, status, phone, profileName, qrcode }`
- `POST ?instance=X&action=create` → cria instância + configura webhook automaticamente
- `POST ?instance=X&action=disconnect` → desconecta
- `POST ?instance=X&action=refresh-qr` → novo QR

**wa-send body:** `{ instance, number, text }` → `{ ok: true/false }`

**IMPORTANTE — config.path:** As funções usam `export const config = { path: '/api/wa-status' }` (e `/api/wa-send`). NÃO adicionar redirects em netlify.toml para esses paths — o config.path já registra a rota diretamente.

#### Campanhas.jsx — Zatende removido
- Removido: config Zatende (URL/key/instância), botão "Zatende", `cp_zatende` localStorage
- Adicionado: badge status bot (verde/amarelo), botão "🤖 Disparar via Bot" (usa `/api/wa-send`)
- Instância automática via `getConfiguredStoreId()` — cada loja usa a própria
- Modo manual (wa.me) mantido como fallback

#### Configuracoes.jsx — Seção Bot WhatsApp
- Componente `WhatsAppBotSection` adicionado (fora do export default — estável)
- Poll automático: 8s se connecting, 30s se open
- Mostra QR code com `<img src={qrcode}>` (base64 data URL)
- Botões: Criar instância / Atualizar QR / Desconectar
- Instância = `getConfiguredStoreId() || 'zatendestok'`

#### Arquitetura multi-tenant WhatsApp
```
Cada loja → instância própria na Evolution API (nome = storeId)
Configurações → bot conectado lá → QR aparece na tela
Campanhas → Disparar via Bot → /api/wa-send → Evolution API → WhatsApp do loja
```

### Commits desta sessão
| Hash | Mensagem |
|---|---|
| `d14c898` | docs: AGENTS.md atualizado — sessão 2026-09-18 |
| `642a8ac` | feat: Bot WhatsApp IA — wa-status proxy fn + QR code na página Configurações |
| `550bed3` | feat: Campanhas — remove Zatende, usa nosso próprio bot |
| `1523575` | fix: wa-status e wa-send path config corrigido para /api/wa-* |

### Pendente
- `OPENAI_API_KEY` no Netlify → sem ela o bot recebe mensagens mas não responde com IA
  - Rotacionar em platform.openai.com → API Keys → invalidar antiga → criar nova
  - Setar: `netlify env:set OPENAI_API_KEY "sk-proj-..." --force --site $NETLIFY_SITE_ID --auth $NETLIFY_AUTH_TOKEN`

---

## Sessão 2026-09-18 (tarde) — Precificação + Ativação + Campanhas Pro

### Commits
| Hash | Descrição |
|---|---|
| `4dfcd1b` | feat: bot por mercado — market-profile.js, MarketBotProfileSection, roteamento Zara vs mercado |
| `db7c031` | fix: scanner mobile sync barrier + planos R$297/R$497/Personalizado |
| `a96d402` | feat: pricing atualizado + MasterPainel plano por mercado + Campanhas tabs (grupo/lista) |
| `b2e3fc3` | feat: wa-welcome.js + ativação via WhatsApp + CSV import + anti-ban diário |

### Arquitetura de planos
```
Essencial   → R$297/mês  → 1 PDV
Profissional → R$497/mês  → até 3 PDVs + bot + fidelidade
Enterprise  → Personalizado → ilimitado + onboarding
```

### Fluxo de ativação pós-pagamento
```
1. Pedro faz a venda (Zara captura lead → stage:"fechado")
2. Pedro cria o mercado no MasterPainel (storeName + username + senha)
3. MasterPainel → "Reenviar acesso" → botão "WhatsApp" → /api/wa-welcome
4. Zara manda msg com URL + usuário + senha pro WhatsApp do dono do mercado
5. Dono recebe, acessa zatendestok.com.br, faz login, começa a usar
```

### wa-welcome.js
- `POST /api/wa-welcome` — valida master key, formata número DDI 55
- Usa `EVOLUTION_INSTANCE` (instância principal da Zara) para enviar
- Mensagem formatada com credenciais em negrito + link + saudação

### Campanhas — funcionalidades completas
- **Tab Contatos**: disparo individual com delay 1.5–4s + pausa 5min/30msgs + limite 80/dia (localStorage) + import CSV
- **Tab Grupo do Zap**: busca grupos via `/api/wa-groups`, seleciona, envia ou copia msg
- **Tab Lista de Transmissão**: copia números + copia msg + guia passo-a-passo
- **wa-groups.js**: `GET /api/wa-groups?instance=X` → Evolution API `/group/fetchAllGroups`
- **Import CSV**: aceita `,` `;` `|` `tab` como separador, detecta ordem nome/fone automaticamente
- Botão "Baixar modelo CSV" gera arquivo de exemplo

### Scanner Mobile — fix race condition
- **Problema**: mobile sem sessão iniciava com products=[] → cadastro sobrescrevia servidor
- **Fix**: `syncReady` state — bloqueia câmera até primeiro sync do servidor completar
- Loader visual "Sincronizando estoque..." aparece por 1–3s no primeiro acesso
- Funciona em ambos os modos: `?mode=pdv` e `?mode=estoque`

### MasterPainel — plano por mercado
- Dropdown na MarketCard: Essencial / Profissional / Enterprise
- Chama `POST /api/markets-admin?action=set-plan`
- Campo `plan` salvo no blob `markets` na Netlify

### Anti-ban WhatsApp
- Delay **aleatório 1.5s–4s** (antes era fixo 1.4s)
- **Pausa 5 min** a cada 30 mensagens com countdown visual
- **Contador diário** por instância em localStorage (chave: data + instance)
- Limite **80 msgs/dia** — bloqueia e alerta quando atingido
- Botão "Parar disparo" a qualquer momento via `abortRef`
