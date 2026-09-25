/** Weighted allocation aggregation for the DAO forecast distribution. */

export type ForecastVoteWeight = {
  voterAddress: string
  allocation: number[]
  weight: number
}

export type ForecastAggregate = {
  vector: number[]
  totalWeight: number
  participants: number
  backersByOutcome: number[]
}

export function filterToCitizens<T extends { voterAddress: string }>(
  votes: readonly T[],
  citizenAddresses: readonly string[]
): T[] {
  const citizens = new Set(citizenAddresses.map((address) => address.toLowerCase()))
  return votes.filter((vote) => citizens.has(vote.voterAddress.toLowerCase()))
}

export function aggregateForecastVotes(
  votes: readonly ForecastVoteWeight[],
  nOutcomes: number
): ForecastAggregate {
  const vector = Array.from({ length: nOutcomes }, () => 0)
  const backersByOutcome = Array.from({ length: nOutcomes }, () => 0)
  let totalWeight = 0

  for (const vote of votes) {
    const weight = Number.isFinite(vote.weight) && vote.weight > 0 ? vote.weight : 0
    totalWeight += weight
    for (let i = 0; i < nOutcomes; i++) {
      const alloc = vote.allocation[i] ?? 0
      if (alloc > 0) backersByOutcome[i] += 1
      vector[i] += weight * (alloc / 100)
    }
  }

  if (totalWeight > 0) {
    for (let i = 0; i < nOutcomes; i++) vector[i] /= totalWeight
  }

  return {
    vector,
    totalWeight,
    participants: votes.length,
    backersByOutcome,
  }
}

/**
 * Voting power behind each outcome.
 * Sum of weight × (allocation / 100). Not divided by total weight, so a
 * one-hot pick contributes that citizen's whole voting power to one option.
 */
export function votingPowerByOutcome(
  votes: readonly { allocation: readonly number[]; weight: number }[],
  nOutcomes: number
): number[] {
  if (!Number.isInteger(nOutcomes) || nOutcomes <= 0) return []

  const totals = Array.from({ length: nOutcomes }, () => 0)
  for (const vote of votes) {
    const weight = Number.isFinite(vote.weight) && vote.weight > 0 ? vote.weight : 0
    for (let i = 0; i < nOutcomes; i++) {
      const allocRaw = vote.allocation?.[i] ?? 0
      const alloc = Number.isFinite(allocRaw) ? allocRaw : 0
      totals[i] += weight * (alloc / 100)
    }
  }
  return totals
}
