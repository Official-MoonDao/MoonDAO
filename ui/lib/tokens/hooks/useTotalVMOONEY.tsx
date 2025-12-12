import VMOONEY_ABI from 'const/abis/VotingEscrow.json'
import { VMOONEY_ADDRESSES } from 'const/config'
import { useEffect, useState } from 'react'
import { readContract } from 'thirdweb'
import { arbitrum, ethereum, polygon, base } from '@/lib/rpc/chains'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { votingEscrowContracts } from '../votingEscrowContracts'
import { LockedBreakdown } from './useTotalLockedMooney'

export function useTotalVMOONEY(
  address: string | undefined,
  breakdown: LockedBreakdown[]
): {
  totalVMOONEY: number
  isLoading: boolean
} {
  const [totalVMOONEY, setTotalVMOONEY] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    if (!address || !breakdown || breakdown.length === 0) {
      setTotalVMOONEY(0)
      setIsLoading(false)
      return
    }

    async function fetchTotalVMOONEY() {
      setIsLoading(true)

      try {
        const chainsWithLocks = breakdown.filter((item) => item.amount > 0)

        if (chainsWithLocks.length === 0) {
          if (!cancelled) {
            setTotalVMOONEY(0)
            setIsLoading(false)
          }
          return
        }

        const results = await Promise.allSettled(
          chainsWithLocks.map(async ({ chain }) => {
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

        if (cancelled) {
          return
        }

        const total = results.reduce((sum, result) => {
          if (result.status === 'fulfilled') {
            return sum + result.value
          }
          return sum
        }, 0)

        if (!cancelled) {
          setTotalVMOONEY(total)
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to fetch vMOONEY balances:', error)
          setTotalVMOONEY(0)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    fetchTotalVMOONEY()

    return () => {
      cancelled = true
    }
  }, [address, breakdown])

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
          // Use helper for cleaner code
          const balances = await engineBatchRead<string>(
            tokenAddress,
            'balanceOf',
            addresses.map((address) => (timestamp ? [address, timestamp] : [address])),
            VMOONEY_ABI,
            chainId
          )

          return balances.map((balance) => parseInt(balance) / 1e18)
        } catch (error) {
          console.error(`Failed to fetch vMOONEY balances for chain ${chainId}:`, error)
          return []
        }
      })
    )

    // Sum across chains
    const totals = results.reduce((accumulator, value) => {
      value.forEach((v: any, i: number) => {
        accumulator[i] = (accumulator[i] || 0) + (value[i] as number)
      })
      return accumulator
    }, [] as number[])

    return totals
  } catch (error) {
    console.error('Failed to fetch vMOONEY balances:', error)
    return []
  }
}
