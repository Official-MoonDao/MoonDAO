import ForecastCallers from '@/components/deprize/ForecastCallers'
import ForecastPanel from '@/components/deprize/ForecastPanel'

export default function ForecastSlot(props: {
  chainSlug: string
  deprizeId: number
  labels: string[]
  marketPercents: number[]
  liveTipId?: number
  reported: boolean
}) {
  return (
    <div className="flex flex-col gap-4">
      <ForecastPanel {...props} />
      <ForecastCallers
        chainSlug={props.chainSlug}
        deprizeId={props.deprizeId}
        labels={props.labels}
      />
    </div>
  )
}
