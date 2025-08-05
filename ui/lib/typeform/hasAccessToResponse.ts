import CitizenABI from 'const/abis/Citizen.json'
import CitizenTableABI from 'const/abis/CitizenTable.json'
import TeamABI from 'const/abis/Team.json'
import TeamTableABI from 'const/abis/TeamTable.json'
import {
  CITIZEN_ADDRESSES,
  CITIZEN_TABLE_ADDRESSES,
  DEFAULT_CHAIN_V5,
  TEAM_ADDRESSES,
  TEAM_TABLE_ADDRESSES,
} from 'const/config'
import { getContract, readContract } from 'thirdweb'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'

const chainSlug = getChainSlug(DEFAULT_CHAIN_V5)

const teamContract = getContract({
  address: TEAM_ADDRESSES[chainSlug],
  abi: TeamABI as any,
  client: serverClient,
  chain: DEFAULT_CHAIN_V5,
})

const teamTableContract = getContract({
  address: TEAM_TABLE_ADDRESSES[chainSlug],
  abi: TeamTableABI as any,
  client: serverClient,
  chain: DEFAULT_CHAIN_V5,
})

const citizenContract = getContract({
  address: CITIZEN_ADDRESSES[chainSlug],
  abi: CitizenABI as any,
  client: serverClient,
  chain: DEFAULT_CHAIN_V5,
})

const citizenTableContract = getContract({
  address: CITIZEN_TABLE_ADDRESSES[chainSlug],
  abi: CitizenTableABI as any,
  client: serverClient,
  chain: DEFAULT_CHAIN_V5,
})

// Helper function to get form IDs based on type
async function getFormIdsByType(type: 'team' | 'citizen'): Promise<string[]> {
  if (type === 'team') {
    return [
      process.env.NEXT_PUBLIC_TYPEFORM_TEAM_FORM_ID as string,
      process.env.NEXT_PUBLIC_TYPEFORM_TEAM_EMAIL_FORM_ID as string,
    ].filter(Boolean)
  } else {
    return [
      process.env.NEXT_PUBLIC_TYPEFORM_CITIZEN_FORM_ID as string,
      process.env.NEXT_PUBLIC_TYPEFORM_CITIZEN_SHORT_FORM_ID as string,
      process.env.NEXT_PUBLIC_TYPEFORM_CITIZEN_EMAIL_FORM_ID as string,
    ].filter(Boolean)
  }
}

// Helper function to fetch response from multiple form IDs
export async function fetchResponseFromFormIds(
  formIds: string[],
  responseId: string
): Promise<any> {
  for (const formId of formIds) {
    try {
      const result = await fetch(
        `https://api.typeform.com/forms/${formId}/responses?included_response_ids=${responseId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.TYPEFORM_PERSONAL_ACCESS_TOKEN}`,
          },
        }
      )

      if (result.ok) {
        const data = await result.json()
        if (data.total_items > 0) {
          return data
        }
      }
    } catch (error) {
      console.log(`Error fetching from form ${formId}:`, error)
      continue
    }
  }
  return null
}

export async function hasAccessToResponse(
  walletAddresses: string[],
  responseId: string
): Promise<{
  hasAccess: boolean
  error?: string
  type?: 'team' | 'citizen'
  formIds?: string[]
}> {
  try {
    if (walletAddresses.length === 0) {
      return { hasAccess: false, error: 'No wallet addresses found' }
    }

    // Get table names
    const teamTableName = await readContract({
      contract: teamTableContract,
      method: 'getTableName' as string,
      params: [],
    })

    const citizenTableName = await readContract({
      contract: citizenTableContract,
      method: 'getTableName' as string,
      params: [],
    })

    // Check if response belongs to a team
    let team: any
    try {
      team = await queryTable(
        DEFAULT_CHAIN_V5,
        `SELECT * FROM ${teamTableName} WHERE formId = '${responseId}'`
      )
    } catch (error) {
      team = []
    }

    // Check if response belongs to a citizen
    let citizen: any
    try {
      citizen = await queryTable(
        DEFAULT_CHAIN_V5,
        `SELECT * FROM ${citizenTableName} WHERE formId = '${responseId}'`
      )
    } catch (error) {
      citizen = []
    }

    // Check if the user has any wallets that are managers of the team
    let responseBelongsToTeamAndUserIsManager = false
    if (team.length > 0) {
      for (const wallet of walletAddresses) {
        const isManager = await readContract({
          contract: teamContract,
          method: 'isManager' as string,
          params: [team[0].id, wallet],
        })

        if (isManager) {
          responseBelongsToTeamAndUserIsManager = true
          break
        }
      }
    }

    // Check if any of the user's wallets owns the citizen nft
    let responseBelongsToCitizenAndUserOwnsCitizen = false
    if (citizen.length > 0) {
      for (const wallet of walletAddresses) {
        try {
          const ownedToken = await readContract({
            contract: citizenContract,
            method: 'getOwnedToken' as string,
            params: [wallet],
          })

          if (+ownedToken.toString() === +citizen[0].id) {
            responseBelongsToCitizenAndUserOwnsCitizen = true
            break
          }
        } catch (error) {
          // Continue checking other wallets
        }
      }
    }

    // Check access permissions
    if (team.length > 0 && !responseBelongsToTeamAndUserIsManager) {
      return { hasAccess: false, error: 'User is not a manager of the team' }
    }

    if (citizen.length > 0 && !responseBelongsToCitizenAndUserOwnsCitizen) {
      return { hasAccess: false, error: 'User does not own the citizen nft' }
    }

    const type = team.length > 0 ? 'team' : 'citizen'
    const formIds = await getFormIdsByType(type)
    return { hasAccess: true, type, formIds }
  } catch (error) {
    console.error('Error checking access to response:', error)
    return { hasAccess: false, error: 'Internal server error' }
  }
}
