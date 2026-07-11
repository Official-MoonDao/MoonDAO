/**
 * Assets the shared FundOnramp / Coinbase / MoonPay stack can purchase.
 * ETH is the default (missions, citizen/team creation, wallet top-ups).
 * USDC is used for marketplace listings priced in USDC on Arbitrum.
 */
export type OnrampAsset = 'ETH' | 'USDC'

export function isOnrampAsset(value: unknown): value is OnrampAsset {
  return value === 'ETH' || value === 'USDC'
}

export function onrampAssetIcon(asset: OnrampAsset): string {
  return asset === 'USDC' ? '/coins/USDC.svg' : '/coins/ETH.svg'
}

/** Format a crypto purchase amount for the Coinbase Order API. */
export function formatOnrampPurchaseAmount(
  amount: number,
  asset: OnrampAsset
): string {
  return asset === 'USDC' ? amount.toFixed(6) : amount.toFixed(8)
}

/**
 * Rough fiat (USD) to pre-fill in MoonPay / Privy. USDC ≈ $1; ETH needs a
 * spot price. Includes a ~5% buffer for provider fees and price drift.
 */
export function estimateOnrampFiatUsd(
  cryptoAmount: number,
  asset: OnrampAsset,
  ethSpotPrice?: number
): number | undefined {
  if (!cryptoAmount || cryptoAmount <= 0) return undefined
  if (asset === 'USDC') {
    return Math.ceil(cryptoAmount * 1.05)
  }
  if (ethSpotPrice && ethSpotPrice > 0) {
    return Math.ceil(cryptoAmount * ethSpotPrice * 1.05)
  }
  return undefined
}
