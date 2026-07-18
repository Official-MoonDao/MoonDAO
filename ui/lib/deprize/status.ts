// Pure UI status derivations for the DePrize detail page. Kept free of React /
// thirdweb so they are unit-testable under the mocha runner.

import { MarketStage } from './constants'
import { DEPRIZE_STATE_META, type DePrizeState } from './lifecycle'

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
}): BettingStatusView {
  const defaultDescription =
    DEPRIZE_STATE_META[opts.registryState]?.description ?? ''

  let bettingBlockedReason: string | undefined
  if (opts.bettingOpen) {
    if (opts.marketStage === MarketStage.Paused) {
      bettingBlockedReason =
        'Betting is temporarily paused while the market is halted. Live odds stay visible.'
    } else if (opts.marketStage === MarketStage.Closed) {
      bettingBlockedReason =
        'The prediction market is closed, so betting is unavailable.'
    } else if (!opts.mintConfigured) {
      bettingBlockedReason =
        "Betting isn't wired on this network yet. You can still view live odds."
    }
  }

  const statusLabelOverride =
    opts.bettingOpen && bettingBlockedReason
      ? opts.marketStage === MarketStage.Closed
        ? 'Open · market closed'
        : opts.marketStage === MarketStage.Paused
          ? 'Open · paused'
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
