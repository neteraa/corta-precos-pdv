import React, { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { StoreProvider } from './store.jsx'
import Layout from './components/Layout.jsx'
import UpdateBanner from './components/UpdateBanner.jsx'
import { isLoggedIn, getRole, hasConfiguredStore } from './utils/auth.js'

/* ── Lazy page chunks — each page loads only when first visited ── */
const Landing        = lazy(() => import('./pages/Landing.jsx'))
const Login          = lazy(() => import('./pages/Login.jsx'))
const ResetStore     = lazy(() => import('./pages/ResetStore.jsx'))
const Dashboard      = lazy(() => import('./pages/Dashboard.jsx'))
const PDV            = lazy(() => import('./pages/PDV.jsx'))
const Produtos       = lazy(() => import('./pages/Produtos.jsx'))
const Vendas         = lazy(() => import('./pages/Vendas.jsx'))
const Estoque        = lazy(() => import('./pages/Estoque.jsx'))
const Clientes       = lazy(() => import('./pages/Clientes.jsx'))
const Fidelidade     = lazy(() => import('./pages/Fidelidade.jsx'))
const Fiado          = lazy(() => import('./pages/Fiado.jsx'))
const Promocoes      = lazy(() => import('./pages/Promocoes.jsx'))
const Configuracoes  = lazy(() => import('./pages/Configuracoes.jsx'))
const CustomerDisplay = lazy(() => import('./pages/CustomerDisplay.jsx'))
const Flyer          = lazy(() => import('./pages/Flyer.jsx'))
const Terminal       = lazy(() => import('./pages/Terminal.jsx'))
const ScanMobile     = lazy(() => import('./pages/ScanMobile.jsx'))
const Relatorio      = lazy(() => import('./pages/Relatorio.jsx'))
const Etiquetas      = lazy(() => import('./pages/Etiquetas.jsx'))
const Validade       = lazy(() => import('./pages/Validade.jsx'))
const Campanhas      = lazy(() => import('./pages/Campanhas.jsx'))
const Fornecedor     = lazy(() => import('./pages/Fornecedor.jsx'))
const Fornecedores   = lazy(() => import('./pages/Fornecedores.jsx'))
const Ofertas        = lazy(() => import('./pages/Ofertas.jsx'))
const PainelTV       = lazy(() => import('./pages/PainelTV.jsx'))
const VitrinaDigital = lazy(() => import('./pages/VitrinaDigital.jsx'))
const Guia           = lazy(() => import('./pages/Guia.jsx'))
const Afiliado       = lazy(() => import('./pages/Afiliado.jsx'))
const Demo           = lazy(() => import('./pages/Demo.jsx'))
const MasterPainel   = lazy(() => import('./pages/MasterPainel.jsx'))
const CaixaLogin     = lazy(() => import('./pages/CaixaLogin.jsx'))
const Home           = lazy(() => import('./pages/Home.jsx'))
const Entrega        = lazy(() => import('./pages/Entrega.jsx'))

function PageSpinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: '#f8fafc' }}>
      <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#f97316', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

function RequireAuth({ children }) {
  const location = useLocation()
  if (!isLoggedIn()) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return children
}

/**
 * Guarda o Terminal atrás de auth, mas:
 * - Se o dispositivo tem storeId configurado → redireciona para /caixa (PIN de operador)
 * - Se não tem storeId → redireciona para /login (primeiro acesso, admin configura)
 * O caixeiro NUNCA precisa digitar username/senha de admin.
 */
function RequireCaixaAuth({ children }) {
  const location = useLocation()
  if (!isLoggedIn()) {
    return hasConfiguredStore()
      ? <Navigate to="/caixa" state={{ from: location }} replace />
      : <Navigate to="/login" state={{ from: location }} replace />
  }
  return children
}

/* Routes only admin/gerente can access — caixa goes to /pdv */
const ADMIN_ONLY = new Set(['/home','/dashboard','/produtos','/vendas','/estoque','/clientes','/relatorio','/etiquetas','/validade','/campanhas','/fidelidade','/flyer','/configuracoes','/promocoes','/ofertas','/entrega','/fornecedores'])

function RequireRole({ children }) {
  const location = useLocation()
  const role = getRole()
  // scanner: acesso apenas ao /scan — redireciona tudo para lá
  if (role === 'scanner') return <Navigate to="/scan" replace />
  // caixa: não pode acessar páginas de admin
  if (role === 'caixa' && ADMIN_ONLY.has(location.pathname)) {
    return <Navigate to="/pdv" replace />
  }
  return children
}

export default function App() {
  return (
    <>
    <UpdateBanner />
    <StoreProvider>
      <Suspense fallback={<PageSpinner />}>
        <Routes>
          {/* Public */}
          <Route path="/"        element={<Landing />} />
          <Route path="/login"   element={<Login />} />
          <Route path="/limpar"  element={<ResetStore />} />
          {/* Full-screen pages — no sidebar */}
          <Route path="/display" element={<CustomerDisplay />} />
          <Route path="/flyer"   element={<RequireAuth><Flyer /></RequireAuth>} />
          <Route path="/terminal" element={<RequireCaixaAuth><Terminal /></RequireCaixaAuth>} />
          <Route path="/scan"         element={<RequireAuth><ScanMobile /></RequireAuth>} />
          <Route path="/fornecedor"   element={<Fornecedor />} />
          <Route path="/tv"           element={<PainelTV />} />
          <Route path="/loja/:storeSlug" element={<VitrinaDigital />} />
          <Route path="/guia"         element={<Guia />} />
          <Route path="/afiliado"     element={<Afiliado />} />
          <Route path="/demo"         element={<Demo />} />
          <Route path="/demo/:niche"  element={<Demo />} />
          <Route path="/painel"       element={<MasterPainel />} />
          <Route path="/caixa"          element={<CaixaLogin />} />
          <Route path="/caixa/:storeId" element={<CaixaLogin />} />
          {/* /ofertas — pública, mercados acessam sem login PDV */}
          <Route path="/ofertas"      element={<Ofertas />} />

          <Route element={<RequireAuth><RequireRole><Layout /></RequireRole></RequireAuth>}>
            <Route path="/home"         element={<Home />} />
            <Route path="/entrega"      element={<Entrega />} />
            <Route path="/dashboard"    element={<Dashboard />} />
            <Route path="/pdv"          element={<PDV />} />
            <Route path="/produtos"     element={<Produtos />} />
            <Route path="/vendas"       element={<Vendas />} />
            <Route path="/estoque"      element={<Estoque />} />
            <Route path="/clientes"     element={<Clientes />} />
            <Route path="/fidelidade"   element={<Fidelidade />} />
            <Route path="/fiado"        element={<Fiado />} />
            <Route path="/promocoes"    element={<Promocoes />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
            <Route path="/relatorio"    element={<Relatorio />} />
            <Route path="/etiquetas"    element={<Etiquetas />} />
            <Route path="/validade"     element={<Validade />} />
            <Route path="/campanhas"    element={<Campanhas />} />
            <Route path="/fornecedores" element={<Fornecedores />} />
          </Route>
        </Routes>
      </Suspense>
    </StoreProvider>
    </>
  )
}
