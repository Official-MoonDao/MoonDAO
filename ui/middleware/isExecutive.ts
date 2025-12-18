import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../pages/api/auth/[...nextauth]'
import { DEFAULT_CHAIN_V5, EB_TEAM_ID, MOONDAO_HAT_TREE_IDS, TEAM_ADDRESSES } from 'const/config'
import { getPrivyUserData } from '@/lib/privy'
import { getContract, readContract } from 'thirdweb'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'
import hatsSubgraphClient from '@/lib/hats/hatsSubgraphClient'
import TeamABI from 'const/abis/Team.json'

export async function isExecutive(
  req: NextApiRequest,
  res: NextApiResponse,
  next: () => void
) {
  if (process.env.NEXT_PUBLIC_CHAIN === 'testnet') {
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
      const hats = await hatsSubgraphClient.getWearer({
        chainId: chain.id,
        wearerAddress: walletAddress as `0x${string}`,
        props: {
          currentHats: {
            props: {
              tree: {},
              admin: {
                admin: {
                  admin: {},
                },
              },
            },
          },
        },
      })

      if (!hats.currentHats || hats.currentHats.length === 0) {
        continue
      }

      const moondaoHats = hats.currentHats.filter(
        (hat: any) => hat.tree.id === MOONDAO_HAT_TREE_IDS[chainSlug]
      )

      if (moondaoHats.length === 0) {
        continue
      }

      for (const hat of moondaoHats) {
        try {
          const teamIdFromHat = await readContract({
            contract: teamContract,
            method: 'adminHatToTokenId' as string,
            params: [hat.id],
          })
          const teamIdFromAdmin = hat.admin?.id
            ? await readContract({
                contract: teamContract,
                method: 'adminHatToTokenId' as string,
                params: [hat.admin.id],
              })
            : null
          const teamIdFromAdminAdmin = hat.admin?.admin?.id
            ? await readContract({
                contract: teamContract,
                method: 'adminHatToTokenId' as string,
                params: [hat.admin.admin.id],
              })
            : null

          let teamId
          if (+teamIdFromHat.toString() !== 0) {
            teamId = teamIdFromHat
          } else if (teamIdFromAdmin && +teamIdFromAdmin.toString() !== 0) {
            teamId = teamIdFromAdmin
          } else if (teamIdFromAdminAdmin && +teamIdFromAdminAdmin.toString() !== 0) {
            teamId = teamIdFromAdminAdmin
          } else {
            continue
          }

          if (+teamId.toString() === Number(EB_TEAM_ID)) {
            next()
            return
          }
        } catch (err) {
          console.error('Error checking hat for team ID:', err)
          continue
        }
      }
    }

    res.status(403).json({ error: 'Forbidden: Executive Branch access required' })
  } catch (error) {
    console.error('Error checking EB membership:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

