import { TEAM_ROLE_REGISTRY_ADDRESSES } from 'const/config'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getContract, readContract } from 'thirdweb'
import TeamRoleRegistryABI from 'const/abis/TeamRoleRegistry.json'
import { getChainSlug } from '@/lib/thirdweb/chain'

export const REGISTRY_ROLE = {
  NONE: 0,
  MEMBER: 1,
  MANAGER: 2,
} as const

export type RegistryMember = {
  address: string
  role: number
}

/**
 * Reads role data from the on-chain TeamRoleRegistry for a given team.
 *
 * Teams created through the V2 (hats-free) creators are `registryBased` and resolve
 * their membership entirely from the registry. Legacy teams return `registryBased=false`,
 * in which case callers should keep using the hats-based membership UI.
 */
export default function useTeamRoleRegistry(teamContract: any, teamId: string | number) {
  const [registryContract, setRegistryContract] = useState<any>(null)
  const [registryBased, setRegistryBased] = useState<boolean>(false)
  const [members, setMembers] = useState<RegistryMember[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [refreshKey, setRefreshKey] = useState<number>(0)

  useEffect(() => {
    if (!teamContract?.chain) return
    try {
      const chainSlug = getChainSlug(teamContract.chain)
      const registryAddress = TEAM_ROLE_REGISTRY_ADDRESSES[chainSlug]
      if (!registryAddress) {
        setRegistryContract(null)
        return
      }
      setRegistryContract(
        getContract({
          client: teamContract.client,
          address: registryAddress,
          abi: TeamRoleRegistryABI as any,
          chain: teamContract.chain,
        })
      )
    } catch (err) {
      console.error('Failed to build role registry contract:', err)
      setRegistryContract(null)
    }
  }, [teamContract])

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  useEffect(() => {
    let active = true
    async function load() {
      if (!registryContract || teamId == null || teamId === '') return
      setIsLoading(true)
      try {
        const based: any = await readContract({
          contract: registryContract,
          method: 'registryBased' as string,
          params: [teamId],
        })
        if (!active) return
        setRegistryBased(!!based)
        if (!based) {
          setMembers([])
          return
        }
        const addresses: any = await readContract({
          contract: registryContract,
          method: 'getMembers' as string,
          params: [teamId],
        })
        const withRoles = await Promise.all(
          (addresses || []).map(async (address: string) => {
            const role: any = await readContract({
              contract: registryContract,
              method: 'getRole' as string,
              params: [teamId, address],
            })
            return { address, role: Number(role) }
          })
        )
        if (active) setMembers(withRoles)
      } catch (err) {
        console.error('Failed to load registry roles:', err)
        // Leave registryBased and members unchanged. Resetting registryBased
        // to false would make a registry team appear as a legacy hats team and
        // blank the roster on transient RPC failures.
      } finally {
        if (active) setIsLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [registryContract, teamId, refreshKey])

  const managers = useMemo(
    () => members.filter((m) => m.role >= REGISTRY_ROLE.MANAGER),
    [members]
  )

  return { registryContract, registryBased, members, managers, isLoading, refresh }
}
