import { useEffect, useState } from 'react'
import { readContract } from 'thirdweb'
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
