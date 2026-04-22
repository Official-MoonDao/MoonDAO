export type ParsedDelegation = {
  delegatorAddress: string
  delegateeAddress: string
  storedAmount: number
}

export type AggregatedEntry = {
  delegateeAddress: string
  totalDelegated: number
  delegatorCount: number
}

export type LeaderboardEntry = {
  delegateeAddress: string
  citizenId: number | string
  citizenName: string
  citizenImage?: string
  totalDelegated: number
  delegatorCount: number
}

export function parseDelegations(
  rows: any[]
): ParsedDelegation[] {
  const delegations: ParsedDelegation[] = []
  for (const row of rows) {
    try {
      const vote =
        typeof row.vote === 'string' ? JSON.parse(row.vote) : row.vote
      const entries = Object.entries(vote)
      if (entries.length > 0) {
        const [delegateeAddress, amount] = entries[0]
        delegations.push({
          delegatorAddress: (row.address as string).toLowerCase(),
          delegateeAddress: (delegateeAddress as string).toLowerCase(),
          storedAmount: Number(amount) || 0,
        })
      }
    } catch {
      continue
    }
  }
  return delegations
}

export function aggregateDelegations(
  delegations: ParsedDelegation[],
  balanceMap: Record<string, number>
): AggregatedEntry[] {
  const aggregated: Record<
    string,
    { totalDelegated: number; delegatorCount: number }
  > = {}

  for (const d of delegations) {
    const currentBalance = balanceMap[d.delegatorAddress] ?? 0
    const effective = Number.isFinite(currentBalance)
      ? currentBalance
      : d.storedAmount
    if (effective <= 0) continue

    const key = d.delegateeAddress
    if (!aggregated[key]) {
      aggregated[key] = { totalDelegated: 0, delegatorCount: 0 }
    }
    aggregated[key].totalDelegated += effective
    aggregated[key].delegatorCount += 1
  }

  return Object.entries(aggregated).map(([addr, data]) => ({
    delegateeAddress: addr,
    totalDelegated: Math.round(data.totalDelegated * 100) / 100,
    delegatorCount: data.delegatorCount,
  }))
}

export function buildLeaderboard(
  aggregated: AggregatedEntry[],
  // `id` is widened to `number | string` to match `LeaderboardEntry.citizenId`
  // and the actual shape coming back from Tableland (which can return numeric
  // columns as strings depending on the gateway). Callers no longer need an
  // `as any` cast here.
  citizenMap: Record<
    string,
    { id: number | string; name: string; image?: string }
  >,
  limit?: number
): LeaderboardEntry[] {
  const leaderboard: LeaderboardEntry[] = []

  for (const entry of aggregated) {
    const citizen = citizenMap[entry.delegateeAddress]
    if (!citizen) continue
    leaderboard.push({
      delegateeAddress: entry.delegateeAddress,
      citizenId: citizen.id,
      citizenName: citizen.name || '',
      citizenImage: citizen.image,
      totalDelegated: entry.totalDelegated,
      delegatorCount: entry.delegatorCount,
    })
  }

  leaderboard.sort((a, b) => b.totalDelegated - a.totalDelegated)
  return limit != null ? leaderboard.slice(0, limit) : leaderboard
}

export function applyOptimisticUpdate(
  current: LeaderboardEntry[],
  newDelegation: {
    delegateeAddress: string
    citizenId: number | string
    citizenName: string
    citizenImage?: string
    amount: number
  },
  previousDelegation: { delegatee: string; amount: number } | null,
  isRedelegation: boolean
): LeaderboardEntry[] {
  const optimistic = [...current]

  if (isRedelegation && previousDelegation) {
    const oldIdx = optimistic.findIndex(
      (e) => e.delegateeAddress === previousDelegation.delegatee
    )
    if (oldIdx >= 0) {
      const isSameCitizen =
        previousDelegation.delegatee === newDelegation.delegateeAddress
      optimistic[oldIdx] = {
        ...optimistic[oldIdx],
        totalDelegated: Math.max(
          0,
          optimistic[oldIdx].totalDelegated - previousDelegation.amount
        ),
        delegatorCount: isSameCitizen
          ? optimistic[oldIdx].delegatorCount
          : Math.max(0, optimistic[oldIdx].delegatorCount - 1),
      }
      if (optimistic[oldIdx].totalDelegated <= 0) {
        optimistic.splice(oldIdx, 1)
      }
    }
  }

  const newIdx = optimistic.findIndex(
    (e) => e.delegateeAddress === newDelegation.delegateeAddress
  )
  if (newIdx >= 0) {
    const wasRedelegationToSame =
      isRedelegation &&
      previousDelegation?.delegatee === newDelegation.delegateeAddress
    optimistic[newIdx] = {
      ...optimistic[newIdx],
      totalDelegated: optimistic[newIdx].totalDelegated + newDelegation.amount,
      delegatorCount: wasRedelegationToSame
        ? optimistic[newIdx].delegatorCount
        : optimistic[newIdx].delegatorCount + 1,
    }
  } else {
    optimistic.push({
      delegateeAddress: newDelegation.delegateeAddress,
      citizenId: newDelegation.citizenId,
      citizenName: newDelegation.citizenName,
      citizenImage: newDelegation.citizenImage,
      totalDelegated: newDelegation.amount,
      delegatorCount: 1,
    })
  }

  optimistic.sort((a, b) => b.totalDelegated - a.totalDelegated)
  return optimistic
}

export function sanitizeSearchQuery(query: string): string {
  return query
    .trim()
    .replace(/'/g, "''")
    .replace(/%/g, '')
    .replace(/_/g, '')
}

export function isValidEthAddress(s: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(s)
}

/**
 * Case-insensitive lookup of a delegatee address in the leaderboard.
 * Returns citizen metadata if found, null otherwise.
 */
export function resolveVoteCitizenInfo(
  delegateeAddress: string,
  leaderboard: LeaderboardEntry[]
): {
  citizenName: string
  citizenImage?: string
  citizenId: number | string
} | null {
  const lower = delegateeAddress.toLowerCase()
  const match = leaderboard.find(
    (e) => e.delegateeAddress.toLowerCase() === lower
  )
  if (!match) return null
  return {
    citizenName: match.citizenName,
    citizenImage: match.citizenImage,
    citizenId: match.citizenId,
  }
}

const RANK_EMOJIS = ['🥇', '🥈', '🥉']

/**
 * Formats the top entries of a leaderboard into a Discord-markdown string.
 * Each line shows rank, linked citizen name, total delegated, and backer count.
 */
export function formatLeaderboardStandings(
  leaderboard: LeaderboardEntry[],
  origin: string,
  formatLink: (name: string, id: string | number) => string,
  limit = 10
): string {
  return leaderboard
    .slice(0, limit)
    .map((entry, i) => {
      const rank = i < 3 ? RANK_EMOJIS[i] : `${i + 1}.`
      const name = entry.citizenName || `Citizen #${entry.citizenId}`
      const link = entry.citizenName
        ? `[${name}](${origin}/citizen/${formatLink(name, String(entry.citizenId))})`
        : name
      const amount = entry.totalDelegated.toLocaleString('en-US', {
        maximumFractionDigits: 0,
      })
      return `${rank} **${link}** — ${amount} $OVERVIEW (${entry.delegatorCount} backer${entry.delegatorCount !== 1 ? 's' : ''})`
    })
    .join('\n')
}
