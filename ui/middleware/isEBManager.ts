import TeamABI from 'const/abis/Team.json'
import { DEFAULT_CHAIN_V5, EB_TEAM_ID, TEAM_ADDRESSES } from 'const/config'
import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getContract, readContract } from 'thirdweb'
import { getPrivyUserData } from '@/lib/privy'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'
import { authOptions } from '../pages/api/auth/[...nextauth]'

export async function isEBManager(req: NextApiRequest, res: NextApiResponse, next: () => void) {
  // Bypass authentication in testnet environment
  const isTestEnv = process.env.NEXT_PUBLIC_CHAIN === 'testnet'

  if (isTestEnv) {
    next()
    return
  }

  if (EB_TEAM_ID === undefined) {
    console.error('EB_TEAM_ID not configured')
    res.status(500).json({ error: 'EB team ID not configured' })
    return
  }

  const session = await getServerSession(req, res, authOptions)

  if (!session?.accessToken) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const privyUserData = await getPrivyUserData(session.accessToken)

  if (!privyUserData || privyUserData.walletAddresses.length === 0) {
    res.status(401).json({ error: 'No wallet addresses found' })
    return
  }

  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)

  const teamContract = getContract({
    client: serverClient,
    address: TEAM_ADDRESSES[chainSlug],
    abi: TeamABI as any,
    chain: chain,
  })

  try {
    for (const walletAddress of privyUserData.walletAddresses) {
      try {
        const isManager = await readContract({
          contract: teamContract,
          method: 'isManager' as string,
          params: [EB_TEAM_ID, walletAddress],
        })

        if (isManager) {
          next()
          return
        }
      } catch (err) {
        console.error('Error checking manager status:', err)
        continue
      }
    }

    res.status(403).json({ error: 'Forbidden: Executive Branch manager access required' })
  } catch (error) {
    console.error('Error checking EB manager status:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
