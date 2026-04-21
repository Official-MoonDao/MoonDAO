import VMOONEY_ABI from 'const/abis/VotingEscrow.json'
import { VMOONEY_ADDRESSES } from 'const/config'
import useSWR from 'swr'
import { readContract } from 'thirdweb'
import { arbitrum, ethereum, polygon, base } from '@/lib/rpc/chains'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { votingEscrowContracts } from '../votingEscrowContracts'
import { LockedBreakdown } from './useTotalLockedMooney'

async function fetchTotalVMOONEYForAddress(address: string): Promise<number> {
  const chains = Object.keys(votingEscrowContracts) as string[]
  if (chains.length === 0) return 0

  const results = await Promise.allSettled(
    chains.map(async (chain) => {
      const contract = votingEscrowContracts[chain]
      if (!contract) return 0

      const balance = await readContract({
        contract,
        method: 'balanceOf' as any,
        params: [address],
      })

      return Number(balance?.toString() || 0) / 10 ** 18
    })
  )

  return results.reduce((sum, result) => {
    if (result.status === 'fulfilled') {
      return sum + result.value
    }
    return sum
  }, 0)
}

/**
 * Fetches total vMOONEY balance across ALL chains - identical to fetchTotalVMOONEYs
 * used for project voting. Uses SWR for consistent cached data across components.
 */
const SWR_CONFIG = {
  revalidateOnFocus: true,
  dedupingInterval: 10000,
  errorRetryCount: 3,
  revalidateOnReconnect: true,
}

export function useTotalVMOONEY(
  address: string | undefined,
  _breakdown?: LockedBreakdown[] // No longer used - fetches from all chains like project voting
): {
  totalVMOONEY: number
  isLoading: boolean
} {
  const { data: totalVMOONEY = 0, isLoading } = useSWR(
    address ? `vmooney-total-${address.toLowerCase()}` : null,
    () => fetchTotalVMOONEYForAddress(address!),
    SWR_CONFIG
  )

  return {
    totalVMOONEY,
    isLoading,
  }
}

// Retry an async fn up to `attempts` times with exponential backoff. Used to
// make per-chain vMOONEY reads resilient to transient RPC blips so we don't
// silently undercount voting power when a single chain hiccups.
async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  baseDelayMs = 250
): Promise<T> {
  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (i < attempts - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, baseDelayMs * Math.pow(2, i))
        )
      }
    }
  }
  throw lastError
}

export async function fetchTotalVMOONEYs(addresses: string[], timestamp: number) {
  try {
    const { engineBatchRead } = await import('@/lib/thirdweb/engine')
    const chains = [arbitrum, ethereum, base, polygon]

    // Fail loudly if any chain ultimately can't be read (after retries) so
    // callers (the API route, the vote-tally code) get a hard error and can
    // decide whether to retry, rather than silently returning a lower vMOONEY
    // total. Previously a single transient RPC failure on one chain would
    // quietly drop that chain's balance from the sum, which produced
    // intermittently-wrong voting power both in the UI and at tally time.
    const results = await Promise.all(
      chains.map(async (chain) => {
        const chainSlug = getChainSlug(chain)
        const chainId = chain.id
        const tokenAddress = VMOONEY_ADDRESSES[chainSlug]

        if (!process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_SECRET) {
          return addresses.map(() => 0)
        }

        const balances = await withRetry(() =>
          engineBatchRead<string>(
            tokenAddress,
            'balanceOf',
            addresses.map((address) => (timestamp ? [address, timestamp] : [address])),
            VMOONEY_ABI,
            chainId
          )
        )

        return balances.map((balance) => {
          const parsed = parseInt(balance)
          return isNaN(parsed) ? 0 : parsed / 1e18
        })
      })
    )

    // Sum across chains. Initialize each address slot to 0 so an empty
    // result (e.g. missing thirdweb secret on a chain) doesn't drop the
    // address out of the totals array.
    const totals: number[] = addresses.map(() => 0)
    results.forEach((chainBalances) => {
      chainBalances.forEach((value: number, i: number) => {
        const numValue = isNaN(value) ? 0 : value
        totals[i] = (totals[i] || 0) + numValue
      })
    })

    return totals
  } catch (error) {
    console.error('Failed to fetch vMOONEY balances:', error)
    throw error
  }
}
