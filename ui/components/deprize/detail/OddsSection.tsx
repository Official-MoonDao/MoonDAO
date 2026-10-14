import dynamic from 'next/dynamic'
import { useMemo } from 'react'
import type { MarketMode } from './MarketModeTabs'

const CHART_HEIGHT = 300

const OddsHistoryChart = dynamic(() => import('@/components/deprize/OddsHistoryChart'), {
  ssr: false,
})

export default function OddsSection(props: {
  mode: MarketMode
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
  /** Voting-power share per outcome, percent. Empty when nobody has voted yet. */
  mooneyShares: number[] | null
  mooneyLoading: boolean
}) {
  const { mooneyShares } = props
  const mooneyHistory = useMemo(() => {
    if (!mooneyShares || mooneyShares.length === 0) return []
    return [{ t: props.domainStartMs ?? Date.now(), p: mooneyShares }]
  }, [mooneyShares, props.domainStartMs])

  if (props.numOutcomes <= 0) return null

  const ethEmpty = !props.activityLoading && !props.activityError && props.betsLength === 0
  const caption =
    props.mode === 'bet'
      ? ethEmpty
        ? 'Chance to win · starting odds, no bets on this market yet'
        : 'Chance to win · set by ETH bets'
      : 'Share of Citizen voting power'

  return (
    <div className="border-b border-white/[0.08] pb-5">
      {props.question && <p className="text-gray-300 text-sm leading-snug">{props.question}</p>}
      <p className={`mb-3 text-xs font-normal text-gray-500 ${props.question ? 'mt-2' : ''}`}>
        {caption}
      </p>
      {props.mode === 'bet' ? (
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
      ) : mooneyShares && mooneyShares.length > 0 ? (
        <>
          <OddsHistoryChart
            variant="hero"
            height={CHART_HEIGHT}
            history={mooneyHistory}
            labels={props.labels}
            colors={props.colors}
            domainStartMs={props.domainStartMs}
            loading={props.mooneyLoading}
          />
          <p className="mt-2 text-[11px] leading-snug text-gray-500">
            Current voting-power share. A prediction with 0 voting power is saved and does not move
            this.
          </p>
        </>
      ) : (
        <div
          className="flex items-center justify-center px-4 text-center text-xs text-gray-500"
          style={{ height: CHART_HEIGHT }}
        >
          {props.mooneyLoading
            ? 'Loading MOONEY predictions…'
            : 'No MOONEY predictions yet. A prediction without a Citizen is saved at 0 voting power and does not move this chart.'}
        </div>
      )}
    </div>
  )
}
