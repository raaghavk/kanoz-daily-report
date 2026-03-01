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
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-kanoz-bg">
      <div className="w-full max-w-md">
        {/* Card Container */}
        <div className="bg-kanoz-card rounded-3xl shadow-lg p-8 space-y-6">
          {/* Logo Section */}
          <div className="text-center space-y-3">
            {/* Leaf Icon */}
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-gradient-to-br from-kanoz-green to-kanoz-green-dark rounded-2xl flex items-center justify-center">
                <svg
                  viewBox="0 0 48 48"
                  width="32"
                  height="32"
                  className="text-white"
                >
                  {/* Leaf shape */}
                  <g fill="white">
                    <path d="M24 4C24 4 16 12 16 22C16 30 19 36 24 38C29 36 32 30 32 22C32 12 24 4 24 4Z" />
                    <path d="M22 14C22 14 20 18 20 22C20 26 21 28 24 29C27 28 28 26 28 22C28 18 26 14 24 14" fill="#15803d" />
                  </g>
                </svg>
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-kanoz-text">Kanoz Bio Energy</h1>
              <p className="text-sm text-kanoz-text-secondary mt-1">Daily Report System</p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1">
              <p className="text-sm font-semibold text-kanoz-red">Error</p>
              <p className="text-xs text-kanoz-text-secondary">{error}</p>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-semibold text-kanoz-text">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="supervisor@kanoz.in"
                className="w-full px-4 py-3 rounded-xl border border-kanoz-border bg-white text-sm text-kanoz-text placeholder-kanoz-text-tertiary focus:outline-none focus:ring-2 focus:ring-kanoz-green focus:border-transparent transition-all"
                required
              />
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-semibold text-kanoz-text">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-4 py-3 rounded-xl border border-kanoz-border bg-white text-sm text-kanoz-text placeholder-kanoz-text-tertiary focus:outline-none focus:ring-2 focus:ring-kanoz-green focus:border-transparent transition-all pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-kanoz-text-secondary hover:text-kanoz-text transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    // Eye icon (open)
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  ) : (
                    // Eye off icon (closed)
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.26 3.64m-5.88-2.12a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-kanoz-green text-white font-semibold rounded-xl text-sm hover:bg-kanoz-green-dark disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 mt-6"
            >
              {loading ? (
                <>
                  <svg
                    className="w-4 h-4 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-kanoz-border"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-kanoz-card text-kanoz-text-tertiary">or</span>
            </div>
          </div>

          {/* Help Text */}
          <p className="text-xs text-center text-kanoz-text-secondary">
            Need help? Contact your administrator
          </p>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-xs text-kanoz-text-tertiary">
            © 2026 Kanoz Bio Energy Pvt. Ltd.
          </p>
        </div>
      </div>
    </div>
  )
}
