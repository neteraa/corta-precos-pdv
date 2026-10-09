import React, { useState } from 'react'
import { FileText, CheckCircle2, AlertTriangle, Key, Building2, MapPin, Shield } from 'lucide-react'
import { useStore } from '../store.jsx'
import { validarConfigNFe, ESTADOS_BR } from '../utils/nfe.js'

/**
 * Componente de Configuração de NF-e
 * Permite configurar emissão de nota fiscal eletrônica
 */
export default function ConfiguracaoNFe() {
  const { nfeConfig, setNfeConfig } = useStore()
  const [saved, setSaved] = useState(false)
  const [showToken, setShowToken] = useState(false)

  const handleSave = () => {
    setNfeConfig(nfeConfig)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleToggle = () => {
    setNfeConfig({
      ...nfeConfig,
      habilitado: !nfeConfig.habilitado
    })
  }

  const handleChange = (field, value) => {
    setNfeConfig({ ...nfeConfig, [field]: value })
  }

  // Valida configuração
  const validacao = validarConfigNFe(nfeConfig)
  const podeEmitir = nfeConfig.habilitado && validacao.valido

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <FileText className="w-8 h-8 text-green-600" />
        <div>
          <h2 className="text-2xl font-black text-gray-800">Emissão de NF-e / NFC-e</h2>
          <p className="text-sm text-gray-500">Configure para emitir notas fiscais eletrônicas</p>
        </div>
      </div>

      {/* Alert - Focus NFe */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-bold mb-1">📌 Integração via Focus NFe</p>
          <p>
            Sistema integrado com <strong>Focus NFe</strong> (API homologada pela SEFAZ).
            <br/>
            Você precisa criar uma conta em: <a href="https://focusnfe.com.br" target="_blank" rel="noopener noreferrer" className="underline font-bold">focusnfe.com.br</a>
            <br/>
            <span className="text-xs">Planos a partir de R$49/mês • Teste grátis disponível</span>
          </p>
        </div>
      </div>

      {/* Toggle Geral */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-gray-800">Habilitar Emissão de NF-e</h3>
            <p className="text-sm text-gray-500">Liga/desliga emissão de notas fiscais eletrônicas</p>
          </div>
          <button
            onClick={handleToggle}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
              nfeConfig.habilitado ? 'bg-green-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                nfeConfig.habilitado ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {nfeConfig.habilitado && (
          <div className="space-y-6 pt-6 border-t border-gray-200">
            {/* ━━━━━━━━━━━━━━ API FOCUS NFE ━━━━━━━━━━━━━━ */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <Key className="w-4 h-4 text-gray-600" />
                <h4 className="font-bold text-gray-800">Credenciais da API</h4>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Token da API Focus NFe *
                  </label>
                  <div className="relative">
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={nfeConfig.token_nfe}
                      onChange={(e) => handleChange('token_nfe', e.target.value)}
                      placeholder="Cole aqui o token da Focus NFe"
                      className="input pr-20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded bg-gray-100"
                    >
                      {showToken ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Obtenha em: Focus NFe → Configurações → Tokens de Integração
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Ambiente
                  </label>
                  <select
                    value={nfeConfig.ambiente}
                    onChange={(e) => handleChange('ambiente', e.target.value)}
                    className="input"
                  >
                    <option value="homologacao">Homologação (Testes)</option>
                    <option value="producao">Produção (Real)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {nfeConfig.ambiente === 'homologacao' 
                      ? '⚠️ Modo de testes - notas não têm valor fiscal'
                      : '✅ Modo real - notas têm valor fiscal oficial'}
                  </p>
                </div>
              </div>
            </div>

            {/* ━━━━━━━━━━━━━━ DADOS DA EMPRESA ━━━━━━━━━━━━━━ */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4 text-gray-600" />
                <h4 className="font-bold text-gray-800">Dados da Empresa</h4>
              </div>
              
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      CNPJ *
                    </label>
                    <input
                      type="text"
                      value={nfeConfig.cnpj}
                      onChange={(e) => handleChange('cnpj', e.target.value)}
                      placeholder="00.000.000/0000-00"
                      maxLength="18"
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Inscrição Estadual *
                    </label>
                    <input
                      type="text"
                      value={nfeConfig.ie}
                      onChange={(e) => handleChange('ie', e.target.value)}
                      placeholder="000.000.000.000"
                      className="input"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Razão Social *
                  </label>
                  <input
                    type="text"
                    value={nfeConfig.razao_social}
                    onChange={(e) => handleChange('razao_social', e.target.value)}
                    placeholder="Exemplo: CORTA PRECOS COMERCIO LTDA"
                    className="input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nome Fantasia
                  </label>
                  <input
                    type="text"
                    value={nfeConfig.nome_fantasia}
                    onChange={(e) => handleChange('nome_fantasia', e.target.value)}
                    placeholder="Exemplo: Corta Preços Supermercado"
                    className="input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Regime Tributário
                  </label>
                  <select
                    value={nfeConfig.regime}
                    onChange={(e) => handleChange('regime', e.target.value)}
                    className="input"
                  >
                    <option value="simples">Simples Nacional</option>
                    <option value="presumido">Lucro Presumido</option>
                    <option value="real">Lucro Real</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ━━━━━━━━━━━━━━ ENDEREÇO ━━━━━━━━━━━━━━ */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4 text-gray-600" />
                <h4 className="font-bold text-gray-800">Endereço da Empresa</h4>
              </div>
              
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Logradouro *
                    </label>
                    <input
                      type="text"
                      value={nfeConfig.logradouro}
                      onChange={(e) => handleChange('logradouro', e.target.value)}
                      placeholder="Rua, Av, etc"
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Número *
                    </label>
                    <input
                      type="text"
                      value={nfeConfig.numero}
                      onChange={(e) => handleChange('numero', e.target.value)}
                      placeholder="123"
                      className="input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Complemento
                    </label>
                    <input
                      type="text"
                      value={nfeConfig.complemento}
                      onChange={(e) => handleChange('complemento', e.target.value)}
                      placeholder="Sala, apto, etc"
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Bairro *
                    </label>
                    <input
                      type="text"
                      value={nfeConfig.bairro}
                      onChange={(e) => handleChange('bairro', e.target.value)}
                      placeholder="Centro, Jardim..."
                      className="input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Município *
                    </label>
                    <input
                      type="text"
                      value={nfeConfig.municipio}
                      onChange={(e) => handleChange('municipio', e.target.value)}
                      placeholder="Cidade"
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      UF *
                    </label>
                    <select
                      value={nfeConfig.uf}
                      onChange={(e) => handleChange('uf', e.target.value)}
                      className="input"
                    >
                      {ESTADOS_BR.map(uf => (
                        <option key={uf} value={uf}>{uf}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      CEP *
                    </label>
                    <input
                      type="text"
                      value={nfeConfig.cep}
                      onChange={(e) => handleChange('cep', e.target.value)}
                      placeholder="00000-000"
                      maxLength="9"
                      className="input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Telefone
                    </label>
                    <input
                      type="text"
                      value={nfeConfig.telefone}
                      onChange={(e) => handleChange('telefone', e.target.value)}
                      placeholder="(00) 00000-0000"
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={nfeConfig.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      placeholder="contato@empresa.com.br"
                      className="input"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ━━━━━━━━━━━━━━ MENSAGEM NA NOTA ━━━━━━━━━━━━━━ */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Mensagem na Nota (opcional)
              </label>
              <textarea
                value={nfeConfig.mensagem_nota}
                onChange={(e) => handleChange('mensagem_nota', e.target.value)}
                placeholder="Texto que aparece nas informações adicionais da nota"
                rows="2"
                className="input"
                maxLength="255"
              />
              <p className="text-xs text-gray-500 mt-1">
                Máximo 255 caracteres
              </p>
            </div>

            {/* STATUS DE VALIDAÇÃO */}
            {!validacao.valido && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-bold mb-1">⚠️ Configuração incompleta</p>
                    <ul className="list-disc list-inside space-y-1">
                      {validacao.erros.map((erro, idx) => (
                        <li key={idx}>{erro}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {podeEmitir && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-green-800">
                  <p className="font-bold">✅ Configuração completa!</p>
                  <p>Sistema pronto para emitir notas fiscais eletrônicas.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Botão Salvar */}
      <div className="flex items-center justify-end gap-3">
        {saved && (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-sm font-semibold">Configurações salvas!</span>
          </div>
        )}
        <button onClick={handleSave} className="btn-primary">
          Salvar Configurações
        </button>
      </div>

      {/* Ajuda */}
      <div className="card p-4 bg-gray-50 border border-gray-200">
        <p className="text-xs text-gray-600 leading-relaxed">
          <strong>📚 Como configurar:</strong><br/>
          1. Crie conta gratuita em <a href="https://focusnfe.com.br" target="_blank" rel="noopener noreferrer" className="underline">focusnfe.com.br</a><br/>
          2. Obtenha o <strong>token de integração</strong> no painel da Focus NFe<br/>
          3. Preencha todos os campos obrigatórios (*) acima<br/>
          4. Teste primeiro em <strong>Homologação</strong>, depois mude para Produção<br/>
          5. Configure certificado digital A1 no painel da Focus NFe<br/>
          <br/>
          <strong>💡 Dica:</strong> Focus NFe oferece 10 notas grátis de teste!
        </p>
      </div>
    </div>
  )
}
