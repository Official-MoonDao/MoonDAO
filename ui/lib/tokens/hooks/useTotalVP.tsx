import useSWR from 'swr'
import { useTotalVMOONEY } from './useTotalVMOONEY'

/**
 * Returns voting power calculated the same way as project votes:
 * sqrt(total vMOONEY balance across all chains)
 *
 * This matches the calculation in:
 * - ui/pages/api/proposals/vote.ts (fetchTotalVMOONEYs + Math.sqrt)
 * - ui/pages/api/proposals/nonProjectVote.ts
 * - ui/pages/project/[tokenId].tsx
 */
export function useTotalVP(address: string) {
  const { totalVMOONEY, isLoading: isLoadingVMOONEY } = useTotalVMOONEY(
    address || undefined
  )

  const isLoading = isLoadingVMOONEY
  const walletVP =
    !isLoading && totalVMOONEY !== undefined
      ? Math.sqrt(totalVMOONEY || 0)
      : undefined

  return {
    walletVP,
    isLoading,
    isError: false,
  }
}

/**
 * Batch fetch voting power for multiple addresses.
 * Uses same calculation as project votes: sqrt(vMOONEY) via API route.
 */
export function useTotalVPs(addresses: string[]) {

  const shouldFetch = addresses && addresses.length > 0
  const addressesKey = addresses.join(',')

  const { data, error } = useSWR(
    shouldFetch ? `vps-api-${addressesKey}` : null,
    async () => {
      const res = await fetch(
        `/api/voting-power?addresses=${encodeURIComponent(addressesKey)}`
      )
      if (!res.ok) throw new Error('Failed to fetch voting power')
      const { votingPowers } = await res.json()
      return votingPowers as number[]
    }
  )

  return {
    walletVPs: data || [],
    isLoading: !error && !data && shouldFetch,
    isError: !!error,
  }
}
