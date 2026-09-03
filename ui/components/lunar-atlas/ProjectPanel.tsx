import { ArrowLeftIcon, MapPinIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import type { Chain } from 'thirdweb'
import {
  findDePrizeIdForGoal,
  getDePrizeRaceBinding,
  isCompetitiveRace,
  isDePrizeGoalMarketBound,
} from '@/lib/deprize/competitions'
import { positionRedeemValue, UNIT } from '@/lib/deprize/constants'
import { fmt } from '@/lib/deprize/format'
import { exitMockPosition, useMockMarket } from '@/lib/deprize/mockMarket'
import type { Outcome } from '@/lib/deprize/useDePrizeMarket'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import {
  parseAtlasYear,
  raceStandingForProject,
} from '@/lib/lunar-atlas/selectors'
import {
  LOCATION_PRECISION_LABEL,
  MILESTONE_STATUS_CLASSES,
  MILESTONE_STATUS_LABEL,
  PROJECT_TYPE_GLYPH,
  PROJECT_TYPE_LABEL,
  ROSTER_STATUS_LABEL,
  formatPlace,
  participationKind,
  orgColor,
} from '@/lib/lunar-atlas/display'
import {
  PARTICIPATION_BAR_CLASSES,
  PARTICIPATION_ROW_CLASSES,
} from './participation-styles'
import type {
  Organization,
  Project,
  SharedGoal,
} from '@/lib/lunar-atlas/types'
import BetModal from '@/components/deprize/BetModal'
import DemoBetModal from '@/components/deprize/DemoBetModal'
import ExitPositionModal from '@/components/deprize/ExitPositionModal'
import SourceBadge from './SourceBadge'

type ProjectPanelProps = {
  project: Project
  organization?: Organization
  sharedGoals: SharedGoal[]
  onClose: () => void
  onFocusRegion?: (project: Project) => void
  onSelectSharedGoal?: (goalId: string) => void
  // When this competitor was opened from a capability-race list, a one-click
  // return to that list.
  onBack?: () => void
  backLabel?: string
  /** Race this competitor was opened from (or its first competitive goal). */
  betGoal?: SharedGoal
  chainSlug?: string
  chain?: Chain
  account?: any
  userAddress?: string
  onConnectWallet?: () => void
  spendableEth?: number
  deprizeId?: number
  mintAddress?: string
  marketAddress?: string
  numOutcomes?: number
  outcomes?: Outcome[]
  bettingAllowed?: boolean
  tradingHalted?: boolean
  resolved?: boolean
  winningIndex?: number
  isRefundVector?: boolean
  payoutDen?: bigint
  payoutNums?: bigint[]
  jbProjectId?: number | bigint
  onDone?: () => void
}

export default function ProjectPanel({
  project,
  organization,
  sharedGoals,
  onClose,
  onFocusRegion,
  onSelectSharedGoal,
  onBack,
  backLabel = 'Back to competitors',
  betGoal,
  chainSlug,
  chain,
  account,
  userAddress,
  onConnectWallet,
  spendableEth = 0,
  deprizeId,
  mintAddress,
  marketAddress,
  numOutcomes = 0,
  outcomes,
  bettingAllowed = false,
  tradingHalted = false,
  resolved = false,
  winningIndex = -1,
  isRefundVector = false,
  payoutDen,
  payoutNums,
  jbProjectId,
  onDone,
}: ProjectPanelProps) {
  const color = orgColor(organization)
  const approximate = project.locationPrecision !== 'exact'
  const rosterKind = participationKind(project.rosterStatus)
  const standings = useMemo(
    () =>
      sharedGoals
        .map((g) => raceStandingForProject(project.id, g))
        .filter((s): s is NonNullable<typeof s> => s !== undefined),
    [sharedGoals, project.id]
  )
  const standingGoalIds = useMemo(
    () => new Set(standings.map((s) => s.goalId)),
    [standings]
  )
  const otherGoals = sharedGoals.filter((g) => !standingGoalIds.has(g.id))

  const hasRace = !!betGoal && isCompetitiveRace(betGoal.projectIds.length)
  const bound =
    !!betGoal && !!chainSlug && isDePrizeGoalMarketBound(chainSlug, betGoal.id)
  const marketDeprizeId = bound
    ? deprizeId ?? findDePrizeIdForGoal(chainSlug!, betGoal!.id)
    : undefined
  const binding =
    marketDeprizeId !== undefined && chainSlug
      ? getDePrizeRaceBinding(chainSlug, marketDeprizeId)
      : undefined
  const outcomeIndex = binding
    ? binding.outcomes.findIndex((o) => !o.field && o.projectId === project.id)
    : -1
  const outcome =
    bound && outcomeIndex >= 0 ? outcomes?.[outcomeIndex] : undefined
  const canBack =
    hasRace &&
    (bound ? marketDeprizeId !== undefined && outcomeIndex >= 0 : true)
  const demo = useMockMarket(
    betGoal?.id ?? project.id,
    betGoal?.projectIds ?? [project.id],
    betGoal?.market?.impliedOdds,
    userAddress,
  )
  const demoPosition = demo.positions[project.id]
  const holding = bound
    ? !!outcome && Number.isFinite(outcome.balance) && outcome.balance > 0
    : !!demoPosition && demoPosition.qty > 0
  const heldValueEth = bound ? outcome?.balance : demoPosition?.qty
  const redeemValueEth =
    bound && resolved && outcome?.balanceWei !== undefined && payoutDen
      ? Number(
          positionRedeemValue(
            outcome.balanceWei,
            payoutNums?.[outcomeIndex] ?? 0n,
            payoutDen,
          ),
        ) / Number(UNIT)
      : undefined
  const isWinningSlot =
    bound && resolved && outcomeIndex >= 0 && outcomeIndex === winningIndex
  const backDisabled =
    !!userAddress && bound && (!bettingAllowed || tradingHalted)

  const [betOpen, setBetOpen] = useState(false)
  const [exitOpen, setExitOpen] = useState(false)
  const [demoBetOpen, setDemoBetOpen] = useState(false)
  useEffect(() => {
    setBetOpen(false)
    setExitOpen(false)
    setDemoBetOpen(false)
  }, [project.id, betGoal?.id])

  const handleBetClick = () => {
    if (!userAddress) {
      onConnectWallet?.()
      return
    }
    if (!bound) {
      setDemoBetOpen(true)
      return
    }
    if (
      !bettingAllowed ||
      outcomeIndex < 0 ||
      !marketAddress ||
      !mintAddress ||
      outcomeIndex >= numOutcomes
    ) {
      return
    }
    setBetOpen(true)
  }

  const handleDemoExit = () => {
    if (!betGoal) return
    const valueEth = exitMockPosition(betGoal.id, project.id, userAddress)
    toast.success(`Cashed out ${project.name} (demo) for ≈ ${fmt(valueEth)} ETH.`, {
      style: toastStyle,
    })
    onDone?.()
  }

  const milestones = useMemo(
    () =>
      [...project.milestones].sort(
        (a, b) => (parseAtlasYear(a.targetDate) ?? 0) - (parseAtlasYear(b.targetDate) ?? 0)
      ),
    [project.milestones]
  )

  return (
    <div className="pointer-events-auto flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a0c14]/95 shadow-2xl backdrop-blur-xl">
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2 text-xs font-medium text-cyan-200/80 transition hover:bg-white/5 hover:text-cyan-100"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          {backLabel}
        </button>
      )}
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
            />
            <span className="truncate text-xs font-medium uppercase tracking-wide text-white/60">
              {project.orgId === 'unassigned'
                ? 'No developer assigned'
                : `${organization?.name ?? project.orgId}${
                    organization?.kind ? ` · ${organization.kind}` : ''
                  }`}
            </span>
          </div>
          <h2 className="mt-1 truncate text-lg font-semibold text-white">
            {project.name}
          </h2>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-white/60">
            <span>{PROJECT_TYPE_GLYPH[project.type]}</span>
            <span>{PROJECT_TYPE_LABEL[project.type]}</span>
          </div>
          {standings[0] && (
            <p className="mt-1 text-sm font-medium tabular-nums text-cyan-200/90">
              {formatPlace(standings[0].place)} place ·{' '}
              {Math.round(standings[0].probability * 100)}%
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-start gap-2">
          {canBack && !resolved && (
            <button
              type="button"
              onClick={handleBetClick}
              disabled={backDisabled}
              className="rounded-md px-3 py-1.5 text-xs font-semibold text-white transition-all
                bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500
                disabled:cursor-not-allowed disabled:opacity-40"
            >
              {userAddress ? 'Buy' : 'Connect'}
            </button>
          )}
          {resolved && redeemValueEth !== undefined && (
            <span
              className={`self-center text-xs font-semibold tabular-nums ${
                isWinningSlot || isRefundVector ? 'text-emerald-300' : 'text-gray-500'
              }`}
            >
              ≈ {fmt(redeemValueEth)} ETH
            </span>
          )}
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {/* Location */}
        <div className="flex flex-wrap items-center gap-2">
          {approximate && (
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-200">
              <MapPinIcon className="h-3.5 w-3.5" />
              {LOCATION_PRECISION_LABEL[project.locationPrecision]}
            </span>
          )}
          {project.regionLabel && (
            <span className="text-xs text-white/50">{project.regionLabel}</span>
          )}
          {project.location && onFocusRegion && (
            <button
              onClick={() => onFocusRegion(project)}
              className="ml-auto rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70 transition hover:border-cyan-400/40 hover:text-cyan-200"
            >
              Fly to location
            </button>
          )}
        </div>

        {standings.length > 0 && (
          <div className="space-y-2">
            {standings.map((s) => {
              const body = (
                <>
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-semibold text-white">
                      {formatPlace(s.place)} place
                    </span>
                    <span className="text-lg font-semibold tabular-nums text-cyan-200">
                      {Math.round(s.probability * 100)}%
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-white/80">
                    {s.title}
                  </span>
                  <span className="mt-1.5 flex items-center gap-2">
                    <MarketPill status={s.marketStatus ?? 'none'} />
                    <span className="text-[11px] text-white/40">
                      {s.fieldSize} competitor{s.fieldSize === 1 ? '' : 's'}
                    </span>
                  </span>
                </>
              )
              return onSelectSharedGoal ? (
                <button
                  key={s.goalId}
                  type="button"
                  onClick={() => onSelectSharedGoal(s.goalId)}
                  className="w-full rounded-lg border border-fuchsia-400/25 bg-fuchsia-500/[0.07] px-3 py-2.5 text-left transition hover:border-fuchsia-400/45 hover:bg-fuchsia-500/10"
                >
                  {body}
                </button>
              ) : (
                <div
                  key={s.goalId}
                  className="w-full rounded-lg border border-fuchsia-400/25 bg-fuchsia-500/[0.07] px-3 py-2.5 text-left"
                >
                  {body}
                </div>
              )
            })}
          </div>
        )}

        {holding && !resolved && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
            <span className="text-[11px] text-white/50">
              {fmt(heldValueEth ?? 0)} {bound ? 'ETH' : 'demo ETH'} if wins
            </span>
            {(bound ? !tradingHalted : true) && (
              <button
                type="button"
                onClick={() => (bound ? setExitOpen(true) : handleDemoExit())}
                className="shrink-0 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white transition-all hover:border-indigo-400/35 hover:bg-indigo-500/15"
              >
                Cash out
              </button>
            )}
          </div>
        )}

        {/* Summary */}
        <p className="text-sm leading-relaxed text-white/80">{project.summary}</p>

        {rosterKind && project.rosterStatus && (
          <div
            className={`flex overflow-hidden rounded-lg border ${PARTICIPATION_ROW_CLASSES[rosterKind]}`}
          >
            <span
              aria-hidden
              className={`w-1 shrink-0 ${PARTICIPATION_BAR_CLASSES[rosterKind]}`}
            />
            <p className="px-3 py-2 text-xs leading-relaxed text-white/80">
              {ROSTER_STATUS_LABEL[project.rosterStatus]}
            </p>
          </div>
        )}

        {/* Milestones */}
        {milestones.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">
              Timeline
            </h3>
            <ol className="space-y-3 border-l border-white/10 pl-4">
              {milestones.map((m) => (
                <li key={m.id} className="relative">
                  <span
                    className="absolute -left-[21px] top-1 h-2 w-2 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-white">{m.title}</span>
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${MILESTONE_STATUS_CLASSES[m.status]}`}
                    >
                      {MILESTONE_STATUS_LABEL[m.status]}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-white/50">
                    {m.targetDate}
                    {m.datePrecision === 'estimated' ? ' (est.)' : ''}
                  </div>
                  {m.sources.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {m.sources.map((s, i) => (
                        <SourceBadge key={i} source={s} />
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}

        {otherGoals.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">
              Shared goals
            </h3>
            <div className="space-y-2">
              {otherGoals.map((g) =>
                // Only render an interactive affordance when there is a real
                // handler — a button that does nothing reads as broken.
                onSelectSharedGoal ? (
                  <button
                    key={g.id}
                    onClick={() => onSelectSharedGoal(g.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left transition hover:border-fuchsia-400/40 hover:bg-white/10"
                  >
                    <span className="text-sm text-white/85">{g.title}</span>
                    <MarketPill status={g.market?.status ?? 'none'} />
                  </button>
                ) : (
                  <div
                    key={g.id}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left"
                  >
                    <span className="text-sm text-white/85">{g.title}</span>
                    <MarketPill status={g.market?.status ?? 'none'} />
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {/* Sources */}
        {project.sources.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">
              Sources
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {project.sources.map((s, i) => (
                <SourceBadge key={i} source={s} />
              ))}
            </div>
          </div>
        )}

        <p className="border-t border-white/10 pt-3 text-[11px] leading-relaxed text-white/35">
          Publicly-stated goals compiled by MoonDAO from the sources above. Not an
          endorsement, guarantee, or prediction of outcomes.
        </p>
      </div>

      {betOpen &&
        chain &&
        account &&
        marketAddress &&
        mintAddress &&
        marketDeprizeId !== undefined &&
        outcomeIndex >= 0 && (
          <BetModal
            deprizeId={marketDeprizeId}
            outcomeIndex={outcomeIndex}
            teamName={project.name}
            probability={outcome?.probability ?? NaN}
            numOutcomes={numOutcomes}
            mintAddress={mintAddress}
            marketAddress={marketAddress}
            jbProjectId={jbProjectId}
            chain={chain}
            account={account}
            spendableEth={spendableEth}
            onClose={() => setBetOpen(false)}
            onDone={() => {
              setBetOpen(false)
              onDone?.()
            }}
          />
        )}

      {exitOpen &&
        chain &&
        account &&
        marketAddress &&
        marketDeprizeId !== undefined &&
        outcomeIndex >= 0 && (
          <ExitPositionModal
            deprizeId={marketDeprizeId}
            outcomeIndex={outcomeIndex}
            teamName={project.name}
            balanceWei={outcome?.balanceWei ?? 0n}
            positionId={outcome?.positionId ?? 0n}
            numOutcomes={numOutcomes}
            marketAddress={marketAddress}
            chain={chain}
            account={account}
            onClose={() => setExitOpen(false)}
            onDone={() => {
              setExitOpen(false)
              onDone?.()
            }}
          />
        )}

      {demoBetOpen && betGoal && (
        <DemoBetModal
          sharedGoalId={betGoal.id}
          projectIds={betGoal.projectIds}
          impliedOdds={betGoal.market?.impliedOdds}
          projectId={project.id}
          teamName={project.name}
          probability={demo.odds[project.id] ?? 0}
          address={userAddress}
          onClose={() => setDemoBetOpen(false)}
          onDone={() => {
            setDemoBetOpen(false)
            onDone?.()
          }}
        />
      )}
    </div>
  )
}

export function MarketPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    none: { label: 'Market TBD', cls: 'text-white/40 border-white/10 bg-white/5' },
    planned: {
      label: 'Market planned',
      cls: 'text-fuchsia-200 border-fuchsia-400/30 bg-fuchsia-500/10',
    },
    live: {
      label: 'Market live',
      cls: 'text-emerald-200 border-emerald-400/30 bg-emerald-500/10',
    },
    resolved: {
      label: 'Resolved',
      cls: 'text-white/60 border-white/15 bg-white/5',
    },
  }
  const s = map[status] ?? map.none
  return (
    <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${s.cls}`}>
      {s.label}
    </span>
  )
}
