import { DEPRIZE_AVAILABILITY_LEGEND } from '@/lib/deprize/constants'

export default function DePrizeAvailabilityLegend() {
  return (
    <p className="text-center text-xs text-gray-500 px-4 py-3">
      {DEPRIZE_AVAILABILITY_LEGEND}
    </p>
  )
}