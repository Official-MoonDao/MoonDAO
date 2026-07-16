import { TEAM_ROLE_REGISTRY_ADDRESSES } from 'const/config'
import { useEffect, useState } from 'react'
import { getContract, readContract } from 'thirdweb'
import TeamRoleRegistryABI from 'const/abis/TeamRoleRegistry.json'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { REGISTRY_ROLE } from '@/lib/team/useTeamRoleRegistry'
import { UserTeam } from './types'

/**
 * Returns the teams (including projects, which are teams under the hood) that the
 * connected address manages according to the on-chain role registry. This complements
 * the hats-subgraph discovery used for legacy teams, so launchpad access and the mission
 * team selector work for registry-based teams and projects.
 */
export function useRegistryManagerTeams(
  teamContract: any,
  address: string | undefined
) {
  const [userTeamsAsManager, setUserTeamsAsManager] = useState<UserTeam[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    let active = true
    async function load() {
      if (!teamContract?.chain || !address) {
        setUserTeamsAsManager([])
        return
      }
      const chainSlug = getChainSlug(teamContract.chain)
      const registryAddress = TEAM_ROLE_REGISTRY_ADDRESSES[chainSlug]
      if (!registryAddress) {
        setUserTeamsAsManager([])
        return
      }
      setIsLoading(true)
      try {
        const registryContract = getContract({
          client: teamContract.client,
          address: registryAddress,
          abi: TeamRoleRegistryABI as any,
          chain: teamContract.chain,
        })
        const teamIds: any = await readContract({
          contract: registryContract,
          method: 'getTeamsForAccount' as string,
          params: [address],
        })
        const managerTeams = await Promise.all(
          (teamIds || []).map(async (teamId: bigint) => {
            const role: any = await readContract({
              contract: registryContract,
              method: 'getRole' as string,
              params: [teamId, address],
            })
            return Number(role) >= REGISTRY_ROLE.MANAGER
              ? ({ teamId: String(teamId), hats: [] } as UserTeam)
              : null
          })
        )
        if (active) {
          setUserTeamsAsManager(managerTeams.filter(Boolean) as UserTeam[])
        }
      } catch (err) {
        console.error('Failed to load registry manager teams:', err)
        if (active) setUserTeamsAsManager([])
      } finally {
        if (active) setIsLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [teamContract, address])

  return { userTeamsAsManager, isLoading }
}
