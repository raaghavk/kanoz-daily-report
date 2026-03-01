import { Check } from 'lucide-react'

export default function Stepper({ currentStep, totalSteps = 9, onStepClick }) {
  return (
    <div className="flex items-center gap-0 px-4 py-3 bg-kanoz-card border-b border-kanoz-border overflow-x-auto">
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1
        const isDone = step < currentStep
        const isCurrent = step === currentStep
        return (
          <div key={step} className="flex items-center">
            <button
              onClick={() => onStepClick?.(step)}
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${
                isDone
                  ? 'bg-kanoz-green text-white'
                  : isCurrent
                  ? 'bg-kanoz-green text-white ring-2 ring-kanoz-green-light'
                  : 'bg-kanoz-bg text-kanoz-text-tertiary border border-kanoz-border'
              }`}
            >
              {isDone ? <Check size={14} strokeWidth={3} /> : step}
            </button>
            {step < totalSteps && (
              <div className={`w-3 h-0.5 ${isDone ? 'bg-kanoz-green' : 'bg-kanoz-border'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
