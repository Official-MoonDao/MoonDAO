import Image from 'next/image'
import { LoadingSpinner } from '../layout/LoadingSpinner'

export default function MissionStat({
  label,
  value,
  icon,
}: {
  label: string
  value: string | number | undefined
  icon?: string
}) {
  return (
    <div id="mission-stat-container" className="flex gap-2 items-center">
      {icon && <Image src={icon} alt={label} width={30} height={30} />}
      <div
        id="mission-stat-content"
        className="flex flex-col font-GoodTimes h-[50px]"
      >
        <p id="mission-stat-label" className="text-sm opacity-50">
          {label || ''}
        </p>
        {value !== undefined && value !== '' ? (
          <p id="mission-stat-value">{value}</p>
        ) : (
          <LoadingSpinner
            id="mission-stat-loading"
            className="relative w-[20px] scale-[0.5]"
          />
        )}
      </div>
    </div>
  )
}
