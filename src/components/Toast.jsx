import { useState, useEffect, createContext, useContext } from 'react'
import { CheckCircle, AlertCircle, Info } from 'lucide-react'

const ToastContext = createContext()

let toastFn = () => {}

export function showToast(message, type = 'success') {
  toastFn(message, type)
}

export default function Toast() {
  const [toast, setToast] = useState(null)

  useEffect(() => {
    toastFn = (message, type) => {
      setToast({ message, type })
      setTimeout(() => setToast(null), 2500)
    }
  }, [])

  if (!toast) return null

  const icons = {
    success: <CheckCircle size={18} />,
    error: <AlertCircle size={18} />,
    info: <Info size={18} />,
  }

  const bgColors = {
    success: '#1B7A45',
    error: '#E53E3E',
    info: '#2563EB',
  }

  return (
    <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 999 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 14, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', background: bgColors[toast.type], color: 'white' }}>
        {icons[toast.type]}
        <span style={{ fontSize: 14, fontWeight: 500 }}>{toast.message}</span>
      </div>
    </div>
  )
}
