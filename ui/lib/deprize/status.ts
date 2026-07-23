// Pure UI status derivations for the DePrize detail page. Kept free of React /
// thirdweb so they are unit-testable under the mocha runner.

import { MarketStage } from './constants'
import { DEPRIZE_STATE_META, DePrizeState } from './lifecycle'

export type BettingStatusView = {
  /** Why betting is blocked despite registry OPEN, if applicable. */
  bettingBlockedReason: string | undefined
  /** Header description — blocked reason, else the registry state copy. */
  effectiveDescription: string
  /** Badge override when registry OPEN but trading isn't actually available. */
  statusLabelOverride: string | undefined
}

/**
 * Reconcile registry lifecycle with the LMSR trading stage into ONE status so
 * the header can't say "Accepting bets" while the market is paused/closed or
 * the bet router isn't wired.
 */
export function reconcileBettingStatus(opts: {
  bettingOpen: boolean
  marketStage: number | undefined
  mintConfigured: boolean
  registryState: DePrizeState
  /**
   * Whether DePrizeMint (or a validated fallback) has bound an LMSR.
   * `undefined` = still resolving; `false` = confirmed unbound.
   */
  marketBound?: boolean
}): BettingStatusView {
  const defaultDescription =
    DEPRIZE_STATE_META[opts.registryState]?.description ?? ''

  let bettingBlockedReason: string | undefined
  if (opts.bettingOpen) {
    if (opts.marketBound === false) {
      bettingBlockedReason =
        'No prediction market is bound to this DePrize, so betting is unavailable.'
    } else if (opts.marketBound === true && opts.marketStage === undefined) {
      // Address resolved but LMSR stage not read yet — never flash "Accepting bets".
      bettingBlockedReason = 'Loading market status…'
    } else if (opts.marketStage === MarketStage.Paused) {
      bettingBlockedReason =
        'Betting is temporarily paused while the market is halted. Live odds stay visible.'
    } else if (opts.marketStage === MarketStage.Closed) {
      bettingBlockedReason =
        'The prediction market is closed, so betting is unavailable.'
    } else if (
      opts.marketBound === true &&
      opts.marketStage !== MarketStage.Running
    ) {
      // Any non-Running LMSR stage (e.g. Created) — don't claim "Accepting bets".
      bettingBlockedReason = 'The prediction market is not open for trading yet.'
    } else if (!opts.mintConfigured) {
      bettingBlockedReason =
        "Betting isn't wired on this network yet. You can still view live odds."
    }
  }

  const statusLabelOverride =
    opts.bettingOpen && bettingBlockedReason
      ? opts.marketBound === false
        ? 'Open · no market'
        : opts.marketStage === MarketStage.Closed
          ? 'Open · market closed'
          : opts.marketStage === MarketStage.Paused
            ? 'Open · paused'
            : bettingBlockedReason.startsWith('Loading')
              ? 'Open'
              : 'Open · betting unavailable'
      : undefined

  return {
    bettingBlockedReason,
    effectiveDescription:
      opts.bettingOpen && bettingBlockedReason
        ? bettingBlockedReason
        : defaultDescription,
    statusLabelOverride,
  }
}

/**
 * Live vs Former for the index tabs.
 * - Live: OPEN and still tradable (Running or Paused), or mid-lifecycle (LOCKED/VOTING).
 * - Former: terminal outcomes, winner-declared (SETTLED/M1), or OPEN shells that
 *   can never accept bets (unbound market / closed LMSR / mint unwired).
 */
export function deprizeListBucket(opts: {
  state: DePrizeState
  isTerminal: boolean
  mintConfigured: boolean
  marketBound: boolean | undefined
  marketStage: number | undefined
  marketLoading: boolean
}): 'live' | 'closed' | 'none' | 'loading' {
  const { state, isTerminal, mintConfigured, marketBound, marketStage, marketLoading } =
    opts
  if (state === DePrizeState.NONE) return 'none'
  if (
    isTerminal ||
    state === DePrizeState.SETTLED ||
    state === DePrizeState.M1_RELEASED
  ) {
    return 'closed'
  }
  if (state === DePrizeState.OPEN) {
    if (marketLoading || marketBound === undefined) return 'loading'
    if (!mintConfigured || marketBound === false || marketStage === MarketStage.Closed) {
      return 'closed'
    }
    // Running or Paused (or stage not yet read but market is bound) → Live.
    return 'live'
  }
  if (state === DePrizeState.DRAFT) return 'closed'
  // LOCKED / VOTING — still in flight.
  return 'live'
}

/**
 * Format the "Betting closes" countdown from a sunset unix-seconds timestamp.
 */
export function formatBettingCloses(
  sunsetSec: bigint | number,
  nowMs: number = Date.now(),
): string {
  const sunsetMs = Number(sunsetSec) * 1000
  if (!Number.isFinite(sunsetMs) || sunsetMs <= 0) return '—'
  if (sunsetMs <= nowMs) return 'Closing soon'
  const diffSec = Math.floor((sunsetMs - nowMs) / 1000)
  const d = Math.floor(diffSec / 86400)
  const h = Math.floor((diffSec % 86400) / 3600)
  if (d > 0) return `${d}d ${h}h`
  const m = Math.floor((diffSec % 3600) / 60)
  return `${h}h ${m}m`
}

/** True when a 0x-prefixed 40-hex address is present (DePrizeMint configured). */
export function isMintConfigured(mintAddress: string | undefined): boolean {
  return !!mintAddress && /^0x[0-9a-fA-F]{40}$/.test(mintAddress)
}
