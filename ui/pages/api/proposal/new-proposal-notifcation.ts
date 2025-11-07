import { getProposal } from '@nance/nance-sdk'
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
import { NANCE_API_URL, NANCE_SPACE_NAME } from '@/lib/nance/constants'
import { getPrivyUserData } from '@/lib/privy'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'

const chainSlug = getChainSlug(DEFAULT_CHAIN_V5)

const NOTIFICATION_CHANNEL_ID =
  process.env.NEXT_PUBLIC_CHAIN === 'mainnet'
    ? GENERAL_CHANNEL_ID
    : TEST_CHANNEL_ID

// In-memory storage for used proposal IDs to prevent duplicate notifications
const notifiedProposals = new Set<string>()

// Clear the set every hour to prevent memory issues
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

      const { accessToken, proposalId, selectedWallet } = JSON.parse(data)

      if (!accessToken || !proposalId) {
        return res.status(400).send({ message: 'Missing required fields' })
      }

      // Check if proposal notification has already been sent
      if (notifiedProposals.has(proposalId)) {
        return res.status(400).send({
          message: 'Notification for this proposal has already been sent',
        })
      }

      // Verify the Privy access token
      const privyUserData = await getPrivyUserData(accessToken)
      if (!privyUserData) {
        return res.status(400).send({ message: 'Invalid access token' })
      }

      const { walletAddresses } = privyUserData
      if (walletAddresses.length === 0) {
        return res.status(400).send({ message: 'No wallet addresses found' })
      }

      // Use selectedWallet index if provided, otherwise default to first wallet
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

      // Fetch proposal from Nance
      const proposal = await getProposal(
        { space: NANCE_SPACE_NAME, uuid: proposalId },
        NANCE_API_URL
      )

      if (!proposal) {
        return res.status(400).send({
          message: 'Proposal not found',
        })
      }

      // Verify the proposal author matches the authenticated user
      if (proposal.authorAddress?.toLowerCase() !== proposalAuthorAddress) {
        return res.status(400).send({
          message: 'Proposal author does not match authenticated user',
        })
      }

      // Check if proposal is recent (within 10 minutes)
      const proposalCreatedTime = new Date(proposal.createdTime).getTime()
      const currentTime = new Date().getTime()
      const timeDifference = currentTime - proposalCreatedTime
      if (timeDifference > 10 * 60 * 1000) {
        return res.status(400).send({
          message: 'Proposal is too old. Must be within 10 minutes.',
        })
      }

      // Mark proposal as notified
      notifiedProposals.add(proposalId)

      // Try to get citizen data for the proposal author
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

      // Send Discord notification
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

        const content = `## **${authorDisplay}** has submitted a new proposal!\n[${proposal.title}](${DEPLOYED_ORIGIN}/proposal/${proposal.uuid})`

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
        // Remove proposal from notified set if notification failed, allowing retry
        notifiedProposals.delete(proposalId)
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
