import XPManagerABI from 'const/abis/XPManager.json'
import { XP_MANAGER_ADDRESSES, XP_ORACLE_CHAIN, XP_ORACLE_CHAIN_ID } from 'const/config'
import { getAccessToken } from '@privy-io/react-auth'
import { useEffect, useState } from 'react'
import { readContract, getContract } from 'thirdweb'
import client from '@/lib/thirdweb/client'
import { getChainById } from '@/lib/thirdweb/chain'
import { XP_VERIFIERS } from './config'

/**
 * Returns the number of XP quests the user is eligible to claim but hasn't yet.
 * Checks both on-chain claim status (verifierId) and the quest's backend API.
 * Returns null while still loading (including during revalidation).
 */
export function useClaimableQuestsCount(userAddress?: string): number | null {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    if (!userAddress) {
      setCount(null)
      return
    }

    // Reset to loading state whenever we (re)validate so consumers don't
    // display a stale count for the previous address.
    setCount(null)

    let cancelled = false

    async function check() {
      // The XP Manager only lives on the oracle chain (arbitrum/sepolia).
      // Use XP_ORACLE_CHAIN_ID rather than DEFAULT_CHAIN_V5, which can resolve
      // to arbitrum-sepolia (not present in XP_MANAGER_ADDRESSES).
      const oracleChain = getChainById(Number(XP_ORACLE_CHAIN_ID))
      const managerAddress = XP_MANAGER_ADDRESSES[XP_ORACLE_CHAIN]
      if (!oracleChain || !managerAddress) {
        setCount(0)
        return
      }

      // Eligibility checks require an access token. Bail out early for
      // unauthenticated users so we don't fire a burst of contract reads.
      let accessToken: string | null = null
      try {
        accessToken = await getAccessToken()
      } catch {
        // Not authenticated
      }
      if (!accessToken) {
        if (!cancelled) setCount(0)
        return
      }

      const xpManagerContract = getContract({
        client,
        chain: oracleChain,
        address: managerAddress,
        abi: XPManagerABI as any,
      })

      const checks = await Promise.allSettled(
        XP_VERIFIERS.map(async (v) => {
          if (!v.route) return false

          // 1. Check on-chain: has the user already claimed this verifier?
          let claimed = false
          try {
            claimed = Boolean(
              await readContract({
                contract: xpManagerContract,
                method: 'hasClaimedFromVerifier' as string,
                params: [userAddress, BigInt(v.verifierId)],
              })
            )
          } catch {
            return false
          }
          if (claimed) return false

          // 2. Check eligibility via the quest's backend API. This MUST be a
          // GET: on every proof route GET only *checks* eligibility and is
          // side-effect free, whereas POST signs an oracle proof and relays an
          // on-chain XP claim transaction (`submit*ClaimFor`). This hook is a
          // passive count for a dashboard badge, so it must never use the
          // claim verb — otherwise merely loading the dashboard would
          // auto-claim every eligible quest on the user's behalf. Mirror the
          // read-only eligibility fetch in `components/xp/Quest.tsx`. The proof
          // routes return an explicit `eligible` boolean that already applies
          // the per-verifier threshold.
          try {
            const res = await fetch(
              `${v.route}?user=${userAddress}&accessToken=${accessToken}`,
              { method: 'GET' }
            )
            if (!res.ok) return false
            const data = await res.json()
            return Boolean(data.eligible)
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
