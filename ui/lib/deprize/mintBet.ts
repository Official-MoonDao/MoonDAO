/**
 * Arguments for `DePrizeMint.bet`. Every deployed mint, on Sepolia and on
 * Arbitrum One, rejects a bet without the server-issued CompliancePermit, so
 * the permit deadline and signature are always the last two arguments.
 */
export function mintBetArgs(args: {
  deprizeId: number | bigint
  outcomeIndex: number | bigint
  shares: bigint
  maxCost: bigint
  deadline: string | bigint
  signature: `0x${string}`
}): [bigint, bigint, bigint, bigint, bigint, `0x${string}`] {
  return [
    BigInt(args.deprizeId),
    BigInt(args.outcomeIndex),
    args.shares,
    args.maxCost,
    BigInt(args.deadline),
    args.signature,
  ]
}

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
