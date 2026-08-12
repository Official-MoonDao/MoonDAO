import { DEPRIZE_MINT_ADDRESSES } from 'const/config'
import { useMemo } from 'react'
import type { Chain } from 'thirdweb'
import {
  findDePrizeIdForGoal,
  getDePrizeRaceBinding,
  isDePrizeGoalMarketBound,
} from './competitions'
import { DePrizeState, MarketStage } from './constants'
import { mapOutcomeOddsToProjectIds } from './goal-odds'
import { useDePrize } from './useDePrize'
import { useDePrizeMarket, type Outcome } from './useDePrizeMarket'
import { getChainSlug } from '@/lib/thirdweb/chain'

/** Atlas SharedGoalMarket.status values the bridge can emit. */
export type DePrizeGoalMarketStatus = 'live' | 'resolved' | 'planned'

export type UseDePrizeGoalOddsResult = {
  deprizeId: number | undefined
  /** Juicebox project id for the prize pool (0 / undefined when unbound). */
  jbProjectId: number | undefined
  /** Fractions of 1 keyed by atlas projectId. Undefined when unbound / mismatched. */
  oddsByProjectId: Record<string, number> | undefined
  /** Fraction of 1 on the Open Field slot, if any. */
  fieldOdds: number | undefined
  status: DePrizeGoalMarketStatus
  loading: boolean
  // --- Betting / positions surface (Moon Base Zero inline betting) ---
  /** Router address to bet through; empty string when unconfigured on this chain. */
  mintAddress: string
  /** Bound LMSR market address, once resolved. */
  marketAddress: string | undefined
  /** True once DePrizeMint.marketOf(id) resolved this LMSR (bets will not revert). */
  mintBound: boolean
  numOutcomes: number
  /** Registry team ids in outcome-index order. */
  teamIds: bigint[]
  /** Live per-outcome probability/balance/positionId — same shape as the detail page. */
  outcomes: Outcome[]
  stage: number | undefined
  resolved: boolean
  winningIndex: number
  isRefundVector: boolean
  payoutDen: bigint | undefined
  payoutNums: bigint[]
  bettingOpen: boolean
  tradingHalted: boolean
  sunset: bigint | undefined
  cancellationPending: boolean
  /** Re-reads both the registry record and the market (odds, balances, resolution). */
  refresh: () => void
}

function deriveGoalMarketStatus(
  registryState: DePrizeState | undefined,
  bound: boolean,
): DePrizeGoalMarketStatus {
  // An unbound race has no on-chain market to report; it keeps curator priors.
  if (!bound) return 'planned'
  if (registryState === undefined) return 'planned'

  // Superseded generations are not the live race — treat as planned so the
  // bridge only surfaces odds from the tip generation findDePrizeIdForGoal
  // already resolves to.
  if (registryState === DePrizeState.SUPERSEDED) return 'planned'

  if (
    registryState === DePrizeState.SETTLED ||
    registryState === DePrizeState.M1_RELEASED ||
    registryState === DePrizeState.M2_COMPLETE ||
    registryState === DePrizeState.M2_FAILED ||
    registryState === DePrizeState.CANCELLED ||
    registryState === DePrizeState.NO_WINNER
  ) {
    return 'resolved'
  }

  if (
    registryState === DePrizeState.OPEN ||
    registryState === DePrizeState.LOCKED ||
    registryState === DePrizeState.VOTING
  ) {
    return 'live'
  }

  return 'planned'
}

/**
 * Bridge one Moon Base Zero race to its bound DePrize market.
 * Mounts a single market (call for the open race only — do not fan out to all 8).
 * Inherits ODDS_POLL_MS / hidden-tab skip from useDePrizeMarket.
 * Resolves to the live generation tip when a race has been superseded.
 *
 * Also the single source for the race's betting/positions surface (mint
 * address, market address, per-outcome balances) so Moon Base Zero can bet
 * and cash out inline without mounting a second copy of this market — see
 * docs/DEPRIZE_PHASE_B1.md's "mount one market" rule.
 */
export function useDePrizeGoalOdds(
  chain: Chain,
  sharedGoalId: string | undefined,
  userAddress?: string,
): UseDePrizeGoalOddsResult {
  const chainSlug = getChainSlug(chain)
  const deprizeId = findDePrizeIdForGoal(chainSlug, sharedGoalId)
  const binding = getDePrizeRaceBinding(chainSlug, deprizeId)
  const bound = isDePrizeGoalMarketBound(chainSlug, sharedGoalId)

  const { deprize, loading: registryLoading, refresh: refreshRegistry } = useDePrize(
    deprizeId,
    chain,
  )
  const numOutcomes = deprize?.teamIds.length ?? 0

  const market = useDePrizeMarket({
    deprizeId,
    conditionId: deprize?.conditionId,
    numOutcomes,
    chain,
    userAddress,
    registryState: deprize?.state,
  })

  const mapped = useMemo(() => {
    if (!bound) return undefined
    if (!binding?.outcomes.length || !deprize?.teamIds.length) return undefined
    // Alignment guard (correctness, not policy): a roster whose length has
    // drifted from the market would attribute odds to the wrong competitor.
    if (market.outcomes.length !== binding.outcomes.length) return undefined
    return mapOutcomeOddsToProjectIds({
      outcomes: binding.outcomes,
      teamIds: deprize.teamIds,
      probabilities: market.outcomes.map((o) => o.probability),
    })
  }, [binding, deprize?.teamIds, market.outcomes, bound])

  const status = deriveGoalMarketStatus(deprize?.state, bound)

  const jbProjectId =
    deprize && deprize.jbProjectId > 0n ? Number(deprize.jbProjectId) : undefined

  const refresh = () => {
    refreshRegistry()
    market.refresh()
  }

  return {
    deprizeId,
    jbProjectId,
    oddsByProjectId: mapped?.oddsByProjectId,
    fieldOdds: mapped?.fieldOdds,
    status,
    loading: !!deprizeId && (registryLoading || market.loading),
    mintAddress: DEPRIZE_MINT_ADDRESSES[chainSlug] ?? '',
    marketAddress: market.marketAddress,
    mintBound: market.mintBound,
    numOutcomes,
    teamIds: deprize?.teamIds ?? [],
    outcomes: market.outcomes,
    stage: market.stage,
    resolved: market.resolved,
    winningIndex: market.winningIndex,
    isRefundVector: market.isRefundVector,
    payoutDen: market.payoutDen,
    payoutNums: market.payoutNums,
    bettingOpen: !!deprize?.bettingOpen,
    tradingHalted: market.stage !== undefined && market.stage !== MarketStage.Running,
    sunset: deprize?.sunset,
    cancellationPending: !!deprize?.cancellationPending,
    refresh,
  }
}
