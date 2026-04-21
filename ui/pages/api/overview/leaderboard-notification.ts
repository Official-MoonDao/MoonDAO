import {
  CITIZEN_TABLE_NAMES,
  GENERAL_CHANNEL_ID,
  TEST_CHANNEL_ID,
  VOTES_TABLE_ADDRESSES,
  DEPLOYED_ORIGIN,
} from 'const/config'
import { authMiddleware } from 'middleware/authMiddleware'
import withMiddleware from 'middleware/withMiddleware'
import { waitForReceipt } from 'thirdweb'
import { ethers5Adapter } from 'thirdweb/adapters/ethers5'
import { fetchOverviewLeaderboard } from '@/lib/overview-delegate/fetchLeaderboard'
import {
  formatLeaderboardStandings,
  isValidEthAddress,
} from '@/lib/overview-delegate/leaderboard'
import { getPrivyUserData } from '@/lib/privy'
import { arbitrum } from '@/lib/rpc/chains'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'
import { getBlocksInTimeframe } from '@/lib/utils/blocks'

const chain = arbitrum
const chainSlug = getChainSlug(chain)

const NOTIFICATION_CHANNEL_ID =
  process.env.NEXT_PUBLIC_CHAIN === 'mainnet'
    ? GENERAL_CHANNEL_ID
    : TEST_CHANNEL_ID

const usedTransactions = new Set<string>()
setInterval(() => {
  usedTransactions.clear()
}, 60 * 60 * 1000)

async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    if (!data) {
      return res.status(400).json({ message: 'Bad request' })
    }

    const { txHash, accessToken } = data
    if (!txHash || !accessToken) {
      return res.status(400).json({ message: 'Missing required fields' })
    }

    const privyUserData = await getPrivyUserData(accessToken)
    if (!privyUserData) {
      return res.status(400).json({ message: 'Invalid access token' })
    }

    const { walletAddresses } = privyUserData
    if (walletAddresses.length === 0) {
      return res.status(400).json({ message: 'No wallet addresses found' })
    }

    if (usedTransactions.has(txHash)) {
      return res.status(400).json({
        message: 'This transaction has already been processed',
      })
    }

    const txReceipt = await waitForReceipt({
      client: serverClient,
      chain,
      transactionHash: txHash,
    })

    if (!txReceipt) {
      return res.status(400).json({ message: 'Transaction not found' })
    }

    const txFrom = txReceipt.from?.toLowerCase()
    const normalizedWalletAddresses = walletAddresses.map((addr: string) =>
      addr?.toLowerCase()
    )

    if (!txFrom || !normalizedWalletAddresses.includes(txFrom)) {
      return res.status(403).json({
        message: 'Transaction sender does not match authenticated user',
      })
    }

    const votesAddress = VOTES_TABLE_ADDRESSES[chainSlug]
    if (txReceipt.to?.toLowerCase() !== votesAddress?.toLowerCase()) {
      return res.status(400).json({
        message: 'Transaction is not to the Votes contract',
      })
    }

    const txBlockNumber = parseInt(
      typeof txReceipt.blockNumber === 'object' &&
        txReceipt.blockNumber &&
        'toString' in txReceipt.blockNumber
        ? (txReceipt.blockNumber as any).toString()
        : String(txReceipt.blockNumber)
    )
    const provider = ethers5Adapter.provider.toEthers({
      client: serverClient,
      chain,
    })
    const currBlockNumber = await provider.getBlockNumber()
    const maxBlocksAge = getBlocksInTimeframe(chain, 10)
    const blockAge = currBlockNumber - txBlockNumber

    if (blockAge > maxBlocksAge) {
      return res.status(400).json({
        message: `Transaction is too old`,
      })
    }

    usedTransactions.add(txHash)

    const voterAddress = txReceipt.from.toLowerCase()
    const citizenTableName = CITIZEN_TABLE_NAMES[chainSlug]

    let voterCitizen: any = null
    if (citizenTableName) {
      try {
        const voterRows: any = await queryTable(
          chain,
          `SELECT name, id, image, owner FROM ${citizenTableName} WHERE LOWER(owner) = '${voterAddress}'`
        )
        if (voterRows?.length > 0) {
          voterCitizen = voterRows[0]
        }
      } catch {}
    }

    let delegateeCitizen: any = null
    let delegateeAddress: string | null = null
    if (typeof data.delegateeAddress === 'string') {
      const candidateAddress = data.delegateeAddress.toLowerCase()
      if (isValidEthAddress(candidateAddress)) {
        delegateeAddress = candidateAddress
      }
    }
    if (citizenTableName && delegateeAddress) {
      try {
        const delegateeRows: any = await queryTable(
          chain,
          `SELECT name, id, image, owner FROM ${citizenTableName} WHERE LOWER(owner) = '${delegateeAddress}'`
        )
        if (delegateeRows?.length > 0) {
          delegateeCitizen = delegateeRows[0]
        }
      } catch {}
    }

    const leaderboard = await fetchOverviewLeaderboard(25)

    const voterDisplay = voterCitizen?.name
      ? `[${voterCitizen.name}](${DEPLOYED_ORIGIN}/citizen/${generatePrettyLinkWithId(voterCitizen.name, voterCitizen.id)})`
      : `${voterAddress.slice(0, 6)}...${voterAddress.slice(-4)}`

    const delegateeDisplay = delegateeCitizen?.name
      ? `[${delegateeCitizen.name}](${DEPLOYED_ORIGIN}/citizen/${generatePrettyLinkWithId(delegateeCitizen.name, delegateeCitizen.id)})`
      : delegateeAddress
        ? `${delegateeAddress.slice(0, 6)}...${delegateeAddress.slice(-4)}`
        : 'a candidate'

    let content = `## 🗳️ **${delegateeDisplay}** received a new backer in the Overview Flight!`

    if (leaderboard.length > 0) {
      content += `\n\n### Current Standings\n${formatLeaderboardStandings(leaderboard, DEPLOYED_ORIGIN, generatePrettyLinkWithId)}`
      content += `\n\n[Vote now →](${DEPLOYED_ORIGIN}/overview-vote)`
    }

    const messageData: any = {
      embeds: [{ description: content }],
    }

    if (delegateeCitizen?.image) {
      messageData.embeds[0].thumbnail = {
        url: `https://ipfs.io/ipfs/${delegateeCitizen.image.replace('ipfs://', '')}`,
      }
    } else if (voterCitizen?.image) {
      messageData.embeds[0].thumbnail = {
        url: `https://ipfs.io/ipfs/${voterCitizen.image.replace('ipfs://', '')}`,
      }
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
      usedTransactions.delete(txHash)
      throw new Error('Failed to send message to Discord')
    }

    return res.status(200).json({ success: true })
  } catch (err: any) {
    console.error('Leaderboard notification error:', err)
    return res.status(400).json({
      message: err.message || 'Failed to send leaderboard notification',
    })
  }
}

export default withMiddleware(handler, authMiddleware)
