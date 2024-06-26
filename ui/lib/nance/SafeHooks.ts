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

function basicFetcher(): Fetcher<any, string> {
  return async (url) => {
    const res = await fetch(url)
    const json = await res.json()

    return json
  }
}

export function useSafeBalances(address: string, shouldFetch: boolean = true) {
  const api = `https://safe-transaction-mainnet.safe.global`
  return useSWR<SafeBalanceUsdResponse[], Error>(
    shouldFetch
      ? `${api}/api/v1/safes/${address}/balances?trusted=true&exclude_spam=true`
      : null,
    basicFetcher(),
    { shouldRetryOnError: false }
  )
}
