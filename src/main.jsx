import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

// eslint-disable-next-line no-undef
if (typeof __BUILD_TS__ !== 'undefined') console.info('[ZatendeStock] build', new Date(__BUILD_TS__).toISOString())

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
)
