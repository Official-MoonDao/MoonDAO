import {
  CITIZEN_TABLE_NAMES,
  OVERVIEW_PATH_VOTE_ID,
  OVERVIEW_TOKEN_ADDRESS,
  OVERVIEW_TOKEN_DECIMALS,
  VOTES_TABLE_NAMES,
} from 'const/config'
// Import from the utils sub-path: the named export from 'ethers' breaks at
// runtime under Next's Webpack barrel optimizer in ethers v5 (see the same
// note in lib/overview-delegate/fetchLeaderboard.ts).
import { formatUnits } from 'ethers/lib/utils'
import { isValidEthAddress } from '@/lib/overview-delegate/leaderboard'
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

/**
 * A single participant in the vote. Intentionally carries no `optionId`: the
 * page mirrors the governance proposal pattern of showing *who* voted and with
 * how much weight, without revealing each voter's choice until results are
 * unsealed.
 */
export type PathVoteVoter = {
  address: string
  votingPower: number
  citizenName?: string
  citizenId?: number | string
}

export type PathVoteResults = {
  results: PathVoteResult[]
  totalVoted: number
  totalVoters: number
  voters: PathVoteVoter[]
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
    voters: [],
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

    // Per-voter list (no choice attached) — powers the "who voted" panel that
    // stays visible while the per-option tally is sealed.
    const voters: PathVoteVoter[] = votes
      .map((v) => {
        const bal = balanceMap[v.voterAddress] ?? 0
        const power = Number.isFinite(bal) ? bal : v.storedAmount
        return {
          address: v.voterAddress,
          votingPower: Math.round(power * 100) / 100,
        }
      })
      .filter((v) => v.votingPower > 0)
      .sort((a, b) => b.votingPower - a.votingPower)

    // Resolve citizen names for voter addresses (best-effort), mirroring the
    // leaderboard's owner -> citizen lookup so the list shows names not raw
    // addresses where possible.
    if (voters.length > 0) {
      try {
        const citizenTableName = CITIZEN_TABLE_NAMES[chainSlug]
        const safeAddresses = voters
          .map((v) => v.address)
          .filter(isValidEthAddress)
        if (citizenTableName && safeAddresses.length > 0) {
          const inClause = safeAddresses.map((a) => `'${a}'`).join(',')
          const citizenStatement = `SELECT id, name, owner FROM ${citizenTableName} WHERE LOWER(owner) IN (${inClause})`
          const citizenRows = await queryTable(chain, citizenStatement)
          if (citizenRows) {
            const citizenByOwner: Record<
              string,
              { id: number | string; name: string }
            > = {}
            for (const c of citizenRows) {
              citizenByOwner[c.owner.toLowerCase()] = { id: c.id, name: c.name }
            }
            for (const voter of voters) {
              const match = citizenByOwner[voter.address.toLowerCase()]
              if (match) {
                voter.citizenName = match.name
                voter.citizenId = match.id
              }
            }
          }
        }
      } catch (error) {
        console.error('[fetchPathVoteResults] citizen lookup failed:', error)
      }
    }

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
      voters,
    }
  } catch (error) {
    console.error('[fetchPathVoteResults] fatal error:', error)
    return emptyPathVoteResults()
  }
}
