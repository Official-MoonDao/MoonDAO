/**
 * Discord notification for proposal votes.
 *
 * Two flavors, distinguished by the `kind` field in the request body:
 *   - 'senate': a single-proposal Senate vote (NonProjectProposal contract).
 *               Includes the proposal name + MDP + distribution payload.
 *   - 'member': a quarterly Member Vote across many proposals (Proposals
 *               contract). Includes quarter / year and a count of proposals
 *               the voter allocated to.
 *
 * The route validates that:
 *   - The caller has a valid Privy token (via the Bearer header — populated by
 *     the new `Authorization: Bearer ${accessToken}` convention also used by
 *     leaderboard-notification — and re-checked against the body for defense
 *     in depth).
 *   - The transaction was sent by one of the authenticated user's wallets.
 *   - The transaction's `to` matches the expected contract for `kind`.
 *   - The transaction is recent (within ~10 minutes of blocks).
 *   - We haven't already processed this `txHash` in this Node process.
 */
import {
  CITIZEN_TABLE_NAMES,
  DEFAULT_CHAIN_V5,
  GENERAL_CHANNEL_ID,
  NON_PROJECT_PROPOSAL_ADDRESSES,
  PROPOSALS_ADDRESSES,
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

// In-process dedup: if the same tx is posted twice by the client (retry, etc.)
// we don't want two Discord messages. This isn't multi-instance-safe on
// serverless, but it covers the common case of a client-side retry.
const usedTransactions = new Set<string>()
setInterval(() => {
  usedTransactions.clear()
}, 60 * 60 * 1000)

type VoteKind = 'senate' | 'member'

function isVoteKind(value: unknown): value is VoteKind {
  return value === 'senate' || value === 'member'
}

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

    const { txHash, accessToken, kind } = data
    if (!txHash || !accessToken) {
      return res.status(400).json({ message: 'Missing required fields' })
    }
    if (!isVoteKind(kind)) {
      return res
        .status(400)
        .json({ message: "Invalid 'kind' (expected 'senate' or 'member')" })
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

    // Each `kind` has exactly one valid destination contract.
    const expectedContract =
      kind === 'senate'
        ? NON_PROJECT_PROPOSAL_ADDRESSES[chainSlug]
        : PROPOSALS_ADDRESSES[chainSlug]

    if (
      !expectedContract ||
      txReceipt.to?.toLowerCase() !== expectedContract.toLowerCase()
    ) {
      return res.status(400).json({
        message: 'Transaction is not to the expected contract for this vote',
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

    let content = ''
    let linkUrl = ''

    if (kind === 'senate') {
      // Senate vote payload: { proposalName, proposalMDP, isEdit }
      const proposalNameRaw =
        typeof data.proposalName === 'string' ? data.proposalName.trim() : ''
      const proposalMDPRaw = data.proposalMDP
      const proposalMDP =
        typeof proposalMDPRaw === 'number'
          ? proposalMDPRaw
          : typeof proposalMDPRaw === 'string' && proposalMDPRaw.trim() !== ''
            ? Number(proposalMDPRaw)
            : null

      const proposalLabel = proposalNameRaw
        ? proposalMDP != null && Number.isFinite(proposalMDP)
          ? `MDP-${proposalMDP}: ${proposalNameRaw}`
          : proposalNameRaw
        : proposalMDP != null && Number.isFinite(proposalMDP)
          ? `MDP-${proposalMDP}`
          : 'a proposal'

      const verb = data.isEdit ? 'updated their vote on' : 'voted on'
      content = `## 🗳️ **${voterDisplay}** ${verb} **${proposalLabel}**`

      if (proposalMDP != null && Number.isFinite(proposalMDP)) {
        linkUrl = `${DEPLOYED_ORIGIN}/proposal/${proposalMDP}`
        content += `\n\n[View proposal →](${linkUrl})`
      }
    } else {
      // Member vote payload: { quarter, year, proposalCount, isEdit }
      const quarter = Number(data.quarter)
      const year = Number(data.year)
      const proposalCountRaw = data.proposalCount
      const proposalCount =
        typeof proposalCountRaw === 'number' && Number.isFinite(proposalCountRaw)
          ? proposalCountRaw
          : null

      const quarterLabel =
        Number.isInteger(quarter) && Number.isInteger(year)
          ? ` for **Q${quarter} ${year}**`
          : ''
      const acrossLabel =
        proposalCount != null && proposalCount > 0
          ? ` across **${proposalCount} proposal${proposalCount === 1 ? '' : 's'}**`
          : ''
      const verb = data.isEdit
        ? 'updated their member vote'
        : 'submitted a member vote'

      content = `## 🗳️ **${voterDisplay}** ${verb}${quarterLabel}${acrossLabel}`
      linkUrl = `${DEPLOYED_ORIGIN}/projects`
      content += `\n\n[View proposals →](${linkUrl})`
    }

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
      // Allow a retry from the client if Discord rejected us.
      usedTransactions.delete(txHash)
      throw new Error('Failed to send message to Discord')
    }

    return res.status(200).json({ success: true })
  } catch (err: any) {
    console.error('Vote notification error:', err)
    return res.status(400).json({
      message: err.message || 'Failed to send vote notification',
    })
  }
}

export default withMiddleware(handler, authMiddleware)
