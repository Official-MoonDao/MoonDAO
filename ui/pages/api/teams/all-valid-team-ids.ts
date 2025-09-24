import TeamABI from 'const/abis/Team.json'
import {
  DEFAULT_CHAIN_V5,
  TEAM_TABLE_NAMES,
  TEAM_ADDRESSES,
} from 'const/config'
import { setPublicHeaders } from 'middleware/publicHeaders'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import { getContract, readContract } from 'thirdweb'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  setPublicHeaders(res)

  try {
    const chain = DEFAULT_CHAIN_V5
    const chainSlug = getChainSlug(chain)
    const tableName = TEAM_TABLE_NAMES[chainSlug]

    const statement = `SELECT id, name, image FROM ${tableName}`

    const results = await queryTable(chain, statement)

    if (!results) {
      return res.status(500).json({ message: 'Error querying team table' })
    }

    const teamContract = getContract({
      client: serverClient,
      address: TEAM_ADDRESSES[chainSlug],
      chain: chain,
      abi: TeamABI as any,
    })

    const now = Math.floor(Date.now() / 1000)

    // Check expiration for each team
    const validityChecks = await Promise.all(
      results.map(async (result: any) => {
        try {
          const expiresAt = await readContract({
            contract: teamContract,
            method: 'expiresAt',
            params: [result.id],
          })
          return {
            teamId: result.id,
            isValid: +expiresAt.toString() > now,
          }
        } catch (error) {
          console.error(
            `Error checking expiration for team ${result.id}:`,
            error
          )
          return {
            teamId: result.id,
            isValid: false,
          }
        }
      })
    )

    const validTeams = validityChecks
      .filter((check) => check.isValid)
      .map((check) => {
        const teamData = results.find(
          (result: any) => result.id === check.teamId
        )
        return {
          id: check.teamId,
          name: teamData?.name || `Team ${check.teamId}`,
          image: teamData?.image || null,
        }
      })

    // Also return just the IDs for backward compatibility
    const validTeamIds = validTeams.map((team) => team.id)

    return res.status(200).json({ validTeamIds, validTeams })
  } catch (error) {
    console.error('Error fetching valid teams:', error)
    return res.status(500).json({ message: 'Error fetching valid teams' })
  }
}

export default withMiddleware(handler, rateLimit)
