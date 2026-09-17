export type FundingProvider = 'moonpay' | 'coinbase'

export type FundingStrategy =
  | { kind: 'none' }
  | { kind: 'faucet'; faucetUrl: string }
  | {
      kind: 'onramp'
      defaultProvider: FundingProvider
      allowProviderToggle: boolean
      pollIntervalMs: number
      pollWindowByProvider: Record<FundingProvider, number>
      chainSlug: string
    }

export const ARBITRUM_CHAIN_ID = 42161
export const SEPOLIA_CHAIN_ID = 11155111

export const JWT_FRESHNESS_MS = 60 * 60 * 1000
export const WALLET_WAIT_MS = 10_000
export const ELIGIBILITY_TIMEOUT_MS = 10_000
export const ONRAMP_SUGGESTED_PURCHASE_ETH = 0.01
export const DEPRIZE_ONRAMP_JWT_KEY = 'onrampJWT:deprize'
export const ONRAMP_SNAPSHOT_PREFIX = 'onrampReturn:deprize:'

/** Owner: *unassigned — DePrize product*. Kill switch is `{ kind: 'none' }`. */
export const FUNDING_STRATEGY_BY_CHAIN: Record<number, FundingStrategy> = {
  [ARBITRUM_CHAIN_ID]: {
    kind: 'onramp',
    defaultProvider: 'moonpay',
    allowProviderToggle: true,
    pollIntervalMs: 3000,
    pollWindowByProvider: { moonpay: 90_000, coinbase: 120_000 },
    chainSlug: 'arbitrum',
  },
  [SEPOLIA_CHAIN_ID]: {
    kind: 'faucet',
    faucetUrl: 'https://sepoliafaucet.com',
  },
}

export function getFundingStrategy(chainId: number): FundingStrategy {
  return FUNDING_STRATEGY_BY_CHAIN[chainId] ?? { kind: 'none' }
}

export function pollWindowMs(
  strategy: FundingStrategy,
  provider: FundingProvider
): number {
  if (strategy.kind !== 'onramp') return 0
  return strategy.pollWindowByProvider[provider]
}
