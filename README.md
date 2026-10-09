# 🏪 ZatendeStok - Sistema Completo para Mercados

**Sistema profissional de gestão para mercados, padarias, açougues e distribuidoras.**

[![Deploy Status](https://api.netlify.com/api/v1/badges/abd4863b-ef7b-4d7c-b3f2-85547f519485/deploy-status)](https://app.netlify.com/sites/zatendestock/deploys)

🌐 **Demo:** https://zatendestock.netlify.app

---

## 🚀 Features Principais

### 💰 PDV Completo
- ✅ Terminal touchscreen otimizado
- ✅ Leitor de código de barras (USB/câmera)
- ✅ Múltiplas formas de pagamento (PIX, cartão, dinheiro)
- ✅ Desconto por produto ou total
- ✅ Parcelamento no cartão de crédito
- ✅ Pagamento misto (divide em múltiplos métodos)
- ✅ Impressão de cupom (impressora térmica USB)

### 📦 Gestão de Estoque
- ✅ Controle de estoque FIFO (First In, First Out)
- ✅ Lotes e validades
- ✅ Alertas de produtos vencendo
- ✅ Estoque mínimo
- ✅ Entrada de mercadorias
- ✅ Fotos de produtos (manual + auto via OpenFoodFacts)

### 🔥 Promoções Inteligentes
- ✅ Mix-and-match (2 por R$10, 5 por R$20...)
- ✅ Leve X pague Y
- ✅ Desconto percentual
- ✅ Desconto fixo
- ✅ Grupos de produtos
- ✅ Sugestão automática no PDV

### 📊 Sistema Fiscal (NOVO! 🎉)
- ✅ **Configuração visual** (27 estados do Brasil)
- ✅ **3 regimes tributários** (Simples Nacional, Lucro Presumido, Lucro Real)
- ✅ **Campos fiscais por produto** (NCM, CFOP, CST, alíquotas)
- ✅ **Cálculo automático** de impostos (ICMS, PIS, COFINS)
- ✅ **Impressão na nota** (conforme Lei 12.741/2012)
- ✅ **Multi-tenant** (isolado por loja)

### 🤖 Bot WhatsApp com IA
- ✅ Atendimento automático humanizado
- ✅ Catálogo de produtos via WhatsApp
- ✅ Consulta de promoções
- ✅ Pedidos de delivery
- ✅ Confirmação de pagamento PIX
- ✅ Multi-loja (cada mercado tem seu bot)

### 💳 Fiado (Caderneta Digital)
- ✅ Controle de crédito por cliente
- ✅ Histórico completo
- ✅ Pagamentos parciais
- ✅ Relatórios de inadimplência

### 📱 Multi-Plataforma
- ✅ PWA (instala no celular/tablet/computador)
- ✅ Offline-first (funciona sem internet)
- ✅ Sync em tempo real (múltiplos dispositivos)
- ✅ Responsive (mobile + desktop)

### 🎯 Recursos Avançados
- ✅ Dashboard com métricas em tempo real
- ✅ Relatórios de vendas, estoque, fiado
- ✅ Controle de operadores (caixas)
- ✅ Cancelamento de vendas (com aprovação)
- ✅ Metas de vendas
- ✅ Movimentação de caixa
- ✅ Múltiplas empresas (multi-tenant)

---

## 🏗️ Tecnologias

### Frontend
- **React 18** - UI framework
- **Vite** - Build tool ultrarrápido
- **Tailwind CSS** - Styling
- **Lucide Icons** - Ícones modernos
- **Recharts** - Gráficos e dashboards

### Backend
- **Netlify Functions** - Serverless (Node.js)
- **Netlify Blobs** - Storage key-value
- **OpenAI API** - Bot WhatsApp inteligente
- **Evolution API** - Integração WhatsApp

### Ferramentas
- **ESLint** - Code quality
- **Git** - Version control
- **Service Worker** - PWA + offline

---

## 📦 Instalação

### Pré-requisitos
- Node.js 18+
- npm ou yarn
- Git

### Setup Local

```bash
# Clone o repositório
git clone https://github.com/neteraa/corta-precos-pdv.git
cd corta-precos-pdv

# Instale dependências
npm install

# Configure variáveis de ambiente
cp .env.example .env
# Edite .env com suas credenciais

# Rode em desenvolvimento
npm run dev

# Build para produção
npm run build

# Preview do build
npm run preview
```

### Deploy na Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy
netlify deploy --prod
```

---

## ⚙️ Configuração

### Variáveis de Ambiente

Crie arquivo `.env` na raiz:

```env
# OpenAI (para bot WhatsApp)
VITE_OPENAI_API_KEY=sk-...

# Evolution API (WhatsApp)
VITE_EVOLUTION_API_URL=https://...
VITE_EVOLUTION_INSTANCE=nome_instancia

# Netlify (para backend)
NETLIFY_AUTH_TOKEN=nfp_...
```

### Configuração Fiscal

1. Acesse **Configurações** no menu
2. Vá em **📊 Configurações Fiscais**
3. Ligue o toggle "Mostrar Impostos na Nota"
4. Escolha seu **regime tributário**
5. Escolha seu **estado** (UF)
6. Salve

### Bot WhatsApp

1. Tenha uma instância da Evolution API rodando
2. Configure as variáveis `EVOLUTION_API_URL` e `EVOLUTION_INSTANCE`
3. Configure o webhook apontando para `/wa-bot`
4. Bot funciona automaticamente!

---

## 📖 Documentação

- [FISCAL.md](./FISCAL.md) - Sistema fiscal completo
- [GITHUB_PUSH.md](./GITHUB_PUSH.md) - Instruções de push

---

## 🎯 Público-Alvo

### Pequenos (MEI)
- Faturamento: < R$50k/mês
- Não precisa de fiscal
- **Plano:** R$150/mês

### Médios
- Faturamento: R$50-500k/mês
- Emite NF-e via emissor externo
- **Plano:** R$350/mês (com fiscal básico)

### Grandes
- Faturamento: R$1mi+/mês
- Precisa de fiscal completo
- **Plano:** R$550-1200/mês (com fiscal premium)

---

## 🤝 Contribuindo

Pull requests são bem-vindos! Para mudanças grandes, abra uma issue primeiro.

### Workflow
1. Fork o projeto
2. Crie sua branch (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add: Amazing Feature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

---

## 📄 Licença

Propriedade de **ZatendeStok**. Todos os direitos reservados.

---

## 📞 Suporte

- **Email:** suporte@zatendestok.com.br
- **WhatsApp:** (15) 99660-4075
- **Site:** https://zatendestok.com.br

---

## 🏆 Créditos

Desenvolvido com ❤️ por **ZatendeStok**

---

## 📊 Estatísticas

- **27** estados cobertos
- **3** regimes tributários
- **1000+** linhas de código fiscal
- **100%** offline-first
- **0** dependências de banco de dados

---

## 🔄 Changelog

### v2.0.0 - Sistema Fiscal Empresarial (2024-09-26)
- ✅ Sistema fiscal nacional completo
- ✅ Configuração visual de impostos
- ✅ Campos fiscais por produto (NCM, CFOP, CST)
- ✅ Cálculo automático (ICMS, PIS, COFINS)
- ✅ Impressão na nota térmica
- ✅ Multi-tenant com cache isolado

### v1.5.0 - Bot WhatsApp Humanizado (2024-09)
- ✅ Bot "Zara" com personalidade
- ✅ 5 variações de saudação
- ✅ Fix de promoções no WhatsApp
- ✅ Multi-key fallback system

### v1.0.0 - Lançamento Inicial (2024)
- ✅ PDV completo
- ✅ Gestão de estoque
- ✅ Promoções mix-and-match
- ✅ Fiado
- ✅ Multi-tenant

---

**⭐ Se gostou, deixa uma estrela no GitHub!**

[![GitHub stars](https://img.shields.io/github/stars/neteraa/corta-precos-pdv?style=social)](https://github.com/neteraa/corta-precos-pdv)
