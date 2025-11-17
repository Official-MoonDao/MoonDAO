import { useEffect, useState } from 'react'
import VMOONEY_ABI from 'const/abis/VotingEscrow.json'
import { arbitrum, ethereum, polygon, base } from '@/lib/rpc/chains'
import { readContract } from 'thirdweb'
import { VMOONEY_ADDRESSES, ZERO_ADDRESS } from 'const/config'
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

export function useTotalVMOONEYs(addresses: string[] | undefined): {
  totalVMOONEYs: number
  isLoading: boolean
} {
  const [totalVMOONEYs, setTotalVMOONEYs] = useState<number[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    if (!addresses) {
      setTotalVMOONEYs([])
      setIsLoading(false)
      return
    }

    async function fetchVMOONEYs() {
      setIsLoading(true)
      const totals = await fetchTotalVMOONEYs(addresses)
      setTotalVMOONEYs(totals)
      setIsLoading(false)
    }
    fetchVMOONEYs()

    return () => {
      cancelled = true
    }
  }, [])

  return {
    totalVMOONEYs,
    isLoading,
  }
}

export async function fetchTotalVMOONEYs(
  addresses: string[],
  timestamp: number
) {
  try {
    const chains = [arbitrum, ethereum, base, polygon]
    const results = await Promise.allSettled(
      chains.map(async (chain) => {
        const chainSlug = getChainSlug(chain)
        const chainId = chain.id
        const tokenAddress = VMOONEY_ADDRESSES[chainSlug]
        const url = 'https://engine.thirdweb.com/v1/read/contract'
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-secret-key': process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_SECRET,
          },
          body: JSON.stringify({
            readOptions: {
              chainId: chainId,
              multicall: true,
              from: ZERO_ADDRESS,
            },
            params: addresses.map((address) => {
              return {
                contractAddress: tokenAddress,
                method: 'balanceOf',
                params: timestamp ? [address, timestamp] : [address],
                abi: VMOONEY_ABI,
              }
            }),
          }),
        })
        const jsonResponse = await response.json()
        return jsonResponse.result
      })
    )
    const values = results.map((r) => r.value.map((v) => parseInt(v.result)))

    const totals = values.reduce((accumulator, value) => {
      value.forEach((v, i) => {
        accumulator[i] = (accumulator[i] || 0) + value[i]
      })
      return accumulator
    })
    return totals
  } catch (error) {
    console.error('Failed to fetch vMOONEY balances:', error)
    return []
  }
}
