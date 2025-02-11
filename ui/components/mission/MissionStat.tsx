import { LoadingSpinner } from '../layout/LoadingSpinner'

export default function MissionStat({
  label,
  value,
}: {
  label: string
  value: string | number | undefined
}) {
  return (
    <div className="flex flex-col">
      <p className="text-sm opacity-50">{label || ''}</p>
      {value !== undefined ? (
        <p className="text-lg font-bold font-GoodTimes">{value}</p>
      ) : (
        <LoadingSpinner className="relative w-[20px] scale-[0.5]" />
      )}
    </div>
  )
}
