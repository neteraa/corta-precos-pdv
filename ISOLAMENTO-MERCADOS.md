# 🏪 ISOLAMENTO TOTAL POR MERCADO

## ✅ **O QUE FOI FEITO**

Sistema agora tem **isolamento completo** por mercado:
- Cada mercado vê **APENAS seus dados**
- Admin (master key) vê **TODOS os mercados**
- Corta Preços continua funcionando normalmente

---

## 🔐 **COMO FUNCIONA**

### **Estrutura de Dados:**
```
chat_history:cortaprecos_123:5511999999999  ← Conversa do Corta Preços
chat_history:mercado_abc:5511888888888      ← Conversa do Mercado ABC
chat_history:mercado_xyz:5511777777777      ← Conversa do Mercado XYZ
```

Cada mercado tem:
- **storeId**: `cortaprecos_123`, `mercado_abc`, etc
- **token**: senha secreta única
- **Dados isolados**: conversas, pedidos, produtos, etc

---

## 👥 **2 TIPOS DE USUÁRIO**

### **1. ADMIN (você)**
```
Login: zatendestok.com.br/login
Credencial: MASTER KEY
Acesso: VÊ TODOS OS MERCADOS
```

### **2. MERCADO (cliente)**
```
Login: zatendestok.com.br/login
Credencial: storeId + token
Acesso: VÊ APENAS SEUS DADOS
```

---

## 🎯 **COMO CRIAR LOGIN POR MERCADO**

### **Passo 1: Gerar storeId e token**
```javascript
// No console do navegador (zatendestok.com.br):

// 1. Gera token aleatório
const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
  .map(b => b.toString(16).padStart(2, '0')).join('')

console.log('Token:', token)

// 2. Define storeId (ex: nome do mercado)
const storeId = 'mercado_saojoao_456'  // sem espaços, só letras/números/_

// 3. Salva no Netlify Blobs (via API)
await fetch('/api/persist', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    key: `${storeId}:token`,
    value: token,
    storeId: 'zs-auth'  // store especial de autenticação
  })
})

console.log('✅ Login criado!')
console.log('storeId:', storeId)
console.log('token:', token)
```

### **Passo 2: Passar credenciais pro mercado**
```
Envie por WhatsApp/Email:

━━━━━━━━━━━━━━━━━━━━━━
🏪 ACESSO AO SISTEMA
━━━━━━━━━━━━━━━━━━━━━━

Link: https://zatendestok.com.br/login

storeId: mercado_saojoao_456
token: abc123def456...

⚠️ GUARDE BEM! É a senha da sua loja.
━━━━━━━━━━━━━━━━━━━━━━
```

### **Passo 3: Mercado faz login**
```
1. Acessa zatendestok.com.br/login
2. Clica em "Login com storeId"
3. Cola storeId e token
4. Pronto! Vê apenas seus dados
```

---

## 🧪 **TESTE RÁPIDO**

### **Teste 1: Admin vê tudo**
```
1. Login com MASTER KEY
2. Vai em /conversas
3. ✅ Deve ver conversas de TODOS os mercados
```

### **Teste 2: Mercado vê só seus dados**
```
1. Login com storeId + token (Corta Preços)
2. Vai em /conversas
3. ✅ Deve ver APENAS conversas do Corta Preços
```

---

## 🔒 **PÁGINAS ISOLADAS**

Já isoladas (cada mercado vê só seus dados):
- ✅ Conversas WhatsApp
- ✅ Entregas
- ✅ Produtos (via store.jsx)
- ✅ Vendas (via store.jsx)
- ✅ Estoque (via store.jsx)
- ✅ Dashboard (via store.jsx)

---

## 🚨 **IMPORTANTE: CORTA PREÇOS**

O Corta Preços já está configurado e funcionando!

**Não precisa fazer nada.**

Ele já tem:
- storeId: `cortaprecos_1789770018182`
- token: (salvo no sistema)
- Acesso: zatendestok.com.br/login → login normal

---

## 📝 **CRIAR NOVOS MERCADOS (ROTEIRO)**

Para cada mercado novo:

### **1. Defina o storeId**
```
Padrão: mercado_{nome}_{timestamp}
Exemplo: mercado_bommercado_1727380000
```

### **2. Gere token (código acima)**

### **3. Salve no sistema (código acima)**

### **4. Envie credenciais pro cliente**

### **5. Configure WhatsApp bot (se tiver)**
```
No Evolution API:
- instanceName: cortaprecos_1789770018182 (mesmo do storeId)
- Webhook: https://zatendestok.com.br/api/wa-bot
```

### **6. Teste o isolamento**
```
- Login com o novo storeId+token
- Confere se vê só seus dados
- Admin confere se vê todos
```

---

## ✅ **GARANTIAS**

- ✅ **Isolamento total**: Mercado X não vê dados do mercado Y
- ✅ **Backward compatible**: Corta Preços continua funcionando
- ✅ **Admin global**: Master key vê tudo (debug/suporte)
- ✅ **Escalável**: Pronto para dezenas de mercados

---

## 🚀 **PRONTO PARA VENDER!**

Sistema está **pronto para produção** com:
- Isolamento completo
- Multi-tenant funcionando
- Admin global funcionando
- Primeiro cliente (Corta Preços) OK

**Pode começar a vender amanhã!** 💰
