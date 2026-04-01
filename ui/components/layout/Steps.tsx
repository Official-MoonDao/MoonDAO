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
    <div id={id} className={`flex items-center gap-1 ${className}`}>
      {steps.map((step, i) => {
        const isActive = i === currStep
        const isCompleted = i < currStep
        const isClickable = i <= lastStep

        return (
          <div key={i} className="flex items-center gap-1 flex-1">
            <button
              onClick={() => {
                if (isClickable) setStep(i)
              }}
              disabled={!isClickable}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 w-full justify-center ${
                isActive
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  : isCompleted
                  ? 'bg-white/[0.04] text-slate-300 border border-white/[0.08] hover:bg-white/[0.08]'
                  : 'bg-transparent text-slate-600 border border-transparent'
              } ${!isClickable ? 'cursor-default opacity-50' : 'cursor-pointer'}`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                  isActive
                    ? 'bg-indigo-500 text-white'
                    : isCompleted
                    ? 'bg-emerald-500/80 text-white'
                    : 'bg-slate-700 text-slate-500'
                }`}
              >
                {isCompleted ? (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              <span className="hidden sm:inline">{step}</span>
            </button>
            {i < steps.length - 1 && (
              <div
                className={`w-4 h-px flex-shrink-0 ${
                  isCompleted ? 'bg-emerald-500/50' : 'bg-white/[0.08]'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
