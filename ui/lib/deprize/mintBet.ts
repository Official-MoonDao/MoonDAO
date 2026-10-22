/** Arbitrum One. The live DePrizeMint there is the pre-permit router. */
export const ARBITRUM_ONE_CHAIN_ID = 42161

/**
 * Arbitrum One's deployed mint exposes
 * `bet(uint256,uint256,uint256,uint256)` and does not check a CompliancePermit.
 * Sepolia's mint takes the permit deadline and signature as the last two args.
 */
export function arbitrumMintUsesLegacyBet(chainId: number): boolean {
  return chainId === ARBITRUM_ONE_CHAIN_ID
}

/**
 * Custom errors from DePrizeMint. The bet ABI has to include these or a revert
 * surfaces as "Encoded error signature not found on ABI" instead of a name.
 * `CostTooHigh` is keccak selector 0xcb7a3738.
 */
export const MINT_BET_ERRORS = [
  { type: 'error', name: 'ZeroAddress', inputs: [] },
  {
    type: 'error',
    name: 'BettingClosed',
    inputs: [{ name: 'deprizeId', type: 'uint256' }],
  },
  {
    type: 'error',
    name: 'MarketNotSet',
    inputs: [{ name: 'deprizeId', type: 'uint256' }],
  },
  {
    type: 'error',
    name: 'MarketAlreadySet',
    inputs: [
      { name: 'deprizeId', type: 'uint256' },
      { name: 'market', type: 'address' },
    ],
  },
  {
    type: 'error',
    name: 'BadOutcomeIndex',
    inputs: [
      { name: 'deprizeId', type: 'uint256' },
      { name: 'outcomeIndex', type: 'uint256' },
    ],
  },
  { type: 'error', name: 'NonPositiveCost', inputs: [] },
  {
    type: 'error',
    name: 'CostTooHigh',
    inputs: [
      { name: 'cost', type: 'uint256' },
      { name: 'budget', type: 'uint256' },
      { name: 'maxCost', type: 'uint256' },
    ],
  },
  {
    type: 'error',
    name: 'CollateralMismatch',
    inputs: [
      { name: 'expectedSpent', type: 'uint256' },
      { name: 'actualSpent', type: 'uint256' },
    ],
  },
  {
    type: 'error',
    name: 'OutcomeTokenMismatch',
    inputs: [
      { name: 'expectedPositionId', type: 'uint256' },
      { name: 'expectedAmount', type: 'uint256' },
      { name: 'received', type: 'uint256' },
    ],
  },
  { type: 'error', name: 'RefundFailed', inputs: [] },
  { type: 'error', name: 'MarketCtfMismatch', inputs: [] },
  { type: 'error', name: 'MarketCollateralMismatch', inputs: [] },
  {
    type: 'error',
    name: 'MarketSlotMismatch',
    inputs: [
      { name: 'slots', type: 'uint256' },
      { name: 'teams', type: 'uint256' },
    ],
  },
  {
    type: 'error',
    name: 'MarketConditionMismatch',
    inputs: [
      { name: 'marketCondition', type: 'bytes32' },
      { name: 'registryCondition', type: 'bytes32' },
    ],
  },
  { type: 'error', name: 'UnexpectedERC1155', inputs: [] },
  { type: 'error', name: 'ComplianceSignerUnset', inputs: [] },
  {
    type: 'error',
    name: 'PermitExpired',
    inputs: [{ name: 'deadline', type: 'uint256' }],
  },
  {
    type: 'error',
    name: 'InvalidPermit',
    inputs: [{ name: 'recovered', type: 'address' }],
  },
  { type: 'error', name: 'RenounceDisabled', inputs: [] },
] as const

/** ABI fragment for the Arbitrum One mint. Do not use this on Sepolia. */
export const LEGACY_MINT_BET_ABI = [
  {
    type: 'function',
    name: 'bet',
    stateMutability: 'payable',
    inputs: [
      { name: 'deprizeId', type: 'uint256' },
      { name: 'outcomeIndex', type: 'uint256' },
      { name: 'outcomeTokenAmount', type: 'uint256' },
      { name: 'maxCost', type: 'uint256' },
    ],
    outputs: [],
  },
  ...MINT_BET_ERRORS,
] as const

export const COST_TOO_HIGH_SELECTOR = '0xcb7a3738'

export const COST_TOO_HIGH_MESSAGE =
  'The price moved, so this ETH amount no longer covers the shares. Try again or enter a smaller amount.'

function errorParts(err: unknown, depth: number): string[] {
  if (depth > 6 || err == null) return []
  if (typeof err === 'string') return [err]
  if (typeof err !== 'object') return []
  const value = err as Record<string, unknown>
  const parts: string[] = []
  const keys = ['shortMessage', 'message', 'reason', 'details', 'signature', 'errorName', 'name']
  for (const key of keys) {
    if (typeof value[key] === 'string') parts.push(value[key] as string)
  }
  if (typeof value.data === 'string') parts.push(value.data)
  else parts.push(...errorParts(value.data, depth + 1))
  parts.push(...errorParts(value.cause, depth + 1))
  return parts
}

export function isCostTooHighError(err: unknown): boolean {
  const text = errorParts(err, 0).join(' ').toLowerCase()
  return text.includes(COST_TOO_HIGH_SELECTOR) || text.includes('costtoohigh')
}

/** A readable toast for CostTooHigh, or null when the failure is something else. */
export function betFailureMessage(err: unknown): string | null {
  if (isCostTooHighError(err)) return COST_TOO_HIGH_MESSAGE
  return null
}
