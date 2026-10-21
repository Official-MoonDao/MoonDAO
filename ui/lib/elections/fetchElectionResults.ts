import { CITIZEN_TABLE_NAMES, DEFAULT_CHAIN_V5, VOTES_TABLE_NAMES } from 'const/config'
import { isValidEthAddress } from '@/lib/overview-delegate/leaderboard'
import { resolveCloseBlocks, type CloseBlocksByChain } from '@/lib/proposals/blockAtTimestamp'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { fetchTotalVMOONEYs, fetchTotalVMOONEYsAtBlocks } from '@/lib/tokens/hooks/useTotalVMOONEY'
import { ballotChoices, Election, NONE_OF_THE_ABOVE_KEY } from './elections'
import { computeRankedChoiceTally, parseRankedBallot, RankedChoiceTally } from './rankedChoice'

export type ElectionVoter = {
  address: string
  votingPower: number
  ballot: number[]
  citizenName?: string
  citizenId?: number | string
}

export type ElectionResults = {
  voters: ElectionVoter[]
  totalVoters: number
  totalVP: number
  tally: RankedChoiceTally
  // 'projected': √vMOONEY projected to `closesAt` (voting still open).
  // 'historical': √vMOONEY read at each chain's block at `closesAt`.
  powerSource: 'projected' | 'historical'
  closeBlocks: CloseBlocksByChain | null
  generatedAt: string | null
}

export function emptyElectionResults(election: Election): ElectionResults {
  return {
    voters: [],
    totalVoters: 0,
    totalVP: 0,
    tally: computeRankedChoiceTally([], {}, ballotChoices(election), noneKey(election)),
    powerSource: 'projected',
    closeBlocks: null,
    generatedAt: null,
  }
}

function noneKey(election: Election) {
  return election.includeNone ? NONE_OF_THE_ABOVE_KEY : null
}

// Override for reading vMOONEY (one value per address). Lets tests supply
// voting power without wallets that actually hold vMOONEY.
type VMooneyReader = (addresses: string[], closeTimestamp: number) => Promise<number[]>

export async function fetchElectionResults(
  election: Election,
  options: { readVMOONEYs?: VMooneyReader } = {}
): Promise<ElectionResults> {
  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)
  const votesTableName = VOTES_TABLE_NAMES[chainSlug]
  const choices = ballotChoices(election)
  if (!votesTableName || !election.closesAt) return emptyElectionResults(election)

  const rows: any[] =
    (await queryTable(
      chain,
      `SELECT * FROM ${votesTableName} WHERE voteId = ${election.voteId}`
    )) ?? []

  const keys = choices.map((c) => c.key)
  const ballots = new Map<string, number[]>()
  for (const row of rows) {
    const address = String(row?.address ?? '').toLowerCase()
    if (!isValidEthAddress(address) || ballots.has(address)) continue
    const ballot = parseRankedBallot(row.vote, keys)
    if (ballot.length > 0) ballots.set(address, ballot)
  }
  const addresses = Array.from(ballots.keys())
  if (addresses.length === 0) return emptyElectionResults(election)

  const closeTimestamp = Math.floor(Date.parse(election.closesAt) / 1000)
  const isPastClose = Date.now() / 1000 >= closeTimestamp
  let closeBlocks: CloseBlocksByChain | null = null
  let vMOONEYs: number[]
  if (options.readVMOONEYs) {
    vMOONEYs = await options.readVMOONEYs(addresses, closeTimestamp)
  } else if (isPastClose) {
    closeBlocks = await resolveCloseBlocks(closeTimestamp)
    vMOONEYs = await fetchTotalVMOONEYsAtBlocks(addresses, closeBlocks)
  } else {
    vMOONEYs = await fetchTotalVMOONEYs(addresses, closeTimestamp)
  }
  const power: Record<string, number> = {}
  addresses.forEach((address, i) => {
    const v = Number(vMOONEYs?.[i]) || 0
    power[address] = v > 0 ? Math.sqrt(v) : 0
  })

  const voters: ElectionVoter[] = addresses
    .map((address) => ({ address, votingPower: power[address], ballot: ballots.get(address)! }))
    .filter((v) => v.votingPower > 0)
    .sort((a, b) => b.votingPower - a.votingPower)

  try {
    const citizenTableName = CITIZEN_TABLE_NAMES[chainSlug]
    if (citizenTableName && voters.length > 0) {
      const inClause = voters.map((v) => `'${v.address}'`).join(',')
      const citizens: any[] =
        (await queryTable(
          chain,
          `SELECT id, name, owner FROM ${citizenTableName} WHERE LOWER(owner) IN (${inClause})`
        )) ?? []
      const byOwner = new Map(citizens.map((c) => [String(c.owner).toLowerCase(), c]))
      for (const voter of voters) {
        const match = byOwner.get(voter.address)
        if (match) {
          voter.citizenName = match.name
          voter.citizenId = match.id
        }
      }
    }
  } catch (error) {
    console.error('[fetchElectionResults] citizen lookup failed:', error)
  }

  const tally = computeRankedChoiceTally(
    voters.map((v) => ({ address: v.address, vote: v.ballot })),
    power,
    choices,
    noneKey(election)
  )

  return {
    voters,
    totalVoters: voters.length,
    totalVP: tally.totalParticipationVP,
    tally,
    powerSource: isPastClose ? 'historical' : 'projected',
    closeBlocks,
    generatedAt: null,
  }
}

// Strips everything that would reveal how people voted. Used while the
// election is still open so the page props don't leak the running tally.
export function sealElectionResults(
  election: Election,
  results: ElectionResults
): ElectionResults {
  const empty = emptyElectionResults(election)
  return {
    ...results,
    voters: results.voters.map((v) => ({ ...v, ballot: [] })),
    tally: { ...empty.tally, totalParticipationVP: results.totalVP, ballotCount: results.totalVoters },
  }
}
