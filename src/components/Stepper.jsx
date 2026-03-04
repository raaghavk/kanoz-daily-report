import { Check } from 'lucide-react'

export default function Stepper({ currentStep, totalSteps = 9, onStepClick, stepsWithErrors = [] }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '12px 20px',
      overflowX: 'auto',
      flexShrink: 0,
      background: '#F5F7F6',
      borderBottom: '1px solid #E2E8E4',
      gap: 4,
    }}>
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1
        const isDone = step < currentStep
        const isCurrent = step === currentStep
        const hasError = stepsWithErrors.includes(step)
        return (
          <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={() => onStepClick?.(step)}
              style={{
                width: 28,
                height: 28,
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
                position: 'relative',
                ...(isDone
                  ? { background: '#1B7A45', color: 'white' }
                  : isCurrent
                  ? { background: '#D4960A', color: 'white', boxShadow: '0 0 0 3px rgba(212,150,10,0.3)' }
                  : { background: '#EDF0EE', color: '#8A9B92', border: '1px solid #E2E8E4' }
                )
              }}
            >
              {isDone ? <Check size={13} strokeWidth={3} /> : step}
              {hasError && !isCurrent && (
                <div style={{
                  position: 'absolute', top: -2, right: -2,
                  width: 8, height: 8, borderRadius: '50%',
                  background: '#E53E3E', border: '1.5px solid #F5F7F6'
                }} />
              )}
            </button>
            {step < totalSteps && (
              <div style={{
                width: 8,
                minWidth: 8,
                height: 2,
                flexShrink: 0,
                borderRadius: 1,
                background: isDone ? '#1B7A45' : '#E2E8E4',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
