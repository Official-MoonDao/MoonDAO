/**
 * Team Data Service Wrapper
 * Provides environment-aware team data fetching
 */
import { arbitrum } from '@/lib/rpc/chains'
import {
  fetchTeamsWithOwners,
  getDummyTeamData,
  fetchTeamWithOwner,
} from '@/lib/team/teamDataService'

export async function getTeamsWithOwners(limit?: number) {
  try {
    if (process.env.NEXT_PUBLIC_ENV === 'prod' || process.env.NEXT_PUBLIC_TEST_ENV === 'true') {
      return await fetchTeamsWithOwners(arbitrum, { limit })
    } else {
      return getDummyTeamData()
    }
  } catch (error) {
    console.error('Error getting teams with owners:', error)
    return []
  }
}

export async function getTeamWithOwner(teamId: string | number) {
  try {
    if (process.env.NEXT_PUBLIC_ENV === 'prod' || process.env.NEXT_PUBLIC_TEST_ENV === 'true') {
      return await fetchTeamWithOwner(arbitrum, teamId)
    } else {
      const dummyData = getDummyTeamData()
      return dummyData.find((team: any) => team.metadata.id === teamId.toString()) || null
    }
  } catch (error) {
    console.error(`Error getting team ${teamId}:`, error)
    return null
  }
}

export {
  fetchTeamsWithOwners,
  fetchTeamWithOwner,
  getDummyTeamData,
} from '@/lib/team/teamDataService'
