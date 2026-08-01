import { TEAM_ROLE_REGISTRY_ADDRESSES } from 'const/config'
import { useEffect, useMemo, useState } from 'react'
import { getContract, readContract } from 'thirdweb'
import TeamRoleRegistryABI from 'const/abis/TeamRoleRegistry.json'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { REGISTRY_ROLE } from '@/lib/team/useTeamRoleRegistry'
import { UserTeam } from './types'

function normalizeAddresses(input: string | string[] | null | undefined): string[] {
  if (input == null || input === '') return []
  const list = Array.isArray(input) ? input : [input]
  const out = new Set<string>()
  for (const a of list) {
    if (a && typeof a === 'string' && /^0x[a-fA-F0-9]{40}$/i.test(a.trim())) {
      out.add(a.trim().toLowerCase())
    }
  }
  return Array.from(out)
}

/**
 * Returns the teams (including projects, which are teams under the hood) that the
 * connected address manages according to the on-chain role registry. This complements
 * the hats-subgraph discovery used for legacy teams, so launchpad access and the mission
 * team selector work for registry-based teams and projects.
 *
 * Accepts the active wallet and/or all Privy-linked EVM addresses, matching the
 * wearerAddresses pattern used by hat-based discovery.
 */
export function useRegistryManagerTeams(
  teamContract: any,
  addressOrAddresses: string | string[] | null | undefined,
) {
  const [userTeamsAsManager, setUserTeamsAsManager] = useState<UserTeam[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const addresses = useMemo(() => normalizeAddresses(addressOrAddresses), [addressOrAddresses])
  const addressKey = addresses.slice().sort().join(',')

  useEffect(() => {
    let active = true
    async function load() {
      if (!teamContract?.chain || addresses.length === 0) {
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
      setUserTeamsAsManager([])
      try {
        const registryContract = getContract({
          client: teamContract.client,
          address: registryAddress,
          abi: TeamRoleRegistryABI as any,
          chain: teamContract.chain,
        })
        const perAddress = await Promise.all(
          addresses.map(async (address) => {
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
              }),
            )
            return managerTeams.filter(Boolean) as UserTeam[]
          }),
        )
        if (active) {
          const byId = new Map<string, UserTeam>()
          for (const team of perAddress.flat()) {
            byId.set(team.teamId, team)
          }
          setUserTeamsAsManager(Array.from(byId.values()))
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
    // addressKey is the stable dep for the normalized address list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamContract, addressKey])

  return { userTeamsAsManager, isLoading }
}
