import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ShoppingCart, Eye, EyeOff, Lock, User } from 'lucide-react'
import { getCredentials } from '../utils/auth.js'

export default function Login() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const from      = location.state?.from?.pathname || '/dashboard'

  const [user, setUser]   = useState('')
  const [pass, setPass]   = useState('')
  const [show, setShow]   = useState(false)
  const [err,  setErr]    = useState('')
  const [loading, setLoading] = useState(false)

  const submit = (e) => {
    e.preventDefault()
    setErr('')
    setLoading(true)
    setTimeout(() => {
      const { username, password } = getCredentials()
      if (user.trim() === username && pass === password) {
        localStorage.setItem('cp_session', JSON.stringify({ loggedIn: true, user: user.trim() }))
        navigate(from, { replace: true })
      } else {
        setErr('Usuário ou senha incorretos.')
        setLoading(false)
      }
    }, 400) // small delay feels more real
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4">
      {/* background pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#1c0a00_0%,_#030712_70%)] pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-orange-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-orange-500/30 mb-4">
            <ShoppingCart className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">CORTA PREÇOS</h1>
          <p className="text-orange-400 text-sm font-medium mt-1">Sistema de Gestão PDV</p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-white font-bold text-lg mb-6 text-center">Entrar no sistema</h2>

          <form onSubmit={submit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
                Usuário
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={user}
                  onChange={e => { setUser(e.target.value); setErr('') }}
                  placeholder="admin"
                  autoFocus
                  autoComplete="username"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type={show ? 'text' : 'password'}
                  value={pass}
                  onChange={e => { setPass(e.target.value); setErr('') }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-11 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShow(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition"
                >
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {err && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5 text-red-400 text-sm text-center font-medium">
                {err}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !user || !pass}
              className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-orange-500/20 mt-2"
            >
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-700 text-xs mt-6">
          PDV v3.0 · Corta Preços © 2025
        </p>
      </div>
    </div>
  )
}
