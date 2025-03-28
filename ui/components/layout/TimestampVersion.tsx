import { formatHistoricalDate } from '@/lib/utils/timestamp'

export default function TimestampVersion({
  timestamp,
}: {
  timestamp?: number
  txHash?: string
}) {
  return (
    <div className="text-right">
      {timestamp && (
        <div className="text-xs text-grey-500">
          {formatHistoricalDate(timestamp)}
        </div>
      )}
    </div>
  )
}
