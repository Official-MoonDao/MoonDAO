import dynamic from 'next/dynamic'
import { CARD } from './primitives'

const OddsHistoryChart = dynamic(() => import('@/components/deprize/OddsHistoryChart'), {
  ssr: false,
})

export default function OddsSection(props: {
  numOutcomes: number
  activityLoading: boolean
  activityError?: unknown
  betsLength: number
  history: any
  labels: string[]
  colors: string[]
  domainStartMs?: number
  markers: any
  oddsLoading: boolean
}) {
  if (props.numOutcomes <= 0) return null
  return (
    <div className={CARD}>
      <p className="text-white font-semibold mb-3">
        {!props.activityLoading && !props.activityError && props.betsLength === 0
          ? 'Starting odds — no bets yet'
          : 'Odds'}
      </p>
      <OddsHistoryChart
        history={props.history}
        labels={props.labels}
        colors={props.colors}
        domainStartMs={props.domainStartMs}
        markers={props.markers}
        loading={props.oddsLoading}
      />
    </div>
  )
}
