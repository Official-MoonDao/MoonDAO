import { COLLATERAL_DECIMALS } from 'const/config'

// LMSRWithTWAP.stage() values.
export enum MarketStage {
  Running = 0,
  Paused = 1,
  Closed = 2,
}

// DePrizeRegistry lifecycle states (mirrors IDePrizeRegistry.DePrizeState).
export enum DePrizeState {
  NONE = 0,
  DRAFT = 1,
  OPEN = 2,
  LOCKED = 3,
  VOTING = 4,
  SETTLED = 5,
  M1_RELEASED = 6,
  M2_COMPLETE = 7,
  M2_FAILED = 8,
  CANCELLED = 9,
  NO_WINNER = 10,
}

// Human-readable labels + short descriptions for each lifecycle state.
export const DEPRIZE_STATE_META: Record<
  DePrizeState,
  { label: string; description: string }
> = {
  [DePrizeState.NONE]: {
    label: 'Not registered',
    description: 'This DePrize does not exist yet.',
  },
  [DePrizeState.DRAFT]: {
    label: 'Draft',
    description: 'Being configured. Betting has not opened.',
  },
  [DePrizeState.OPEN]: {
    label: 'Open',
    description: 'Accepting bets. Back the provider you think will win.',
  },
  [DePrizeState.LOCKED]: {
    label: 'Locked',
    description: 'Betting is closed while the winner is determined.',
  },
  [DePrizeState.VOTING]: {
    label: 'Voting',
    description: 'The Senate winner vote is in progress.',
  },
  [DePrizeState.SETTLED]: {
    label: 'Settled',
    description: 'A winner has been declared. Winners can claim.',
  },
  [DePrizeState.M1_RELEASED]: {
    label: 'Milestone 1 released',
    description: '30% of the prize has been released to the winning provider.',
  },
  [DePrizeState.M2_COMPLETE]: {
    label: 'Delivered',
    description: 'The mission was delivered and the prize fully released.',
  },
  [DePrizeState.M2_FAILED]: {
    label: 'Delivery failed',
    description: 'Delivery failed after M1. Refunds are available.',
  },
  [DePrizeState.CANCELLED]: {
    label: 'Cancelled',
    description: 'This DePrize was cancelled. Refunds are available.',
  },
  [DePrizeState.NO_WINNER]: {
    label: 'No winner',
    description: 'No eligible winner was declared. Refunds are available.',
  },
}

export const REFUNDABLE_STATES: ReadonlySet<DePrizeState> = new Set([
  DePrizeState.CANCELLED,
  DePrizeState.NO_WINNER,
  DePrizeState.M2_FAILED,
])

export const TERMINAL_STATES: ReadonlySet<DePrizeState> = new Set([
  DePrizeState.M2_COMPLETE,
  DePrizeState.M2_FAILED,
  DePrizeState.CANCELLED,
  DePrizeState.NO_WINNER,
])

// Prize slice: every bet routes 5% (1/20) to the Juicebox prize pool.
// Single source of truth lives in the dependency-free quote-math module.
export { SLICE_DENOMINATOR } from './quote-math'

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

export const isRefundableState = (s: DePrizeState | undefined) =>
  s !== undefined && REFUNDABLE_STATES.has(s)
export const isTerminalState = (s: DePrizeState | undefined) =>
  s !== undefined && TERMINAL_STATES.has(s)
