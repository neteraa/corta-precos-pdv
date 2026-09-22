# CHANGELOG — ZatendeStok / Corta Preços PDV

> Registro completo de alterações, correções e melhorias.  
> Última atualização: 22/09/2026  
> Branch: `master` · Prod: https://zatendestok.com.br

---

## [Sessão 22/09/2026] — Correções críticas do primeiro cliente (Corta Preços)

### 🔴 CRÍTICO — Produto cadastrado no celular nunca aparecia no terminal

**Causa raiz:** `slugify()` em `auth.js` removia underscores do storeId.  
`cortaprecos_1789770018182` → `cortaprecos1789770018182`

Isso criava dois caminhos divergentes:
- `getMktStoreId()` (usado para dados) ← lia `cp_session.storeId` → **com `_`** ✅
- `getConfiguredStoreId()` (usado para gerar URL do celular) ← lia `cp_store_id` → **sem `_`** ❌

O celular salvava em `cortaprecos1789770018182:cp_products`.  
O computador lia de `cortaprecos_1789770018182:cp_products`.  
Namespaces diferentes → produto nunca aparecia.

**Arquivos corrigidos:**
- `src/utils/auth.js` — `slugify()` agora preserva `_` com `[^a-z0-9_]+`
- `src/utils/auth.js` — `getConfiguredStoreId()` prefere `cp_session.storeId`
- `src/pages/ScanMobile.jsx` — IIFE não chama mais `saveStoreId()` (evita re-slugify)

**Migração:** 1 produto perdido (`DODON FRUTAS VERMELHAS 140G`) recuperado do namespace errado via script direto no Netlify Blobs.

**Commits:** `cc133ce`, `4c89d90`

---

### 🔴 CRÍTICO — Estoque dobrado ao cadastrar produto novo pelo celular

**Causa:** `saveNewProd()` salvava `stock: parseFloat(newProdQty)`. A sheet de confirmação abria com `qty = newProdQty`. O `confirmAll()` somava `stock + qty = 2× o valor real`.

**Fix:** `saveNewProd()` agora salva `stock: 0`. Todo o estoque vem exclusivamente do `confirmAll()` via `bulkUpsertProducts`.

**Arquivo:** `src/pages/ScanMobile.jsx`  
**Commit:** `43aaef3`

---

### 🔴 CRÍTICO — Race condition no lote de entrada de estoque (ScanMobile)

**Causa:** `confirmAll()` chamava `upsertProduct()` para cada produto do lote → N POSTs simultâneos. Servidor é last-write-wins → POSTs fora de ordem apagavam itens.

**Fix:** Novo `bulkUpsertProducts(batch)` no store → único `setProducts` + único POST para todo o lote. Usa estoque de `prev` (estado atual), não do momento do scan.

**Arquivos:** `src/store.jsx`, `src/pages/ScanMobile.jsx`  
**Commit:** `43aaef3`

---

### 🔴 CRÍTICO — Sync de 30s apagava import/cadastro em andamento

**Causa:** `applyServerData()` sobrescrevia `setProducts()` com dado do servidor mesmo quando o POST local ainda estava em trânsito. Cenário: importar 3000 produtos → sync dispara antes do POST chegar → UI mostra 0 produtos.

**Fix:** Mesmo padrão já usado em operadores — se local tem MAIS produtos que o servidor, local vence e re-sobe ao servidor.

**Arquivo:** `src/store.jsx`  
**Commit:** `5a09a32`

---

### 🟠 ALTO — Scanner de código de barras concatenava códigos após produto não encontrado

**Causa:** `addToCart()` no Terminal não limpava o campo `query` quando o produto não era encontrado. Próximo scan do leitor concatenava o código anterior → nunca encontrava nada.

**Fix:** `setQuery('')` + `setResults([])` + `inputRef.focus()` no bloco de erro.

**Arquivo:** `src/pages/Terminal.jsx`  
**Commit:** `4c89d90`

---

### 🟠 ALTO — Terminal mostrava produto errado ao escanear o mesmo item mais de uma vez

**Causa:** `onKeyDown` no Terminal priorizava `results[0]` (busca textual) sobre código exato. O scanner envia dígitos um a um → `useEffect([query])` atualizava `results` com match parcial → Enter usava `results[0]` errado.

**Fix:** Mesma lógica do PDV admin — `findProduct(query)` primeiro, `results[0]` como fallback.

**Arquivo:** `src/pages/Terminal.jsx`  
**Commit:** `3e1a018`

---

### 🟡 MÉDIO — IDs duplicados em cadastros rápidos (upsertProduct)

**Causa:** ID era `` `p${Date.now()}` `` sem sufixo aleatório. Dois produtos no mesmo milissegundo → mesmo ID → segundo sobrescreve o primeiro.

**Fix:** `` `p${Date.now()}_${Math.random().toString(36).slice(2)}` ``

**Arquivo:** `src/store.jsx`  
**Commit:** `5a09a32`

---

### 🟡 MÉDIO — Flash de produtos de demonstração após limpar base de dados

**Causa:** `clearBusinessData()` fazia `localStorage.removeItem(key)`. Próxima carga de página: `useState` lia `null` → retornava `SEED_PRODUCTS` por ~1s antes do sync.

**Fix:** `localStorage.setItem(key, '[]')` em vez de `removeItem`.

**Arquivo:** `src/store.jsx`  
**Commit:** `5a09a32`

---

### 🟡 MÉDIO — Três bugs do terminal de caixa

#### 5a. Operadores não reconhecidos no lock screen
`caixaOps` filtrava só `role === 'caixa'`. Operadores com `role = 'gerente'` ou `'admin'` eram invisíveis.  
**Fix:** Mostra todos os operadores com `active !== false`.

#### 5b. Input sem foco após selecionar operador e PIN
Após o lock screen fechar, o campo de busca não recebia foco. Caixa tinha que clicar toda vez.  
**Fix:** `useEffect([activeOperator])` → `setTimeout(() => inputRef.focus(), 120ms)`.

#### 5c. Scan feedback não mostrava progresso de promoção
Quando produto pertencente a um grupo de promo era escaneado, nenhuma notificação aparecia.  
**Fix:** `addToCart()` calcula progresso do `promoGroup` inline e mostra chip âmbar com "⚡ BONO 4x11 — faltam 3 un." ou "🏷 PROMO ATIVA!".

**Arquivo:** `src/pages/Terminal.jsx`  
**Commit:** `e871104`

---

### 🟡 MÉDIO — Race condition nos operadores de caixa (sessão anterior)

**Causa:** `applyServerData()` sobrescrevia operadores recém-adicionados no ciclo de sync de 30s.

**Fix:** Local vence se tem mais operadores. Mesmo padrão aplicado depois para produtos.

**Arquivo:** `src/store.jsx`  
**Commit:** `b49fd83`

---

## Estado atual do sistema (22/09/2026)

### Infraestrutura
| Componente | Status |
|---|---|
| Netlify Blobs (dados) | ✅ Operacional |
| Evolution API WhatsApp | ✅ Open — +55 15 9979-6930 |
| OpenAI gpt-4o-mini (Zara) | ✅ Ativo |
| Netlify Functions | ✅ 200 em todos os endpoints |
| Deploy automático | ✅ `npm run build` → dist/ → Netlify |

### Clientes em produção
| Market | StoreId | Plano |
|---|---|---|
| Corta Preços | `cortaprecos_1789770018182` | Ativo |
| Padaria Teste | `padariateste_1790000668712` | Teste |
| Nete Ta Mercado | `mkt_1789747558270` | Interno |
| ZatendeStok Admin | `mkt_1789762223411` | Admin |

### Produtos Corta Preços
- **2797 produtos** no servidor (namespace `cortaprecos_1789770018182:cp_products`)
- 1 produto recuperado de namespace errado nesta sessão

### Fluxo mobile→desktop (corrigido e validado)
```
Celular abre /scan?storeId=cortaprecos_1789770018182&mode=estoque
       ↓
syncReady: aguarda servidor antes de permitir cadastro
       ↓
Escaneia produto → não encontrado → formulário de cadastro
       ↓
saveNewProd() → upsertProduct(stock:0) → persist → POST correto
       ↓
Sheet confirma qty+vencimento+custo → addToBatch()
       ↓
confirmAll() → bulkUpsertProducts(batch) → 1 setProducts + 1 POST
       ↓
Namespace correto → PC vê produto no próximo sync (≤30s)
```

---

## Arquitetura de dados

### Namespaces Netlify Blobs
```
{storeId}:cp_products       → catálogo de produtos
{storeId}:cp_sales          → histórico de vendas
{storeId}:cp_customers      → clientes / fiado
{storeId}:cp_operators      → operadores de caixa
{storeId}:cp_promos         → regras de promoção
{storeId}:cp_cash           → sangria/suprimento
{storeId}:cp_goal           → meta de vendas
{storeId}:cp_supplier_offers → ofertas de fornecedores
```

### Camadas de persistência (dupla)
1. **localStorage** — `mkt:{storeId}:{key}` — acesso instantâneo offline
2. **Netlify Blobs** — `{storeId}:{key}` — fonte da verdade, sincronizado a cada 30s

### Regra de conflito sync
- **Produtos e operadores:** local vence se tem mais itens (POST em trânsito)
- **Vendas, clientes, promos:** servidor sempre vence

---

## Comandos úteis

```bash
# Build e deploy
npm run build
npx netlify-cli deploy --prod --dir=dist --auth=$NETLIFY_AUTH_TOKEN --site=abd4863b-ef7b-4d7c-b3f2-85547f519485

# Verificar produtos no servidor
curl https://zatendestok.com.br/api/restore?storeId=cortaprecos_1789770018182 | python3 -c "
import sys,json; d=json.load(sys.stdin)['data']
print(len(json.loads(d.get('cp_products','[]'))), 'produtos')
"

# Simular bot WhatsApp
curl -X POST https://zatendestok.com.br/wa-bot \
  -H "Content-Type: application/json" \
  -d '{"event":"MESSAGES_UPSERT","instance":"zatendeapi","data":{"key":{"remoteJid":"5511999@s.whatsapp.net","fromMe":false,"id":"T1"},"message":{"conversation":"oi"},"pushName":"Teste","messageTimestamp":1700000000}}'

# Git push com token (substituir GITHUB_TOKEN pelo token real)
git remote set-url origin https://$GITHUB_TOKEN@github.com/neteraa/corta-precos-pdv.git
git push origin master
```

---

## Próximas melhorias sugeridas

- [ ] Configuração de promoções de combo pelo celular (promoGroup no ScanMobile)
- [ ] Notificação push quando produto chega abaixo do estoque mínimo
- [ ] Relatório de entrada de estoque (histórico do ScanMobile)
- [ ] Sincronização em tempo real (WebSocket) entre PC e celular
- [ ] Backup automático dos dados antes de limpar base
