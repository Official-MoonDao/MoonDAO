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
  mode?: 'standard' | 'dark' | 'modern'
  extra?: React.ReactNode
  tooltip?: string
  onBlur?: () => void
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
  extra,
  tooltip,
  onBlur,
}: FormInputProps) {
  return (
    <div className="w-full h-full py-1 flex flex-col justify-between gap-2 max-w-[400px]">
      <div className="flex flex-row items-center gap-2">
        {label && <p className={`text-sm font-GoodTimes ${mode === 'modern' ? 'text-white' : ''}`}>{label}</p>}
        {tooltip && (
          <Tooltip text={tooltip} disabled={disabled}>
            ?
          </Tooltip>
        )}
      </div>
      <div className="flex flex-row items-center gap-2">
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          className={`w-full p-3 px-4 ${
            mode === 'modern'
              ? 'bg-gradient-to-r from-slate-800/50 to-slate-700/50 border border-slate-600/50 rounded-xl text-white placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20 transition-all'
              : mode === 'dark'
              ? 'bg-gradient-to-r from-[#000000] to-[#040617] placeholder:opacity-50 rounded-full'
              : 'bg-[#0f152f] rounded-full'
          } ${className}`}
          onChange={onChange}
          value={value}
          disabled={disabled}
          maxLength={maxLength}
          onBlur={onBlur}
        />
        {extra}
      </div>
    </div>
  )
}
