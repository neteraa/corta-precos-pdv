# ZatendeStok — AGENTS.md (v10.0 — 2026-09-22)

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
| Railway latência | ~3.5s cold start |

---

## Env Vars (Netlify — nunca committar)

- EVOLUTION_API_URL  ✅
- EVOLUTION_API_KEY  ✅
- EVOLUTION_INSTANCE ✅
- OPENAI_API_KEY     ✅ (sk-proj-4FVEl...)
- WA_BOT_SECRET      ❌ ausente (não crítico)

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

## Zara (wa-bot.js)

ZARA_INSTANCES = ['zatendeapi', 'zatendestok']
System Prompt: ~6900 chars com:
  - 14 módulos listados
  - Links /demo/:niche por segmento
  - Afiliados R$150/R$250, link /afiliado
  - Objeções: tá caro / já tenho sistema / vou pensar / não sei tecnologia / não conheço vocês
  - Lead tag: <zs_lead>{"name","market","city","niche","stage"}</zs_lead>
  - Stages: novo|curioso|interessado|demo|afiliado|fechado

Proteções:
  - sendReply fire-and-forget (sem await) → retorna ~1.5s
  - AbortController 8s na Evolution API
  - OpenAIQuotaError → fallback humanizado (nunca fica mudo)
  - Ignora: fromMe, grupos, áudio, sticker, reaction
  - Histórico: Map em memória, últimas 10 msgs por número

---

## Markets em produção (blob zs-auth)

mkt_1789747558270       — Nete Ta Mercado (mercado)
mkt_1789762223411       — ZatendeStok Admin (mercado)
cortaprecos_1789770018182 — Corta preços (mercado)
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

## Commits recentes

f85238a — fix: landing Bricolage + hero sem vazio + phone float + scroll reveal
e4bb785 — feat: hero 2 colunas + PDVMock animado no desktop
014dba2 — fix: landing checklist features + stats bar + copy humano
1877a10 — fix: fallback OpenAI quota (credit_balance_exhausted)
acede4f — fix: responsividade mobile Landing + Demo + Afiliado
7ee7f84 — feat: logo nova + landing redesign + Zara atualizada

---

## Padrões

- Inline styles → componentes dark (Landing, Afiliado, Demo hub)
- Tailwind classes → sistema autenticado (Layout, PDV, Dashboard)
- CSS const com @media → responsividade Landing (560px/768px), Afiliado (420px)
- Build: npm run build → dist/ sempre limpo antes de deploy
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
