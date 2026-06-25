import { MOONEY_ADDRESSES, USDC_ADDRESSES } from 'const/config'

// v1 swaps are Arbitrum-only. These constants are the single source of truth so
// the server can reject anything off Arbitrum and the client can guard the UI.
export const ARBITRUM_CHAIN_ID = 42161
export const ARBITRUM_CAIP2 = 'eip155:42161'

// Privy represents the chain's native asset (ETH on Arbitrum) with the literal
// string "native" rather than an address.
export const NATIVE_ASSET = 'native'

export type SwapTokenKey = 'ETH' | 'USDC' | 'MOONEY'

export interface SwapTokenConfig {
  key: SwapTokenKey
  symbol: string
  name: string
  /** ERC-20 decimals, or 18 for native ETH. Used to convert human amounts. */
  decimals: number
  /** Either NATIVE_ASSET ("native") or a checksummed ERC-20 address. */
  assetAddress: string
  /** Small icon path used by the modal. */
  icon: string
  /**
   * When false, the token is allowlisted server-side but hidden from the
   * default token pickers. Used to keep an unproven pair (MOONEY) out of the
   * happy path until its routing/liquidity is confirmed via real quotes.
   */
  showByDefault: boolean
  /**
   * Marks a token whose swap routing has not been verified end-to-end. The UI
   * can surface a warning; quotes that fail for these still degrade gracefully.
   */
  experimental?: boolean
}

// Token addresses come exclusively from const/config.ts — never invented here,
// never accepted from the client. The client only ever sends a token KEY.
export const ARBITRUM_SWAP_TOKENS: Record<SwapTokenKey, SwapTokenConfig> = {
  ETH: {
    key: 'ETH',
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    assetAddress: NATIVE_ASSET,
    icon: '/icons/networks/arbitrum.svg',
    showByDefault: true,
  },
  USDC: {
    key: 'USDC',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    assetAddress: USDC_ADDRESSES.arbitrum,
    icon: '/coins/USDC.svg',
    showByDefault: true,
  },
  // MOONEY is allowlisted but kept out of the default UI until quote/execute is
  // confirmed to route reliably on Arbitrum. See TODO in lib/privy/swaps.ts.
  MOONEY: {
    key: 'MOONEY',
    symbol: 'MOONEY',
    name: 'MOONEY',
    decimals: 18,
    assetAddress: MOONEY_ADDRESSES.arbitrum,
    icon: '/coins/MOONEY.png',
    showByDefault: false,
    experimental: true,
  },
}

export const SWAP_TOKEN_KEYS = Object.keys(ARBITRUM_SWAP_TOKENS) as SwapTokenKey[]

export function isSupportedSwapChainId(chainId: number | string | undefined | null): boolean {
  if (chainId === undefined || chainId === null) return false
  return Number(chainId) === ARBITRUM_CHAIN_ID
}

export function isSwapTokenKey(value: unknown): value is SwapTokenKey {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ARBITRUM_SWAP_TOKENS, value)
}

/**
 * Resolve a client-supplied token key to its allowlisted config. Throws on any
 * unknown key so callers never operate on an arbitrary/forged token.
 */
export function getSwapToken(key: unknown): SwapTokenConfig {
  if (!isSwapTokenKey(key)) {
    throw new Error(`Unsupported token: ${typeof key === 'string' ? key : 'unknown'}`)
  }
  const token = ARBITRUM_SWAP_TOKENS[key]
  if (!token.assetAddress) {
    // Defensive: a missing address in config would otherwise produce a bad quote.
    throw new Error(`Token ${key} is not configured for Arbitrum`)
  }
  return token
}

/** Tokens shown in the picker by default (excludes experimental/hidden ones). */
export function getDefaultSwapTokens(): SwapTokenConfig[] {
  return SWAP_TOKEN_KEYS.map((k) => ARBITRUM_SWAP_TOKENS[k]).filter((t) => t.showByDefault)
}

/**
 * Validate that a from/to pair is allowed: both keys must be on the allowlist
 * and they must be different. Returns the resolved configs.
 */
export function validateSwapPair(
  fromKey: unknown,
  toKey: unknown
): { from: SwapTokenConfig; to: SwapTokenConfig } {
  const from = getSwapToken(fromKey)
  const to = getSwapToken(toKey)
  if (from.key === to.key) {
    throw new Error('Input and output tokens must be different')
  }
  return { from, to }
}

/** Slippage must be an integer in [0, 10000] basis points (0%–100%). */
export function isValidSlippageBps(bps: unknown): boolean {
  return typeof bps === 'number' && Number.isInteger(bps) && bps >= 0 && bps <= 10000
}

export const DEFAULT_SLIPPAGE_BPS = 50

/**
 * Convert a human-readable decimal amount (e.g. "0.0125") to base units as a
 * bigint, using the token's decimals. Pure string math — no floating point — so
 * it is safe for on-chain values. Throws a clear error on any malformed input.
 */
export function humanAmountToBaseUnits(amount: string | number, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    throw new Error('Invalid token decimals')
  }
  const raw = typeof amount === 'number' ? String(amount) : amount
  const trimmed = (raw ?? '').trim()

  // Reject scientific notation, signs, and anything that isn't digits + one dot.
  if (trimmed === '' || trimmed === '.' || !/^\d*\.?\d*$/.test(trimmed)) {
    throw new Error('Enter a valid amount')
  }

  const [wholePart, fracPart = ''] = trimmed.split('.')
  if (fracPart.length > decimals) {
    throw new Error(`This token supports at most ${decimals} decimal places`)
  }

  const paddedFrac = fracPart.padEnd(decimals, '0')
  const combined = `${wholePart}${paddedFrac}`.replace(/^0+(?=\d)/, '') || '0'
  const result = BigInt(combined)

  if (result <= BigInt(0)) {
    throw new Error('Amount must be greater than zero')
  }
  return result
}

/**
 * Convert base units back to a human-readable decimal string for display.
 * Trims trailing zeros. Pure string math.
 */
export function baseUnitsToHumanAmount(
  baseUnits: string | bigint,
  decimals: number,
  maxDisplayDecimals?: number
): string {
  const value = typeof baseUnits === 'bigint' ? baseUnits : BigInt(baseUnits || '0')
  const negative = value < BigInt(0)
  const abs = negative ? value * BigInt(-1) : value
  const digits = abs.toString().padStart(decimals + 1, '0')
  const whole = digits.slice(0, digits.length - decimals)
  let frac = decimals > 0 ? digits.slice(digits.length - decimals) : ''

  if (maxDisplayDecimals !== undefined && frac.length > maxDisplayDecimals) {
    frac = frac.slice(0, maxDisplayDecimals)
  }
  frac = frac.replace(/0+$/, '')

  const result = frac ? `${whole}.${frac}` : whole
  return negative ? `-${result}` : result
}
