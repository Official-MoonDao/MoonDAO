import TeamABI from 'const/abis/Team.json'
import TeamTableABI from 'const/abis/TeamTable.json'
import {
  DEFAULT_CHAIN_V5,
  TEAM_ADDRESSES,
  TEAM_TABLE_ADDRESSES,
} from 'const/config'
import { authMiddleware } from 'middleware/authMiddleware'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import { getContract, readContract } from 'thirdweb'
import { getPrivyUserData } from '@/lib/privy'
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

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { teamId, accessToken } = req.body

    try {
      const privyUserData = await getPrivyUserData(accessToken)

      if (!privyUserData) {
        return res.status(401).json({ error: 'Invalid access token' })
      }

      const { walletAddresses } = privyUserData

      let isManagerOfTeam
      for (const walletAddress of walletAddresses) {
        try {
          const isManager = await readContract({
            contract: teamContract,
            method: 'isManager' as string,
            params: [teamId, walletAddress],
          })
          if (isManager) {
            isManagerOfTeam = true
            break
          }
        } catch (error) {}
      }

      if (!isManagerOfTeam) {
        return res
          .status(401)
          .json({ error: 'You are not a manager of this team' })
      }

      const teamTableName = await readContract({
        contract: teamTableContract,
        method: 'getTableName' as string,
        params: [],
      })

      const team: any = await queryTable(
        DEFAULT_CHAIN_V5,
        `SELECT * FROM ${teamTableName} WHERE id = ${teamId}`
      )

      const unpinRes = await fetch(
        `https://api.pinata.cloud/pinning/unpin/${
          team.image.split('ipfs://')[1]
        }`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${process.env.PINATA_JWT_KEY}`,
          },
        }
      )
      const data = await unpinRes.json()
      return res.status(200).json(data)
    } catch (error) {
      console.error('Error processing request:', error)
      return res.status(500).json('Error processing request')
    }
  } else {
    return res.status(400).json('Invalid method')
  }
}

export default withMiddleware(handler, authMiddleware)
