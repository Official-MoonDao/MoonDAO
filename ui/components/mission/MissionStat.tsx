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
    <div className="flex gap-2 items-center">
      {icon && <Image src={icon} alt={label} width={30} height={30} />}
      <div className="flex flex-col font-GoodTimes h-[50px]">
        <p className="text-sm opacity-50">{label || ''}</p>
        {value !== undefined && value !== '' ? (
          <p className="">{value}</p>
        ) : (
          <LoadingSpinner className="relative w-[20px] scale-[0.5]" />
        )}
      </div>
    </div>
  )
}
