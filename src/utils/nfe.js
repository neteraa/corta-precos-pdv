// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🧾 SISTEMA DE EMISSÃO DE NFC-e / NF-e - ZATENDESTOK
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
// Integração com Focus NFe API
// Documentação: https://focusnfe.com.br/doc/
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Configuração padrão da API
 * Em produção, virá do localStorage/configurações
 */
const API_BASE = 'https://api.focusnfe.com.br'

/**
 * Formata CNPJ/CPF (remove formatação)
 */
function apenasNumeros(str) {
  return (str || '').replace(/\D/g, '')
}

/**
 * Formata valor para 2 decimais
 */
function formatarValor(valor) {
  return Number(valor || 0).toFixed(2)
}

/**
 * Gera referência única da nota (usa timestamp)
 */
function gerarReferencia() {
  return `NFE${Date.now()}`
}

/**
 * Monta objeto de item da nota conforme API Focus NFe
 */
function montarItem(item, produto, numero) {
  const valorUnitario = Number(item.price || 0)
  const quantidade = Number(item.qty || 1)
  const valorTotal = valorUnitario * quantidade

  return {
    numero_item: String(numero),
    codigo_produto: produto?.sku || item.productId,
    descricao: (item.name || 'Produto').substring(0, 120), // Max 120 caracteres
    cfop: produto?.cfop || '5102', // Venda dentro do estado
    unidade_comercial: produto?.unit || 'UN',
    quantidade_comercial: formatarValor(quantidade),
    valor_unitario_comercial: formatarValor(valorUnitario),
    valor_bruto: formatarValor(valorTotal),
    
    // NCM obrigatório (se não tiver, usa genérico)
    codigo_ncm: produto?.ncm || '00000000',
    
    // Origem da mercadoria
    origem: produto?.origem ?? '0', // 0 = Nacional
    
    // ICMS
    icms_situacao_tributaria: produto?.cst || '102', // 102 = Simples Nacional sem ST
    icms_aliquota: formatarValor(produto?.icms_aliquota || 0),
    
    // PIS
    pis_situacao_tributaria: '49', // Outras operações (Simples Nacional)
    
    // COFINS  
    cofins_situacao_tributaria: '49', // Outras operações (Simples Nacional)
  }
}

/**
 * Monta objeto da NFC-e completo
 * 
 * @param {object} venda - Objeto da venda do sistema
 * @param {array} produtos - Array de produtos (pra pegar dados fiscais)
 * @param {object} config - Configurações da empresa (CNPJ, IE, etc)
 * @returns {object} Objeto pronto pra enviar pra API
 */
export function montarNFCe(venda, produtos, config) {
  // Valida configuração mínima
  if (!config.cnpj) throw new Error('CNPJ da empresa não configurado')
  if (!config.razao_social) throw new Error('Razão Social não configurada')
  
  // Calcula totais
  const valorProdutos = venda.items.reduce((sum, item) => sum + (item.qty * item.price), 0)
  const desconto = Number(venda.discount || 0) + Number(venda.promoDiscount || 0)
  const valorTotal = valorProdutos - desconto

  // Monta itens
  const itens = venda.items.map((item, idx) => {
    const produto = produtos.find(p => p.id === item.productId)
    return montarItem(item, produto, idx + 1)
  })

  // Determina forma de pagamento
  let formaPagamento = '01' // 01 = Dinheiro
  if (venda.payment?.includes('PIX')) formaPagamento = '17'
  else if (venda.payment?.includes('Débito')) formaPagamento = '04'
  else if (venda.payment?.includes('Crédito')) formaPagamento = '03'

  // Monta objeto NFC-e
  const nfce = {
    // Referência única (obrigatório)
    natureza_operacao: 'Venda',
    
    // Tipo de documento
    modelo: '65', // 65 = NFC-e
    finalidade: '1', // 1 = Normal
    
    // Identificação do emitente
    cnpj_emitente: apenasNumeros(config.cnpj),
    inscricao_estadual_emitente: apenasNumeros(config.ie || ''),
    nome_emitente: config.razao_social,
    nome_fantasia_emitente: config.nome_fantasia || config.razao_social,
    
    // Endereço do emitente
    logradouro_emitente: config.logradouro,
    numero_emitente: config.numero,
    bairro_emitente: config.bairro,
    municipio_emitente: config.municipio,
    uf_emitente: config.uf,
    cep_emitente: apenasNumeros(config.cep),
    telefone_emitente: apenasNumeros(config.telefone || ''),
    
    // Regime tributário
    regime_tributario: config.regime === 'simples' ? '1' : '3', // 1 = Simples Nacional, 3 = Normal
    
    // Indica presença do comprador
    indicador_inscricao_estadual_destinatario: '9', // 9 = Não contribuinte
    presenca_comprador: '1', // 1 = Operação presencial
    
    // CPF do destinatário (opcional - só se tiver)
    ...(venda.customerCPF && {
      cpf_destinatario: apenasNumeros(venda.customerCPF),
      nome_destinatario: venda.customerName || 'CONSUMIDOR',
    }),
    
    // Itens da nota
    items: itens,
    
    // Totais
    valor_produtos: formatarValor(valorProdutos),
    valor_desconto: formatarValor(desconto),
    valor_total: formatarValor(valorTotal),
    
    // Modalidade do frete
    modalidade_frete: '9', // 9 = Sem frete
    
    // Formas de pagamento
    formas_pagamento: [{
      forma_pagamento: formaPagamento,
      valor_pagamento: formatarValor(valorTotal),
      ...(venda.troco > 0 && {
        valor_troco: formatarValor(venda.troco)
      })
    }],
    
    // Informações adicionais
    informacoes_adicionais_contribuinte: [
      config.mensagem_nota || 'Obrigado pela preferencia!',
      venda.operatorName ? `Operador: ${venda.operatorName}` : '',
    ].filter(Boolean).join(' | '),
  }

  return nfce
}

/**
 * Emite NFC-e via API Focus NFe
 * 
 * @param {object} nfce - Objeto da NFC-e montado
 * @param {string} token - Token da API Focus NFe
 * @param {boolean} homologacao - true = ambiente de testes
 * @returns {Promise<object>} Resposta da API
 */
export async function emitirNFCe(nfce, token, homologacao = false) {
  const referencia = gerarReferencia()
  const ambiente = homologacao ? 'homologacao' : 'producao'
  
  const url = `${API_BASE}/v2/nfce?ref=${referencia}&ambiente=${ambiente}`
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${btoa(token + ':')}`, // Focus NFe usa Basic Auth
    },
    body: JSON.stringify(nfce)
  })

  const data = await response.json()
  
  if (!response.ok) {
    throw new Error(data.mensagem || data.erros?.[0]?.mensagem || 'Erro ao emitir NFC-e')
  }

  return {
    referencia,
    ...data
  }
}

/**
 * Consulta status de uma NFC-e
 * 
 * @param {string} referencia - Referência da nota
 * @param {string} token - Token da API
 * @param {boolean} homologacao - Ambiente de homologação
 * @returns {Promise<object>} Status da nota
 */
export async function consultarNFCe(referencia, token, homologacao = false) {
  const ambiente = homologacao ? 'homologacao' : 'producao'
  const url = `${API_BASE}/v2/nfce/${referencia}?ambiente=${ambiente}`
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${btoa(token + ':')}`,
    }
  })

  const data = await response.json()
  
  if (!response.ok) {
    throw new Error(data.mensagem || 'Erro ao consultar NFC-e')
  }

  return data
}

/**
 * Cancela uma NFC-e emitida
 * 
 * @param {string} referencia - Referência da nota
 * @param {string} justificativa - Motivo do cancelamento (min 15 caracteres)
 * @param {string} token - Token da API
 * @param {boolean} homologacao - Ambiente de homologação
 * @returns {Promise<object>} Confirmação do cancelamento
 */
export async function cancelarNFCe(referencia, justificativa, token, homologacao = false) {
  if (!justificativa || justificativa.length < 15) {
    throw new Error('Justificativa deve ter no mínimo 15 caracteres')
  }

  const ambiente = homologacao ? 'homologacao' : 'producao'
  const url = `${API_BASE}/v2/nfce/${referencia}?ambiente=${ambiente}`
  
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${btoa(token + ':')}`,
    },
    body: JSON.stringify({ justificativa })
  })

  const data = await response.json()
  
  if (!response.ok) {
    throw new Error(data.mensagem || 'Erro ao cancelar NFC-e')
  }

  return data
}

/**
 * Download do XML da NFC-e
 * 
 * @param {string} referencia - Referência da nota
 * @param {string} token - Token da API
 * @param {boolean} homologacao - Ambiente de homologação
 * @returns {Promise<string>} XML da nota
 */
export async function downloadXML(referencia, token, homologacao = false) {
  const ambiente = homologacao ? 'homologacao' : 'producao'
  const url = `${API_BASE}/v2/nfce/${referencia}.xml?ambiente=${ambiente}`
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${btoa(token + ':')}`,
    }
  })

  if (!response.ok) {
    throw new Error('Erro ao baixar XML')
  }

  return await response.text()
}

/**
 * Download do DANFE (PDF) da NFC-e
 * 
 * @param {string} referencia - Referência da nota
 * @param {string} token - Token da API
 * @param {boolean} homologacao - Ambiente de homologação
 * @returns {Promise<Blob>} PDF do DANFE
 */
export async function downloadDANFE(referencia, token, homologacao = false) {
  const ambiente = homologacao ? 'homologacao' : 'producao'
  const url = `${API_BASE}/v2/nfce/${referencia}.pdf?ambiente=${ambiente}`
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${btoa(token + ':')}`,
    }
  })

  if (!response.ok) {
    throw new Error('Erro ao baixar DANFE')
  }

  return await response.blob()
}

/**
 * Valida se configuração está completa pra emissão
 * 
 * @param {object} config - Configurações da empresa
 * @returns {object} { valido: boolean, erros: string[] }
 */
export function validarConfigNFe(config) {
  const erros = []

  if (!config.token_nfe) erros.push('Token da API não configurado')
  if (!config.cnpj) erros.push('CNPJ não configurado')
  if (!config.razao_social) erros.push('Razão Social não configurada')
  if (!config.ie) erros.push('Inscrição Estadual não configurada')
  if (!config.logradouro) erros.push('Endereço não configurado')
  if (!config.numero) erros.push('Número do endereço não configurado')
  if (!config.bairro) erros.push('Bairro não configurado')
  if (!config.municipio) erros.push('Município não configurado')
  if (!config.uf) erros.push('UF não configurada')
  if (!config.cep) erros.push('CEP não configurado')

  return {
    valido: erros.length === 0,
    erros
  }
}

/**
 * Estados brasileiros (pra validação)
 */
export const ESTADOS_BR = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
]

/**
 * Status possíveis de uma NFC-e
 */
export const STATUS_NFE = {
  processando: { label: 'Processando', cor: 'blue' },
  autorizada: { label: 'Autorizada', cor: 'green' },
  erro: { label: 'Erro', cor: 'red' },
  cancelada: { label: 'Cancelada', cor: 'gray' },
  denegada: { label: 'Denegada', cor: 'red' },
}
