import { COLLATERAL_DECIMALS } from 'const/config'

// Pure lifecycle enums/derivations live in lifecycle.ts (dependency-free, unit
// tested); re-exported here so UI code has one import site for DePrize consts.
export {
  DePrizeState,
  DEPRIZE_STATE_META,
  REFUNDABLE_STATES,
  TERMINAL_STATES,
  isRefundableState,
  isTerminalState,
  deriveDePrizeFlags,
  resolvePayoutVector,
  shouldSurfaceResolution,
  positionRedeemValue,
} from './lifecycle'

// Prize slice: every bet routes 5% (1/20) to the Juicebox prize pool.
// Single source of truth lives in the dependency-free quote-math module.
export { SLICE_DENOMINATOR } from './quote-math'

// LMSRWithTWAP.stage() values.
export enum MarketStage {
  Running = 0,
  Paused = 1,
  Closed = 2,
}

export const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000'

export const UNIT = 10n ** BigInt(COLLATERAL_DECIMALS)
export const MAX_UINT256 = (1n << 256n) - 1n

// Keep a little native ETH back for gas when placing a bet (the router pulls the
// full msg.value and refunds leftover, but the wallet still pays gas).
export const GAS_RESERVE_WEI = 10n ** 15n // 0.001 ETH
export const GAS_RESERVE_ETH = Number(GAS_RESERVE_WEI) / 1e18

// Per-outcome line/accent colors, shared across the chart and team cards.
export const OUTCOME_COLORS = [
  '#22c55e',
  '#3b82f6',
  '#a855f7',
  '#f59e0b',
  '#ef4444',
  '#06b6d4',
]

// Odds-history sampling cadence for the live chart.
export const ODDS_SAMPLE_MIN_MS = 8000
export const ODDS_HISTORY_MAX = 1000
export const ODDS_POLL_MS = 30000
