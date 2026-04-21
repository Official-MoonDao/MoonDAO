import useSWR from 'swr'

/**
 * Returns voting power calculated the same way as project votes:
 * sqrt(total vMOONEY balance across all chains).
 *
 * Both the single-address (`useTotalVP`) and batch (`useTotalVPs`) hooks
 * delegate to the `/api/voting-power` route, which calls
 * `fetchTotalVMOONEYs` server-side via Thirdweb's engine batch reads. This
 * is the **same** code path used by:
 *   - ui/pages/api/proposals/vote.ts
 *   - ui/pages/api/proposals/nonProjectVote.ts
 *   - ui/pages/project/[tokenId].tsx
 * so what users see in the UI matches what gets counted at tally time.
 *
 * The previous implementation called `balanceOf` directly from the browser
 * across four chains in parallel and silently treated any failed RPC as a
 * zero (via `Promise.allSettled` + summing only fulfilled results). That
 * produced intermittently-undercounted voting power that varied between
 * page loads depending on which public RPC happened to time out.
 */
const SWR_CONFIG = {
  revalidateOnFocus: true,
  dedupingInterval: 10000,
  errorRetryCount: 3,
  errorRetryInterval: 2000,
  revalidateOnReconnect: true,
  shouldRetryOnError: true,
}

async function fetchVotingPowers(addressesKey: string): Promise<number[]> {
  const res = await fetch(
    `/api/voting-power?addresses=${encodeURIComponent(addressesKey)}`
  )
  if (!res.ok) throw new Error('Failed to fetch voting power')
  const { votingPowers } = await res.json()
  return (votingPowers as number[]) ?? []
}

export function useTotalVP(address: string) {
  const shouldFetch = !!address
  const { data, error, isLoading } = useSWR(
    shouldFetch ? `vp-api-${address.toLowerCase()}` : null,
    async () => {
      const powers = await fetchVotingPowers(address)
      return powers[0]
    },
    SWR_CONFIG
  )

  return {
    walletVP: data,
    isLoading: shouldFetch && isLoading,
    isError: !!error,
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
    () => fetchVotingPowers(addressesKey),
    SWR_CONFIG
  )

  return {
    walletVPs: data || [],
    isLoading: !error && !data && shouldFetch,
    isError: !!error,
  }
}
