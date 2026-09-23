// Race view for a DePrize-shaped shared goal: the competitor roster (official
// vs unofficial via color, not a repeating "listed" chip), the draft
// capability criteria, market structure, and sources. Opened from a
// shared-goal row in ProjectPanel or by clicking the goal's region marker.

import { FlagIcon, MapPinIcon, XMarkIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import type { MouseEvent } from 'react'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import type { Chain } from 'thirdweb'
import {
  OPEN_FIELD_PROJECT_ID,
  ROSTER_DISCLAIMER,
  findDePrizeIdForGoal,
  getDePrizeRaceBinding,
  isCompetitiveRace,
  isCompetitorClaimed,
  isDePrizeGoalMarketBound,
} from '@/lib/deprize/competitions'
import { DEPRIZE_TERMS_URL, positionRedeemValue, UNIT } from '@/lib/deprize/constants'
import { fmt } from '@/lib/deprize/format'
import { exitMockPosition, useMockMarket } from '@/lib/deprize/mockMarket'
import type { Outcome } from '@/lib/deprize/useDePrizeMarket'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import {
  PARTICIPATION_LABEL,
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
import ClaimPanel from '@/components/deprize/ClaimPanel'
import DemoBetModal from '@/components/deprize/DemoBetModal'
import ExitPositionModal from '@/components/deprize/ExitPositionModal'
import { MarketPill } from './ProjectPanel'
import SourceBadge from './SourceBadge'

type Competitor = {
  project: Project
  organization?: Organization
}

type SharedGoalPanelProps = {
  goal: SharedGoal
  competitors: Competitor[]
  onClose: () => void
  onSelectProject: (id: string) => void
  /** Bound DePrize id when this race has an on-chain market. */
  deprizeId?: number
  /** Chain slug for the binding lookup (branding + disclaimer). */
  chainSlug?: string
  /** Formatted prize-pool total, e.g. "0.042 ETH". */
  prizePoolLabel?: string
  prizePoolLoading?: boolean
  // --- Inline betting / positions (bet, cash out, and claim without leaving
  // Moon Base Zero). All optional so the panel still renders for unbound
  // races or before the market bridge has resolved anything. ---
  chain?: Chain
  account?: any
  userAddress?: string
  onConnectWallet?: () => void
  spendableEth?: number
  mintAddress?: string
  marketAddress?: string
  numOutcomes?: number
  /** Live per-outcome odds/balance/positionId, same shape as the detail page. */
  outcomes?: Outcome[]
  /** New bets may be placed (region-cleared, market Running, mint bound). */
  bettingAllowed?: boolean
  tradingHalted?: boolean
  resolved?: boolean
  winningIndex?: number
  isRefundVector?: boolean
  payoutDen?: bigint
  payoutNums?: bigint[]
  jbProjectId?: number | bigint
  refreshNonce?: number
  /** Bump the parent's refresh after a bet, cash out, or claim. */
  onDone?: () => void
}

const NEUTRAL_ACCENT = '#9ca3af'

function oddsCaption(status: string | undefined): string {
  if (status === 'live') return 'Odds are live market-implied probabilities.'
  if (status === 'resolved') {
    return 'Final market-implied probabilities from the resolved market.'
  }
  return 'Illustrative curator priors — live odds replace these when the prediction market opens.'
}

function stopRowNav(e: MouseEvent) {
  e.stopPropagation()
}

export default function SharedGoalPanel({
  goal,
  competitors,
  onClose,
  onSelectProject,
  deprizeId,
  chainSlug,
  prizePoolLabel,
  prizePoolLoading = false,
  chain,
  account,
  userAddress,
  onConnectWallet,
  spendableEth = 0,
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
  refreshNonce = 0,
  onDone,
}: SharedGoalPanelProps) {
  // A registry id alone is not enough — incomplete race bindings must not
  // show bound chrome (market CTA / ROSTER_DISCLAIMER). Match the bridge gate.
  const bound = !!chainSlug && isDePrizeGoalMarketBound(chainSlug, goal.id)
  // A single entrant has nowhere for odds to point at — see isCompetitiveRace.
  // Today that's only the mass driver: an open-source concept study with no
  // funded developer. Without this gate its lone row would price at a
  // mechanical 100% and show a live Buy button, which reads as MoonDAO
  // declaring that entrant the winning builder rather than what it actually
  // is — the only public writeup on a capability nobody has committed to yet.
  const hasRace = isCompetitiveRace(competitors.length)
  const marketDeprizeId = bound
    ? deprizeId ?? findDePrizeIdForGoal(chainSlug!, goal.id)
    : undefined
  const binding =
    marketDeprizeId !== undefined && chainSlug
      ? getDePrizeRaceBinding(chainSlug, marketDeprizeId)
      : undefined
  const kinds = competitors.map((c) =>
    participationKind(c.project.rosterStatus)
  )
  const anyOfficial = kinds.includes('official')
  const anyUnofficial = kinds.includes('unofficial')
  const anyDeclined = kinds.includes('declined')
  const showParticipationLegend = anyOfficial || anyUnofficial || anyDeclined

  // Demo betting sandbox for races without a bound on-chain market yet — same
  // local ledger the /deprize index uses, so "Back this team" always does
  // something even before every race has a deployed LMSR/mint router.
  const projectIds = competitors.map((c) => c.project.id)
  const impliedOdds = goal.market?.impliedOdds
  const demo = useMockMarket(goal.id, projectIds, impliedOdds, userAddress)

  // Inline bet/cash-out modals — a competitor row opens one of these instead
  // of navigating to /deprize/{id}, so a bet can be placed without leaving
  // the globe. Reset whenever the open race changes so a stale index from a
  // previous goal can never target the wrong market.
  const [betIndex, setBetIndex] = useState<number | null>(null)
  const [exitIndex, setExitIndex] = useState<number | null>(null)
  const [demoBetProjectId, setDemoBetProjectId] = useState<string | null>(null)
  useEffect(() => {
    setBetIndex(null)
    setExitIndex(null)
    setDemoBetProjectId(null)
  }, [goal.id])

  const outcomeAt = (index: number | undefined): Outcome | undefined =>
    index === undefined ? undefined : outcomes?.[index]

  const canBet = (index: number) =>
    !!marketAddress && !!mintAddress && index < numOutcomes

  const handleBetClick = (projectId: string, index: number | undefined) => {
    if (!userAddress) {
      onConnectWallet?.()
      return
    }
    if (!bound) {
      setDemoBetProjectId(projectId)
      return
    }
    if (!bettingAllowed || index === undefined || !canBet(index)) return
    setBetIndex(index)
  }

  const handleDemoExit = (projectId: string, teamName: string) => {
    const valueEth = exitMockPosition(goal.id, projectId, userAddress)
    toast.success(`Cashed out ${teamName} (demo) for \u2248 ${fmt(valueEth)} ETH.`, {
      style: toastStyle,
    })
    onDone?.()
  }

  const nameForOutcome = (index: number): string => {
    const outcomeBinding = binding?.outcomes[index]
    if (outcomeBinding?.field) return 'Open Field'
    const projectId = outcomeBinding?.projectId
    const match = competitors.find((c) => c.project.id === projectId)
    return match?.project.name ?? `Team #${index + 1}`
  }

  const winningTeamName =
    resolved && winningIndex >= 0 ? nameForOutcome(winningIndex) : undefined
  const split = goal.market?.payoutSplit
  const odds = goal.market?.impliedOdds
  const fieldOdds = odds?.[OPEN_FIELD_PROJECT_ID]
  // Odds fraction (0-1) for a competitor: live market odds once bound, else
  // the demo market's current price (which starts at the curator prior and
  // moves as demo bets land).
  const oddsFractionFor = (projectId: string): number | undefined => {
    if (!hasRace) return undefined
    if (bound) return odds?.[projectId]
    const pct = demo.odds[projectId]
    return pct !== undefined ? pct / 100 : odds?.[projectId]
  }
  // Highest-odds competitor first; ties and odds-less entries keep seed order.
  const ranked = [...competitors].sort(
    (a, b) => (oddsFractionFor(b.project.id) ?? -1) - (oddsFractionFor(a.project.id) ?? -1)
  )

  const outcomeIndexFor = (projectId: string): number | undefined => {
    if (!binding) return undefined
    const i = binding.outcomes.findIndex(
      (o) => !o.field && o.projectId === projectId
    )
    return i >= 0 ? i : undefined
  }

  // Brand color is withheld only from competitors that are actually outcomes in
  // the market and have not claimed their listing. A competitor the atlas lists
  // but the market does not price is not being bet on, so greying it would just
  // read as a rendering bug.
  const accentFor = (projectId: string, organization?: Organization) => {
    if (!binding) return orgColor(organization)
    const outcome = binding.outcomes.find((o) => o.projectId === projectId)
    if (!outcome) return orgColor(organization)
    return isCompetitorClaimed(outcome) ? orgColor(organization) : NEUTRAL_ACCENT
  }

  const marketStatus = goal.market?.status ?? 'none'
  const fieldOutcomeIndex =
    binding?.outcomes.findIndex((o) => o.field) ?? -1

  return (
    <div className="pointer-events-auto flex h-full w-full flex-col overflow-hidden rounded-2xl border border-fuchsia-400/20 bg-[#0a0c14]/95 shadow-2xl backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <FlagIcon className="h-4 w-4 shrink-0 text-fuchsia-300" />
            <span className="text-xs font-medium uppercase tracking-wide text-fuchsia-200/80">
              Capability race
            </span>
            <MarketPill status={marketStatus} />
            {!bound && hasRace ? (
              <span
                className="rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-fuchsia-200"
                title="No on-chain market yet — betting here is simulated and only updates odds shown in this browser."
              >
                Demo market
              </span>
            ) : (
              !bound &&
              competitors.length > 0 && (
                <span
                  className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/50"
                  title="Only one concept study is on record for this capability — there is no active competition to bet on."
                >
                  No developer yet
                </span>
              )
            )}
          </div>
          <h2 className="mt-1 text-lg font-semibold leading-snug text-white">
            {goal.title}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/50">
            {goal.targetWindow && (
              <span>
                Target window: {goal.targetWindow.from ?? '?'} –{' '}
                {goal.targetWindow.to ?? '?'}
              </span>
            )}
            {bound && (
              <span className="tabular-nums text-emerald-200/90">
                Prize pool:{' '}
                {prizePoolLoading
                  ? '…'
                  : prizePoolLabel ?? '—'}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 rounded-lg p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {/* Region anchor */}
        {goal.regionLabel && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/60">
              <MapPinIcon className="h-3.5 w-3.5" />
              {goal.regionLabel}
            </span>
          </div>
        )}

        {/* Description */}
        <p className="text-sm leading-relaxed text-white/80">{goal.description}</p>

        {/* Competitors */}
        {competitors.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">
              {hasRace ? `Competitors (${competitors.length})` : 'No committed developer'}
            </h3>
            {!hasRace && (
              <p className="mb-2 text-xs leading-relaxed text-white/50">
                Only one concept study is on record for this capability and no
                organization has committed to building it — there is no
                active competition to bet on. Shown below for reference.
              </p>
            )}
            {hasRace && showParticipationLegend && (
              <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/45">
                {anyOfficial && (
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className={`h-3 w-1 rounded-full ${PARTICIPATION_BAR_CLASSES.official}`}
                    />
                    Official participant
                  </span>
                )}
                {anyUnofficial && (
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className={`h-3 w-1 rounded-full ${PARTICIPATION_BAR_CLASSES.unofficial}`}
                    />
                    Unofficial — not confirmed
                  </span>
                )}
                {anyDeclined && (
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className={`h-3 w-1 rounded-full ${PARTICIPATION_BAR_CLASSES.declined}`}
                    />
                    Declined
                  </span>
                )}
              </div>
            )}
            <div className="space-y-2">
              {ranked.map(({ project, organization }) => {
                const color = accentFor(project.id, organization)
                const p = oddsFractionFor(project.id)
                const outcomeIndex = outcomeIndexFor(project.id)
                // Every competitor can be backed: for real races once bound
                // to an outcome index, for everything else via the demo
                // sandbox (which uses the project id directly as its key).
                // A single-entrant non-race (hasRace false) is never
                // backable — see isCompetitiveRace.
                const canBack =
                  hasRace &&
                  (bound
                    ? marketDeprizeId !== undefined && outcomeIndex !== undefined
                    : true)
                const kind = participationKind(project.rosterStatus)
                const outcome = outcomeAt(outcomeIndex)
                const demoPosition = demo.positions[project.id]
                const holding = bound
                  ? !!outcome && Number.isFinite(outcome.balance) && outcome.balance > 0
                  : !!demoPosition && demoPosition.qty > 0
                const redeemValueEth =
                  bound && resolved && outcome?.balanceWei !== undefined && payoutDen
                    ? Number(
                        positionRedeemValue(
                          outcome.balanceWei,
                          payoutNums?.[outcomeIndex ?? -1] ?? 0n,
                          payoutDen,
                        ),
                      ) / Number(UNIT)
                    : undefined
                const isWinningSlot =
                  bound && resolved && outcomeIndex !== undefined && outcomeIndex === winningIndex
                const backDisabled =
                  !!userAddress && bound && (!bettingAllowed || tradingHalted)
                const heldValueEth = bound
                  ? outcome?.balance
                  : demoPosition?.qty
                return (
                  <div
                    key={project.id}
                    title={kind ? PARTICIPATION_LABEL[kind] : undefined}
                    className={`relative overflow-hidden rounded-lg border transition-colors hover:border-cyan-400/30 ${
                      kind
                        ? PARTICIPATION_ROW_CLASSES[kind]
                        : 'border-white/[0.06] bg-white/[0.03]'
                    }`}
                  >
                    {kind && (
                      <span
                        aria-hidden
                        className={`absolute inset-y-0 left-0 z-20 w-1 ${PARTICIPATION_BAR_CLASSES[kind]}`}
                      />
                    )}
                    {p != null && (
                      <div
                        className="pointer-events-none absolute inset-y-0 left-0 opacity-[0.14]"
                        style={{ width: `${Math.round(p * 100)}%`, background: color }}
                      />
                    )}
                    <div className="relative z-10 flex items-center gap-2.5 px-2.5 py-2 pl-3.5">
                      <button
                        type="button"
                        onClick={() => onSelectProject(project.id)}
                        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{
                            backgroundColor: color,
                            boxShadow:
                              color === NEUTRAL_ACCENT ? undefined : `0 0 6px ${color}`,
                          }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-white/90">
                            {project.name}
                          </span>
                          <span className="block truncate text-[11px] text-white/40">
                            {project.orgId === 'unassigned'
                              ? 'No developer assigned'
                              : organization?.name ?? project.orgId}
                          </span>
                        </span>
                      </button>
                      {holding && (
                        <span className="shrink-0 text-[10px] font-medium text-moon-green">
                          {resolved
                            ? isWinningSlot
                              ? 'Won'
                              : isRefundVector
                                ? 'Refund'
                                : 'Lost'
                            : `Holding ${fmt(heldValueEth ?? 0, 3)}`}
                        </span>
                      )}
                      {p != null && (
                        <span className="w-9 shrink-0 text-right text-sm font-semibold tabular-nums text-gray-200">
                          {Math.round(p * 100)}%
                        </span>
                      )}
                      {canBack && !resolved && (
                        <button
                          type="button"
                          onClick={() => handleBetClick(project.id, outcomeIndex)}
                          disabled={backDisabled}
                          className="shrink-0 rounded-md px-3 py-1 text-xs font-semibold text-white transition-all
                            bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500
                            disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {userAddress ? 'Buy' : 'Connect'}
                        </button>
                      )}
                      {resolved && bound && redeemValueEth !== undefined && (
                        <span
                          className={`shrink-0 text-xs font-semibold tabular-nums ${
                            isWinningSlot || isRefundVector ? 'text-emerald-300' : 'text-gray-500'
                          }`}
                        >
                          ≈ {fmt(redeemValueEth)} ETH
                        </span>
                      )}
                    </div>
                    {holding && !resolved && (
                      <div
                        className="relative z-10 flex items-center justify-between gap-2 border-t border-white/[0.06] px-2.5 py-1.5"
                        onMouseDown={stopRowNav}
                      >
                        <span className="text-[11px] text-white/50">
                          {fmt(heldValueEth ?? 0)} {bound ? 'ETH' : 'demo ETH'} if wins
                        </span>
                        {(bound ? !tradingHalted : true) && (
                          <button
                            type="button"
                            onClick={() =>
                              bound
                                ? setExitIndex(outcomeIndex!)
                                : handleDemoExit(project.id, project.name)
                            }
                            className="shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white
                              bg-white/5 hover:bg-indigo-500/15 border border-white/10 hover:border-indigo-400/35 transition-all"
                          >
                            Cash out
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
              {fieldOdds != null && Number.isFinite(fieldOdds) && (() => {
                const fieldOutcome = outcomeAt(
                  fieldOutcomeIndex >= 0 ? fieldOutcomeIndex : undefined,
                )
                const fieldHolding =
                  !!fieldOutcome &&
                  Number.isFinite(fieldOutcome.balance) &&
                  fieldOutcome.balance > 0
                const fieldRedeemValueEth =
                  resolved && fieldOutcome?.balanceWei !== undefined && payoutDen
                    ? Number(
                        positionRedeemValue(
                          fieldOutcome.balanceWei,
                          payoutNums?.[fieldOutcomeIndex] ?? 0n,
                          payoutDen,
                        ),
                      ) / Number(UNIT)
                    : undefined
                const fieldIsWinningSlot = resolved && fieldOutcomeIndex === winningIndex
                return (
                  <div className="relative overflow-hidden rounded-lg border border-dashed border-white/15 bg-white/[0.03]">
                    <div
                      className="pointer-events-none absolute inset-y-0 left-0 bg-white/30 opacity-[0.14]"
                      style={{ width: `${Math.round(fieldOdds * 100)}%` }}
                    />
                    <div className="relative z-10 flex items-center gap-2.5 px-2.5 py-2">
                      <span className="h-2 w-2 shrink-0 rounded-full border border-dashed border-white/40" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-white/80">Other entrants</span>
                        <span className="block truncate text-[11px] text-white/40">
                          Any qualifying entrant not listed above
                        </span>
                      </span>
                      {fieldHolding && (
                        <span className="shrink-0 text-[10px] font-medium text-moon-green">
                          {resolved
                            ? fieldIsWinningSlot
                              ? 'Won'
                              : isRefundVector
                                ? 'Refund'
                                : 'Lost'
                            : `Holding ${fmt(fieldOutcome!.balance, 3)}`}
                        </span>
                      )}
                      <span className="w-9 shrink-0 text-right text-sm font-semibold tabular-nums text-gray-300">
                        {Math.round(fieldOdds * 100)}%
                      </span>
                      {marketDeprizeId !== undefined && fieldOutcomeIndex >= 0 && !resolved && (
                        <button
                          type="button"
                          onClick={() => handleBetClick(OPEN_FIELD_PROJECT_ID, fieldOutcomeIndex)}
                          disabled={!!userAddress && (!bettingAllowed || tradingHalted)}
                          className="shrink-0 rounded-md px-3 py-1 text-xs font-semibold text-white transition-all
                            bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500
                            disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {userAddress ? 'Buy' : 'Connect'}
                        </button>
                      )}
                      {resolved && fieldRedeemValueEth !== undefined && (
                        <span
                          className={`shrink-0 text-xs font-semibold tabular-nums ${
                            fieldIsWinningSlot || isRefundVector ? 'text-emerald-300' : 'text-gray-500'
                          }`}
                        >
                          ≈ {fmt(fieldRedeemValueEth)} ETH
                        </span>
                      )}
                    </div>
                    {fieldHolding && !resolved && (
                      <div className="relative z-10 flex items-center justify-between gap-2 border-t border-white/[0.06] px-2.5 py-1.5">
                        <span className="text-[11px] text-white/50">
                          {fmt(fieldOutcome!.balance)} ETH if wins
                        </span>
                        {!tradingHalted && (
                          <button
                            type="button"
                            onClick={() => setExitIndex(fieldOutcomeIndex)}
                            className="shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white
                              bg-white/5 hover:bg-indigo-500/15 border border-white/10 hover:border-indigo-400/35 transition-all"
                          >
                            Cash out
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>

            {marketDeprizeId !== undefined && (
              <Link
                href={`/deprize/${marketDeprizeId}`}
                className="mt-3 flex w-full items-center justify-center rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white/85 transition hover:border-fuchsia-400/40 hover:bg-white/10 hover:text-white"
              >
                See all competitors
              </Link>
            )}

            {odds && (
              <p className="mt-2 text-[11px] leading-relaxed text-white/40">
                {oddsCaption(marketStatus)}
              </p>
            )}
            {bound ? (
              <p className="mt-2 text-[11px] leading-relaxed text-white/40">
                {ROSTER_DISCLAIMER}
              </p>
            ) : (
              hasRace &&
              anyUnofficial && (
                <p className="mt-2 text-[11px] leading-relaxed text-white/40">
                  Unofficial competitors are listed at MoonDAO&apos;s editorial
                  discretion. That does not mean the organization has agreed to
                  participate in any MoonDAO prize.
                </p>
              )
            )}
          </div>
        )}

        {/* Claim / refund — same helper as the DePrize detail page, so a
            resolved race can be settled without leaving the globe. */}
        {resolved && marketDeprizeId !== undefined && chain && account && (
          <ClaimPanel
            deprizeId={marketDeprizeId}
            chain={chain}
            account={account}
            resolved={resolved}
            isRefundVector={isRefundVector}
            winningTeamName={winningTeamName}
            jbProjectId={jbProjectId}
            refreshNonce={refreshNonce}
            onDone={() => onDone?.()}
          />
        )}

        {/* Capability criteria */}
        {goal.criteria && goal.criteria.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">
              Capability criteria (draft)
            </h3>
            <ol className="space-y-2.5">
              {goal.criteria.map((c, i) => (
                <li key={c.id} className="flex gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 text-[11px] font-semibold text-fuchsia-200">
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm leading-snug text-white/85">
                      {c.statement}
                    </span>
                    {c.threshold && (
                      <span className="mt-0.5 block text-xs text-white/50">
                        {c.threshold}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-[11px] leading-relaxed text-white/40">
              Draft criteria — the binding spec is frozen and pinned publicly
              when a market opens.
            </p>
          </div>
        )}

        {/* Market structure */}
        {goal.market && (split || goal.market.budgetGate) && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">
              Prize structure
            </h3>
            {split && (
              <div className="flex gap-2">
                <div className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <div className="text-lg font-semibold text-white">
                    {Math.round(split.capability * 100)}%
                  </div>
                  <div className="text-xs text-white/50">
                    Capability demo confirmed
                  </div>
                </div>
                <div className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <div className="text-lg font-semibold text-white">
                    {Math.round(split.flight * 100)}%
                  </div>
                  <div className="text-xs text-white/50">
                    Flight / surface milestone
                  </div>
                </div>
              </div>
            )}
            {goal.market.budgetGate && (
              <p className="mt-2 text-xs leading-relaxed text-white/50">
                Budget gate: {goal.market.budgetGate}
              </p>
            )}
          </div>
        )}

        {/* Sources */}
        {goal.sources.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">
              Sources
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {goal.sources.map((s, i) => (
                <SourceBadge key={i} source={s} />
              ))}
            </div>
          </div>
        )}

        {!hasRace ? (
          <p className="border-t border-white/10 pt-3 text-[11px] leading-relaxed text-white/35">
            This capability has no competing developer and no MoonDAO
            DePrize market. Nothing above is a bet, an offer, an
            endorsement, or a prediction that this entrant will build it.
          </p>
        ) : !bound ? (
          <p className="border-t border-white/10 pt-3 text-[11px] leading-relaxed text-white/35">
            No on-chain MoonDAO DePrize market exists for this race yet, so the
            odds and positions above are a demo sandbox — no real ETH moves.
            Nothing here is an offer, endorsement, or prediction of outcomes.
          </p>
        ) : (
          <p className="border-t border-white/10 pt-3 text-[11px] leading-relaxed text-white/35">
            Nothing here is an offer, endorsement, or prediction of outcomes. See
            the{' '}
            <a
              href={DEPRIZE_TERMS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-white/20 underline-offset-2 hover:text-white/60"
            >
              DePrize Terms &amp; Conditions
            </a>{' '}
            before placing a bet.
          </p>
        )}
      </div>

      {betIndex !== null && chain && account && marketAddress && mintAddress && (
        <BetModal
          deprizeId={marketDeprizeId!}
          outcomeIndex={betIndex}
          teamName={nameForOutcome(betIndex)}
          probability={outcomeAt(betIndex)?.probability ?? NaN}
          numOutcomes={numOutcomes}
          mintAddress={mintAddress}
          marketAddress={marketAddress}
          jbProjectId={jbProjectId}
          chain={chain}
          account={account}
          spendableEth={spendableEth}
          onClose={() => setBetIndex(null)}
          onDone={() => onDone?.()}
        />
      )}

      {exitIndex !== null && chain && account && marketAddress && (
        <ExitPositionModal
          deprizeId={marketDeprizeId!}
          outcomeIndex={exitIndex}
          teamName={nameForOutcome(exitIndex)}
          balanceWei={outcomeAt(exitIndex)?.balanceWei ?? 0n}
          positionId={outcomeAt(exitIndex)?.positionId ?? 0n}
          numOutcomes={numOutcomes}
          marketAddress={marketAddress}
          chain={chain}
          account={account}
          onClose={() => setExitIndex(null)}
          onDone={() => onDone?.()}
        />
      )}

      {demoBetProjectId !== null && (
        <DemoBetModal
          sharedGoalId={goal.id}
          projectIds={projectIds}
          impliedOdds={impliedOdds}
          projectId={demoBetProjectId}
          teamName={
            competitors.find((c) => c.project.id === demoBetProjectId)?.project.name ??
            'this team'
          }
          probability={demo.odds[demoBetProjectId] ?? 0}
          address={userAddress}
          onClose={() => setDemoBetProjectId(null)}
          onDone={() => onDone?.()}
        />
      )}
    </div>
  )
}
