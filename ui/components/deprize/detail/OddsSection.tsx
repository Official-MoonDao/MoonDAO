import dynamic from 'next/dynamic'
import { CARD } from './primitives'

const OddsHistoryChart = dynamic(() => import('@/components/deprize/OddsHistoryChart'), {
  ssr: false,
})

export default function OddsSection(props: {
  numOutcomes: number
  question?: string
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
      {props.question && (
        <p className="text-white text-base font-semibold leading-snug">{props.question}</p>
      )}
      <p className={`text-white font-semibold mb-3 ${props.question ? 'mt-1 text-xs text-gray-500 font-normal' : ''}`}>
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
