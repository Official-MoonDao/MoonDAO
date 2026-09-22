import { FORECASTS_TABLE_NAMES } from 'const/config'
import { buildCitizenOwnerLookupStatement, citizenRowsByOwner } from '@/lib/citizen/citizenLookup'
import { aggregateForecastVotes, filterToCitizens } from '@/lib/forecasts/aggregate'
import { scoreAllocation } from '@/lib/forecasts/brier'
import type { ForecastCaller, ForecastConsensus } from '@/lib/forecasts/consensusTypes'
import { FORECAST_DAO_MIN_PARTICIPANTS } from '@/lib/forecasts/constants'
import {
  FORECAST_MAX_WEIGHT_SHARE,
  VMOONEY_UNAVAILABLE,
  capWeights,
  resolveVmooney,
  votingWeight,
} from '@/lib/forecasts/weighting'
import queryTable from '@/lib/tableland/queryTable'
import { v4SlugToV5Chain } from '@/lib/thirdweb/chain'
import { fetchTotalVMOONEYs } from '@/lib/tokens/hooks/useTotalVMOONEY'
import { deprizeForecastVoteId, parseForecastVotes, type ParsedForecastVote } from './forecastVote'

export type { ForecastCaller, ForecastConsensus, ParsedForecastVote }

function emptyConsensus(deprizeId: number, voteId: number, nOutcomes: number): ForecastConsensus {
  return {
    voteId,
    deprizeId,
    vector: Array.from({ length: nOutcomes }, () => 0),
    backersByOutcome: Array.from({ length: nOutcomes }, () => 0),
    participants: 0,
    totalWeight: 0,
    revealed: false,
    leaderboard: [],
  }
}

export async function fetchForecastConsensus(args: {
  chainSlug: string
  deprizeId: number
  outcomeCount: number
  resolvedVector?: number[] | null
}): Promise<ForecastConsensus> {
  const { chainSlug, deprizeId, outcomeCount, resolvedVector } = args
  const voteId = deprizeForecastVoteId(deprizeId)
  if (!Number.isInteger(outcomeCount) || outcomeCount <= 0) {
    return emptyConsensus(deprizeId, voteId, 0)
  }

  try {
    const chain = v4SlugToV5Chain(chainSlug)
    const forecastsTable = FORECASTS_TABLE_NAMES[chainSlug]
    if (!chain || !forecastsTable) return emptyConsensus(deprizeId, voteId, outcomeCount)

    const rows = await queryTable(chain, `SELECT * FROM ${forecastsTable} WHERE voteId = ${voteId}`)
    const parsed = parseForecastVotes(rows, outcomeCount)
    if (parsed.length === 0) return emptyConsensus(deprizeId, voteId, outcomeCount)

    const uniqueVoters = [...new Set(parsed.map((row) => row.voterAddress))]

    const balanceMap: Record<string, number> = {}
    try {
      const now = Math.floor(Date.now() / 1000)
      const balances = await fetchTotalVMOONEYs(uniqueVoters, now)
      for (let i = 0; i < uniqueVoters.length; i++) {
        balanceMap[uniqueVoters[i]] = balances[i] ?? 0
      }
    } catch (error) {
      console.error('[fetchForecastConsensus] vMOONEY batch read failed:', error)
      for (const addr of uniqueVoters) {
        balanceMap[addr] = VMOONEY_UNAVAILABLE
      }
    }

    const citizenStmt = buildCitizenOwnerLookupStatement(chainSlug, uniqueVoters)
    const citizenRows = citizenStmt ? await queryTable(chain, citizenStmt) : []
    const citizenByOwner = citizenRowsByOwner(citizenRows)
    const citizenVotes = filterToCitizens(parsed, [...citizenByOwner.keys()])

    const liveByVoter = new Map<string, number>()
    const rawWeights = citizenVotes.map((vote) => {
      const live = resolveVmooney(
        Number.isFinite(balanceMap[vote.voterAddress])
          ? balanceMap[vote.voterAddress]
          : VMOONEY_UNAVAILABLE,
        vote.storedVmooney
      )
      liveByVoter.set(vote.voterAddress, live)
      return votingWeight(live)
    })
    const shares = capWeights(rawWeights, FORECAST_MAX_WEIGHT_SHARE)
    const weighted = citizenVotes.map((vote, i) => ({
      ...vote,
      weight: shares[i] ?? 0,
    }))

    const aggregate = aggregateForecastVotes(weighted, outcomeCount)
    const totalWeight = rawWeights.reduce((acc, w) => acc + w, 0)

    const leaderboard: ForecastCaller[] = citizenVotes
      .map((vote, i) => {
        const citizen = citizenByOwner.get(vote.voterAddress)
        const scored = scoreAllocation(vote.allocation, resolvedVector)
        return {
          voterAddress: vote.voterAddress,
          citizenId: citizen?.id ?? '',
          citizenName: citizen?.name || vote.voterAddress,
          citizenImage: citizen?.image ?? undefined,
          allocation: vote.allocation,
          weight: rawWeights[i] ?? 0,
          storedVmooney: vote.storedVmooney,
          liveVmooney: liveByVoter.get(vote.voterAddress) ?? 0,
          updatedAt: vote.timestamp,
          brier: scored?.brier ?? null,
          skill: scored?.skill ?? null,
        }
      })
      .sort((a, b) => {
        if (a.skill != null && b.skill != null && a.skill !== b.skill) return b.skill - a.skill
        return b.weight - a.weight
      })

    return {
      voteId,
      deprizeId,
      vector: aggregate.vector,
      backersByOutcome: aggregate.backersByOutcome,
      participants: aggregate.participants,
      totalWeight,
      revealed: aggregate.participants >= FORECAST_DAO_MIN_PARTICIPANTS,
      leaderboard,
    }
  } catch (error) {
    console.error('[fetchForecastConsensus] fatal error:', error)
    return emptyConsensus(deprizeId, voteId, outcomeCount)
  }
}
