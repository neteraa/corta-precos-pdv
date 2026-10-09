# 📊 SISTEMA FISCAL - ZATENDESTOK

Sistema **OPCIONAL** de cálculo e exibição de impostos na nota fiscal.

## ✅ FUNCIONALIDADES

- ✅ Funciona em **TODOS os estados do Brasil**
- ✅ Suporta **3 regimes tributários**:
  - Simples Nacional (padrão)
  - Lucro Presumido
  - Lucro Real
- ✅ Calcula automaticamente ICMS, PIS e COFINS
- ✅ Mostra na nota térmica impressa
- ✅ **DESLIGADO por padrão** (não quebra nada!)

---

## 🚀 COMO ATIVAR

### **Opção 1: Ativar manualmente (código)**

Edite `/src/pages/Terminal.jsx` linha **338**:

```javascript
const configFiscal = {
  mostrar_impostos_nota: true,   // ← MUDE DE false PRA true
  regime: 'simples',              // simples, presumido, real
  estado: 'SP',                   // UF da sua loja
  icms_padrao: 18,                // % ICMS do seu estado
  pis_padrao: 0.65,
  cofins_padrao: 3.0,
}
```

### **Opção 2: Configurar por cliente (futuro)**

Depois vamos adicionar tela em **Configurações** pra cliente escolher!

---

## 📝 COMO APARECE NA NOTA

### **Simples Nacional** (padrão):

```
================================
Subtotal              R$ 100,00
Desconto promo        R$  10,00
--------------------------------
TOTAL                 R$  90,00
Pagamento                  PIX
--------------------------------

TRIBUTOS APROXIMADOS:
Trib. aprox.           R$  7,20
Conforme Lei 12.741/2012
(Simples Nacional)
--------------------------------
      Obrigado pela preferencia!
     DEUS E BOM O TEMPO TODO
```

### **Lucro Presumido/Real**:

```
================================
Subtotal              R$ 100,00
--------------------------------
TOTAL                 R$ 100,00
Pagamento             Dinheiro
--------------------------------

TRIBUTOS:
ICMS                  R$  18,00
PIS                   R$   0,65
COFINS                R$   3,00
Total tributos        R$  21,65
--------------------------------
      Obrigado pela preferencia!
     DEUS E BOM O TEMPO TODO
```

---

## 🏗️ ARQUITETURA

### **Arquivos criados:**

- `/src/utils/fiscal.js` - Sistema de cálculo
  - Alíquotas de ICMS por estado
  - Cálculo por regime tributário
  - Formatação pra nota

- `FISCAL.md` - Esta documentação

### **Arquivos modificados:**

- `/src/pages/Terminal.jsx` - Adiciona cálculo na venda
- `/src/utils/escpos.js` - Adiciona seção na nota

---

## ⚙️ ALÍQUOTAS POR ESTADO

| Estado | ICMS | Estado | ICMS |
|--------|------|--------|------|
| AC | 17% | PA | 17% |
| AL | 18% | PB | 18% |
| AM | 18% | PE | 18% |
| AP | 18% | PI | 18% |
| BA | 18% | PR | 18% |
| CE | 18% | RJ | 18% |
| DF | 18% | RN | 18% |
| ES | 17% | RO | 17,5% |
| GO | 17% | RR | 17% |
| MA | 18% | RS | 18% |
| MG | 18% | SC | 17% |
| MS | 17% | SE | 18% |
| MT | 17% | SP | 18% |
|    | | TO | 18% |

---

## 🎯 PRÓXIMOS PASSOS (FUTURO)

### **Fase 2: Configuração por cliente**
- [ ] Tela em Configurações
- [ ] Salvar config no localStorage
- [ ] Liga/desliga por mercado

### **Fase 3: Dados fiscais por produto**
- [ ] NCM no cadastro de produto
- [ ] CFOP, CST personalizados
- [ ] Alíquotas específicas

### **Fase 4: Integração com emissor**
- [ ] Exportar vendas formatadas
- [ ] Integração com Bling/Tiny/Focus NFe
- [ ] Emissão automática de NF-e

### **Fase 5: Emissão própria (avançado)**
- [ ] Emissão de NFC-e integrada
- [ ] Certificado digital A1/A3
- [ ] Integração com Sefaz

---

## ⚠️ AVISOS LEGAIS

1. **Valores aproximados**: Sistema usa alíquotas padrão. Consulte contador pra valores exatos!
2. **Não substitui contador**: Este sistema é informativo, não substitui orientação contábil
3. **Sem garantia fiscal**: Não nos responsabilizamos por erros de apuração
4. **Atualização de tabelas**: Alíquotas podem mudar - confira regularmente!

---

## 📞 SUPORTE

Dúvidas sobre impostos? **Consulte seu contador!**

Dúvidas sobre o sistema? Fale com suporte ZatendeStok.

---

**Desenvolvido com ❤️ por ZatendeStok**  
*Versão 1.0 - Sistema Fiscal Opcional*
