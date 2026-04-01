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
    <div id="mission-stat-container" className="flex items-center gap-2.5">
      {icon && (
        <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center flex-shrink-0">
          <Image src={icon} alt={label} width={18} height={18} className="opacity-70" />
        </div>
      )}
      <div id="mission-stat-content" className="flex flex-col font-GoodTimes">
        <div className="flex items-center gap-1.5">
          <p id="mission-stat-label" className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">
            {label || ''}
          </p>
          {tooltip && (
            <Tooltip text={tooltip} compact buttonClassName="scale-75">
              ?
            </Tooltip>
          )}
        </div>
        {value !== undefined && value !== '' ? (
          <p id="mission-stat-value" className="text-white text-sm">{value}</p>
        ) : (
          <LoadingSpinner id="mission-stat-loading" className="relative w-[20px] scale-[0.5]" />
        )}
      </div>
    </div>
  )
}

export default memo(MissionStat)
