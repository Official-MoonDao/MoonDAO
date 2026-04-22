/**
 * Discord notification for retroactive-rewards distribution submissions.
 *
 * Fires when a citizen submits (or updates) their distribution row on the
 * Distribution Tableland contract. The route validates that the transaction
 * was sent by an authenticated wallet, that it actually targets the
 * Distribution contract, and that it's recent — then posts a message to
 * Discord summarizing what was submitted (quarter / year / project count).
 *
 * Mirrors the auth + validation pattern of `vote-notification.ts` and
 * `leaderboard-notification.ts`. The client must send the Privy access token
 * both in the `Authorization: Bearer ...` header (so `authMiddleware` lets
 * the request through) and in the body (so we can re-verify and look up the
 * user's wallets).
 */
import {
  CITIZEN_TABLE_NAMES,
  DEFAULT_CHAIN_V5,
  DISTRIBUTION_TABLE_ADDRESSES,
  GENERAL_CHANNEL_ID,
  TEST_CHANNEL_ID,
  DEPLOYED_ORIGIN,
} from 'const/config'
import { authMiddleware } from 'middleware/authMiddleware'
import withMiddleware from 'middleware/withMiddleware'
import { waitForReceipt } from 'thirdweb'
import { ethers5Adapter } from 'thirdweb/adapters/ethers5'
import { getPrivyUserData } from '@/lib/privy'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'
import { getBlocksInTimeframe } from '@/lib/utils/blocks'

const chain = DEFAULT_CHAIN_V5
const chainSlug = getChainSlug(chain)

const NOTIFICATION_CHANNEL_ID =
  process.env.NEXT_PUBLIC_CHAIN === 'mainnet'
    ? GENERAL_CHANNEL_ID
    : TEST_CHANNEL_ID

const usedTransactions = new Set<string>()
setInterval(() => {
  usedTransactions.clear()
}, 60 * 60 * 1000)

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

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

    const distributionAddress = DISTRIBUTION_TABLE_ADDRESSES[chainSlug]
    if (
      !distributionAddress ||
      txReceipt.to?.toLowerCase() !== distributionAddress.toLowerCase()
    ) {
      return res.status(400).json({
        message: 'Transaction is not to the Distribution contract',
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
        message: 'Transaction is too old',
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

    const voterDisplay = voterCitizen?.name
      ? `[${voterCitizen.name}](${DEPLOYED_ORIGIN}/citizen/${generatePrettyLinkWithId(voterCitizen.name, voterCitizen.id)})`
      : shortAddress(voterAddress)

    const quarter = Number(data.quarter)
    const year = Number(data.year)
    const projectCountRaw = data.projectCount
    const projectCount =
      typeof projectCountRaw === 'number' && Number.isFinite(projectCountRaw)
        ? projectCountRaw
        : null

    const quarterLabel =
      Number.isInteger(quarter) && Number.isInteger(year)
        ? ` for **Q${quarter} ${year}**`
        : ''
    const acrossLabel =
      projectCount != null && projectCount > 0
        ? ` across **${projectCount} project${projectCount === 1 ? '' : 's'}**`
        : ''
    const verb = data.isEdit
      ? 'updated their retroactive rewards distribution'
      : 'submitted a retroactive rewards distribution'

    let content = `## 🎯 **${voterDisplay}** ${verb}${quarterLabel}${acrossLabel}`
    content += `\n\n[View projects →](${DEPLOYED_ORIGIN}/projects)`

    const messageData: any = {
      embeds: [{ description: content }],
    }

    if (voterCitizen?.image) {
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
    console.error('Distribution notification error:', err)
    return res.status(400).json({
      message: err.message || 'Failed to send distribution notification',
    })
  }
}

export default withMiddleware(handler, authMiddleware)
