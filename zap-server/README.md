# ZatendeStock — ZAP Server

Servidor local Baileys para disparar mensagens WhatsApp diretamente,
sem abrir o WA um por um.

## Setup rápido (Mac/Linux)

```bash
cd zap-server
npm install
node server.js        # → aparece QR code no terminal
```

Escaneia o QR no WA → 3 pontos → Dispositivos Vinculados → Vincular Dispositivo

---

## Expor via ngrok (URL estática)

**Você já tem o domínio:** `hexaplaric-nondruidic-jeffie.ngrok-free.dev`

```bash
# Terminal 1 — servidor
node server.js

# Terminal 2 — ngrok (porta 3001, não 80!)
ngrok http --url=hexaplaric-nondruidic-jeffie.ngrok-free.dev 3001
```

No ZatendeStock → clica no dot ZAP → URL do servidor:
```
https://hexaplaric-nondruidic-jeffie.ngrok-free.dev
```

---

## Auto-start no Mac (launchd)

Para o servidor iniciar automaticamente quando ligar o Mac:

```bash
# 1. Copia o plist
cp com.zatendestock.zap.plist ~/Library/LaunchAgents/

# 2. Edita o caminho (troca YOUR_USER pelo seu usuário)
nano ~/Library/LaunchAgents/com.zatendestock.zap.plist

# 3. Ativa
launchctl load ~/Library/LaunchAgents/com.zatendestock.zap.plist

# 4. Verifica
launchctl list | grep zatendestock
```

---

## VPS (sem depender do escritório)

### A verdade sobre cloud + WhatsApp

| Situação                        | Risco de ban |
|---------------------------------|-------------|
| Mac office + ngrok              | 🟢 Baixíssimo (IP residencial/comercial) |
| VPS Hetzner + Evolution API     | 🟡 Baixo (datacenter europeu, menos suspeito) |
| AWS/GCP/Azure + Baileys puro    | 🔴 Alto (IPs conhecidos da Meta) |
| Z-API / Wapi.app (serviço BR)   | 🟢 Baixo (eles gerenciam os IPs) |

### Por que seu setup antigo era no físico?
Correto! Meta bloqueia IPs de datacenter para conexões WA Web em escala.
Para 5 mercados parceiros (não cold outreach), VPS europeu funciona ~95% dos casos.

---

### Opção A — VPS Hetzner + Evolution API (~€4/mês)

```bash
# No VPS (Ubuntu 22.04)
docker run -d \
  --name evolution-api \
  -p 8080:8080 \
  -e AUTHENTICATION_TYPE=apikey \
  -e AUTHENTICATION_API_KEY=sua_chave_aqui \
  atendai/evolution-api:latest

# Cria instância
curl -X POST https://seu-vps/instance/create \
  -H "apikey: sua_chave_aqui" \
  -d '{"instanceName":"zatendestock","token":"meu_token"}'
```

A URL que você usa no ZatendeStock seria a do VPS.
(Requer adaptar o código do ZatendeStock para a API do Evolution)

---

### Opção B — Z-API.io (R$29–197/mês, zero servidor) ← RECOMENDADO PARA PRODUÇÃO

1. Cria conta em https://z-api.io
2. Cria instância → aparece QR code no painel deles
3. Pega a URL e token da instância
4. Substitui o servidor local pela Z-API

A Z-API usa IPs residenciais gerenciados por eles — zero risco de ban.
Para escalar para múltiplos distribuidores (cada um com seu WA), é a melhor opção.

---

### Opção C — Meta WhatsApp Business Cloud API (grátis até 1k msgs/mês)

- Sem ban jamais (é a própria Meta)
- Requer empresa verificada na Meta
- Requer aprovar templates de mensagem
- API diferente (mas integrável)

---

## Para produção multi-tenant

Se o ZatendeStock for vendido para vários distribuidores:
- Cada distribuidor tem seu próprio WA de negócio
- **Z-API**: cada instância = 1 distribuidor (~R$29/mês por instância)
- **Evolution API + VPS**: multi-instância no mesmo servidor
- **Meta Cloud API**: 1 número verificado por tenant

---

## Variáveis de ambiente

```bash
ZAP_PORT=3001     # porta do servidor (default: 3001)
DELAY_MS=1500     # delay entre msgs em ms (default: 1500)
```
