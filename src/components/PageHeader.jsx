import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function PageHeader({ title, subtitle, backTo, onBack, rightAction }) {
  const navigate = useNavigate()

  function handleBack() {
    if (onBack) {
      onBack()
    } else if (backTo) {
      navigate(backTo)
    } else {
      navigate(-1)
    }
  }

  return (
    <div style={{ flexShrink: 0, background: '#0F2418' }}>
      <div style={{
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={handleBack}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={18} color="white" />
          </button>
          <div>
            <h2 style={{
              fontSize: 17,
              fontWeight: 700,
              color: 'white',
              margin: 0,
              lineHeight: 1.3,
            }}>{title}</h2>
            {subtitle && (
              <div style={{
                fontSize: 11,
                marginTop: 2,
                color: 'rgba(255,255,255,0.5)',
              }}>
                {subtitle}
              </div>
            )}
          </div>
        </div>
        {rightAction && <div>{rightAction}</div>}
      </div>
    </div>
  )
}
