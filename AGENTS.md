# ZatendeStok — AGENTS.md (v12.0 — 2026-09-22)

## Projeto

**Nome:** ZatendeStok / Corta Preços PDV
**Stack:** React 18 + Vite + Tailwind CSS + Netlify Functions (ESM)
**Repo:** https://github.com/neteraa/corta-precos-pdv
**Prod:** https://zatendestok.com.br
**Netlify Site ID:** abd4863b-ef7b-4d7c-b3f2-85547f519485
**Deploy:** npx netlify-cli deploy --prod --dir=dist --auth=$NETLIFY_AUTH_TOKEN

---

## Infraestrutura

| Serviço | Detalhes |
|---------|----------|
| Frontend | React + Vite em /workspace/project/src/ |
| Functions | Netlify Functions ESM em netlify/functions/ |
| DB | Netlify Blobs: zs-auth (markets), corta-precos (products), wa-leads (leads) |
| WhatsApp | Evolution API no Railway — https://evolution-api-zjth-production.up.railway.app |
| Instância WA | zatendeapi · open · +55 15 9979-6930 · nome: "zatende" |
| Webhook WA | https://zatendestok.com.br/wa-bot · MESSAGES_UPSERT · enabled: true |
| OpenAI | gpt-4o-mini · max_tokens: 350 · temp: 0.75 · timeout: 12s |
| WS Relay | Railway — wss://ws-relay-production-42a7.up.railway.app/ws/scan |
|         | Projeto: charming-dedication · Serviço: ws-relay (69a44033) |
|         | rootDirectory=relay · startCommand=node ws-relay.js |
|         | Autenticação: HMAC-SHA256 com ZS_PERSIST_SECRET |
| Railway latência | ~3.5s cold start |

---

## Env Vars (Netlify — nunca committar)

- EVOLUTION_API_URL     ✅
- EVOLUTION_API_KEY     ✅
- EVOLUTION_INSTANCE    ✅
- OPENAI_API_KEY        ✅ (sk-proj-4FVEl...)
- WA_BOT_SECRET         ❌ ausente (não crítico)
- ZS_PERSIST_SECRET     ✅ (64 chars hex — production; também no Railway ws-relay)
- VITE_WS_RELAY_URL     ✅ wss://ws-relay-production-42a7.up.railway.app (todos os contextos)

**CRITICAL:** VITE_ vars precisam de `export VITE_XXX=val && npm run build` — variáveis inline no mesmo
comando (`VITE_XXX=val npm run build`) NÃO são injetadas pelo shell do CI da Netlify. Sempre usar `export`.

**NOTA domínio Railway:** O domínio real é `ws-relay-production-42a7.up.railway.app` (com sufixo -42a7),
NÃO `ws-relay-production.up.railway.app`. Confundir os dois quebra o relay silenciosamente.

---

## Arquivos-chave

src/pages/Landing.jsx         — landing dark completa (hero, demos, planos, afiliados, FAQ)
src/pages/Demo.jsx            — /demo hub + /demo/:niche PDV interativo sem auth
src/pages/Afiliado.jsx        — landing afiliados com simulador de ganhos
src/pages/Login.jsx           — login, salva niche na session
src/components/ZatendeStokLogo.jsx — ZSMark SVG + wordmark laranja/âmbar (fundo warm-dark #0d0b07→#1a1307)
src/components/ZaraMascot.jsx — mascote Zara, flat SVG 280×390px, animações: float/blink/wave/pulse
                                  props: width, className, style · usado no hero de /afiliado
src/components/Layout.jsx     — sidebar niche-aware tema dinâmico
src/hooks/usePrinter.js       — NICHE_META, getNicheMeta()
src/index.css                 — html,body overflow-x:hidden global
netlify/functions/wa-bot.js   — Zara bot (fire-and-forget, timeout 26s, OpenAIQuotaError fallback)
netlify/functions/wa-status.js
netlify/functions/markets-admin.js
netlify/functions/auth.js
netlify.toml                  — [functions."wa-bot"] timeout = 26

---

## Nichos

mercado      🏪 #f97316 — PDV multi-caixa, FIFO, promoção 3x2
padaria      🥖 #d97706 — 5 pães R$5,90 auto, venda por peso
acougue      🥩 #dc2626 — venda por kg, controle de lote
restaurante  🍽️ #0891b2 — comanda por mesa, QR Code
lanchonete   🌯 #16a34a — adicionais auto, fila live
distribuidora 🚚 #1d4ed8 — venda por caixa/grade, rota entrega

---

## Planos

Essencial    R$297/mês — 1 PDV, fiado, validade, estoque, relatórios
Profissional R$497/mês ⭐ — 3 PDVs + Zara bot + fidelidade + campanhas
Personalizado sob consulta — PDVs ilimitados, onboarding, SLA

---

## Afiliados

Comissão R$150 (Essencial) / R$250 (Profissional) — PIX na hora
Cadastro: /afiliado (landing dark com simulador de ganhos via slider)

---

## wa-bot.js — Multi-modo

### Corta Preços bot (atendente da loja)
CORTA_PRECOS_INSTANCES = ['zatendeapi', 'cortaprecos_1789770018182']
  - instanceName vem como 'cortaprecos_1789770018182' do webhook Evolution API
  - Carrega catálogo (produtos + promos) do Netlify Blob com cache 20min
  - buildCatalogText: máx 60 produtos (ordenados por estoque), 1 linha por categoria
  - buildCortaPrecosPrompt: atendente do Corta Preços, faz delivery R$7 PIX
  - Fallback sem OpenAI: keywords → resposta contextual + telefone (15) 9979-6930
  - Delivery: bot anota endereço, confirma por PIX, painel em /entrega

### Zara (vendas ZatendeStok)
ZARA_INSTANCES = ['zatendestok']
  - System prompt ~6900 chars, 14 módulos, leads, afiliados

### Proteções anti-dreno
  - Rate limit: 20 msgs/hora por número (descarta silenciosamente)
  - MAX_HISTORY: 8 trocas (era 12)
  - Catálogo: 60 produtos em formato compacto (era 100, verbose)
  - sendReply fire-and-forget, AbortController 8s
  - OpenAIQuotaError → fallback humanizado com keywords (nunca fica mudo)
  - Ignora: fromMe, grupos, áudio, sticker, reaction

### Fluxo de entrega (Corta Preços)
  - PIX CNPJ: 60.662.362/0001-70 — chave hardcoded no prompt do bot
  - Bot gera tag `<zs_delivery>{phone,name,address,items,total,deliveryFee:7}</zs_delivery>`
  - saveDeliveryOrder() escreve direto no blob corta-precos:cortaprecos_1789770018182:cp_deliveries
  - delivery.js GET /api/delivery sem auth (storeId escopa dados)
  - delivery.js POST /api/delivery aceita pedido direto (bot ou frontend)
  - Entrega.jsx auto-refresh 15s + visibilitychange
  - extractText: imageMessage sem caption → "[comprovante enviado]" (bot responde ao comprovante)
  - Fluxo: coleta endereço → lista produtos+preços → calcula total+R$7 → envia PIX CNPJ → pede comprovante → confirma pedido → emite tag delivery

### Sync Configurações Cross-Device
  - cp_settings no blob: {storeName, phone, pixKey, pixCity, themeColor} (sem logoImage)
  - persist.js e restore.js: cp_settings adicionado aos KEYS
  - saveSettings em Configuracoes.jsx persiste tudo ao blob
  - store.jsx applyServerData: cp_settings → localStorage (só campos vazios)
  - Configuracoes.jsx: useEffect preenche form quando settings sync chega
  - Blob pré-populado: pixKey=60662362000170, phone=(15)9979-6930, pixCity=BOITUVA

---

## Markets em produção (blob zs-auth)

mkt_1789747558270       — Nete Ta Mercado (mercado)
mkt_1789762223411       — ZatendeStok Admin (mercado)
cortaprecos_1789770018182 — Corta preços (mercado) — 2797 produtos
padariateste_1790000668712 — Padaria Teste (padaria)

---

## URLs

/           Landing dark
/demo       Hub demos 6 nichos
/demo/:niche PDV interativo (sem auth)
/afiliado   Landing afiliados
/login      Login sistema
/painel     MasterPainel admin (chave: 198556@@Pedro)

---

## Design System — Landing (v10.0)

**Fonte:** Bricolage Grotesque (800w) para h1/h2/stats — Google Fonts variável
**Corpo:** Inter (400/700/800/900) — sistema autenticado usa Tailwind defaults

**Hero:**
- Layout: 2 colunas flex-row no desktop (≥700px), flex-column no mobile
- `alignItems:'flex-start'` + `paddingTop:'max(110px,14vh)'` — sem vazio no topo
- `minHeight:'100dvh'` mantido para scroll indicator funcionar
- Coluna visual: PDVMock (234px) com `animation:phoneFloat 4.5s ease-in-out infinite`
- `filter: drop-shadow(0 32px 48px rgba(249,115,22,.18))` no phone

**Animações CSS:**
- `phoneFloat`: levita 14px + rotate(2deg) infinito
- `.rv` / `.rv.in`: scroll reveal via IntersectionObserver (threshold 0.12)
- `.rv-d1..d6`: stagger delays 0.08s → 0.58s
- `bobArrow`: seta no bottom do hero

**Aplicado em:**
- Stats números: rv-d1..d4 com Bricolage 40px/800
- Demo cards: rv rv-d1..d6 (staggered por índice)
- Demo section header: rv

**Paleta:** `#f97316` (laranja) / `#fbbf24` (âmbar) — ZERO roxo/verde AI
**Seções dark:** inline styles (não Tailwind) — Landing.jsx, Afiliado.jsx, Demo hub

---

## QA produção (22/09/2026)

| Check | Status |
|---|---|
| Landing / | ✅ 200 |
| /demo | ✅ 200 |
| /demo/mercado..distribuidora | ✅ 200 (todos 6) |
| /login | ✅ 200, rejeita credencial inválida |
| /afiliado | ✅ 200, slider funcionando |
| /painel | ✅ login com 198556@@Pedro, 4 mercados visíveis |
| /api/wa-status | ✅ status:open, phone:5515997969303 |
| /wa-bot | ✅ HTTP 200, captura lead (testado) |
| PDV demo interativo | ✅ carrinho, total, pagamentos |
| Leads Bot | ✅ 13 leads capturados pela Zara |

---

## Bugs corrigidos (v11.0 — críticos do primeiro cliente)

**Ver CHANGELOG.md para histórico completo detalhado.**

| Bug | Arquivo | Commit |
|---|---|---|
| storeId sem `_` → produto celular não aparecia no terminal | auth.js, ScanMobile.jsx | cc133ce, 4c89d90 |
| Estoque dobrado ao cadastrar produto novo pelo celular | ScanMobile.jsx | 43aaef3 |
| Race condition no lote de entrada (N POSTs simultâneos) | store.jsx, ScanMobile.jsx | 43aaef3 |
| Sync de 30s apagava produtos recém-importados | store.jsx | 5a09a32 |
| Scanner concatenava códigos após produto não encontrado | Terminal.jsx | 4c89d90 |
| Terminal retornava produto errado ao escanear mesmo item | Terminal.jsx | 3e1a018 |
| IDs duplicados em cadastros rápidos (sem sufixo random) | store.jsx | 5a09a32 |
| Flash de SEED_PRODUCTS após limpar base de dados | store.jsx | 5a09a32 |
| Operadores não apareciam no lock screen do terminal | Terminal.jsx | e871104 |
| Sem foco automático após login de operador | Terminal.jsx | e871104 |
| Race condition sobrescrevia operadores adicionados | store.jsx | b49fd83 |

---

## Regras de conflito de sync (store.jsx)

```
applyServerData():
  Produtos   → local vence se prev.length > parsed.length (POST em trânsito)
  Operadores → local vence se prev.length > serverOps.length (mesmo padrão)
  Vendas     → servidor sempre vence
  Clientes   → servidor sempre vence
  Promos     → servidor sempre vence
```

---

## Fluxo mobile→desktop correto (validado)

```
storeId correto = 'cortaprecos_1789770018182'  (com _ preservado pelo slugify)

getConfiguredStoreId() → prefere cp_session.storeId (tem o valor original com _)
                      → fallback cp_store_id (pode estar sem _ em instalações antigas)

URL enviada ao celular:  /scan?storeId=cortaprecos_1789770018182&mode=estoque
Celular salva em:        cortaprecos_1789770018182:cp_products  ✅
PC lê de:               cortaprecos_1789770018182:cp_products  ✅
```

ScanMobile não chama mais `saveStoreId()` (ver comentário no topo do arquivo).  
IIFE inicial define `cp_store_id` e `cp_session.storeId` diretamente sem slugify.

---

## Estado dos dados Corta Preços (22/09/2026)

- **2797 produtos** no namespace `cortaprecos_1789770018182:cp_products`
- 1 produto migrado de namespace errado nesta sessão: DODON FRUTAS VERMELHAS 140G

---

## Commits recentes

(próximo)    — chore: AGENTS.md v12.0 + relay E2E verificado
c1201179    — feat: WebSocket relay for cross-device scanner → PDV
af8696cd    — fix: secure tenant persistence and sync
9b10d8d9    — chore: AGENTS.md v11.0 + CHANGELOG.md completo
cc133ce     — fix: storeId com underscore — causa raiz produto não aparecer no terminal
43aaef3     — fix: ScanMobile — estoque dobrado + race condition no lote de entrada
5a09a32     — fix: 3 buracos de segurança no fluxo de persistência de produtos

---

## Controle de Lotes (Multi-lot / FIFO)

Produtos podem ter múltiplos lotes com datas de vencimento diferentes.

**Estrutura:**
```js
product.lots = [
  { id: 'lot_xxx', qty: 20, expiryDate: '2024-01-10', receivedAt: '...' },
  { id: 'lot_yyy', qty: 30, expiryDate: '2024-01-30', receivedAt: '...' },
]
// product.stock = soma dos lotes (mantido em sync)
// product.expiryDate = data do lote mais próximo ao vencimento
```

**Invariantes:**
- Produtos sem lotes (`lots` vazio/undefined): comportamento idêntico ao anterior
- Produtos com lotes: `stock = lots.reduce((s,l)=>s+l.qty,0)`
- FIFO automático na venda (registerSale em store.jsx)

**Fluxo de entrada (Estoque.jsx):**
1. Escanear produto → linha na lista com qty e data de vencimento
2. Botão `[L+]` para adicionar novo lote do mesmo produto (data diferente)
3. Badge "Lote 1", "Lote 2" identifica múltiplos lotes na lista
4. Confirmar → cada linha chama addLot(productId, {qty, expiryDate})

**Validade.jsx:**
- Produtos com lotes são expandidos em linhas separadas por lote
- Badge "Lote 1/2", "Lote 2/2" — editável individualmente
- "Gerar Promoção" usa qty do lote específico

---

## Padrões

- Inline styles → componentes dark (Landing, Afiliado, Demo hub)
- Tailwind classes → sistema autenticado (Layout, PDV, Dashboard)
- CSS const com @media → responsividade Landing (560px/768px), Afiliado (420px)
- Build: `export VITE_WS_RELAY_URL=wss://ws-relay-production-42a7.up.railway.app && npm run build`
  → dist/ sempre limpo antes de deploy; `export` obrigatório para VITE_ vars
- Git: branch master, Co-authored-by: openhands <openhands@all-hands.dev>
- Push: git remote set-url com token → push → resetar remote sem token

---

## Comandos úteis

# Build + deploy
npm run build && npx netlify-cli deploy --prod --dir=dist --auth=$NETLIFY_AUTH_TOKEN

# Testar bot
curl https://zatendestok.com.br/api/wa-status?instance=zatendeapi

# Simular mensagem
curl -X POST https://zatendestok.com.br/wa-bot -H "Content-Type: application/json" \
  -d '{"event":"MESSAGES_UPSERT","instance":"zatendeapi","data":{"key":{"remoteJid":"5511999999991@s.whatsapp.net","fromMe":false,"id":"TEST"},"message":{"conversation":"oi"},"pushName":"Teste","messageTimestamp":1700000000}}'

# Setar env var
npx netlify-cli env:set NOME_VAR valor --auth=$NETLIFY_AUTH_TOKEN

# Build + deploy correto (export obrigatório para VITE_ vars)
export VITE_WS_RELAY_URL=wss://ws-relay-production-42a7.up.railway.app && npm run build
npx netlify-cli deploy --prod --dir=dist --auth=$NETLIFY_AUTH_TOKEN

# Relay health (domínio correto com -42a7)
curl https://ws-relay-production-42a7.up.railway.app/health
# Expected: {"ok":true,"rooms":<N>,"secret":true}

# Railway redeploy via API
/tmp/node_modules/.bin/railway api 'mutation { serviceInstanceRedeploy(serviceId: "69a44033-d4aa-45de-b738-eef350413f6c", environmentId: "061cb025-41f8-4eaf-bb06-ebceca4ac87c") }'

# Railway vars (ws-relay)
/tmp/node_modules/.bin/railway variables set --project df6bcfe6 --service ws-relay --environment production KEY=VALUE
