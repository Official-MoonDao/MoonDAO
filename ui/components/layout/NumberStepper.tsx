import { MinusIcon, PlusIcon } from '@heroicons/react/24/solid'
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
    // Allow empty string while typing
    if (rawValue === '') {
      setDisplayValue('')
      return
    }
    const value = Number(rawValue)
    if (!isNaN(value)) {
      // Normalize to remove leading zeros (e.g. "020" → "20")
      setDisplayValue(String(value))
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

  const atMin = min !== undefined && number <= min
  const atMax = max !== undefined && number >= max

  return (
    <div
      className={`flex items-center gap-1.5 flex-shrink-0 ${
        isDisabled ? 'opacity-40 pointer-events-none' : ''
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Decrease button */}
      <button
        onClick={decrease}
        disabled={atMin}
        className={`w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg transition-all duration-150 touch-manipulation ${
          atMin
            ? 'bg-white/5 text-white/20 cursor-not-allowed'
            : 'bg-white/10 hover:bg-white/20 active:bg-white/25 active:scale-95 text-white/70 hover:text-white'
        }`}
      >
        <MinusIcon className="w-3.5 h-3.5" strokeWidth={2} />
      </button>

      {/* Input + % label */}
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          id="number-stepper"
          className={`w-[56px] sm:w-[50px] h-8 sm:h-7 bg-white/[0.07] text-white text-center rounded-lg border transition-all duration-150 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-sm font-medium tabular-nums tracking-tight pr-5 ${
            isFocused
              ? 'border-blue-500/60 bg-white/10 ring-1 ring-blue-500/20'
              : 'border-white/10 hover:border-white/20'
          }`}
          type="number"
          value={currentDisplayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          step={0}
          disabled={isDisabled}
        />
        <span className="absolute right-2 text-white/40 text-xs font-medium pointer-events-none">
          %
        </span>
      </div>

      {/* Increase button */}
      <button
        onClick={increase}
        disabled={atMax}
        className={`w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg transition-all duration-150 touch-manipulation ${
          atMax
            ? 'bg-white/5 text-white/20 cursor-not-allowed'
            : 'bg-white/10 hover:bg-white/20 active:bg-white/25 active:scale-95 text-white/70 hover:text-white'
        }`}
      >
        <PlusIcon className="w-3.5 h-3.5" strokeWidth={2} />
      </button>
    </div>
  )
}
