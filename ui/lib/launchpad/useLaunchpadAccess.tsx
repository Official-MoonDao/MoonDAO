import { useContext } from 'react'
import { LAUNCHPAD_WHITELISTED_CITIZENS } from 'const/missions'
import CitizenContext from '@/lib/citizen/citizen-context'
import { LaunchpadAccessResult, UserTeam } from './types'

export function useLaunchpadAccess(
  userTeamsAsManager: UserTeam[] | undefined,
  userTeamsAsManagerLoading: boolean
): LaunchpadAccessResult {
  const { citizen } = useContext(CitizenContext)
  
  const citizenHasAccess =
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet'
      ? LAUNCHPAD_WHITELISTED_CITIZENS.includes(citizen?.id)
      : true

  const hasAccess = (userTeamsAsManager && userTeamsAsManager.length > 0) || citizenHasAccess
  const requiresLogin = !citizen && process.env.NEXT_PUBLIC_CHAIN === 'mainnet'

  return {
    hasAccess: hasAccess || false,
    isLoading: userTeamsAsManagerLoading,
    requiresLogin,
  }
}

