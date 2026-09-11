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
  buildSupersededPayouts,
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

export const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000'

export const UNIT = 10n ** BigInt(COLLATERAL_DECIMALS)
export const MAX_UINT256 = (1n << 256n) - 1n

// Keep a little native ETH back for gas when placing a bet (the router pulls the
// full msg.value and refunds leftover, but the wallet still pays gas). The
// amount is chain-aware — see gas-reserve.ts for why a flat reserve is wrong.
export {
  DEFAULT_GAS_RESERVE_WEI,
  L2_GAS_RESERVE_WEI,
  gasReserveEth,
  gasReserveWei,
  spendableFromBalanceEth,
} from './gas-reserve'

// Per-outcome line/accent colors, shared across the chart and team cards.
// Sized for the largest planned race (4) plus headroom; wraps via `% length`.
export const OUTCOME_COLORS = [
  '#22c55e',
  '#3b82f6',
  '#a855f7',
  '#f59e0b',
  '#ef4444',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
]

// Odds-history sampling cadence for the live chart.
export const ODDS_SAMPLE_MIN_MS = 8000
export const ODDS_HISTORY_MAX = 1000
export const ODDS_POLL_MS = 30000

// DePrize legal documents, published under MoonDAO's Legal docs from
// content/docs/Legal/DePrize/*.md (same host/pattern as the Website Terms &
// Privacy Policy).
export const DEPRIZE_TERMS_URL = '/docs/Legal/DePrize/DePrize-Terms-and-Conditions'
export const DEPRIZE_PRIZE_RULES_URL = '/docs/Legal/DePrize/DePrize-Official-Prize-Rules'
export const DEPRIZE_PRIVACY_URL = '/docs/Legal/DePrize/DePrize-Privacy-Notice'
export const DEPRIZE_RISK_DISCLOSURES_URL =
  '/docs/Legal/DePrize/DePrize-Risk-Disclosures-and-Disclaimers'
// Bump whenever the published Terms change materially; the bet flow keys the
// user's acceptance on this so a new version re-prompts them.
export const DEPRIZE_TERMS_VERSION = '1.1'
