import { CITIZEN_TABLE_NAMES, DEFAULT_CHAIN_V5 } from 'const/config'
import { SignJWT } from 'jose'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getPrivyUserData } from '@/lib/privy'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  try {
    const { accessToken } = req.body || {}
    if (!accessToken)
      return res.status(400).json({ error: 'Missing access token' })
    if (!process.env.SPACE_JWT_SECRET)
      return res.status(500).json({ error: 'Missing JWT secret' })

    // Get Privy user data
    const privyUserData = await getPrivyUserData(accessToken)
    if (!privyUserData) {
      return res.status(401).json({ error: 'Invalid access token' })
    }

    const { walletAddresses } = privyUserData

    if (walletAddresses.length === 0) {
      return res
        .status(400)
        .json({ error: 'No wallet addresses found for this account' })
    }

    // Get the first wallet address
    const wallet = walletAddresses[0]

    // Query citizen NFT data
    const chain = DEFAULT_CHAIN_V5
    const chainSlug = getChainSlug(chain)
    let citizenName = 'Unknown Citizen'

    try {
      // Query for citizen data using the wallet address
      const statement = `SELECT * FROM ${
        CITIZEN_TABLE_NAMES[chainSlug]
      } WHERE owner = '${wallet.toLowerCase()}'`
      const citizenRows = await queryTable(chain, statement)

      const citizen: any = citizenRows[0]

      if (!citizen) {
        return res.status(400).json({ error: 'No citizen found' })
      }

      citizenName = citizen.name || 'Unknown Citizen'
    } catch (error) {
      console.log('Error fetching citizen data:', error)
      return res.status(500).json({ error: 'Failed to fetch citizen data' })
    }

    const token = await new SignJWT({
      sub: wallet.toLowerCase(),
      wallet: wallet,
      name: citizenName,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('10m')
      .sign(new TextEncoder().encode(process.env.SPACE_JWT_SECRET))

    return res.status(200).json({ token })
  } catch (e: any) {
    console.error(e)
    return res.status(500).json({ error: 'Failed to sign token' })
  }
}
