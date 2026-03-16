import {
  CITIZEN_TABLE_NAMES,
  GENERAL_CHANNEL_ID,
  OVERVIEW_BLOCKED_CITIZEN_IDS,
  OVERVIEW_DELEGATION_VOTE_ID,
  OVERVIEW_TOKEN_ADDRESS,
  OVERVIEW_TOKEN_DECIMALS,
  TEST_CHANNEL_ID,
  VOTES_TABLE_ADDRESSES,
  VOTES_TABLE_NAMES,
  DEPLOYED_ORIGIN,
} from 'const/config'
import { formatUnits } from 'ethers'
import { authMiddleware } from 'middleware/authMiddleware'
import withMiddleware from 'middleware/withMiddleware'
import { waitForReceipt } from 'thirdweb'
import { ethers5Adapter } from 'thirdweb/adapters/ethers5'
import {
  parseDelegations,
  aggregateDelegations,
  buildLeaderboard,
  isValidEthAddress,
  formatLeaderboardStandings,
} from '@/lib/overview-delegate/leaderboard'
import type { LeaderboardEntry } from '@/lib/overview-delegate/leaderboard'
import { getPrivyUserData } from '@/lib/privy'
import { arbitrum } from '@/lib/rpc/chains'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'
import { engineBatchRead } from '@/lib/thirdweb/engine'
import { getBlocksInTimeframe } from '@/lib/utils/blocks'

const ERC20_BALANCE_OF_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
]

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

async function buildCurrentLeaderboard(): Promise<LeaderboardEntry[]> {
  const votesTableName = VOTES_TABLE_NAMES[chainSlug]
  if (!votesTableName) return []

  const statement = `SELECT * FROM ${votesTableName} WHERE voteId = ${OVERVIEW_DELEGATION_VOTE_ID}`
  const rows = await queryTable(chain, statement)
  if (!rows || rows.length === 0) return []

  const delegations = parseDelegations(rows)
  if (delegations.length === 0) return []

  const uniqueDelegators = [
    ...new Set(delegations.map((d) => d.delegatorAddress)),
  ]

  let balanceMap: Record<string, number> = {}
  try {
    const balances = await engineBatchRead<string>(
      OVERVIEW_TOKEN_ADDRESS,
      'balanceOf',
      uniqueDelegators.map((addr) => [addr]),
      ERC20_BALANCE_OF_ABI,
      chain.id
    )
    for (let i = 0; i < uniqueDelegators.length; i++) {
      const raw = balances[i]
      const wei = BigInt(raw || '0')
      const normalized = parseFloat(formatUnits(wei, OVERVIEW_TOKEN_DECIMALS))
      balanceMap[uniqueDelegators[i].toLowerCase()] = normalized
    }
  } catch {
    for (const addr of uniqueDelegators) {
      balanceMap[addr.toLowerCase()] = Infinity
    }
  }

  const aggregated = aggregateDelegations(delegations, balanceMap)
  if (aggregated.length === 0) return []

  const safeAddresses = aggregated
    .map((e) => e.delegateeAddress)
    .filter(isValidEthAddress)

  let citizenMap: Record<
    string,
    { id: number; name: string; image?: string }
  > = {}

  if (safeAddresses.length > 0) {
    const citizenTableName = CITIZEN_TABLE_NAMES[chainSlug]
    if (citizenTableName) {
      const inClause = safeAddresses.map((a) => `'${a}'`).join(',')
      const citizenStatement = `SELECT id, name, owner, image FROM ${citizenTableName} WHERE LOWER(owner) IN (${inClause})`
      const citizenRows = await queryTable(chain, citizenStatement)
      if (citizenRows) {
        for (const c of citizenRows) {
          if (OVERVIEW_BLOCKED_CITIZEN_IDS.includes(c.id)) continue
          citizenMap[c.owner.toLowerCase()] = {
            id: c.id,
            name: c.name,
            image: c.image,
          }
        }
      }
    }
  }

  return buildLeaderboard(aggregated, citizenMap, 25)
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

    let leaderboard: LeaderboardEntry[] = []
    try {
      leaderboard = await buildCurrentLeaderboard()
    } catch {}

    const voterDisplay = voterCitizen?.name
      ? `[${voterCitizen.name}](${DEPLOYED_ORIGIN}/citizen/${generatePrettyLinkWithId(voterCitizen.name, voterCitizen.id)})`
      : `${voterAddress.slice(0, 6)}...${voterAddress.slice(-4)}`

    const delegateeDisplay = delegateeCitizen?.name
      ? `[${delegateeCitizen.name}](${DEPLOYED_ORIGIN}/citizen/${generatePrettyLinkWithId(delegateeCitizen.name, delegateeCitizen.id)})`
      : delegateeAddress
        ? `${delegateeAddress.slice(0, 6)}...${delegateeAddress.slice(-4)}`
        : 'a candidate'

    let content = `## 🗳️ **${voterDisplay}** has backed **${delegateeDisplay}** in the Overview Flight!`

    if (leaderboard.length > 0) {
      content += `\n\n### Current Standings\n${formatLeaderboardStandings(leaderboard, DEPLOYED_ORIGIN, generatePrettyLinkWithId)}`
      content += `\n\n[Vote now →](${DEPLOYED_ORIGIN}/overview-vote)`
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
