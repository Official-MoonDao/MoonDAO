import XPManagerABI from 'const/abis/XPManager.json'
import { XP_MANAGER_ADDRESSES, DEFAULT_CHAIN_V5 } from 'const/config'
import { getAccessToken } from '@privy-io/react-auth'
import { useEffect, useState } from 'react'
import { readContract, getContract } from 'thirdweb'
import client from '@/lib/thirdweb/client'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { XP_VERIFIERS } from './config'

/**
 * Returns the number of XP quests the user is eligible to claim but hasn't yet.
 * Checks both on-chain claim status (verifierId) and the quest's backend API.
 * Returns null while still loading.
 */
export function useClaimableQuestsCount(userAddress?: string): number | null {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    if (!userAddress) {
      setCount(null)
      return
    }

    let cancelled = false

    async function check() {
      const chainSlug = getChainSlug(DEFAULT_CHAIN_V5)
      const xpManagerContract = getContract({
        client,
        chain: DEFAULT_CHAIN_V5,
        address: XP_MANAGER_ADDRESSES[chainSlug],
        abi: XPManagerABI as any,
      })

      // Get access token once for all API calls
      let accessToken: string | null = null
      try {
        accessToken = await getAccessToken()
      } catch {
        // Not authenticated — skip
      }

      const checks = await Promise.allSettled(
        XP_VERIFIERS.map(async (v) => {
          // 1. Check on-chain: has the user already claimed this verifier?
          let claimed = false
          try {
            claimed = Boolean(await readContract({
              contract: xpManagerContract,
              method: 'hasClaimedFromVerifier' as string,
              params: [userAddress, BigInt(v.verifierId)],
            }))
          } catch {
            return false
          }
          if (claimed) return false

          // 2. Check eligibility via the quest's backend API
          if (!v.route || !v.metricKey || !accessToken) return false

          try {
            const res = await fetch(
              `${v.route}?user=${userAddress}&accessToken=${accessToken}`
            )
            if (!res.ok) return false
            const data = await res.json()
            if (data.error) return false

            const metric = data[v.metricKey]
            return (
              typeof metric === 'boolean' ? metric :
              typeof metric === 'number'  ? metric > 0 :
              typeof metric === 'string'  ? parseInt(metric) > 0 :
              false
            )
          } catch {
            return false
          }
        })
      )

      if (cancelled) return

      const claimable = checks.filter(
        (r) => r.status === 'fulfilled' && r.value === true
      ).length

      setCount(claimable)
    }

    check()
    return () => {
      cancelled = true
    }
  }, [userAddress])

  return count
}
