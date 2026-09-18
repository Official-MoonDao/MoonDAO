/** On-chain payload contract for a DePrize prediction stored in Votes.sol. */

export const DEPRIZE_FORECAST_VOTE_ID_BASE = 1000
export const FORECAST_VOTE_SCHEMA_VERSION = 1

export type ForecastVotePayload = {
  allocation: number[]
  vmooney: number
}

export type ParsedForecastVote = {
  voterAddress: string
  allocation: number[]
  storedVmooney: number
}

export function deprizeForecastVoteId(deprizeId: number): number {
  return DEPRIZE_FORECAST_VOTE_ID_BASE + deprizeId
}

export function isValidAllocation(allocation: readonly number[]): boolean {
  if (!Array.isArray(allocation) || allocation.length === 0) return false
  let sum = 0
  for (const value of allocation) {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      return false
    }
    sum += value
  }
  return sum === 100
}

export function encodeForecastVote(allocation: number[], vmooney: number): string {
  if (!isValidAllocation(allocation)) {
    throw new Error('invalid-allocation')
  }
  const a: Record<string, number> = {}
  for (let i = 0; i < allocation.length; i++) {
    if (allocation[i] > 0) a[String(i)] = allocation[i]
  }
  return JSON.stringify({
    v: FORECAST_VOTE_SCHEMA_VERSION,
    a,
    vp: vmooney,
  })
}

export function decodeForecastVote(
  raw: unknown,
  nOutcomes: number
): ForecastVotePayload | null {
  if (raw == null || !Number.isInteger(nOutcomes) || nOutcomes <= 0) return null
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null
    if ((obj as { v?: unknown }).v !== FORECAST_VOTE_SCHEMA_VERSION) return null
    const a = (obj as { a?: unknown }).a
    if (!a || typeof a !== 'object' || Array.isArray(a)) return null

    const allocation = Array.from({ length: nOutcomes }, () => 0)
    for (const [key, value] of Object.entries(a as Record<string, unknown>)) {
      const idx = Number(key)
      if (!Number.isInteger(idx) || idx < 0 || idx >= nOutcomes) return null
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) return null
      allocation[idx] = value
    }
    if (!isValidAllocation(allocation)) return null

    const vp = (obj as { vp?: unknown }).vp
    const vmooney = typeof vp === 'number' && Number.isFinite(vp) && vp >= 0 ? vp : 0
    return { allocation, vmooney }
  } catch {
    return null
  }
}

export function parseForecastVotes(rows: unknown, nOutcomes: number): ParsedForecastVote[] {
  if (!Array.isArray(rows)) return []
  const parsed: ParsedForecastVote[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const address = (row as { address?: unknown }).address
    if (typeof address !== 'string' || address.length === 0) continue
    const decoded = decodeForecastVote((row as { vote?: unknown }).vote, nOutcomes)
    if (!decoded) continue
    parsed.push({
      voterAddress: address.toLowerCase(),
      allocation: decoded.allocation,
      storedVmooney: decoded.vmooney,
    })
  }
  return parsed
}

export function allocationVector(allocation: readonly number[]): number[] {
  const sum = allocation.reduce((acc, value) => acc + value, 0)
  if (!(sum > 0)) return allocation.map(() => 0)
  return allocation.map((value) => value / sum)
}
