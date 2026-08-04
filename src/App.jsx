import React from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { StoreProvider } from './store.jsx'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import PDV from './pages/PDV.jsx'
import Produtos from './pages/Produtos.jsx'
import Vendas from './pages/Vendas.jsx'
import Estoque from './pages/Estoque.jsx'
import Clientes from './pages/Clientes.jsx'
import Fidelidade from './pages/Fidelidade.jsx'
import Fiado from './pages/Fiado.jsx'
import Promocoes from './pages/Promocoes.jsx'
import Configuracoes from './pages/Configuracoes.jsx'
import CustomerDisplay from './pages/CustomerDisplay.jsx'
import Flyer from './pages/Flyer.jsx'
import Terminal from './pages/Terminal.jsx'
import ScanMobile from './pages/ScanMobile.jsx'
import Relatorio from './pages/Relatorio.jsx'
import Etiquetas from './pages/Etiquetas.jsx'
import Validade from './pages/Validade.jsx'
import Campanhas from './pages/Campanhas.jsx'
import Fornecedor from './pages/Fornecedor.jsx'
import Ofertas from './pages/Ofertas.jsx'
import { isLoggedIn } from './utils/auth.js'

function RequireAuth({ children }) {
  const location = useLocation()
  if (!isLoggedIn()) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return children
}

export default function App() {
  return (
    <StoreProvider>
      <Routes>
        {/* Public */}
        <Route path="/login"   element={<Login />} />
        {/* Full-screen pages — no sidebar, but still protected */}
        <Route path="/display" element={<CustomerDisplay />} />
        <Route path="/flyer"   element={<RequireAuth><Flyer /></RequireAuth>} />
        <Route path="/terminal" element={<RequireAuth><Terminal /></RequireAuth>} />
        <Route path="/scan"       element={<ScanMobile />} />
        <Route path="/fornecedor" element={<Fornecedor />} />
        {/* /ofertas é pública — mercados acessam sem login PDV (usa ?s=TENANT_ID) */}
        <Route path="/ofertas"    element={<Ofertas />} />

        <Route element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"    element={<Dashboard />} />
          <Route path="/pdv"          element={<PDV />} />
          <Route path="/produtos"     element={<Produtos />} />
          <Route path="/vendas"       element={<Vendas />} />
          <Route path="/estoque"      element={<Estoque />} />
          <Route path="/clientes"     element={<Clientes />} />
          <Route path="/fidelidade"   element={<Fidelidade />} />
          <Route path="/fiado"         element={<Fiado />} />
          <Route path="/promocoes"     element={<Promocoes />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
          <Route path="/relatorio"     element={<Relatorio />} />
          <Route path="/etiquetas"     element={<Etiquetas />} />
          <Route path="/validade"      element={<Validade />} />
          <Route path="/campanhas"     element={<Campanhas />} />
        </Route>
      </Routes>
    </StoreProvider>
  )
}
