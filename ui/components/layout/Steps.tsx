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
    <ul id={id} className={`steps ${className}`}>
      {steps.map((step, i) => (
        <button
          data-content=""
          className={`step ${i <= currStep ? 'step-error' : ''}`}
          key={i}
          onClick={() => {
            if (i <= lastStep) {
              setStep(i)
            }
          }}
          disabled={i > lastStep}
        >
          <li>{step}</li>
        </button>
      ))}
    </ul>
  )
}
