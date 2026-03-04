import { useState, useCallback, useEffect, createContext, useContext } from 'react'
import { CheckCircle, AlertCircle, Info } from 'lucide-react'

const ToastContext = createContext()

// Mutable reference for backward compatibility with `import { showToast }`
const toastRef = { current: () => {} }

// eslint-disable-next-line react-refresh/only-export-components
export function showToast(message, type = 'success') {
  toastRef.current(message, type)
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)

  const show = useCallback((message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 2500)
  }, [])

  // Keep mutable ref in sync with provider (via useEffect, not during render)
  useEffect(() => {
    toastRef.current = show
  }, [show])

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
    <ToastContext.Provider value={{ showToast: show }}>
      {children}
      {toast && (
        <div role="alert" aria-live="polite" style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 999 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 14, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', background: bgColors[toast.type], color: 'white' }}>
            {icons[toast.type]}
            <span style={{ fontSize: 14, fontWeight: 500 }}>{toast.message}</span>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  )
}

// Default export kept for backward compatibility but no longer needed
export default function Toast() {
  return null
}
