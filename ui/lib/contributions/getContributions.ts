//server-side only
// One reader for every contribution: the offchain archive (everything before
// the in-app form) merged with the onchain table (everything after). Callers
// get one shape and never need to know which store a row came from.
import { MAX_CITIZEN_LOOKUP_ADDRESSES, type CitizenRow } from '@/lib/citizen/citizenLookup'
import { getArchiveEntries, type ContributionEntry } from './archive'
import { rowToEntry, sortEntries, withCitizenNames } from './entries'
import { getAllContributionRows, getCitizensForAuthors } from './getOnchainContributions'
import { isSubmittedOrigin } from './onchain'

export type { ContributionEntry }
export { entryToFeedContribution } from './entries'

async function citizensFor(wallets: string[]): Promise<Map<string, CitizenRow>> {
  const unique = [...new Set(wallets.filter(Boolean))]
  const chunks: string[][] = []
  for (let i = 0; i < unique.length; i += MAX_CITIZEN_LOOKUP_ADDRESSES)
    chunks.push(unique.slice(i, i + MAX_CITIZEN_LOOKUP_ADDRESSES))
  const maps = await Promise.all(chunks.map((c) => getCitizensForAuthors(c)))
  return new Map(maps.flatMap((m) => [...m]))
}

/**
 * Contributions from both stores, newest first, optionally narrowed to one
 * cycle or one wallet. Imported onchain rows (origin 1) are left out: the
 * archive already holds that history.
 */
export async function getContributions(
  filter: { cycleId?: number; wallet?: string } = {}
): Promise<ContributionEntry[]> {
  const [archive, rows] = await Promise.all([getArchiveEntries(), getAllContributionRows()])
  const wallet = filter.wallet?.toLowerCase()
  const entries = [...archive, ...rows.filter((r) => isSubmittedOrigin(r.origin)).map(rowToEntry)]
    .filter((e) => filter.cycleId == null || e.cycleId === filter.cycleId)
    .filter((e) => !wallet || e.wallet === wallet)
  const citizens = await citizensFor(entries.map((e) => e.wallet))
  return sortEntries(withCitizenNames(entries, citizens))
}
