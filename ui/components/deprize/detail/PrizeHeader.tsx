import Link from 'next/link'
import {
  DEPRIZE_FUND_ENABLED,
  DEPRIZE_TERMS_VERSION,
  DePrizeState,
  FUND_GEO_OPEN,
  UNIT,
} from '@/lib/deprize/constants'
import { useDePrizeRestricted } from '@/lib/deprize/deprizeRestrictedContext'
import { payloadCopy, payloadCopyMode } from '@/lib/deprize/payloadPurse'
import { formatBettingCloses } from '@/lib/deprize/status'
import EthUsd from '@/components/deprize/EthUsd'
import DePrizeTeamLink from '@/components/deprize/DePrizeTeamLink'
import { CARD, Stat, StateBadge } from './primitives'

export default function PrizeHeader(props: {
  knownCompetition: boolean
  title: string
  deprizeId: number | undefined
  showBadge: boolean
  state: DePrizeState
  statusLabelOverride?: string
  abnormalStatus: boolean
  raceGoal: { id: string } | undefined
  jbProjectId: number | undefined
  isLoadingFunding: boolean
  totalFunding: bigint | number
  launchpadMissionHref?: string
  activityLoading: boolean
  activityError?: unknown
  betsLength: number
  totalStakedEth: number
  backers: number
  sunset: bigint
  winningTeamId: bigint
  teamContract: any
  showResolved: boolean
}) {
  const copyMode = payloadCopyMode(DEPRIZE_TERMS_VERSION)
  const restricted = useDePrizeRestricted()
  const {
    knownCompetition,
    title,
    deprizeId,
    showBadge,
    state,
    statusLabelOverride,
    abnormalStatus,
    raceGoal,
    jbProjectId,
    isLoadingFunding,
    totalFunding,
    launchpadMissionHref,
    activityLoading,
    activityError,
    betsLength,
    totalStakedEth,
    backers,
    sunset,
    winningTeamId,
    teamContract,
    showResolved,
  } = props
  const showFundLink =
    jbProjectId !== undefined && DEPRIZE_FUND_ENABLED && (FUND_GEO_OPEN || !restricted)

  return (
    <div className={CARD}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap min-w-0">
          <h1 className="text-white font-GoodTimes text-lg sm:text-xl">
            {knownCompetition ? title : `DePrize #${deprizeId}`}
          </h1>
          {knownCompetition && (
            <span className="text-xs font-mono text-gray-500">#{deprizeId}</span>
          )}
          {showBadge && (
            <StateBadge
              state={state}
              labelOverride={abnormalStatus ? statusLabelOverride : undefined}
              toneOverride={abnormalStatus ? 'amber' : undefined}
            />
          )}
        </div>
        <div className="flex items-center gap-4 shrink-0 text-sm">
          {raceGoal && (
            <Link
              href={`/moonbase?race=${raceGoal.id}`}
              className="text-indigo-300/90 hover:text-indigo-200 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 rounded"
            >
              Open in Moon Base Zero
            </Link>
          )}
          <Link
            href="/deprize"
            className="text-indigo-300/90 hover:text-indigo-200 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 rounded"
          >
            ← All prizes
          </Link>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat
          label={payloadCopy('poolStatLabel', copyMode)}
          href={launchpadMissionHref}
          title={payloadCopy('poolStatTooltip', copyMode)}
        >
          {jbProjectId !== undefined && !isLoadingFunding ? (
            <EthUsd eth={Number(totalFunding) / Number(UNIT)} prize />
          ) : (
            '—'
          )}
        </Stat>
        <Stat
          label="Total staked"
          title="ETH bettors have put into the market. Winning shares are paid from this plus the market's seed funding."
        >
          {activityLoading && !betsLength ? (
            '…'
          ) : activityError ? (
            '—'
          ) : (
            <EthUsd eth={totalStakedEth} approx />
          )}
        </Stat>
        <Stat label="Backers" title="Unique wallets that have backed a competitor.">
          {activityLoading && !betsLength ? (
            '…'
          ) : activityError ? (
            '—'
          ) : (
            <>
              {backers}
              {betsLength > 0 && (
                <span className="ml-1.5 text-xs font-normal text-gray-500">
                  · {betsLength} {betsLength === 1 ? 'bet' : 'bets'}
                </span>
              )}
            </>
          )}
        </Stat>
        <Stat
          label="Betting closes"
          title="After this time the market can be locked and moved to winner determination. Until then, betting stays open."
        >
          {sunset > 0n ? formatBettingCloses(sunset) : '—'}
        </Stat>
      </div>
      {showFundLink && (
        <a
          href="#deprize-prize-pool"
          className="mt-2 inline-block text-xs text-indigo-300 underline-offset-2 hover:underline"
        >
          Fund the prize →
        </a>
      )}
      {winningTeamId > 0n && (
        <div className="mt-3 flex items-center gap-2 flex-wrap px-3 py-2.5 rounded-xl bg-moon-green/10 border border-moon-green/35">
          <span className="text-moon-green text-xs font-semibold uppercase tracking-wide">
            Winner
          </span>
          <DePrizeTeamLink
            teamId={winningTeamId}
            teamContract={teamContract}
            size={28}
            className="text-moon-green hover:text-emerald-300 font-semibold"
          />
        </div>
      )}
      {showResolved &&
        winningTeamId === 0n &&
        (state === DePrizeState.NO_WINNER ||
          state === DePrizeState.CANCELLED ||
          state === DePrizeState.M2_FAILED) && (
          <div className="mt-3 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
            {state === DePrizeState.NO_WINNER
              ? 'No winner — positions redeem on an equal-payout basis.'
              : state === DePrizeState.CANCELLED
                ? 'Cancelled — refunds are available.'
                : 'Delivery failed after Milestone 1 — refunds are available.'}
          </div>
        )}
    </div>
  )
}
