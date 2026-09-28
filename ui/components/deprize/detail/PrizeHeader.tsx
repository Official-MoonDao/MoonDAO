import Link from 'next/link'
import { deprizeIndexHref } from '@/lib/deprize/competitions'
import { DePrizeState } from '@/lib/deprize/constants'
import DePrizeTeamLink from '@/components/deprize/DePrizeTeamLink'
import { CARD, StateBadge, TOUCH } from './primitives'

export default function PrizeHeader(props: {
  knownCompetition: boolean
  title: string
  deprizeId: number | undefined
  showBadge: boolean
  state: DePrizeState
  statusLabelOverride?: string
  badgeTitle?: string
  abnormalStatus: boolean
  raceGoal: { id: string } | undefined
  winningTeamId: bigint
  teamContract: any
  showResolved: boolean
  chainSlug: string
}) {
  const {
    knownCompetition,
    title,
    deprizeId,
    showBadge,
    state,
    statusLabelOverride,
    badgeTitle,
    abnormalStatus,
    raceGoal,
    winningTeamId,
    teamContract,
    showResolved,
    chainSlug,
  } = props
  const indexHref = deprizeIndexHref(chainSlug)

  return (
    <div className={CARD}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap min-w-0">
          <h1 className="text-white font-GoodTimes text-lg sm:text-xl">
            {knownCompetition ? title : `DePrize #${deprizeId}`}
          </h1>
          {showBadge && (
            <StateBadge
              state={state}
              labelOverride={abnormalStatus ? statusLabelOverride : undefined}
              toneOverride={abnormalStatus ? 'amber' : undefined}
              title={badgeTitle}
            />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {raceGoal && (
            <Link
              href={`/moonbase?race=${raceGoal.id}`}
              className={`inline-flex items-center text-indigo-300/90 hover:text-indigo-200 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 rounded ${TOUCH}`}
            >
              Open in Moon Base Zero
            </Link>
          )}
          <Link
            href={indexHref}
            className={`inline-flex items-center text-indigo-300/90 hover:text-indigo-200 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 rounded ${TOUCH}`}
          >
            ← All prizes
          </Link>
        </div>
      </div>
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
