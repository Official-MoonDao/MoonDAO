/**
 * One-shot helper used by the Member Vote tally pipeline (both the
 * read-only `computeMemberVoteOutcome` and the on-chain close in
 * `pages/api/proposals/vote.ts`) to drop disqualified addresses from a
 * quarter's tally.
 *
 * "Disqualified" is whatever the EB encodes in
 * `MEMBER_VOTE_EXCLUDED_ADDRESSES` (in `const/config.ts`). The list is
 * passed in rather than imported here so this stays a pure function
 * (easy to unit-test) and so callers can pass an empty list to opt out.
 *
 * Gating rules (kept here so both call sites can't drift):
 *   - The exclusion only fires when the requested (quarter, year)
 *     matches the *current* calendar quarter. Past-quarter audits/
 *     tallies have to reproduce their original outcome exactly, so we
 *     never touch historical inputs.
 *   - Address comparison is case-insensitive (Tableland sometimes
 *     echoes EIP-55 mixed case, the constant is stored lowercase).
 *   - The disqualified rows stay in the Tableland table — we just
 *     omit them from the array we hand back. Audit trail is preserved
 *     on chain even though they don't count toward the outcome.
 */
import { getCurrentQuarter } from '@/lib/utils/dates'
import type { DistributionVote } from '@/lib/tableland/types'

export type ExcludeMemberVotesResult = {
  /** Votes after the exclusion (same reference as input when no-op). */
  votes: DistributionVote[]
  /** Rows that were dropped, in input order — useful for audit logging. */
  excluded: DistributionVote[]
}

export function excludeMemberVotesByAddress({
  votes,
  quarter,
  year,
  excludedAddresses,
  /**
   * Override for the "current calendar quarter" check. Tests pin this so
   * they don't depend on the wall clock; production callers leave it
   * undefined and we read `getCurrentQuarter()`.
   */
  currentQuarter,
}: {
  votes: DistributionVote[]
  quarter: number
  year: number
  excludedAddresses: string[]
  currentQuarter?: { quarter: number; year: number }
}): ExcludeMemberVotesResult {
  if (
    !excludedAddresses ||
    excludedAddresses.length === 0 ||
    !votes ||
    votes.length === 0
  ) {
    return { votes, excluded: [] }
  }

  const current = currentQuarter ?? getCurrentQuarter()
  if (quarter !== current.quarter || year !== current.year) {
    return { votes, excluded: [] }
  }

  const excludedSet = new Set(
    excludedAddresses
      .filter((a): a is string => typeof a === 'string' && a.length > 0)
      .map((a) => a.toLowerCase())
  )
  if (excludedSet.size === 0) {
    return { votes, excluded: [] }
  }

  const kept: DistributionVote[] = []
  const excluded: DistributionVote[] = []
  for (const v of votes) {
    const addr = typeof v.address === 'string' ? v.address.toLowerCase() : ''
    if (addr && excludedSet.has(addr)) {
      excluded.push(v)
    } else {
      kept.push(v)
    }
  }

  // No matches: hand back the original array reference so callers that
  // identity-compare can short-circuit.
  if (excluded.length === 0) {
    return { votes, excluded: [] }
  }

  return { votes: kept, excluded }
}
