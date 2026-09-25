# 1. OBJECTIVE

Criar o módulo **ZS Analytics de Câmera** — uma página `/cameras` que usa a câmera do celular para detectar pessoas e medir o tempo de permanência (dwell time) por zona configurável dentro da loja, rodando 100% no browser via TensorFlow.js COCO-SSD. O MVP deve estar funcional para demonstração ao vivo em apresentação de vendas na segunda-feira (3 dias).

# 2. CONTEXT SUMMARY

**Stack:** React 18 + Vite + Netlify Functions ESM + Netlify Blobs
**Padrão de referência:** `/scan` (ScanMobile.jsx) — mesma lógica de abrir câmera pelo celular via link, processar no browser, salvar dados; esse padrão será replicado inteiramente.
**Auth:** `RequireAuth` + roles `admin/gerente` — igual demais páginas protegidas no Layout.
**Nav:** Layout.jsx — seção `GESTAO`, ícone `Camera` já importado na linha 31.
**Persistência:** Netlify Blobs, store `corta-precos` — mesmo padrão de `delivery.js` e `cp_settings`.

**Dependências novas a instalar:**
- `@tensorflow/tfjs` — runtime ML no browser
- `@tensorflow-models/coco-ssd` — modelo pré-treinado de detecção de objetos (~5MB, cache após primeiro load)

**Arquivos afetados:**
- `src/pages/Cameras.jsx` (novo)
- `netlify/functions/cameras-analytics.js` (novo)
- `src/App.jsx` (rota + ADMIN_ONLY)
- `src/components/Layout.jsx` (item de nav)
- `src/pages/Dashboard.jsx` (widget de preview)
- `vite.config.js` (ajuste de otimização para TF.js)
- `package.json` (novas dependências)

**Restrição crítica:** Netlify Functions são serverless — toda detecção de vídeo roda no cliente/browser. Arquitetura correta para esse MVP.

# 3. APPROACH OVERVIEW

**Abordagem escolhida: detecção browser-first com TensorFlow.js COCO-SSD**

O celular abre `/cameras` via link (igual `/scan`), autoriza câmera, e o React gerencia: feed de vídeo contínuo → detecção de pessoas via TF.js a cada ~500ms → rastreamento de presença por zona configurável (polígonos sobre o canvas) → cálculo de dwell time → resumo ao vivo + salvamento periódico no Netlify Blob.

**Por que não servidor Python/YOLO agora:**
Prazo de 3 dias inviabiliza um serviço Railway + câmeras IP. TF.js COCO-SSD detecta "person" com precisão suficiente para demo e primeiros meses de uso real. Toda a lógica de zonas/tempo é JavaScript puro — zero custo de infra adicional.

**Argumento de mercado:** RetailNext e Sensormatic cobram R$ 3.000–15.000/mês por analytics de câmera. O ZatendeStok entregaria isso como parte do plano Profissional, via celular, sem app, sem instalação especial.

**Roadmap pós-MVP (não incluído neste plano):**
- Fase 2: suporte a câmeras IP fixas via serviço Python/Railway (YOLO + ByteTrack)
- Fase 3: heatmap visual da planta da loja + multi-câmera simultânea

# 4. IMPLEMENTATION STEPS

## Passo 1 — Instalar dependências e ajustar Vite

**Goal:** Adicionar TF.js ao projeto sem quebrar o build.

**Method:**
```bash
npm install @tensorflow/tfjs @tensorflow-models/coco-ssd
```
Em `vite.config.js`, adicionar ao `optimizeDeps.exclude` os pacotes `@tensorflow/tfjs` e `@tensorflow-models/coco-ssd` para evitar conflitos de bundle com o backend WASM do TF.js.

**Reference:** `package.json`, `vite.config.js`

---

## Passo 2 — Criar `src/pages/Cameras.jsx`

**Goal:** Página principal do módulo — câmera + detecção ao vivo + analytics por zona.

**Method:** Componente React full-screen (mesmo padrão visual do ScanMobile) dividido em:

**A) IIFE de auth no topo do arquivo (igual ScanMobile linhas 33–57):**
- Lê `?storeId=X&t=TOKEN` da URL → salva no localStorage → auto-login como `scanner` se sem sessão ativa
- Permite compartilhar link via WhatsApp para um funcionário abrir a câmera num celular dedicado

**B) Inicialização de câmera e canvas:**
- `getUserMedia({ video: { facingMode: 'environment' } })` para câmera traseira
- `<video>` + `<canvas>` sobrepostos e fixos (cobre a tela inteira)
- Estado de loading enquanto TF.js carrega o modelo (`cocoSsd.load()` — ~2–3s, uma única vez)

**C) Hook `usePeopleDetector(videoRef, model)`:**
- Loop: `requestAnimationFrame` → `model.detect(videoEl)` → filtra `class === 'person' && score > 0.5`
- Frequência real: ~500ms (não bloqueia, economiza bateria)
- Rastreamento de IDs entre frames: IoU simples — se bbox atual sobrepõe >40% com bbox anterior, é a mesma pessoa; caso contrário, nova pessoa com novo ID

**D) Sistema de zonas:**
- Zonas = retângulos em % do frame (responsivo a qualquer resolução de câmera)
- Salvas em `localStorage` com chave `zs_camera_zones_{storeId}` — persistem entre sessões
- **Modo visualização:** zonas desenhadas no canvas com label e cor (até 6 zonas, uma cor por zona)
- **Modo configuração** (botão ⚙): usuário toca e arrasta para desenhar zona → modal para nomear ("Corredor A", "Bebidas", etc.) → salva

**E) Motor de dwell time (dentro do loop de detecção):**
```
Para cada zona, mantém:
  activePersonIds: Set<id>   ← quem está dentro agora
  entryTimes: Map<id, ts>    ← quando cada um entrou

A cada frame:
  pessoasNaZona = pessoas cujo centro do bbox está dentro da zona
  entrando = pessoasNaZona − activePersonIds → registra entryTimes[id] = now
  saindo   = activePersonIds − pessoasNaZona → calcula dwell = now − entryTimes[id]
    → se dwell >= 5s: sessionStats[zona].visits++, totalDwell += dwell
    → remove de entryTimes e activePersonIds
```
Filtro de 5s mínimo elimina passagens rápidas sem interesse analítico.

**F) Painel inferior ao vivo (translúcido, igual ScanMobile):**
- Lista de zonas com, por zona:
  - `👥 2 pessoas agora`
  - `⏱ Média: 1m 24s | Máx: 3m 10s`
  - `📊 17 visitas (sessão)`
- Atualiza a cada segundo com `setInterval`

**G) Topbar:**
- Brand + nome da câmera + hora de início da sessão
- Botão "💾 Salvar sessão" → POST para `/api/cameras-analytics`
- Botão "📱 Link" → copia URL compartilhável com token HMAC (reutiliza lógica do /scan)
- Botão "⚙ Zonas" → alterna modo configuração

**Reference:** `src/pages/Cameras.jsx` (novo), `src/pages/ScanMobile.jsx` (padrão), `src/components/CameraScanner.jsx` (referência de setup de câmera)

---

## Passo 3 — Criar `netlify/functions/cameras-analytics.js`

**Goal:** Persistir snapshots de analytics no Netlify Blob e retornar histórico.

**Method:**

```
GET /api/cameras-analytics?storeId=X&date=YYYY-MM-DD
  → Retorna analytics do dia (padrão: hoje)
  → Com ?range=7 retorna os últimos 7 dias
  → Blob key: {storeId}:zs_cameras:{date}  (store: 'corta-precos')

POST /api/cameras-analytics
  Body: { storeId, sessionId, zones: [{name, visits, avgDwellSec, maxDwellSec, peakCount}], startedAt, endedAt }
  → Lê dados existentes do dia no Blob
  → Faz merge: soma visits, recalcula médias ponderadas, atualiza maxDwell se maior
  → Salva de volta no Blob
  → Responde { ok: true, date, totalVisits }
```

Sem autenticação própria (gateado pelo frontend, igual `/api/delivery`).

**Reference:** `netlify/functions/cameras-analytics.js` (novo), `netlify/functions/delivery.js` (padrão de leitura/escrita de Blob)

---

## Passo 4 — Registrar rota em `App.jsx`

**Goal:** `/cameras` acessível no roteador como página protegida.

**Method:**
```jsx
// Linha ~41 — import lazy
const Cameras = lazy(() => import('./pages/Cameras.jsx'))

// Linha 77 — adicionar ao ADMIN_ONLY
const ADMIN_ONLY = new Set([..., '/cameras'])

// Dentro do bloco RequireAuth > RequireRole > Layout (~linha 137)
<Route path="/cameras" element={<Cameras />} />
```

**Reference:** `src/App.jsx`

---

## Passo 5 — Adicionar item de nav em `Layout.jsx`

**Goal:** Entrada "Analytics 📹" no menu lateral e bottom nav mobile.

**Method:**
```jsx
// Adicionar ao array GESTAO (após /relatorio, antes de fechar o array):
{ to: '/cameras', icon: Camera, label: 'Analytics 📹', roles: ['admin','gerente'] }
```
O ícone `Camera` já está importado na linha 31 do Layout.jsx — sem novo import necessário.

**Reference:** `src/components/Layout.jsx` linhas 51–63

---

## Passo 6 — Widget de resumo no `Dashboard.jsx`

**Goal:** Dashboard mostra card com top zonas do dia, link para `/cameras`.

**Method:**
- `useEffect` → `GET /api/cameras-analytics?storeId=X` (hoje)
- Se retornar vazio ou erro → não renderiza nada (igual widget de delivery)
- Se houver dados → card "📹 Movimento na Loja" com:
  - Top 3 zonas por nº de visitas
  - Zona com maior dwell time médio ("Área de maior atenção: Bebidas — 2m 14s")
  - Link "Ver câmera ao vivo →" para `/cameras`
- Só aparece se `storeId !== 'default'`

**Reference:** `src/pages/Dashboard.jsx`

# 5. TESTING AND VALIDATION

## Testes funcionais antes da apresentação

**1. Detecção ao vivo:**
- Abrir `/cameras` no celular (dev server + IP local ou Netlify preview)
- Câmera abre → modelo carrega em ~3s → pessoa entra no frame → box verde aparece
- Criar zona "Corredor A" → andar dentro dela → contador ao vivo sobe

**2. Dwell time:**
- Ficar ~30s na zona → sair → painel mostra "1 visita | Média: ~30s"
- Passar rapidamente (<5s) → não deve contar como visita

**3. Persistência:**
- Clicar "💾 Salvar sessão" → verificar com `curl /api/cameras-analytics?storeId=X&date=hoje` que dados chegaram no Blob
- Fechar e reabrir `/cameras` → histórico do dia carregado corretamente

**4. Link compartilhável:**
- Gerar link → abrir em segundo celular → câmera inicia com mesmo storeId e zonas salvas

**5. Dashboard widget:**
- Após salvar sessão → Dashboard renderiza card com dados do dia

## Critérios de sucesso para a apresentação de segunda

| Critério | Como demonstrar |
|---|---|
| Detecção ao vivo no celular | Abrir `/cameras` na reunião, andar pelo corredor → boxes aparecem em tempo real |
| Zonas nomeadas | Criar "Bebidas" e "Frios" na hora — mostra configurabilidade em segundos |
| Dwell time acumulando | Ficar ~1 minuto na zona → mostrar "Média 58s de permanência" |
| Histórico no Dashboard | Mostrar card com analytics da sessão anterior |
| Integração no ecossistema | Navegar: PDV → Estoque → Analytics → WhatsApp — tudo no mesmo sistema |
| Sem app extra | Link compartilhado pelo WhatsApp, abre no browser |

## O que é transparente para o cliente (não estará no MVP)

- Câmeras IP fixas integradas (Fase 2 — requer hardware)
- Heatmap visual da planta da loja (Fase 2)
- Multi-câmera simultânea (Fase 2)
- Integração com câmeras de CFTV existentes (Fase 3)

**Argumento de venda para essas limitações:** "Hoje você já tem os dados de comportamento no celular. Em 30 dias, conectamos nas câmeras que você já tem instaladas e o sistema vira automático."
