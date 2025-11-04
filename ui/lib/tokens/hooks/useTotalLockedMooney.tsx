import { BigNumber } from 'ethers'
import { useEffect, useState } from 'react'
import { getContract, readContract } from 'thirdweb'
import { arbitrum, base, ethereum, polygon } from '@/lib/rpc/chains'
import client from '@/lib/thirdweb/client'
import { formatUnits } from 'ethers/lib/utils'
import VotingEscrow from '../../../const/abis/VotingEscrow.json'
import { MOONEY_DECIMALS, VMOONEY_ADDRESSES } from '../../../const/config'

type LockedBreakdown = {
  chain: string
  amount: number
  unlockDate: Date | null
}

type LockedState = {
  totalLocked: number
  breakdown: LockedBreakdown[]
  nextUnlockDate: Date | null
}

const chainConfigs = [
  { key: 'ethereum', chain: ethereum },
  { key: 'polygon', chain: polygon },
  { key: 'arbitrum', chain: arbitrum },
  { key: 'base', chain: base },
]

const votingEscrowContracts = chainConfigs.reduce<Record<string, any>>(
  (acc, { key, chain }) => {
    const address = VMOONEY_ADDRESSES[key]
    if (!address) {
      return acc
    }

    acc[key] = getContract({
      client,
      address,
      chain,
      abi: VotingEscrow as any,
    })

    return acc
  },
  {}
)

const initialState: LockedState = {
  totalLocked: 0,
  breakdown: [],
  nextUnlockDate: null,
}

function toBigNumber(value: any): BigNumber {
  if (value === null || value === undefined) {
    return BigNumber.from(0)
  }

  if (BigNumber.isBigNumber(value)) {
    return value
  }

  if (typeof value === 'bigint') {
    return BigNumber.from(value.toString())
  }

  if (typeof value === 'number') {
    return BigNumber.from(Math.trunc(value))
  }

  if (typeof value === 'string') {
    return BigNumber.from(value)
  }

  if (typeof value === 'object' && '_hex' in value) {
    return BigNumber.from((value as { _hex: string })._hex)
  }

  return BigNumber.from(0)
}

function extractLockedAmount(lockedValue: any): number {
  const rawAmount = Array.isArray(lockedValue)
    ? lockedValue[0]
    : lockedValue?.amount

  if (rawAmount === null || rawAmount === undefined) {
    return 0
  }

  try {
    const amountBn = toBigNumber(rawAmount)
    const formatted = formatUnits(amountBn, MOONEY_DECIMALS)
    return parseFloat(formatted)
  } catch (error) {
    console.error('Failed to parse locked MOONEY amount:', error)
    return 0
  }
}

function extractUnlockDate(lockedValue: any): Date | null {
  const rawEnd = Array.isArray(lockedValue) ? lockedValue[1] : lockedValue?.end

  if (rawEnd === null || rawEnd === undefined) {
    return null
  }

  try {
    const timestamp = BigNumber.isBigNumber(rawEnd)
      ? rawEnd.toNumber()
      : typeof rawEnd === 'bigint'
      ? Number(rawEnd)
      : typeof rawEnd === 'string'
      ? Number(rawEnd)
      : typeof rawEnd === 'number'
      ? rawEnd
      : toBigNumber(rawEnd).toNumber()

    if (!timestamp || Number.isNaN(timestamp)) {
      return null
    }

    return new Date(timestamp * 1000)
  } catch (error) {
    console.error('Failed to parse locked MOONEY unlock date:', error)
    return null
  }
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

          const { lockedValue } = result.value
          const amount = extractLockedAmount(lockedValue)
          const unlockDate = extractUnlockDate(lockedValue)

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
