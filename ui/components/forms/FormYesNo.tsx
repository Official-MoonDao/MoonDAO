import StandardButton from '../layout/StandardButton'
import Tooltip from '../layout/Tooltip'

type FormYesNoProps = {
  id?: string
  value: boolean | undefined
  onChange: (value: boolean) => void
  label?: string
  className?: string
  disabled?: boolean
  mode?: 'standard' | 'dark'
  tooltip?: string
}

export default function FormYesNo({
  id,
  value,
  onChange,
  className = '',
  label,
  disabled = false,
  mode = 'standard',
  tooltip,
}: FormYesNoProps) {
  return (
    <div className="w-auto h-full py-1 flex flex-col justify-between gap-2">
      <div className="flex flex-row gap-2 items-center">
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
      <div className="flex gap-4">
        <StandardButton
          styleOnly
          onClick={() => onChange(false)}
          disabled={disabled}
          backgroundColor={value === false ? 'bg-[#4052B6]' : 'bg-[#000000]'}
          borderRadius="rounded-full"
          hoverEffect={false}
          className={`w-24 ${className}`}
        >
          <span className="font-GoodTimes">No</span>
        </StandardButton>
        <StandardButton
          styleOnly
          onClick={() => onChange(true)}
          disabled={disabled}
          backgroundColor={value === true ? 'bg-[#4052B6]' : 'bg-[#000000]'}
          borderRadius="rounded-full"
          hoverEffect={false}
          className={`w-24 ${className}`}
        >
          <span className="font-GoodTimes">Yes</span>
        </StandardButton>
      </div>
    </div>
  )
}
