import { gql, request as gqlRequest } from 'graphql-request'
import { Address } from 'thirdweb'
import {
  DEFAULT_CHAIN_V5,
  NON_PROJECT_PROPOSAL_TABLE_NAMES,
  PROPOSALS_TABLE_NAMES,
} from 'const/config'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'

// Server-side only. Centralizes the canonical vote count used for both the
// "Votes" XP quest and the Citizen profile so the two never drift apart.

const chain = DEFAULT_CHAIN_V5
const chainSlug = getChainSlug(chain)

const SNAPSHOT_SPACE = process.env.SNAPSHOT_SPACE || 'tomoondao.eth'

// Count votes a user has cast through the current on-chain governance system:
// project/member votes live in the Proposals table and non-project governance
// votes live in the NonProjectProposal table. Each row is one cast vote.
export async function fetchOnchainVotesCount(user: Address): Promise<number> {
  const address = user.toLowerCase()
  const tables = [
    PROPOSALS_TABLE_NAMES[chainSlug],
    NON_PROJECT_PROPOSAL_TABLE_NAMES[chainSlug],
  ].filter(Boolean)

  let total = 0
  for (const table of tables) {
    try {
      const statement = `SELECT COUNT(*) AS c FROM ${table} WHERE LOWER(address) = '${address}'`
      const rows = (await queryTable(chain, statement)) as Array<{
        c: number | string
      }>
      total += Number(rows?.[0]?.c ?? 0)
    } catch (err) {
      console.error(`On-chain votes fetch failed for ${table}:`, err)
    }
  }
  return total
}

// Legacy: votes cast in MoonDAO's historical Snapshot space. Retained so
// Citizens who voted before the migration to on-chain governance still qualify.
export async function fetchSnapshotVotesCount(user: Address): Promise<number> {
  const endpoint = 'https://hub.snapshot.org/graphql'
  const query = gql`
    query Votes($address: String!) {
      votes(
        first: 1000
        skip: 0
        where: { voter: $address, space: "${SNAPSHOT_SPACE}" }
      ) {
        id
        voter
        choice
        created
        space {
          id
        }
      }
    }
  `
  try {
    const data = (await gqlRequest(endpoint, query, {
      address: user,
    })) as any
    const count = Array.isArray(data?.votes) ? data.votes.length : 0
    return count
  } catch (err) {
    console.error('Snapshot votes fetch failed:', err)
    return 0
  }
}

export async function fetchVotesCount(user: Address): Promise<number> {
  const [onchain, snapshot] = await Promise.all([
    fetchOnchainVotesCount(user),
    fetchSnapshotVotesCount(user),
  ])
  return onchain + snapshot
}
