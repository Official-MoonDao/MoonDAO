import Tooltip from '../layout/Tooltip'

type FormInputProps = {
  id?: string
  value: string | number | undefined
  onChange: any
  placeholder?: string
  label?: string
  type?: string
  className?: string
  disabled?: boolean
  maxLength?: number
  mode?: 'standard' | 'dark'
  tooltip?: string
}

export default function FormInput({
  id,
  type = 'text',
  placeholder,
  value,
  onChange,
  className = '',
  label,
  disabled = false,
  maxLength,
  mode = 'standard',
  tooltip,
}: FormInputProps) {
  return (
    <div className="w-full py-1 flex flex-col gap-2">
      <div className="flex flex-row items-center gap-2">
        {label && (
          <p
            className={`text-sm font-GoodTimes ${
              mode === 'dark' && 'opacity-50'
            }`}
          >
            {label}
          </p>
        )}
        {tooltip && <Tooltip text={tooltip}>?</Tooltip>}
      </div>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        className={`w-full p-2 px-4 ${
          mode === 'dark'
            ? 'bg-gradient-to-r from-[#000000] to-[#040617] placeholder:opacity-50'
            : 'bg-[#0f152f]'
        } rounded-full ${className}`}
        onChange={onChange}
        value={value}
        disabled={disabled}
        maxLength={maxLength}
      />
    </div>
  )
}
