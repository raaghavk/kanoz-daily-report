import { Check } from 'lucide-react'

export default function Stepper({ currentStep, totalSteps = 9, onStepClick }) {
  return (
    <div className="flex items-center px-4 py-2.5 overflow-x-auto flex-shrink-0"
      style={{ background: '#F5F7F6', borderBottom: '1px solid #E2E8E4' }}>
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1
        const isDone = step < currentStep
        const isCurrent = step === currentStep
        return (
          <div key={step} className="flex items-center">
            <button
              onClick={() => onStepClick?.(step)}
              className="flex items-center justify-center flex-shrink-0 text-[11px] font-bold transition-all"
              style={{
                width: 30, height: 30, borderRadius: '50%',
                ...(isDone
                  ? { background: '#1B7A45', color: 'white' }
                  : isCurrent
                  ? { background: '#D4960A', color: 'white', boxShadow: '0 0 0 3px rgba(212,150,10,0.3)' }
                  : { background: '#EDF0EE', color: '#8A9B92', border: '1px solid #E2E8E4' }
                )
              }}
            >
              {isDone ? <Check size={14} strokeWidth={3} /> : step}
            </button>
            {step < totalSteps && (
              <div className="h-0.5 flex-shrink-0" style={{
                width: 4, minWidth: 4,
                background: isDone ? '#1B7A45' : '#E2E8E4'
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
