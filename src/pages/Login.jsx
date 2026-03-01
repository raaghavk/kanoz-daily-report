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
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', background: '#0a0a14' }}>
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 430, background: 'linear-gradient(165deg, #0a0a14 0%, #141428 50%, #145C34 100%)' }}>
      {/* Status bar area */}
      <div style={{ height: 56, flexShrink: 0, width: '100%' }} />

      {/* Center content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 28px', width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{
          width: 88, height: 88, borderRadius: 22,
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
          background: 'linear-gradient(135deg, #1B7A45, #145C34)',
          boxShadow: '0 8px 28px rgba(27,122,69,0.4)',
        }}>
          <svg viewBox="0 0 48 48" width="48" height="48">
            <path fill="white" d="M24 4C16 4 8 12 8 24c0 8 4 14 8 17 1-4 3-8 8-12 5 4 7 8 8 12 4-3 8-9 8-17C40 12 32 4 24 4zm0 8c3 0 6 4 6 10s-3 10-6 10-6-4-6-10 3-10 6-10z"/>
            <circle cx="24" cy="22" r="3" fill="white"/>
          </svg>
        </div>

        {/* Brand */}
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'white', marginBottom: 2 }}>Kanoz Bio Energy</h1>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 36 }}>Daily Report System</p>

        {/* Error */}
        {error && (
          <div style={{ width: '100%', borderRadius: 12, padding: 12, marginBottom: 16, background: 'rgba(229,62,62,0.15)', border: '1px solid rgba(229,62,62,0.3)' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#fc8181' }}>Error</p>
            <p style={{ fontSize: 12, color: 'rgba(252,129,129,0.8)', marginTop: 2 }}>{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'rgba(255,255,255,0.6)' }}>
              Email <span style={{ color: '#fc8181' }}>*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="supervisor@kanoz.in"
              className="login-input"
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 10, fontSize: 15, color: 'white',
                border: '1.5px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.06)',
                boxSizing: 'border-box',
              }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'rgba(255,255,255,0.6)' }}>
              Password <span style={{ color: '#fc8181' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                className="login-input"
                style={{
                  width: '100%', padding: '12px 40px 12px 14px', borderRadius: 10, fontSize: 15, color: 'white',
                  border: '1.5px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.06)',
                  boxSizing: 'border-box',
                }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer',
                }}
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}>
              <input type="checkbox" style={{ width: 14, height: 14, borderRadius: 4, accentColor: '#1B7A45' }} />
              Remember me
            </label>
            <span style={{ fontSize: 12, color: '#1B7A45' }}>Forgot password?</span>
          </div>

          {/* Sign In */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '15px 0', borderRadius: 12, color: 'white', fontSize: 16, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8,
              background: '#1B7A45', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 16px rgba(27,122,69,0.35)', opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? (
              <>
                <svg style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                Signing in...
              </>
            ) : 'Sign In'}
          </button>
        </form>
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', paddingBottom: 32, paddingTop: 16 }}>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
          Kanoz Bio Energy Pvt. Ltd.
        </p>
      </div>
    </div>
    </div>
  )
}
