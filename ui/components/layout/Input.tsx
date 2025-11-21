import { ReactNode } from 'react'
import Tooltip from './Tooltip'
import { inputStyles } from '@/lib/layout/styles'
import { inputSizes } from '@/lib/layout/variants'
import { InputVariant, InputSize } from '@/lib/layout/variants'

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
  min?: Date | string
  max?: Date | string
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
}: InputProps) {
  const variantClass = inputStyles[variant] || inputStyles.default
  const sizeClass = inputSizes[size] || ''
  const isTextarea = type === 'textarea'
  const isDate = type === 'date'

  const getMinMaxProps = () => {
    if (!isDate) return {}
    return {
      min: min instanceof Date ? min.toISOString().split('T')[0] : min,
      max: max instanceof Date ? max.toISOString().split('T')[0] : max,
    }
  }

  const inputElement = isTextarea ? (
    <textarea
      id={id}
      placeholder={placeholder}
      className={`w-full ${variantClass} ${sizeClass} ${className} ${error ? 'border-red-500' : ''}`}
      onChange={onChange as any}
      value={value}
      disabled={disabled}
      maxLength={maxLength}
      onBlur={onBlur}
      rows={rows || 4}
    />
  ) : (
    <input
      id={id}
      type={type}
      placeholder={placeholder}
      className={`w-full ${variantClass} ${sizeClass} ${className} ${error ? 'border-red-500' : ''} ${
        isDate && variant === 'dark' ? '[&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert' : ''
      }`}
      onChange={onChange as any}
      value={value}
      disabled={disabled}
      maxLength={maxLength}
      onBlur={onBlur}
      {...getMinMaxProps()}
    />
  )

  return (
    <div className={`w-full h-full py-1 flex flex-col justify-between gap-2 ${maxWidth}`}>
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
      {error && (
        <p className="text-red-500 text-sm mt-1">{error}</p>
      )}
    </div>
  )
}

