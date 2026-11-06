// Pure helpers for the shared contributions shape (see getContributions.ts).
import type { CitizenRow } from '@/lib/citizen/citizenLookup'
import type { ContributionEntry } from './archive'
import type { Contribution } from './getSheetContributions'
import { areaLabel, decodeLinks, type ContributionRow } from './onchain'

export function rowToEntry(row: ContributionRow): ContributionEntry {
  return {
    key: `chain:${row.id}`,
    source: 'onchain',
    id: Number(row.id),
    cycleId: Number(row.cycleId),
    wallet: String(row.author).toLowerCase(),
    name: `${row.author.slice(0, 6)}…${row.author.slice(-4)}`,
    title: row.title,
    description: row.description,
    area: row.area,
    links: decodeLinks(row.links),
    createdAt: Number(row.createdAt),
  }
}

/** Newest first; ties broken by key so the order is stable. */
export function sortEntries(entries: ContributionEntry[]): ContributionEntry[] {
  return [...entries].sort((a, b) => b.createdAt - a.createdAt || a.key.localeCompare(b.key))
}

/** Uses each wallet's current Citizen name when it has one. */
export function withCitizenNames(
  entries: ContributionEntry[],
  citizens: Map<string, CitizenRow>
): ContributionEntry[] {
  return entries.map((e) => {
    const name = e.wallet ? citizens.get(e.wallet)?.name : undefined
    return name ? { ...e, name } : e
  })
}

/** The feed's row shape, which the contributions page and home activity read. */
export function entryToFeedContribution(e: ContributionEntry): Contribution {
  return {
    timestamp: new Date(e.createdAt * 1000).toISOString(),
    walletAddress: e.wallet,
    name: e.name,
    description: e.description,
    links: e.links[0] ?? '',
    area: areaLabel(e.area),
    id: e.id,
    title: e.title,
    linkList: e.links,
    cycleId: e.cycleId,
  }
}
