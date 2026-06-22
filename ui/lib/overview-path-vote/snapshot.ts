import type { PathVoteResults } from './fetchResults'
import rawSnapshot from './closed-snapshot.json'

/**
 * Frozen final tally for the "Send Frank to Space — Path Forward" vote.
 *
 * Generated once at close with `yarn snapshot:path-vote` and committed as
 * `closed-snapshot.json` so the published outcome is permanent: it does not re-tally
 * live $OVERVIEW balances on every ISR revalidation (which would let the
 * "final" numbers drift as token holders move funds after the vote closed).
 */
export type PathVoteSnapshot = PathVoteResults & {
  /** ISO-8601 timestamp the snapshot was generated, or null if never run. */
  generatedAt: string | null
}

export function getPathVoteSnapshot(): PathVoteSnapshot {
  return rawSnapshot as PathVoteSnapshot
}

/**
 * Whether the committed snapshot actually holds tallied data. Guards against
 * flipping OVERVIEW_PATH_VOTE_CLOSED on before the snapshot has been generated,
 * which would otherwise publish an all-zero result.
 */
export function hasPathVoteSnapshot(): boolean {
  const snap = rawSnapshot as PathVoteSnapshot
  return Boolean(snap.generatedAt) && snap.totalVoters > 0
}
