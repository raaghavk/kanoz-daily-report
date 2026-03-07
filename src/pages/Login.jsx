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
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      background: '#fefae0',
    }}>
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        maxWidth: 430,
        background: '#fefae0',
        position: 'relative',
        overflow: 'hidden',
      }}>

        {/* Top decorative curve */}
        <div style={{
          position: 'absolute',
          top: -60,
          left: -40,
          right: -40,
          height: 320,
          borderRadius: '0 0 50% 50%',
          background: 'linear-gradient(160deg, #2d6a4f 0%, #1b4332 100%)',
        }} />

        {/* Subtle pattern overlay on green area */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 260,
          opacity: 0.06,
          backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)',
          backgroundSize: '40px 40px, 60px 60px',
        }} />

        {/* Logo area */}
        <div style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 72,
          marginBottom: 40,
        }}>
          {/* Leaf icon */}
          <div style={{
            width: 72,
            height: 72,
            borderRadius: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
            background: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(10px)',
            border: '1.5px solid rgba(255,255,255,0.2)',
          }}>
            <svg viewBox="0 0 40 40" width="40" height="40">
              <path fill="white" d="M20 4C13 4 7 11 7 21c0 7 3.5 12.5 7 15 0.8-3.5 2.5-7 6-10.5 3.5 3.5 5.2 7 6 10.5 3.5-2.5 7-8 7-15C33 11 27 4 20 4z" opacity="0.9"/>
              <ellipse cx="20" cy="19" rx="4.5" ry="7" fill="none" stroke="white" strokeWidth="1.5" opacity="0.6"/>
            </svg>
          </div>

          <h1 style={{
            fontSize: 22,
            fontWeight: 800,
            color: 'white',
            marginBottom: 4,
            letterSpacing: -0.3,
          }}>
            Kanoz Bio Energy
          </h1>
          <p style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.6)',
            textTransform: 'uppercase',
            letterSpacing: 2.5,
            fontWeight: 600,
          }}>
            Daily Report System
          </p>
        </div>

        {/* Card form area */}
        <div style={{
          position: 'relative',
          zIndex: 2,
          width: '100%',
          padding: '0 24px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{
            background: 'white',
            borderRadius: 20,
            padding: '28px 22px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)',
            border: '1px solid #e5ddd0',
          }}>
            {/* Welcome text */}
            <div style={{ marginBottom: 22 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#2c2c2c', marginBottom: 4 }}>
                Welcome back
              </h2>
              <p style={{ fontSize: 13, color: '#b5b8a8' }}>
                Sign in to continue to your dashboard
              </p>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                borderRadius: 12,
                padding: '10px 14px',
                marginBottom: 16,
                background: '#FEE2E2',
                border: '1px solid #FECACA',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
              }}>
                <span style={{ fontSize: 14, marginTop: 1 }}>⚠️</span>
                <p style={{ fontSize: 13, fontWeight: 500, color: '#DC2626', lineHeight: 1.4 }}>{error}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 700,
                  marginBottom: 6,
                  color: '#595c4a',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="supervisor@kanoz.in"
                  style={{
                    width: '100%',
                    padding: '13px 14px',
                    borderRadius: 12,
                    fontSize: 15,
                    color: '#2c2c2c',
                    border: '1.5px solid #e5ddd0',
                    background: '#fefae0',
                    boxSizing: 'border-box',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    fontFamily: 'inherit',
                  }}
                  onFocus={e => e.target.style.borderColor = '#2d6a4f'}
                  onBlur={e => e.target.style.borderColor = '#e5ddd0'}
                  required
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 700,
                  marginBottom: 6,
                  color: '#595c4a',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    style={{
                      width: '100%',
                      padding: '13px 44px 13px 14px',
                      borderRadius: 12,
                      fontSize: 15,
                      color: '#2c2c2c',
                      border: '1.5px solid #e5ddd0',
                      background: '#fefae0',
                      boxSizing: 'border-box',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      fontFamily: 'inherit',
                    }}
                    onFocus={e => e.target.style.borderColor = '#2d6a4f'}
                    onBlur={e => e.target.style.borderColor = '#e5ddd0'}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#b5b8a8',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 4,
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

              {/* Forgot password link */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -4 }}>
                <span style={{
                  fontSize: 12,
                  color: '#2d6a4f',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}>
                  Forgot password?
                </span>
              </div>

              {/* Sign In Button */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '14px 0',
                  borderRadius: 14,
                  color: 'white',
                  fontSize: 15,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  marginTop: 4,
                  background: loading ? '#b5b8a8' : '#2d6a4f',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: loading ? 'none' : '0 4px 14px rgba(45,106,79,0.3)',
                  transition: 'all 0.2s',
                  fontFamily: 'inherit',
                  letterSpacing: 0.3,
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

          {/* Decorative bottom section */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingBottom: 32,
            paddingTop: 24,
          }}>
            {/* Small tagline */}
            <p style={{
              fontSize: 12,
              color: '#b5b8a8',
              textAlign: 'center',
              lineHeight: 1.5,
              marginBottom: 16,
            }}>
              Biomass Pellet Manufacturing
            </p>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <div style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#2d6a4f',
                opacity: 0.3,
              }} />
              <p style={{
                fontSize: 11,
                color: '#b5b8a8',
                fontWeight: 500,
              }}>
                Kanoz Bio Energy Pvt. Ltd.
              </p>
              <div style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#2d6a4f',
                opacity: 0.3,
              }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
