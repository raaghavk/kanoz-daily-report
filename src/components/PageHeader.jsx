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
    <div className="flex-shrink-0" style={{ background: '#0F2418' }}>
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center transition-all"
            style={{ background: 'rgba(255,255,255,0.1)' }}
          >
            <ArrowLeft size={18} color="white" />
          </button>
          <div>
            <h2 className="text-[17px] font-bold text-white">{title}</h2>
            {subtitle && (
              <div className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
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
