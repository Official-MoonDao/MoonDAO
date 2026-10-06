import {
  getSheetContributions,
  type Contribution,
} from './getSheetContributions'

// Matchup requests arrive one pick at a time, so keep the parsed sheet for a
// minute instead of re-downloading the CSV on every request.
const POOL_TTL_MS = 60 * 1000

let cached: { at: number; rows: Contribution[] } | null = null

export async function getMatchupPool(): Promise<Contribution[]> {
  if (cached && Date.now() - cached.at < POOL_TTL_MS) return cached.rows
  const rows = await getSheetContributions()
  // Don't cache an empty result: it usually means the fetch failed.
  if (rows.length > 0) cached = { at: Date.now(), rows }
  return rows
}

// Anonymous voters get a client-generated id; signed-in voters use their wallet.
export function parseVoterId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim().toLowerCase()
  return /^(0x[a-f0-9]{40}|anon-[a-z0-9-]{8,64})$/.test(v) ? v : null
}
