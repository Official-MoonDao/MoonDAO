import { hatIdDecimalToHex } from '@hatsprotocol/sdk-v1-core'
import { useEffect, useState } from 'react'
import { readContract } from 'thirdweb'
import { Contract, TeamManagerCheckResult, UserTeam } from './types'

export function useTeamManagerCheck(
  teamContract: Contract | undefined,
  userTeams: UserTeam[] | undefined,
  address: string | undefined,
  userTeamsLoading: boolean
): TeamManagerCheckResult {
  const [userTeamsAsManager, setUserTeamsAsManager] = useState<UserTeam[]>()
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    async function getUserTeamsAsManager() {
      if (!userTeams || !teamContract) return
      setIsLoading(true)
      setUserTeamsAsManager(undefined)

      const teamChecks = await Promise.all(
        userTeams.map(async (hat: UserTeam) => {
          if (!hat?.teamId || !hat.hats?.[0]?.id) return { hat, isManager: false }

          const managerHatId: any = await readContract({
            contract: teamContract,
            method: 'teamManagerHat' as string,
            params: [hat.teamId],
          })

          const isManager = hatIdDecimalToHex(managerHatId) === hat.hats?.[0].id

          return { hat, isManager }
        })
      )

      const teamsAsManager = teamChecks.filter(({ isManager }) => isManager).map(({ hat }) => hat)

      setUserTeamsAsManager(teamsAsManager)
      setIsLoading(false)
    }
    if (teamContract && userTeams && address && !userTeamsLoading) {
      getUserTeamsAsManager()
    } else {
      setUserTeamsAsManager(undefined)
      setIsLoading(true)
    }
  }, [teamContract, userTeams, address, userTeamsLoading])

  return { userTeamsAsManager: userTeamsAsManager || [], isLoading }
}
