import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { StoreProvider } from './store.jsx'
import Layout from './components/Layout.jsx'
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

export default function App() {
  return (
    <StoreProvider>
      <Routes>
        {/* Full-screen pages — no sidebar */}
        <Route path="/display"  element={<CustomerDisplay />} />
        <Route path="/flyer"    element={<Flyer />} />
        <Route path="/terminal" element={<Terminal />} />
        <Route path="/scan"     element={<ScanMobile />} />

        <Route element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/pdv" element={<PDV />} />
          <Route path="/produtos" element={<Produtos />} />
          <Route path="/vendas" element={<Vendas />} />
          <Route path="/estoque" element={<Estoque />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/fidelidade" element={<Fidelidade />} />
          <Route path="/fiado"     element={<Fiado />} />
          <Route path="/promocoes" element={<Promocoes />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
        </Route>
      </Routes>
    </StoreProvider>
  )
}
