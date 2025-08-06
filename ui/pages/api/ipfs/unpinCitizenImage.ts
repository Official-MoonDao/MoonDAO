import CitizenABI from 'const/abis/Citizen.json'
import CitizenTableABI from 'const/abis/CitizenTable.json'
import {
  CITIZEN_ADDRESSES,
  CITIZEN_TABLE_ADDRESSES,
  DEFAULT_CHAIN_V5,
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

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { citizenId, accessToken } = JSON.parse(req.body)

    try {
      const privyUserData = await getPrivyUserData(accessToken)

      if (!privyUserData) {
        return res.status(401).json({ error: 'Invalid access token' })
      }

      const { walletAddresses } = privyUserData

      if (walletAddresses.length === 0) {
        return res.status(401).json({ error: 'No wallet addresses found' })
      }

      let ownedTokens: any[] = []
      for (const walletAddress of walletAddresses) {
        console.log(walletAddress)

        const ownedToken: any = await readContract({
          contract: citizenContract,
          method: 'getOwnedToken' as string,
          params: [walletAddress],
        })

        if (+ownedToken.toString() === +citizenId) {
          ownedTokens.push(+ownedToken.toString())
        }
      }

      if (ownedTokens.length === 0 || !ownedTokens.includes(citizenId)) {
        return res.status(401).json({ error: 'Citizen not found' })
      }

      const citizenTableName = await readContract({
        contract: citizenTableContract,
        method: 'getTableName' as string,
        params: [],
      })

      const citizen: any = await queryTable(
        DEFAULT_CHAIN_V5,
        `SELECT * FROM ${citizenTableName} WHERE id = ${citizenId}`
      )
      const unpinRes = await fetch(
        `https://api.pinata.cloud/pinning/unpin/${
          citizen?.image?.split('ipfs://')[1]
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
