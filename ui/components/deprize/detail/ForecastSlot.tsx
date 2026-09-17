import ForecastPanel from '@/components/deprize/ForecastPanel'

export default function ForecastSlot(props: {
  chainSlug: string
  deprizeId: number
  labels: string[]
  marketPercents: number[]
  liveTipId?: number
  reported: boolean
}) {
  return <ForecastPanel {...props} />
}
