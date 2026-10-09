import React, { useState } from 'react'
import { Calculator, CheckCircle2, AlertCircle } from 'lucide-react'
import { useStore } from '../store.jsx'
import { ICMS_POR_ESTADO, REGIMES } from '../utils/fiscal.js'

/**
 * Componente de Configurações Fiscais
 * Permite cliente configurar impostos que aparecem na nota
 */
export default function ConfiguracaoFiscal() {
  const { fiscalConfig, setFiscalConfig } = useStore()
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setFiscalConfig(fiscalConfig)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleToggle = () => {
    setFiscalConfig({
      ...fiscalConfig,
      mostrar_impostos_nota: !fiscalConfig.mostrar_impostos_nota
    })
  }

  const handleChange = (field, value) => {
    setFiscalConfig({ ...fiscalConfig, [field]: value })
  }

  const estados = Object.keys(ICMS_POR_ESTADO).sort()
  const regimeAtual = REGIMES[fiscalConfig.regime] || REGIMES.simples

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Calculator className="w-8 h-8 text-blue-600" />
        <div>
          <h2 className="text-2xl font-black text-gray-800">Configurações Fiscais</h2>
          <p className="text-sm text-gray-500">Configure impostos que aparecem na nota térmica</p>
        </div>
      </div>

      {/* Alert */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <p className="font-bold mb-1">⚠️ Importante</p>
          <p>Valores são aproximados. <strong>Consulte seu contador</strong> para valores exatos e obrigações fiscais!</p>
        </div>
      </div>

      {/* Toggle Geral */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-gray-800">Mostrar Impostos na Nota</h3>
            <p className="text-sm text-gray-500">Exibe informações fiscais na nota impressa (Lei 12.741/2012)</p>
          </div>
          <button
            onClick={handleToggle}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
              fiscalConfig.mostrar_impostos_nota ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                fiscalConfig.mostrar_impostos_nota ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {fiscalConfig.mostrar_impostos_nota && (
          <div className="space-y-6 pt-6 border-t border-gray-200">
            {/* Regime Tributário */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Regime Tributário
              </label>
              <select
                value={fiscalConfig.regime}
                onChange={(e) => handleChange('regime', e.target.value)}
                className="input"
              >
                <option value="simples">Simples Nacional</option>
                <option value="presumido">Lucro Presumido</option>
                <option value="real">Lucro Real</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">{regimeAtual.info}</p>
            </div>

            {/* Estado */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Estado (UF) da Loja
              </label>
              <select
                value={fiscalConfig.estado}
                onChange={(e) => {
                  const uf = e.target.value
                  handleChange('estado', uf)
                  handleChange('icms_padrao', ICMS_POR_ESTADO[uf] || 18)
                }}
                className="input"
              >
                {estados.map(uf => (
                  <option key={uf} value={uf}>
                    {uf} - ICMS {ICMS_POR_ESTADO[uf]}%
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Alíquota ICMS padrão: {fiscalConfig.icms_padrao}%
              </p>
            </div>

            {/* Alíquotas (só mostra se não for Simples) */}
            {fiscalConfig.regime !== 'simples' && (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    ICMS (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={fiscalConfig.icms_padrao}
                    onChange={(e) => handleChange('icms_padrao', parseFloat(e.target.value) || 0)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    PIS (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={fiscalConfig.pis_padrao}
                    onChange={(e) => handleChange('pis_padrao', parseFloat(e.target.value) || 0)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    COFINS (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={fiscalConfig.cofins_padrao}
                    onChange={(e) => handleChange('cofins_padrao', parseFloat(e.target.value) || 0)}
                    className="input"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Preview */}
        {fiscalConfig.mostrar_impostos_nota && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs font-bold text-gray-600 mb-2">PREVIEW - Como aparece na nota:</p>
            <div className="font-mono text-xs text-gray-700 whitespace-pre">
              {fiscalConfig.regime === 'simples' ? (
                <>
                  {`TRIBUTOS APROXIMADOS:\nTrib. aprox.         R$  8,00\nConforme Lei 12.741/2012\n(Simples Nacional)`}
                </>
              ) : (
                <>
                  {`TRIBUTOS:\nICMS                R$ ${fiscalConfig.icms_padrao.toFixed(2)}\nPIS                 R$ ${fiscalConfig.pis_padrao.toFixed(2)}\nCOFINS              R$ ${fiscalConfig.cofins_padrao.toFixed(2)}\nTotal tributos      R$ ${(fiscalConfig.icms_padrao + fiscalConfig.pis_padrao + fiscalConfig.cofins_padrao).toFixed(2)}`}
                </>
              )}
            </div>
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

      {/* Aviso Legal */}
      <div className="card p-4 bg-gray-50 border border-gray-200">
        <p className="text-xs text-gray-600 leading-relaxed">
          <strong>Aviso Legal:</strong> Os valores de impostos exibidos são aproximados e informativos.
          Este sistema NÃO substitui orientação contábil profissional. Consulte sempre seu contador
          para valores exatos e cumprimento de obrigações fiscais. O ZatendeStok não se responsabiliza
          por erros de apuração ou descumprimento de normas fiscais.
        </p>
      </div>
    </div>
  )
}
