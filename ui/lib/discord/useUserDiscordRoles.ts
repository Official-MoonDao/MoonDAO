import { usePrivy } from '@privy-io/react-auth'
import { useCallback, useEffect, useState } from 'react'
import { discordRoleDictionary } from '@/lib/dashboard/dashboard-utils.ts/discord-config'

interface UserDiscordRoles {
  roles: string[]
  isLoading: boolean
  error: string | null
  highestRoleColor: string
  highestRoleName: string
}

// Define role hierarchy (higher index = higher priority)
const ROLE_HIERARCHY: Record<string, number> = {
  // Core leadership roles (highest priority)
  '914973269709447238': 100, // Astronaut (Top tier leadership)
  '1133787490180939817': 90,  // Executive (Multi-sig/Executive leadership)
  
  // Governance roles
  '1075100215406764143': 80,  // Senator (Governance leadership)
  '914997939905101874': 70,   // Project Lead (Project leadership)
  
  // Project contributors
  '915011037017817149': 60,   // Project Contributor
  
  // Voting and citizenship
  '1075090331055435786': 50,  // Voter
  '1293939046774739106': 40,  // Citizen (mainnet)
  '1331745916117323849': 40,  // Citizen (testnet)
  
  // Other community roles (lower priority)
  '1096152084782522448': 30, // MoonDAOcrew
  '941227401290067998': 25,  // MoonDAO World
  '914998572859142185': 20,  // Alien
  '1046539204018045099': 15, // Member
  
  // Default for unknown roles
}

export function useUserDiscordRoles(userAddress?: string): UserDiscordRoles {
  const { getAccessToken, user } = usePrivy()
  const [roles, setRoles] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchUserRoles = useCallback(async () => {
    if (!user?.linkedAccounts) return

    const hasDiscord = user.linkedAccounts.some(
      (acc: any) => acc.type === 'discord_oauth' || acc.type === 'discord'
    )

    if (!hasDiscord) return

    setIsLoading(true)
    setError(null)

    try {
      const accessToken = await getAccessToken()
      if (!accessToken) {
        setError('No access token available')
        setRoles([])
        return
      }

      const response = await fetch(`/api/discord/user-roles?accessToken=${encodeURIComponent(accessToken)}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to fetch roles')
        setRoles([])
        return
      }

      const data = await response.json()
      setRoles(data.roles || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setRoles([])
    } finally {
      setIsLoading(false)
    }
  }, [getAccessToken, user?.linkedAccounts])

  useEffect(() => {
    fetchUserRoles()
  }, [fetchUserRoles])

  // Determine the highest priority role and its color
  const getHighestPriorityRole = useCallback(() => {
    if (roles.length === 0) {
      return {
        color: 'text-slate-400', // Default color
        name: 'Member'
      }
    }

    let highestRole = ''
    let highestPriority = -1

    roles.forEach(roleId => {
      const priority = ROLE_HIERARCHY[roleId] || 0
      if (priority > highestPriority) {
        highestPriority = priority
        highestRole = roleId
      }
    })

    const roleData = discordRoleDictionary[highestRole]
    if (roleData) {
      return {
        color: roleData[0], // Color class
        name: roleData[1]   // Role name
      }
    }

    return {
      color: 'text-slate-400',
      name: 'Member'
    }
  }, [roles])

  const { color: highestRoleColor, name: highestRoleName } = getHighestPriorityRole()

  return {
    roles,
    isLoading,
    error,
    highestRoleColor,
    highestRoleName
  }
}
