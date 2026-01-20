import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import { useRef, useState } from 'react'

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
  const [displayValue, setDisplayValue] = useState<string>(String(number))
  const [isFocused, setIsFocused] = useState(false)

  function increase() {
    if (max && number + step > max) {
      return
    }
    const newValue = number + step
    setNumber(newValue)
    setDisplayValue(String(newValue))
    inputRef.current?.focus()
  }

  function decrease() {
    if (min !== undefined && number - step < min) {
      return
    }
    const newValue = number - step
    setNumber(newValue)
    setDisplayValue(String(newValue))
    inputRef.current?.focus()
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const rawValue = e.target.value
    setDisplayValue(rawValue)
    const value = Number(rawValue)
    if (!isNaN(value)) {
      setNumber(value)
    }
  }

  function handleFocus() {
    setIsFocused(true)
    // Clear display if value is 0 so user can type directly
    if (number === 0) {
      setDisplayValue('')
    }
  }

  function handleBlur() {
    setIsFocused(false)
    // Restore to actual number value on blur
    if (displayValue === '' || isNaN(Number(displayValue))) {
      setDisplayValue(String(number))
    } else {
      setDisplayValue(String(number))
    }
  }

  // Sync displayValue when number prop changes externally (e.g., from arrow buttons)
  const currentDisplayValue = isFocused ? displayValue : String(number)

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
        value={currentDisplayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
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
