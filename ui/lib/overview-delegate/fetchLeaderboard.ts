import {
  CITIZEN_TABLE_NAMES,
  OVERVIEW_BLOCKED_CITIZEN_IDS,
  OVERVIEW_DELEGATION_VOTE_ID,
  OVERVIEW_TOKEN_ADDRESS,
  OVERVIEW_TOKEN_DECIMALS,
  VOTES_TABLE_NAMES,
} from 'const/config'
// `formatUnits` lives on `ethers/lib/utils` in ethers v5 (the version this
// project ships). Importing the named export from `'ethers'` directly works
// at type-check time but blows up at runtime under Next's Webpack barrel
// optimizer ("(0 , formatUnits) is not a function"), which silently kicks
// the leaderboard onto its stored-amount fallback path. Pulling from the
// utils sub-path avoids the optimizer foot-gun.
import { formatUnits } from 'ethers/lib/utils'
import { arbitrum } from '@/lib/rpc/chains'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { engineBatchRead } from '@/lib/thirdweb/engine'
import {
  aggregateDelegations,
  buildLeaderboard,
  isValidEthAddress,
  parseDelegations,
} from './leaderboard'
import type { LeaderboardEntry } from './leaderboard'

const ERC20_BALANCE_OF_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
]

/**
 * Fetches the Overview Flight ($OVERVIEW) delegation leaderboard server-side.
 *
 * Centralizes the Tableland → balance-batch → citizen-resolve pipeline that
 * previously lived in `pages/overview-vote.tsx` and the leaderboard-notification
 * API route, so additional surfaces (e.g. the mission/4 page) can render
 * trustworthy leaderboard data without re-implementing it.
 *
 * @param limit Optional max rows to return. Omit for the full leaderboard.
 * @returns A sorted (highest-delegated first) list of citizens with totals.
 */
export async function fetchOverviewLeaderboard(
  limit?: number
): Promise<LeaderboardEntry[]> {
  try {
    const chain = arbitrum
    const chainSlug = getChainSlug(chain)

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

    const balanceMap: Record<string, number> = {}
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
        const normalized = parseFloat(
          formatUnits(wei, OVERVIEW_TOKEN_DECIMALS)
        )
        balanceMap[uniqueDelegators[i].toLowerCase()] = normalized
      }
    } catch (error) {
      // If the on-chain balance read fails, fall back to stored delegation
      // amounts so we never show an empty leaderboard purely due to RPC flake.
      console.error(
        '[fetchOverviewLeaderboard] balance read failed, using stored amounts:',
        error
      )
      for (const addr of uniqueDelegators) {
        balanceMap[addr.toLowerCase()] = Infinity
      }
    }

    const aggregated = aggregateDelegations(delegations, balanceMap)
    if (aggregated.length === 0) return []

    const safeAddresses = aggregated
      .map((e) => e.delegateeAddress)
      .filter(isValidEthAddress)

    const citizenMap: Record<
      string,
      { id: number | string; name: string; image?: string }
    > = {}

    if (safeAddresses.length > 0) {
      try {
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
      } catch (error) {
        console.error(
          '[fetchOverviewLeaderboard] citizen lookup failed:',
          error
        )
      }
    }

    return buildLeaderboard(aggregated, citizenMap, limit)
  } catch (error) {
    console.error('[fetchOverviewLeaderboard] fatal error:', error)
    return []
  }
}
