import { useEffect, useState } from 'react'
import { readContract } from 'thirdweb'
import { votingEscrowContracts } from '../votingEscrowContracts'

export type LockedBreakdown = {
  chain: string
  amount: number
  unlockDate: Date | null
}

type LockedState = {
  totalLocked: number
  breakdown: LockedBreakdown[]
  nextUnlockDate: Date | null
}

const initialState: LockedState = {
  totalLocked: 0,
  breakdown: [],
  nextUnlockDate: null,
}

export function useTotalLockedMooney(address: string | undefined) {
  const [state, setState] = useState<LockedState>(initialState)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    if (!address) {
      setState({ ...initialState })
      setIsLoading(false)
      return
    }

    async function fetchLockedBalances() {
      setIsLoading(true)

      try {
        const entries = Object.entries(votingEscrowContracts)

        if (entries.length === 0) {
          if (!cancelled) {
            setState({ ...initialState })
          }
          return
        }

        const results = await Promise.allSettled(
          entries.map(async ([chain, contract]) => {
            const lockedValue = await readContract({
              contract,
              method: 'locked' as any,
              params: [address],
            })

            return { chain, lockedValue }
          })
        )

        if (cancelled) {
          return
        }

        const breakdown: LockedBreakdown[] = results.map((result, index) => {
          const chain = entries[index][0]

          if (result.status !== 'fulfilled') {
            return {
              chain,
              amount: 0,
              unlockDate: null,
            }
          }

          const lockedValue = result.value.lockedValue
          const amount = Array.isArray(lockedValue)
            ? Number(lockedValue[0]?.toString() || 0) / 10 ** 18
            : Number(lockedValue?.amount?.toString() || 0) / 10 ** 18

          const rawEnd = Array.isArray(lockedValue)
            ? lockedValue[1]
            : lockedValue?.end
          const unlockDate =
            rawEnd && Number(rawEnd.toString()) > 0
              ? new Date(Number(rawEnd.toString()) * 1000)
              : null

          return {
            chain,
            amount,
            unlockDate,
          }
        })

        const totalLocked = breakdown.reduce(
          (sum, item) => sum + (item.amount || 0),
          0
        )

        const nextUnlockDate =
          breakdown
            .filter((item) => item.amount > 0 && item.unlockDate)
            .sort(
              (a, b) =>
                (a.unlockDate?.getTime() || 0) - (b.unlockDate?.getTime() || 0)
            )[0]?.unlockDate || null

        setState({ totalLocked, breakdown, nextUnlockDate })
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load locked MOONEY balances:', error)
          setState({ ...initialState })
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    fetchLockedBalances()

    return () => {
      cancelled = true
    }
  }, [address])

  return {
    totalLockedMooney: state.totalLocked,
    breakdown: state.breakdown,
    nextUnlockDate: state.nextUnlockDate,
    isLoading,
  }
}
