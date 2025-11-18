import Image from 'next/image'
import { memo } from 'react'
import { LoadingSpinner } from '../layout/LoadingSpinner'
import Tooltip from '../layout/Tooltip'

type MissionStatProps = {
  label: string
  value: string | number | undefined
  icon?: string
  tooltip?: string
}

function MissionStat({ label, value, icon, tooltip }: MissionStatProps) {
  return (
    <div id="mission-stat-container" className="flex gap-2 items-center">
      {icon && <Image src={icon} alt={label} width={30} height={30} />}
      <div id="mission-stat-content" className="flex flex-col font-GoodTimes h-[50px]">
        <div className="flex items-center gap-2">
          <p id="mission-stat-label" className="text-sm opacity-50">
            {label || ''}
          </p>
          {tooltip && (
            <Tooltip text={tooltip} buttonClassName="scale-75">
              ?
            </Tooltip>
          )}
        </div>
        {value !== undefined && value !== '' ? (
          <p id="mission-stat-value">{value}</p>
        ) : (
          <LoadingSpinner id="mission-stat-loading" className="relative w-[20px] scale-[0.5]" />
        )}
      </div>
    </div>
  )
}

export default memo(MissionStat)
