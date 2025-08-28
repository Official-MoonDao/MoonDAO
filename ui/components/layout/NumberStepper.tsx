import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import { useRef } from 'react'

type NumberStepperProps = {
  number: number
  setNumber: (value: number) => void
  step?: number
  max?: number
  min?: number
  isDisabled?: boolean
}

export default function NumberStepper({
  number,
  setNumber,
  step = 1,
  max,
  min,
  isDisabled,
}: NumberStepperProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  function increase() {
    if (max && number + step > max) {
      return
    }
    const newValue = number + step
    setNumber(newValue)
    inputRef.current?.focus()
  }

  function decrease() {
    if (min !== undefined && number - step < min) {
      return
    }
    const newValue = number - step
    setNumber(newValue)
    inputRef.current?.focus()
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = Number(e.target.value)
    setNumber(value)
  }

  return (
    <div
      className={`flex items-center justify-between w-[100px] h-[35px] gradient-2 rounded-full ${
        isDisabled && 'opacity-50'
      }`}
    >
      <input
        ref={inputRef}
        id="number-stepper"
        className="w-[55%] h-full bg-[#00000080] text-white text-center rounded-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        type="number"
        value={number}
        onChange={handleChange}
        step={0}
        disabled={isDisabled}
      />
      <span>%</span>
      <div className="w-[45%] flex flex-col justify-center items-center">
        <button onClick={increase}>
          <ChevronUpIcon className="w-4 h-4" strokeWidth={2.5} stroke="black" />
        </button>
        <button onClick={decrease}>
          <ChevronDownIcon
            className="w-4 h-4"
            strokeWidth={2.5}
            stroke="black"
          />
        </button>
      </div>
    </div>
  )
}
