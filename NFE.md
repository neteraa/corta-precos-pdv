# 📄 EMISSÃO DE NF-e / NFC-e - ZATENDESTOK

Sistema completo de emissão de Nota Fiscal Eletrônica integrado ao PDV.

---

## ✅ O QUE O SISTEMA FAZ

### **Emissão Automática**
- ✅ NFC-e (Nota Fiscal de Consumidor Eletrônica)
- ✅ Integração direta com SEFAZ via Focus NFe
- ✅ Emissão após finalizar venda no Terminal
- ✅ Validação automática de dados
- ✅ Consulta de status em tempo real
- ✅ Histórico de notas emitidas

### **Dados Fiscais Completos**
- ✅ NCM por produto
- ✅ CFOP configurável
- ✅ CST/CSOSN
- ✅ Origem da mercadoria
- ✅ Alíquotas de ICMS, PIS, COFINS
- ✅ Regime tributário (Simples/Presumido/Real)

### **Conformidade Legal**
- ✅ XML assinado digitalmente
- ✅ Enviado para SEFAZ
- ✅ Chave de acesso válida
- ✅ DANFE (Documento Auxiliar)
- ✅ Cancelamento oficial

---

## 🚀 COMO CONFIGURAR

### **Passo 1: Conta Focus NFe**

1. Acesse: https://focusnfe.com.br
2. Crie conta (teste grátis disponível)
3. Configure certificado digital A1 no painel Focus
4. Obtenha o **Token de Integração**

**Preços Focus NFe:**
- 📦 **Starter:** R$49/mês (50 notas)
- 📦 **Basic:** R$99/mês (150 notas)
- 📦 **Premium:** R$199/mês (500 notas)
- 📦 **Enterprise:** R$399/mês (ilimitado)

### **Passo 2: Configurar no Sistema**

1. Acesse **Configurações** → **Emissão de NF-e**
2. Ligue o toggle **"Habilitar Emissão de NF-e"**
3. Preencha:
   - Token da API Focus NFe
   - CNPJ da empresa
   - Razão Social
   - Inscrição Estadual
   - Endereço completo
   - Regime tributário
4. Escolha ambiente: **Homologação** (teste) ou **Produção** (real)
5. Clique em **"Salvar Configurações"**

### **Passo 3: Configurar Produtos (Opcional)**

1. Acesse **Produtos**
2. Edite cada produto
3. Expanda **"Dados Fiscais (Opcional)"**
4. Preencha:
   - NCM (obrigatório pra NF-e)
   - CFOP (padrão: 5102)
   - Origem (padrão: 0 - Nacional)
   - CST/CSOSN
   - Alíquotas específicas (se diferente do padrão)

### **Passo 4: Testar**

1. Configure ambiente como **"Homologação"**
2. Faça uma venda no **Terminal**
3. Após finalizar, clique em **"📄 Emitir NF-e"**
4. Aguarde processamento (3-10 segundos)
5. ✅ Nota autorizada!

---

## 💡 COMO USAR NO PDV

### **Fluxo Normal:**

1. **Adiciona produtos** no carrinho
2. **Finaliza venda** (PIX, Dinheiro, Cartão...)
3. **Modal de sucesso** aparece
4. **Botão "📄 Emitir NF-e"** está disponível *(se configurado)*
5. **Clica no botão**
6. **Sistema processa:**
   - Monta nota com dados fiscais
   - Envia para SEFAZ via Focus NFe
   - Aguarda autorização
   - Salva no histórico
7. **✅ Nota autorizada!**
8. **Cliente pode solicitar** XML/DANFE por email

---

## 📊 DADOS QUE VÃO NA NOTA

### **Emitente (Sua Empresa)**
- CNPJ
- Razão Social / Nome Fantasia
- Inscrição Estadual
- Endereço completo
- Regime tributário

### **Destinatário (Cliente)**
- CPF (se informado)
- Nome (se informado)
- Se não tiver: "CONSUMIDOR FINAL"

### **Produtos**
- Código (SKU)
- Descrição
- NCM
- CFOP
- Quantidade
- Valor unitário
- Valor total
- Origem
- CST/CSOSN
- ICMS, PIS, COFINS

### **Totais**
- Valor dos produtos
- Desconto (se houver)
- Valor total da nota

### **Pagamento**
- Forma de pagamento
- Valor pago
- Troco (se houver)

---

## 🔐 SEGURANÇA

### **O que a Focus NFe faz:**
- ✅ Armazena certificado digital A1 (criptografado)
- ✅ Assina XML com certificado
- ✅ Envia para SEFAZ com protocolo seguro
- ✅ Valida retorno da SEFAZ
- ✅ Armazena XML autorizado
- ✅ Gera DANFE (PDF)

### **O que o ZatendeStok faz:**
- ✅ Monta dados da nota corretamente
- ✅ Valida campos obrigatórios
- ✅ Chama API Focus NFe com token seguro
- ✅ Consulta status
- ✅ Salva histórico local
- ✅ Mostra resultado pro operador

### **Certificado Digital:**
- **Você não precisa instalar** certificado no computador
- **Focus NFe armazena** certificado A1 no servidor deles
- **Seguro e prático** - funciona em qualquer computador

---

## ⚙️ AMBIENTES

### **Homologação (Testes)**
- ✅ Testa emissão SEM gerar nota oficial
- ✅ Notas não têm valor fiscal
- ✅ SEFAZ Homologação responde como produção
- ✅ Ideal pra treinar operadores
- ✅ Validar configurações
- ✅ **SEMPRE teste aqui primeiro!**

### **Produção (Real)**
- ⚠️ Notas TÊM valor fiscal oficial
- ⚠️ Contam no limite mensal da Focus NFe
- ⚠️ Depois de emitida, só pode cancelar em 24h
- ⚠️ **SÓ mude pra produção quando tudo estiver OK!**

---

## 📈 HISTÓRICO DE NOTAS

Sistema salva automaticamente:
- Referência da nota
- Número da nota
- Chave de acesso NF-e
- Status (autorizada, cancelada, erro)
- Data e hora
- Valor
- Ambiente (homologação/produção)
- Venda vinculada

*(Futuramente: página dedicada pra visualizar histórico)*

---

## ❌ CANCELAMENTO

### **Dentro de 24h:**
- ✅ Pode cancelar via Focus NFe
- ✅ Precisa justificativa (mín. 15 caracteres)
- ✅ SEFAZ autoriza cancelamento
- ✅ Nota fica marcada como "Cancelada"

### **Após 24h:**
- ❌ Não pode cancelar
- ⚠️ Precisa fazer **Carta de Correção** (CC-e)
- ⚠️ Ou emitir **Nota de Devolução**

*(Futuramente: função de cancelamento no histórico)*

---

## 🐛 SOLUÇÃO DE PROBLEMAS

### **"Configuração incompleta"**
- ✅ Preencha TODOS os campos obrigatórios (*)
- ✅ Verifique CNPJ e IE
- ✅ Endereço completo

### **"Token inválido"**
- ✅ Verifique token no painel Focus NFe
- ✅ Cole novamente (pode ter espaço extra)

### **"Produto sem NCM"**
- ✅ Configure NCM nos produtos
- ✅ Ou sistema usa padrão "00000000"

### **"Erro ao enviar para SEFAZ"**
- ✅ Verifique internet
- ✅ Aguarde uns minutos (SEFAZ pode estar instável)
- ✅ Tente novamente

### **"Rejeitada pela SEFAZ"**
- ✅ Leia mensagem de erro
- ✅ Geralmente: CNPJ/IE inválidos, ou endereço incompleto
- ✅ Corrija e tente novamente

---

## 💰 CUSTOS

### **Certificado Digital A1:**
- Compra: R$150-250 (validade 1 ano)
- Renovação anual obrigatória

### **Focus NFe:**
- A partir de R$49/mês
- Teste grátis (10 notas)

### **TOTAL:**
- Setup: ~R$250 (certificado)
- Mensal: R$49-399 (Focus NFe)

**Cliente R$1mi/mês pagando R$199/mês = 0,02% de faturamento** (NADA!)

---

## 📚 REFERÊNCIAS

- **Focus NFe:** https://focusnfe.com.br
- **Documentação API:** https://focusnfe.com.br/doc/
- **Portal NF-e:** http://www.nfe.fazenda.gov.br
- **Certificado Digital:** https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/certidoes-e-certidao-negativa/certidao-digital

---

## ✅ CHECKLIST DE IMPLANTAÇÃO

- [ ] Comprar certificado digital A1
- [ ] Criar conta Focus NFe
- [ ] Enviar certificado A1 pra Focus NFe
- [ ] Obter token de integração
- [ ] Configurar empresa no ZatendeStok
- [ ] Cadastrar NCM dos produtos
- [ ] Testar em **Homologação**
- [ ] Treinar operadores
- [ ] Emitir nota de teste
- [ ] Validar XML/DANFE
- [ ] Mudar pra **Produção**
- [ ] ✅ **Sistema em operação!**

---

## 🎯 PRÓXIMAS EVOLUÇÕES (FUTURO)

### **Fase 1: Melhorias Básicas** (1-2 semanas)
- [ ] Página de histórico de notas
- [ ] Download de XML/DANFE
- [ ] Cancelamento via interface
- [ ] Reenvio por email

### **Fase 2: CPF na Nota** (1 semana)
- [ ] Campo CPF no cadastro de cliente
- [ ] Solicitar CPF no Terminal
- [ ] CPF vai automaticamente na nota

### **Fase 3: Contingência** (2 semanas)
- [ ] Emissão offline (FS-DA)
- [ ] Transmissão posterior
- [ ] Indicador de contingência

### **Fase 4: NF-e Completa** (3-4 semanas)
- [ ] NF-e (não só NFC-e)
- [ ] Venda pra empresa (CNPJ)
- [ ] Frete
- [ ] IPI

### **Fase 5: Integração Contador** (1-2 semanas)
- [ ] Exportação XML mensal
- [ ] Relatório SPED
- [ ] Apuração de impostos

---

**SISTEMA PROFISSIONAL COMPLETO! CLIENTE PODE PEDIR NOTA FISCAL OFICIAL! 🎉🔥**

**Desenvolvido com ❤️ por ZatendeStok**
