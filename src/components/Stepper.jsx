import { Check } from 'lucide-react'

export default function Stepper({ currentStep, totalSteps = 9, onStepClick }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '10px 16px',
      overflowX: 'auto',
      flexShrink: 0,
      background: '#F5F7F6',
      borderBottom: '1px solid #E2E8E4',
    }}>
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1
        const isDone = step < currentStep
        const isCurrent = step === currentStep
        return (
          <div key={step} style={{ display: 'flex', alignItems: 'center' }}>
            <button
              onClick={() => onStepClick?.(step)}
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: 11,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
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
              <div style={{
                width: 4,
                minWidth: 4,
                height: 2,
                flexShrink: 0,
                background: isDone ? '#1B7A45' : '#E2E8E4',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
