import {
  CITIZEN_TABLE_NAMES,
  DEFAULT_CHAIN_V5,
  GENERAL_CHANNEL_ID,
  IPFS_GATEWAY,
  TEST_CHANNEL_ID,
} from 'const/config'
import { DEPLOYED_ORIGIN } from 'const/config'
import { authMiddleware } from 'middleware/authMiddleware'
import withMiddleware from 'middleware/withMiddleware'
import { getPrivyUserData } from '@/lib/privy'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'

const chainSlug = getChainSlug(DEFAULT_CHAIN_V5)

const NOTIFICATION_CHANNEL_ID =
  process.env.NEXT_PUBLIC_CHAIN === 'mainnet'
    ? GENERAL_CHANNEL_ID
    : TEST_CHANNEL_ID

const notifiedProposals = new Set<string>()

setInterval(() => {
  notifiedProposals.clear()
}, 60 * 60 * 1000)

async function handler(req: any, res: any) {
  if (req.method === 'POST') {
    try {
      const data = req.body
      if (!data) {
        return res.status(400).send({ message: 'Bad request' })
      }

      const { accessToken, proposalId, proposalTitle, selectedWallet } =
        JSON.parse(data)

      if (!accessToken || !proposalId || !proposalTitle) {
        return res.status(400).send({ message: 'Missing required fields' })
      }

      const proposalIdStr = String(proposalId)

      if (notifiedProposals.has(proposalIdStr)) {
        return res.status(400).send({
          message: 'Notification for this proposal has already been sent',
        })
      }

      const privyUserData = await getPrivyUserData(accessToken)
      if (!privyUserData) {
        return res.status(400).send({ message: 'Invalid access token' })
      }

      const { walletAddresses } = privyUserData
      if (walletAddresses.length === 0) {
        return res.status(400).send({ message: 'No wallet addresses found' })
      }

      const walletIndex =
        typeof selectedWallet === 'number' && selectedWallet >= 0
          ? selectedWallet
          : 0

      if (walletIndex >= walletAddresses.length) {
        return res.status(400).send({
          message: 'Selected wallet index is out of range',
        })
      }

      const proposalAuthorAddress = walletAddresses[walletIndex]?.toLowerCase()

      notifiedProposals.add(proposalIdStr)

      let citizen: any = null
      try {
        const citizenRows: any = await queryTable(
          DEFAULT_CHAIN_V5,
          `SELECT name, id, image, owner FROM ${CITIZEN_TABLE_NAMES[chainSlug]} WHERE owner = '${proposalAuthorAddress}'`
        )

        if (citizenRows.length > 0) {
          citizen = citizenRows[0]
        }
      } catch (err: any) {
        console.log('Error fetching citizen data:', err)
      }

      try {
        const authorDisplay = citizen?.name
          ? `[${
              citizen.name
            }](${DEPLOYED_ORIGIN}/citizen/${generatePrettyLinkWithId(
              citizen.name,
              citizen.id
            )})`
          : proposalAuthorAddress.slice(0, 6) +
            '...' +
            proposalAuthorAddress.slice(-4)

        const content = `## **${authorDisplay}** has submitted a new proposal!\n**[${proposalTitle}](${DEPLOYED_ORIGIN}/proposal/${proposalIdStr})**`

        let messageData: any = {}

        if (citizen) {
          messageData.embeds = [
            {
              description: content,
              image: {
                url: `${IPFS_GATEWAY}${citizen.image.replace('ipfs://', '')}`,
              },
            },
          ]
        } else {
          messageData.embeds = [
            {
              description: content,
            },
          ]
        }

        const response = await fetch(
          `https://discord.com/api/v10/channels/${NOTIFICATION_CHANNEL_ID}/messages`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            },
            body: JSON.stringify(messageData),
          }
        )

        if (!response.ok) {
          throw new Error('Failed to send message to Discord')
        }

        return res.status(200).json({ success: true })
      } catch (err: any) {
        console.log('Discord notification error:', err)
        notifiedProposals.delete(proposalIdStr)
        return res.status(400).json({
          message: err.message,
        })
      }
    } catch (err: any) {
      console.log('Handler error:', err)
      return res.status(400).json({
        error: 'Failed to send proposal notification',
      })
    }
  } else {
    res.status(405).send({ message: 'Method not allowed' })
  }
}
export default withMiddleware(handler, authMiddleware)
