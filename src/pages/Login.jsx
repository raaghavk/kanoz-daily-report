import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(165deg, #0a0a14 0%, #141428 50%, #145C34 100%)' }}>
      {/* Status bar area */}
      <div className="h-14 flex-shrink-0" />

      {/* Center content */}
      <div className="flex-1 flex flex-col items-center justify-center px-7">
        {/* Logo */}
        <div className="w-[88px] h-[88px] rounded-[22px] flex items-center justify-center mb-5"
          style={{ background: 'linear-gradient(135deg, #1B7A45, #145C34)', boxShadow: '0 8px 28px rgba(27,122,69,0.4)' }}>
          <svg viewBox="0 0 48 48" width="48" height="48">
            <path fill="white" d="M24 4C16 4 8 12 8 24c0 8 4 14 8 17 1-4 3-8 8-12 5 4 7 8 8 12 4-3 8-9 8-17C40 12 32 4 24 4zm0 8c3 0 6 4 6 10s-3 10-6 10-6-4-6-10 3-10 6-10z"/>
            <circle cx="24" cy="22" r="3" fill="white"/>
          </svg>
        </div>

        {/* Brand */}
        <h1 className="text-2xl font-extrabold text-white mb-0.5">Kanoz Bio Energy</h1>
        <p className="text-xs text-white/40 uppercase tracking-[2px] mb-9">Daily Report System</p>

        {/* Error */}
        {error && (
          <div className="w-full rounded-xl p-3 mb-4 border" style={{ background: 'rgba(229,62,62,0.15)', borderColor: 'rgba(229,62,62,0.3)' }}>
            <p className="text-sm font-semibold text-red-400">Error</p>
            <p className="text-xs text-red-300/80 mt-0.5">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full space-y-3.5">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Email <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="supervisor@kanoz.in"
              className="w-full px-3.5 py-3 rounded-[10px] text-[15px] text-white"
              style={{
                border: '1.5px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.06)',
              }}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Password <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-3.5 py-3 rounded-[10px] text-[15px] text-white pr-10"
                style={{
                  border: '1.5px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.06)',
                }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.26 3.64m-5.88-2.12a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Remember + Forgot */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: 'rgba(255,255,255,0.4)' }}>
              <input type="checkbox" className="w-3.5 h-3.5 rounded" style={{ accentColor: '#1B7A45' }} />
              Remember me
            </label>
            <span className="text-xs" style={{ color: '#1B7A45' }}>Forgot password?</span>
          </div>

          {/* Sign In */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-[15px] rounded-xl text-white text-[16px] font-bold disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
            style={{
              background: '#1B7A45',
              boxShadow: '0 4px 16px rgba(27,122,69,0.35)',
            }}
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                Signing in...
              </>
            ) : 'Sign In'}
          </button>
        </form>
      </div>

      {/* Footer */}
      <div className="text-center pb-8 pt-4">
        <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Kanoz Bio Energy Pvt. Ltd.
        </p>
      </div>
    </div>
  )
}
