import { Check } from 'lucide-react'
import { SHIFT_STEP_COUNT, SHIFT_STEP_TITLES } from '../lib/shiftWizardSteps'

export default function Stepper({
  currentStep,
  totalSteps = SHIFT_STEP_COUNT,
  stepTitles = SHIFT_STEP_TITLES,
  onStepClick,
  stepsWithErrors = [],
}) {
  function handleKeyDown(e) {
    if (e.key === 'ArrowRight' && currentStep < totalSteps) {
      onStepClick?.(currentStep + 1)
    } else if (e.key === 'ArrowLeft' && currentStep > 1) {
      onStepClick?.(currentStep - 1)
    }
  }

  return (
    <div
      role="tablist"
      aria-label="Report wizard steps"
      onKeyDown={handleKeyDown}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px 20px',
        overflowX: 'auto',
        flexShrink: 0,
        background: '#fefae0',
        borderBottom: '1px solid #e5ddd0',
        gap: 4,
      }}
    >
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1
        const isDone = step < currentStep
        const isCurrent = step === currentStep
        const hasError = stepsWithErrors.includes(step)
        return (
          <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              role="tab"
              aria-selected={isCurrent}
              aria-label={`Step ${step}: ${stepTitles[i] || ''}`}
              tabIndex={isCurrent ? 0 : -1}
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
                  ? { background: '#2d6a4f', color: 'white' }
                  : isCurrent
                  ? { background: '#d4a373', color: 'white', boxShadow: '0 0 0 3px rgba(212,150,10,0.3)' }
                  : { background: '#f5edd6', color: '#8a8d7a', border: '1px solid #e5ddd0' }
                )
              }}
            >
              {isDone ? <Check size={13} strokeWidth={3} /> : step}
              {hasError && !isCurrent && (
                <div style={{
                  position: 'absolute', top: -2, right: -2,
                  width: 8, height: 8, borderRadius: '50%',
                  background: '#d32f2f', border: '1.5px solid #fefae0'
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
                background: isDone ? '#2d6a4f' : '#e5ddd0',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
