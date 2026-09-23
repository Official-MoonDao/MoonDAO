import { useMemo } from 'react'
import type { DePrizeActivity } from './useDePrizeActivity'
import type { UseDePrizeMarketResult } from './useDePrizeMarket'
import { maxProbDelta, rebuildOddsHistory, type TradeMarker } from './lmsr-history'
import type { OddsSample } from './odds-chart'

/** Live-vs-rebuilt divergence (percentage points) above which we trust live. */
const LIVE_SNAP_PT = 0.5

/**
 * Odds history for the chart, identical on every device: rebuilt from the
 * market's on-chain trades (via `useDePrizeActivity`) and the LMSR funding
 * parameter, then finished with the live poll's current prices. Falls back to
 * the market hook's per-browser samples while activity is loading or when the
 * chain data is unavailable.
 */
export function useOddsHistory(args: {
  market: UseDePrizeMarketResult
  activity: DePrizeActivity
}): { history: OddsSample[]; markers: TradeMarker[]; loading: boolean; fromChain: boolean } {
  const { market, activity } = args
  const live = useMemo(
    () => market.outcomes.map((o) => o.probability),
    [market.outcomes],
  )
  const liveValid = live.length > 0 && live.every((p) => Number.isFinite(p))

  return useMemo(() => {
    const canRebuild =
      !activity.loading &&
      !activity.error &&
      market.marketStartMs !== undefined &&
      market.fundingEth !== undefined &&
      market.fundingEth > 0 &&
      market.outcomes.length > 0

    if (!canRebuild) {
      return {
        history: market.oddsHistory,
        markers: [],
        loading: activity.loading,
        fromChain: false,
      }
    }

    const trades = activity.trades
      .filter((t) => Number.isFinite(t.timestampMs))
      .map((t) => ({ timestampMs: t.timestampMs, amounts: t.amounts }))
    const fundingChanges = activity.fundingChanges.filter((f) => Number.isFinite(f.timestampMs))
    // `market.fundingEth` is the funding *now*. The replayed changes are the
    // ones inside the scanned window, so back them out to get the funding at
    // the start of the window; otherwise each change would count twice.
    const replayedDelta = fundingChanges.reduce((s, f) => s + f.deltaEth, 0)
    const initialFundingEth = Math.max(0, (market.fundingEth as number) - replayedDelta)
    const { history, markers } = rebuildOddsHistory({
      marketStartMs: market.marketStartMs as number,
      initialFundingEth,
      trades,
      fundingChanges,
      numOutcomes: market.outcomes.length,
    })

    // Finish with the live prices when they differ from the reconstruction
    // (trades we couldn't see, rounding, or a resolved payout vector).
    if (liveValid && !market.resolved) {
      const last = history[history.length - 1]
      const delta = maxProbDelta(last.p, live)
      if (delta > LIVE_SNAP_PT) {
        console.warn(`[deprize] rebuilt odds differ from live by ${delta.toFixed(2)} pt`)
      }
      if (delta > 0.05) history.push({ t: Date.now(), p: [...live] })
    } else if (market.resolved && liveValid) {
      history.push({ t: Date.now(), p: [...live] })
    }

    return { history, markers, loading: false, fromChain: true }
  }, [
    activity.loading,
    activity.error,
    activity.trades,
    activity.fundingChanges,
    market.marketStartMs,
    market.fundingEth,
    market.outcomes.length,
    market.oddsHistory,
    market.resolved,
    live,
    liveValid,
  ])
}
