import dynamic from 'next/dynamic'

const CHART_HEIGHT = 300

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

  const ethEmpty = !props.activityLoading && !props.activityError && props.betsLength === 0
  const caption = ethEmpty
    ? 'Chance to win · starting odds, no bets on this market yet'
    : 'Chance to win · set by ETH bets'

  return (
    <div className="border-b border-white/[0.08] pb-5">
      {props.question && <p className="text-gray-300 text-sm leading-snug">{props.question}</p>}
      <p className={`mb-3 text-xs font-normal text-gray-500 ${props.question ? 'mt-2' : ''}`}>
        {caption}
      </p>
      <OddsHistoryChart
        variant="hero"
        height={CHART_HEIGHT}
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
