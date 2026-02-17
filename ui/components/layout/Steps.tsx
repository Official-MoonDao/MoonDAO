import { Dispatch, SetStateAction } from 'react'

type StepsProps = {
  id?: string
  steps: string[]
  currStep: number
  className?: string
  lastStep: number
  setStep: Dispatch<SetStateAction<number>>
}

export function Steps({
  id,
  steps,
  currStep,
  setStep,
  lastStep,
  className = '',
}: StepsProps) {
  return (
    <div id={id} className={`flex items-center w-full ${className}`}>
      {steps.map((step, i) => {
        const isCompleted = i < currStep
        const isActive = i === currStep
        const isClickable = i <= lastStep

        return (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <button
              onClick={() => {
                if (isClickable) setStep(i)
              }}
              disabled={!isClickable}
              className="flex flex-col items-center gap-2 group"
            >
              <div
                className={`
                  w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold
                  transition-all duration-300 border-2
                  ${
                    isCompleted
                      ? 'bg-indigo-500 border-indigo-500 text-white'
                      : isActive
                      ? 'bg-indigo-500/20 border-indigo-400 text-indigo-300'
                      : 'bg-white/5 border-white/20 text-white/40'
                  }
                  ${isClickable && !isActive ? 'cursor-pointer group-hover:border-indigo-400/60' : ''}
                `}
              >
                {isCompleted ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`text-xs font-medium tracking-wide transition-colors duration-300
                  ${isActive ? 'text-white' : isCompleted ? 'text-indigo-300' : 'text-white/40'}
                `}
              >
                {step}
              </span>
            </button>
            {i < steps.length - 1 && (
              <div className="flex-1 mx-3 mt-[-1.25rem]">
                <div className="h-0.5 w-full rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      i < currStep ? 'bg-indigo-500 w-full' : 'w-0'
                    }`}
                  />
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
