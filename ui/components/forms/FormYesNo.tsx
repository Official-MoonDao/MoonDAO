import Button from '../layout/Button'
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
    <div id={id} className="w-auto h-full py-1 flex flex-col gap-4">
      <div className="flex flex-row gap-2 items-center">
        {label && <p className={`text-sm font-GoodTimes`}>{label}</p>}
        {tooltip && (
          <Tooltip text={tooltip} disabled={disabled}>
            ?
          </Tooltip>
        )}
      </div>
      <div className="flex gap-4">
        <Button
          styleOnly
          onClick={() => onChange(true)}
          disabled={disabled}
          className={`w-24 rounded-full ${
            value === true ? 'bg-[#4052B6]' : 'bg-[#000000]'
          } ${className}`}
        >
          <span className="font-GoodTimes">Yes</span>
        </Button>
        <Button
          styleOnly
          onClick={() => onChange(false)}
          disabled={disabled}
          className={`w-24 rounded-full ${
            value === false ? 'bg-[#4052B6]' : 'bg-[#000000]'
          } ${className}`}
        >
          <span className="font-GoodTimes">No</span>
        </Button>
      </div>
    </div>
  )
}
