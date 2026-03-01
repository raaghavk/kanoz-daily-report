import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Loader2 } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/')
    } catch (err) {
      setError(err.message || 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-full flex flex-col items-center justify-center px-6 bg-gradient-to-b from-kanoz-green to-kanoz-green-dark">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 48 48" width="36" height="36">
              <path d="M24 4C16 4 8 12 8 24c0 8 4 14 8 17 1-4 3-8 8-12 5 4 7 8 8 12 4-3 8-9 8-17C40 12 32 4 24 4zm0 8c3 0 6 4 6 10s-3 10-6 10-6-4-6-10 3-10 6-10z" fill="white"/>
              <circle cx="24" cy="22" r="3" fill="rgba(255,255,255,0.3)"/>
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-white">Kanoz Bio Energy</h1>
          <p className="text-white/70 text-sm mt-1">Daily Report System</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-xl">
          <div className="mb-4">
            <label className="block text-xs font-semibold text-kanoz-text-secondary mb-1.5">
              Email <span className="text-kanoz-red">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="supervisor@kanoz.in"
              className="w-full px-3.5 py-2.5 rounded-xl border border-kanoz-border text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green focus:border-transparent"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-xs font-semibold text-kanoz-text-secondary mb-1.5">
              Password <span className="text-kanoz-red">*</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full px-3.5 py-2.5 rounded-xl border border-kanoz-border text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green focus:border-transparent"
              required
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-kanoz-red">
              {error}
            </div>
          )}

          <div className="flex justify-between items-center mb-5 text-xs text-kanoz-text-secondary">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" className="rounded" /> Remember me
            </label>
            <a href="#" className="text-kanoz-green font-medium">Forgot password?</a>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-kanoz-green text-white font-bold rounded-xl text-sm hover:bg-kanoz-green-dark disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            Sign In
          </button>
        </form>
      </div>
    </div>
  )
}
