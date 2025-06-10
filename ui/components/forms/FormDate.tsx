import Tooltip from '../layout/Tooltip'

type FormDateProps = {
  id?: string
  value: string | undefined
  onChange: (value: string) => void
  label?: string
  className?: string
  disabled?: boolean
  mode?: 'standard' | 'dark'
  tooltip?: string
  min?: Date
  max?: Date
}

export default function FormDate({
  id,
  value,
  onChange,
  className = '',
  label,
  disabled = false,
  mode = 'standard',
  tooltip,
  min,
  max,
}: FormDateProps) {
  return (
    <div className="w-full h-full py-1 flex flex-col justify-between gap-2 max-w-[200px]">
      <div className="flex flex-row items-center gap-2">
        {label && <p className={`text-sm font-GoodTimes`}>{label}</p>}
        {tooltip && (
          <Tooltip text={tooltip} disabled={disabled}>
            ?
          </Tooltip>
        )}
      </div>
      <input
        id={id}
        type="date"
        className={`w-full p-2 px-4 ${
          mode === 'dark'
            ? 'bg-gradient-to-r from-[#000000] to-[#040617] placeholder:opacity-50 text-white'
            : 'bg-[#0f152f] text-white'
        } rounded-full ${className}
        [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert`}
        onChange={(e) => onChange(e.target.value)}
        value={value}
        disabled={disabled}
        min={min?.toISOString().split('T')[0]}
        max={max?.toISOString().split('T')[0]}
      />
    </div>
  )
}
