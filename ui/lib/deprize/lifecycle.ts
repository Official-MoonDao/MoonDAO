// Pure DePrize lifecycle + resolution derivations. Intentionally
// dependency-free (no thirdweb, no app config) so they are directly
// unit-testable under the mocha/ts-node runner — same pattern as quote-math.ts.

// Mirrors IDePrizeRegistry.DePrizeState exactly.
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

export const isRefundableState = (s: DePrizeState | undefined) =>
  s !== undefined && REFUNDABLE_STATES.has(s)
export const isTerminalState = (s: DePrizeState | undefined) =>
  s !== undefined && TERMINAL_STATES.has(s)

export type DePrizeFlags = {
  bettingOpen: boolean
  isRefundable: boolean
  isTerminal: boolean
  cancellationPending: boolean
}

// Client-side mirror of the registry's own boolean views, derived from
// `state` + `cancellationNoticeAt` so a poll costs a single RPC read:
// - bettingOpen: OPEN and no cancellation notice pending (the registry forces
//   betting closed the moment a cancellation is announced);
// - isRefundable / isTerminal: pure state-set membership.
export function deriveDePrizeFlags(
  state: DePrizeState,
  cancellationNoticeAt: bigint
): DePrizeFlags {
  const cancellationPending = cancellationNoticeAt > 0n
  return {
    bettingOpen: state === DePrizeState.OPEN && !cancellationPending,
    isRefundable: isRefundableState(state),
    isTerminal: isTerminalState(state),
    cancellationPending,
  }
}

export type ResolutionOutcome = {
  resolved: boolean
  // Index of the single winning slot, or -1 when unresolved / refund vector.
  winningIndex: number
  // True for the equal-payout report ([1,1,…,1]) used on NO_WINNER/CANCELLED.
  isRefundVector: boolean
}

// Interpret a CTF payout vector. `payoutDenominator` is 0 until the oracle
// reports; a single positive numerator = winner; all-positive = refund 1/N.
export function resolvePayoutVector(
  payoutNums: bigint[],
  payoutDen: bigint | undefined
): ResolutionOutcome {
  const resolved = payoutDen !== undefined && payoutDen > 0n
  if (!resolved) return { resolved: false, winningIndex: -1, isRefundVector: false }
  const positive = payoutNums.filter((n) => n > 0n).length
  const winningIndex =
    positive === 1 ? payoutNums.findIndex((n) => n > 0n) : -1
  const isRefundVector =
    payoutNums.length > 0 && payoutNums.every((n) => n > 0n)
  return { resolved: true, winningIndex, isRefundVector }
}

// What a held position redeems for under a reported payout vector — the CTF's
// exact integer math (floor division PER POSITION), so UI figures can never
// disagree with what redeemPositions actually pays.
export function positionRedeemValue(
  balanceWei: bigint,
  payoutNumerator: bigint,
  payoutDenominator: bigint
): bigint {
  if (payoutDenominator <= 0n || balanceWei <= 0n) return 0n
  return (balanceWei * payoutNumerator) / payoutDenominator
}
