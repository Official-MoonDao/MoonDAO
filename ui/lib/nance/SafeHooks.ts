import useSWR, { Fetcher } from 'swr'

export interface SafeBalanceUsdResponse {
  tokenAddress: string | null
  token: {
    name: string
    symbol: string
    decimals: number
    logoUri: string
  } | null
  balance: string
}

export interface SafeBalanceUsdResponse {
  tokenAddress: string | null
  token: {
    name: string
    symbol: string
    decimals: number
    logoUri: string
  } | null
  balance: string
  ethValue: string
  timestamp: string
  fiatBalance: string
  fiatConversion: string
  fiatCode: string
}

const SAFE_CHAIN_IDS: Record<string, number> = {
  mainnet: 1,
  optimism: 10,
  polygon: 137,
  base: 8453,
  arbitrum: 42161,
  'base-sepolia': 84532,
  sepolia: 11155111,
}

function basicFetcher(): Fetcher<any, string> {
  return async (url) => {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Safe balances request failed: ${res.status}`)
    return res.json()
  }
}

export function useSafeBalances(
  address: string,
  shouldFetch: boolean = true,
  chainSlug: string = 'mainnet',
  refreshInterval?: number // in milliseconds
) {
  const chainId = SAFE_CHAIN_IDS[chainSlug]

  return useSWR<SafeBalanceUsdResponse[], Error>(
    shouldFetch && chainId ? `/api/safe/${chainId}/v1/safes/${address}/balances` : null,
    basicFetcher(),
    { shouldRetryOnError: false, refreshInterval, revalidateOnFocus: false }
  )
}
