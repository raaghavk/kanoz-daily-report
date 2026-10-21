import { useNavigate } from 'react-router-dom'
import { FileQuestion } from 'lucide-react'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div
      role="main"
      style={{
        minHeight: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        background: '#fefae0',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: '#e8f0ec',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}
        >
          <FileQuestion size={32} color="#2d6a4f" aria-hidden="true" />
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#2c2c2c', marginBottom: 8 }}>Page not found</h2>
        <p style={{ fontSize: 14, color: '#595c4a', marginBottom: 20, lineHeight: 1.5 }}>
          This address is not a screen in the app. Check the link or go back home.
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          style={{
            padding: '12px 32px',
            background: '#2d6a4f',
            color: 'white',
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Go home
        </button>
      </div>
    </div>
  )
}
