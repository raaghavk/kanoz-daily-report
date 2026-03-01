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

  const colors = {
    success: 'bg-kanoz-green text-white',
    error: 'bg-kanoz-red text-white',
    info: 'bg-kanoz-blue text-white',
  }

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[999] animate-bounce-in">
      <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg ${colors[toast.type]}`}>
        {icons[toast.type]}
        <span className="text-sm font-medium">{toast.message}</span>
      </div>
    </div>
  )
}
