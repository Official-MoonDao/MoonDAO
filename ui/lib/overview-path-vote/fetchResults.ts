import {
  OVERVIEW_PATH_VOTE_ID,
  OVERVIEW_TOKEN_ADDRESS,
  OVERVIEW_TOKEN_DECIMALS,
  VOTES_TABLE_NAMES,
} from 'const/config'
// Import from the utils sub-path: the named export from 'ethers' breaks at
// runtime under Next's Webpack barrel optimizer in ethers v5 (see the same
// note in lib/overview-delegate/fetchLeaderboard.ts).
import { formatUnits } from 'ethers/lib/utils'
import { arbitrum } from '@/lib/rpc/chains'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { engineBatchRead } from '@/lib/thirdweb/engine'
import { isPathVoteOptionId, PATH_VOTE_OPTIONS } from './options'
import type { PathVoteOptionId } from './options'

const ERC20_BALANCE_OF_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
]

export type PathVoteResult = {
  optionId: PathVoteOptionId
  totalVoted: number
  voterCount: number
  percentage: number
}

export type PathVoteResults = {
  results: PathVoteResult[]
  totalVoted: number
  totalVoters: number
}

export function emptyPathVoteResults(): PathVoteResults {
  return {
    results: PATH_VOTE_OPTIONS.map((o) => ({
      optionId: o.id,
      totalVoted: 0,
      voterCount: 0,
      percentage: 0,
    })),
    totalVoted: 0,
    totalVoters: 0,
  }
}

type ParsedPathVote = {
  voterAddress: string
  optionId: PathVoteOptionId
  storedAmount: number
}

function parsePathVotes(rows: any[]): ParsedPathVote[] {
  const votes: ParsedPathVote[] = []
  for (const row of rows) {
    try {
      const vote =
        typeof row.vote === 'string' ? JSON.parse(row.vote) : row.vote
      const entries = Object.entries(vote)
      if (entries.length > 0) {
        const [optionId, amount] = entries[0]
        if (!isPathVoteOptionId(optionId)) continue
        votes.push({
          voterAddress: (row.address as string).toLowerCase(),
          optionId,
          storedAmount: Number(amount) || 0,
        })
      }
    } catch {
      continue
    }
  }
  return votes
}

/**
 * Fetches and tallies the "Send Frank to Space — Path Forward" vote
 * server-side: reads all rows for OVERVIEW_PATH_VOTE_ID from the Votes
 * Tableland table, re-weights each vote by the voter's *live* $OVERVIEW
 * balance (same pipeline as the overview delegation leaderboard), and
 * aggregates per option.
 */
export async function fetchPathVoteResults(): Promise<PathVoteResults> {
  try {
    const chain = arbitrum
    const chainSlug = getChainSlug(chain)

    const votesTableName = VOTES_TABLE_NAMES[chainSlug]
    if (!votesTableName) return emptyPathVoteResults()

    const statement = `SELECT * FROM ${votesTableName} WHERE voteId = ${OVERVIEW_PATH_VOTE_ID}`
    const rows = await queryTable(chain, statement)
    if (!rows || rows.length === 0) return emptyPathVoteResults()

    const votes = parsePathVotes(rows)
    if (votes.length === 0) return emptyPathVoteResults()

    const uniqueVoters = [...new Set(votes.map((v) => v.voterAddress))]

    const balanceMap: Record<string, number> = {}
    try {
      const balances = await engineBatchRead<string>(
        OVERVIEW_TOKEN_ADDRESS,
        'balanceOf',
        uniqueVoters.map((addr) => [addr]),
        ERC20_BALANCE_OF_ABI,
        chain.id
      )
      for (let i = 0; i < uniqueVoters.length; i++) {
        const raw = balances[i]
        const wei = BigInt(raw || '0')
        balanceMap[uniqueVoters[i]] = parseFloat(
          formatUnits(wei, OVERVIEW_TOKEN_DECIMALS)
        )
      }
    } catch (error) {
      // On RPC failure fall back to the stored vote amounts so results never
      // render empty purely due to a balance-read flake. Infinity sentinel
      // triggers the storedAmount fallback below.
      console.error(
        '[fetchPathVoteResults] balance read failed, using stored amounts:',
        error
      )
      for (const addr of uniqueVoters) {
        balanceMap[addr] = Infinity
      }
    }

    const totals: Record<
      PathVoteOptionId,
      { totalVoted: number; voterCount: number }
    > = {
      'option-a': { totalVoted: 0, voterCount: 0 },
      'option-b': { totalVoted: 0, voterCount: 0 },
      'option-c': { totalVoted: 0, voterCount: 0 },
      abstain: { totalVoted: 0, voterCount: 0 },
    }

    for (const v of votes) {
      const currentBalance = balanceMap[v.voterAddress] ?? 0
      const effective = Number.isFinite(currentBalance)
        ? currentBalance
        : v.storedAmount
      if (effective <= 0) continue
      totals[v.optionId].totalVoted += effective
      totals[v.optionId].voterCount += 1
    }

    const totalVoted = Object.values(totals).reduce(
      (sum, t) => sum + t.totalVoted,
      0
    )
    const totalVoters = Object.values(totals).reduce(
      (sum, t) => sum + t.voterCount,
      0
    )

    return {
      results: PATH_VOTE_OPTIONS.map((o) => ({
        optionId: o.id,
        totalVoted: Math.round(totals[o.id].totalVoted * 100) / 100,
        voterCount: totals[o.id].voterCount,
        percentage:
          totalVoted > 0
            ? Math.round((totals[o.id].totalVoted / totalVoted) * 1000) / 10
            : 0,
      })),
      totalVoted: Math.round(totalVoted * 100) / 100,
      totalVoters,
    }
  } catch (error) {
    console.error('[fetchPathVoteResults] fatal error:', error)
    return emptyPathVoteResults()
  }
}
