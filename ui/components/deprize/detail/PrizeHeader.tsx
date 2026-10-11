import Link from 'next/link'
import { deprizeIndexHref } from '@/lib/deprize/competitions'
import { DePrizeState } from '@/lib/deprize/constants'
import { goalIndexCategory, PROJECT_TYPE_LABEL } from '@/lib/lunar-atlas/display'
import type { SharedGoal } from '@/lib/lunar-atlas/types'
import CategoryIcon from '@/components/deprize/CategoryIcon'
import DePrizeTeamLink from '@/components/deprize/DePrizeTeamLink'
import { StateBadge, TOUCH } from './primitives'

export default function PrizeHeader(props: {
  knownCompetition: boolean
  title: string
  deprizeId: number | undefined
  showBadge: boolean
  state: DePrizeState
  statusLabelOverride?: string
  badgeTitle?: string
  abnormalStatus: boolean
  raceGoal: SharedGoal | undefined
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
  const category = raceGoal ? goalIndexCategory(raceGoal) : undefined
  const live = state === DePrizeState.OPEN && !abnormalStatus

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap text-xs text-gray-400">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <Link
            href={indexHref}
            className={`inline-flex items-center hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 rounded ${TOUCH}`}
          >
            All prizes
          </Link>
          {category && (
            <>
              <span className="text-gray-600">·</span>
              <span className="inline-flex items-center gap-1">
                <CategoryIcon category={category} className="w-3.5 h-3.5" />
                {PROJECT_TYPE_LABEL[category]}
              </span>
            </>
          )}
          {live && (
            <>
              <span className="text-gray-600">·</span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-red-400">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                Live
              </span>
            </>
          )}
        </div>
        {raceGoal && (
          <Link
            href={`/moonbase?race=${raceGoal.id}`}
            className={`inline-flex items-center text-indigo-300/90 hover:text-indigo-200 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 rounded ${TOUCH}`}
          >
            Open in Moon Base Zero
          </Link>
        )}
      </div>
      <div className="mt-1 flex items-center gap-3 flex-wrap">
        <h1 className="text-white font-heading font-bold uppercase tracking-tight text-2xl sm:text-3xl leading-tight">
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
