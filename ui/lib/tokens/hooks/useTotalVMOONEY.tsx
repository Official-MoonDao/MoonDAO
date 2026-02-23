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
    { revalidateOnFocus: false, dedupingInterval: 10000 }
  )

  return {
    totalVMOONEY,
    isLoading,
  }
}

export async function fetchTotalVMOONEYs(addresses: string[], timestamp: number) {
  try {
    const { engineBatchRead } = await import('@/lib/thirdweb/engine')
    const chains = [arbitrum, ethereum, base, polygon]

    const results = await Promise.all(
      chains.map(async (chain) => {
        const chainSlug = getChainSlug(chain)
        const chainId = chain.id
        const tokenAddress = VMOONEY_ADDRESSES[chainSlug]

        if (!process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_SECRET) {
          return []
        }

        try {
          const balances = await engineBatchRead<string>(
            tokenAddress,
            'balanceOf',
            addresses.map((address) => (timestamp ? [address, timestamp] : [address])),
            VMOONEY_ABI,
            chainId
          )

          return balances.map((balance) => {
            const parsed = parseInt(balance)
            return isNaN(parsed) ? 0 : parsed / 1e18
          })
        } catch (error) {
          console.error(`Failed to fetch vMOONEY balances for chain ${chainId}:`, error)
          return []
        }
      })
    )

    // Sum across chains
    const totals = results.reduce((accumulator, value) => {
      value.forEach((v: any, i: number) => {
        const numValue = isNaN(value[i] as number) ? 0 : (value[i] as number)
        accumulator[i] = (accumulator[i] || 0) + numValue
      })
      return accumulator
    }, [] as number[])

    return totals
  } catch (error) {
    console.error('Failed to fetch vMOONEY balances:', error)
    return []
  }
}
