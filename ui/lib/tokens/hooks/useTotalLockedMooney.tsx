import useSWR from 'swr'
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

async function fetchLockedBalances(address: string): Promise<LockedState> {
  const entries = Object.entries(votingEscrowContracts)

  if (entries.length === 0) {
    return { totalLocked: 0, breakdown: [], nextUnlockDate: null }
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

  const breakdown: LockedBreakdown[] = results.map((result, index) => {
    const chain = entries[index][0]

    if (result.status !== 'fulfilled') {
      return { chain, amount: 0, unlockDate: null }
    }

    const lockedValue = result.value.lockedValue
    const amount = Array.isArray(lockedValue)
      ? Number(lockedValue[0]?.toString() || 0) / 10 ** 18
      : Number(lockedValue?.amount?.toString() || 0) / 10 ** 18

    const rawEnd = Array.isArray(lockedValue) ? lockedValue[1] : lockedValue?.end
    const unlockDate =
      rawEnd && Number(rawEnd.toString()) > 0
        ? new Date(Number(rawEnd.toString()) * 1000)
        : null

    return { chain, amount, unlockDate }
  })

  const totalLocked = breakdown.reduce((sum, item) => sum + (item.amount || 0), 0)

  const nextUnlockDate =
    breakdown
      .filter((item) => item.amount > 0 && item.unlockDate)
      .sort(
        (a, b) =>
          (a.unlockDate?.getTime() || 0) - (b.unlockDate?.getTime() || 0)
      )[0]?.unlockDate || null

  return { totalLocked, breakdown, nextUnlockDate }
}

/**
 * Fetches locked MOONEY from voting escrow across all chains.
 * Uses SWR for consistent cached data across components.
 */
const SWR_CONFIG = {
  revalidateOnFocus: true,
  dedupingInterval: 10000,
  errorRetryCount: 3,
  revalidateOnReconnect: true,
}

export function useTotalLockedMooney(address: string | undefined) {
  const { data, isLoading } = useSWR(
    address ? `locked-mooney-${address.toLowerCase()}` : null,
    () => fetchLockedBalances(address!),
    SWR_CONFIG
  )

  return {
    totalLockedMooney: data?.totalLocked ?? 0,
    breakdown: data?.breakdown ?? [],
    nextUnlockDate: data?.nextUnlockDate ?? null,
    isLoading: isLoading,
  }
}
