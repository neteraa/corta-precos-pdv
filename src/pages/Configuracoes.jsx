import React, { useState } from 'react'
import { Database, RotateCcw, Download, Upload, Info, Store, QrCode, Save, KeyRound, Eye, EyeOff } from 'lucide-react'
import { useStore } from '../store.jsx'
import { parseGdoorCsv } from '../utils/importCsv.js'
import { usePrinter, savePrinterSettings } from '../hooks/usePrinter.js'
import PixQR from '../components/PixQR.jsx'
import { getCredentials, saveCredentials } from '../utils/auth.js'

export default function Configuracoes() {
  const { products, sales, customers, importProducts, resetAll } = useStore()
  const { settings, setSettings } = usePrinter()
  const [form, setForm] = useState(() => ({
    storeName:  settings.storeName  || 'CORTA PRECOS',
    phone:      settings.phone      || '(15) 99660-4075',
    address:    settings.address    || '',
    instagram:  settings.instagram  || 'mercadocortaprecos',
    pixKey:     settings.pixKey     || '',
    pixCity:    settings.pixCity    || 'SAO PAULO',
  }))
  const [saved, setSaved] = useState(false)

  // ── Auth / credentials ────────────────────────────────────
  const [authForm, setAuthForm] = useState(() => {
    const { username } = getCredentials()
    return { username, newPass: '', confirmPass: '' }
  })
  const [showPass, setShowPass]   = useState(false)
  const [authMsg,  setAuthMsg]    = useState(null) // {type:'ok'|'err', text}

  const saveAuth = () => {
    setAuthMsg(null)
    if (!authForm.username.trim()) return setAuthMsg({ type: 'err', text: 'Usuário não pode ser vazio.' })
    if (authForm.newPass && authForm.newPass.length < 4)
      return setAuthMsg({ type: 'err', text: 'Senha precisa de pelo menos 4 caracteres.' })
    if (authForm.newPass !== authForm.confirmPass)
      return setAuthMsg({ type: 'err', text: 'As senhas não coincidem.' })
    const { password: currentPass } = getCredentials()
    saveCredentials(authForm.username.trim(), authForm.newPass || currentPass)
    setAuthForm(f => ({ ...f, newPass: '', confirmPass: '' }))
    setAuthMsg({ type: 'ok', text: '✅ Credenciais atualizadas!' })
    setTimeout(() => setAuthMsg(null), 3000)
  }

  const saveSettings = () => {
    setSettings(s => ({ ...s, ...form }))
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const exportBackup = () => {
    const data = JSON.stringify({ products, sales, customers, exportedAt: new Date().toISOString() }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `cortaprecos-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click()
  }

  const handleImportCsv = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    try {
      const buf = await file.arrayBuffer()
      const list = parseGdoorCsv(buf)
      importProducts(list)
      alert(`✅ ${list.length} produtos importados!`)
    } catch (err) { alert('Erro: ' + err.message) }
    e.target.value = ''
  }

  const handleImportNFe = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    try {
      const text = await file.text()
      const parser = new DOMParser()
      const doc = parser.parseFromString(text, 'application/xml')
      const dets = Array.from(doc.querySelectorAll('det'))
      if (dets.length === 0) { alert('XML inválido ou sem itens (det).'); return }
      const items = dets.map(det => {
        const get = (tag) => det.querySelector(tag)?.textContent?.trim() || ''
        return {
          ean:   get('cEAN'),
          name:  get('xProd'),
          qty:   parseFloat(get('qCom'))  || 0,
          cost:  parseFloat(get('vUnCom').replace(',', '.')) || 0,
          ncm:   get('NCM'),
          unit:  get('uCom'),
        }
      })
      // Pass to store for stock update
      importProducts(items.map(i => ({
        barcode:  i.ean !== 'SEM GTIN' ? i.ean : '',
        name:     i.name,
        cost:     i.cost,
        price:    i.cost * 1.3,    // default 30% margin
        stock:    i.qty,
        category: 'NF-e Import',
        unit:     i.unit,
      })), { merge: true, addStock: true })
      alert(`✅ NF-e importada! ${items.length} itens processados.\nEstoque atualizado com as quantidades da nota.`)
    } catch (err) { alert('Erro ao ler NF-e: ' + err.message) }
    e.target.value = ''
  }

  const Field = ({ label, hint, children }) => (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )

  const Section = ({ icon: Icon, title, children }) => (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
        <Icon className="w-4 h-4 text-brand-600" />
        <h2 className="font-bold text-gray-800">{title}</h2>
      </div>
      {children}
    </div>
  )

  return (
    <div className="space-y-4 max-w-2xl animate-pop">
      <h1 className="text-2xl font-black text-gray-900">Configurações</h1>

      {/* ── Dados da loja ──────────────────────────────────────── */}
      <Section icon={Store} title="Dados da Loja">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nome da loja">
            <input className="input" value={form.storeName} onChange={e => set('storeName', e.target.value)} />
          </Field>
          <Field label="Telefone / WhatsApp">
            <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(15) 99660-4075" />
          </Field>
          <Field label="Endereço (opcional)">
            <input className="input" value={form.address} onChange={e => set('address', e.target.value)} />
          </Field>
          <Field label="Instagram (sem @)">
            <input className="input" value={form.instagram} onChange={e => set('instagram', e.target.value)} placeholder="mercadocortaprecos" />
          </Field>
        </div>
        <button onClick={saveSettings} className={`btn-primary mt-4 ${saved ? 'bg-green-600 hover:bg-green-600' : ''}`}>
          <Save className="w-4 h-4" /> {saved ? '✅ Salvo!' : 'Salvar dados'}
        </button>
      </Section>

      {/* ── Chave PIX ──────────────────────────────────────────── */}
      <Section icon={QrCode} title="PIX — QR Code Automático">
        <p className="text-sm text-gray-500 mb-4">
          Configure sua chave PIX para gerar QR codes automaticamente no valor exato durante o pagamento.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <Field label="Chave PIX" hint="Telefone (+5515...), CPF, CNPJ, e-mail ou chave aleatória">
            <input className="input font-mono text-sm" value={form.pixKey}
              onChange={e => set('pixKey', e.target.value)}
              placeholder="+55159966XXXX ou CPF/CNPJ" />
          </Field>
          <Field label="Cidade (para o QR)">
            <input className="input" value={form.pixCity} onChange={e => set('pixCity', e.target.value)} placeholder="SAO PAULO" />
          </Field>
        </div>
        {form.pixKey && (
          <div className="flex flex-col sm:flex-row items-center gap-6 bg-gray-50 rounded-xl p-4">
            <PixQR amount={10} pixKey={form.pixKey} name={form.storeName} city={form.pixCity} txid="TESTE" size={140} />
            <div className="text-sm text-gray-600">
              <p className="font-bold text-gray-800 mb-1">Preview (R$10,00)</p>
              <p>O QR aparece automaticamente no PDV quando o pagamento é PIX, com o valor exato da compra.</p>
              <p className="mt-2 text-xs text-gray-400">Chave: {form.pixKey}</p>
            </div>
          </div>
        )}
        <button onClick={saveSettings} className={`btn-primary mt-4 ${saved ? 'bg-green-600 hover:bg-green-600' : ''}`}>
          <Save className="w-4 h-4" /> {saved ? '✅ Salvo!' : 'Salvar chave PIX'}
        </button>
      </Section>

      {/* ── Base de dados / NF-e ───────────────────────────────── */}
      <Section icon={Database} title="Importar Dados">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Base CSV Gdoor</p>
            <p className="text-xs text-gray-400 mb-2">
              Separador <code className="bg-gray-100 px-1 rounded">|</code>, encoding Mac Roman. Atualiza produtos e estoque.
            </p>
            <label className="btn-ghost cursor-pointer text-sm">
              <Upload className="w-4 h-4" /> Importar CSV (Gdoor)
              <input type="file" accept=".csv,.txt" className="hidden" onChange={handleImportCsv} />
            </label>
          </div>
          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm font-semibold text-gray-700 mb-1">📄 NF-e XML do Fornecedor</p>
            <p className="text-xs text-gray-400 mb-2">
              Importa nota fiscal eletrônica (XML). Atualiza estoque e custo automaticamente.
            </p>
            <label className="btn-primary cursor-pointer text-sm">
              <Upload className="w-4 h-4" /> Importar NF-e XML
              <input type="file" accept=".xml" className="hidden" onChange={handleImportNFe} />
            </label>
          </div>
        </div>
      </Section>

      {/* ── Backup ─────────────────────────────────────────────── */}
      <Section icon={Download} title="Backup & Exportação">
        <p className="text-sm text-gray-500 mb-3">Exporta todos os dados em JSON.</p>
        <button onClick={exportBackup} className="btn-ghost">
          <Download className="w-4 h-4" /> Exportar backup (.json)
        </button>
      </Section>

      {/* ── Status ─────────────────────────────────────────────── */}
      <Section icon={Info} title="Status do Sistema">
        <div className="grid grid-cols-3 gap-3">
          {[['Produtos', products.length], ['Vendas', sales.length], ['Clientes', customers.length]].map(([label, value]) => (
            <div key={label} className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-xl font-black text-gray-800">{value}</div>
              <div className="text-xs text-gray-500">{label}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Acesso / Login ─────────────────────────────────────── */}
      <Section icon={KeyRound} title="Acesso ao Sistema">
        <p className="text-sm text-gray-500 mb-4">
          Altere o usuário e/ou senha de login. Deixe a senha em branco para manter a atual.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Usuário">
            <input
              className="input"
              value={authForm.username}
              onChange={e => setAuthForm(f => ({ ...f, username: e.target.value }))}
              placeholder="admin"
            />
          </Field>
          <div /> {/* spacer */}
          <Field label="Nova senha">
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                className="input pr-10"
                value={authForm.newPass}
                onChange={e => setAuthForm(f => ({ ...f, newPass: e.target.value }))}
                placeholder="mínimo 4 caracteres"
              />
              <button type="button" onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </Field>
          <Field label="Confirmar nova senha">
            <input
              type={showPass ? 'text' : 'password'}
              className="input"
              value={authForm.confirmPass}
              onChange={e => setAuthForm(f => ({ ...f, confirmPass: e.target.value }))}
              placeholder="repita a senha"
            />
          </Field>
        </div>
        {authMsg && (
          <div className={`mt-3 px-4 py-2.5 rounded-xl text-sm font-medium ${
            authMsg.type === 'ok'
              ? 'bg-green-500/10 text-green-700 border border-green-200'
              : 'bg-red-500/10 text-red-600 border border-red-200'
          }`}>
            {authMsg.text}
          </div>
        )}
        <button onClick={saveAuth} className="btn-primary mt-4">
          <Save className="w-4 h-4" /> Salvar acesso
        </button>
      </Section>

      {/* ── Reset ──────────────────────────────────────────────── */}
      <Section icon={RotateCcw} title="Reset">
        <p className="text-sm text-red-500 font-medium mb-3">⚠️ Apaga todos os dados e restaura demonstração.</p>
        <button onClick={() => { if (confirm('Tem certeza? Todos os dados serão apagados!')) resetAll() }} className="btn-danger">
          <RotateCcw className="w-4 h-4" /> Resetar para dados demo
        </button>
      </Section>
    </div>
  )
}
