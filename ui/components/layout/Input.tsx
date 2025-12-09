import { ReactNode, useCallback } from 'react'
import { inputStyles } from '@/lib/layout/styles'
import { inputSizes } from '@/lib/layout/variants'
import { InputVariant, InputSize } from '@/lib/layout/variants'
import Tooltip from './Tooltip'

export interface InputProps {
  id?: string
  type?: string
  value?: string | number | undefined
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  placeholder?: string
  label?: string
  className?: string
  disabled?: boolean
  maxLength?: number
  variant?: InputVariant
  size?: InputSize
  error?: string
  icon?: ReactNode
  extra?: ReactNode
  tooltip?: string
  onBlur?: () => void
  rows?: number
  maxWidth?: string
  min?: Date | string | number
  max?: Date | string | number
  formatNumbers?: boolean
}

export default function Input({
  id,
  type = 'text',
  value,
  onChange,
  placeholder,
  label,
  className = '',
  disabled = false,
  maxLength,
  variant = 'default',
  size = 'md',
  error,
  icon,
  extra,
  tooltip,
  onBlur,
  rows,
  maxWidth = 'max-w-[400px]',
  min,
  max,
  formatNumbers = true,
}: InputProps) {
  const isTextarea = type === 'textarea'
  const isDate = type === 'date'
  const shouldFormatNumbers = formatNumbers && !isTextarea && !isDate

  const baseVariantClass = inputStyles[variant] || inputStyles.default
  const variantClass =
    isTextarea && baseVariantClass.includes('rounded-full')
      ? baseVariantClass.replace('rounded-full', 'rounded-sm')
      : baseVariantClass
  const sizeClass = inputSizes[size] || ''

  const formatInputWithCommas = useCallback((value: string) => {
    if (!value) return ''
    const numericValue = value.replace(/,/g, '')

    if (numericValue.endsWith('.')) {
      const integerPart = numericValue.slice(0, -1)
      const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      return `${formattedInteger}.`
    }

    const parts = numericValue.split('.')
    const integerPart = parts[0]
    const decimalPart = parts[1] || ''

    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

    return decimalPart ? `${formattedInteger}.${decimalPart}` : formattedInteger
  }, [])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!onChange) return

      if (shouldFormatNumbers) {
        const input = e.target as HTMLInputElement
        const cursorPosition = input.selectionStart || 0
        const originalValue = input.value
        let inputValue = originalValue

        inputValue = inputValue.replace(/[^0-9.,]/g, '')

        const numericValue = inputValue.replace(/,/g, '')

        const decimalParts = numericValue.split('.')
        if (decimalParts.length > 2) {
          inputValue = decimalParts[0] + '.' + decimalParts.slice(1).join('')
        }

        // Enforce max value if provided
        if (max !== undefined && typeof max === 'number') {
          const numValue = parseFloat(numericValue)
          if (!isNaN(numValue) && numValue > max) {
            inputValue = max.toString()
          }
        }

        const formattedValue = formatInputWithCommas(inputValue)

        const syntheticEvent = {
          ...e,
          target: {
            ...e.target,
            value: formattedValue,
          },
        } as React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>

        onChange(syntheticEvent)

        requestAnimationFrame(() => {
          const oldValueBeforeCursor = originalValue.substring(0, cursorPosition)
          const oldNumericBeforeCursor = oldValueBeforeCursor.replace(/,/g, '')
          const newNumericBeforeCursor = formatInputWithCommas(oldNumericBeforeCursor)
          const newCursorPosition = newNumericBeforeCursor.length
          input.setSelectionRange(newCursorPosition, newCursorPosition)
        })
      } else {
        onChange(e)
      }
    },
    [onChange, shouldFormatNumbers, formatInputWithCommas, max]
  )

  const getDisplayValue = () => {
    if (shouldFormatNumbers && value !== undefined && value !== null && value !== '') {
      const stringValue = String(value)
      if (stringValue.match(/^[0-9.,]+$/)) {
        return formatInputWithCommas(stringValue)
      }
    }
    return value
  }

  const getMinMaxProps = () => {
    const props: { min?: string | number; max?: string | number } = {}
    if (isDate) {
      props.min = min instanceof Date ? min.toISOString().split('T')[0] : (min as string)
      props.max = max instanceof Date ? max.toISOString().split('T')[0] : (max as string)
    } else if (type === 'number' && !shouldFormatNumbers) {
      if (min !== undefined) props.min = min as number
      if (max !== undefined) props.max = max as number
    }
    return props
  }

  const inputElement = isTextarea ? (
    <textarea
      id={id}
      placeholder={placeholder}
      className={`w-full ${variantClass} ${sizeClass} ${className} ${
        error ? 'border-red-500' : ''
      }`}
      onChange={handleChange}
      value={value}
      disabled={disabled}
      maxLength={maxLength}
      onBlur={onBlur}
      rows={rows || 4}
    />
  ) : (
    <input
      id={id}
      type={shouldFormatNumbers && type === 'number' ? 'text' : type}
      placeholder={placeholder}
      className={`w-full ${variantClass} ${sizeClass} ${className} ${
        error ? 'border-red-500' : ''
      } ${
        isDate && variant === 'dark'
          ? '[&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert'
          : ''
      }`}
      onChange={handleChange}
      value={getDisplayValue()}
      disabled={disabled}
      maxLength={maxLength}
      onBlur={onBlur}
      {...getMinMaxProps()}
    />
  )

  return (
    <div
      data-cy="input-wrapper"
      className={`w-full h-full py-1 flex flex-col justify-between gap-2 ${maxWidth}`}
    >
      {(label || tooltip) && (
        <div className="flex flex-row items-center gap-2">
          {label && (
            <p className={`text-sm font-GoodTimes ${variant === 'modern' ? 'text-white' : ''}`}>
              {label}
            </p>
          )}
          {tooltip && (
            <Tooltip text={tooltip} disabled={disabled}>
              ?
            </Tooltip>
          )}
        </div>
      )}
      <div className="flex flex-row items-center gap-2">
        {icon && <div className="flex-shrink-0">{icon}</div>}
        {inputElement}
        {extra && <div className="flex-shrink-0">{extra}</div>}
      </div>
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  )
}
