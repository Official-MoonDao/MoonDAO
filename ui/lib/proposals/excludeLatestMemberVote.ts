/**
 * One-shot helper used by the Member Vote tally pipeline (both the
 * read-only `computeMemberVoteOutcome` and the on-chain close in
 * `pages/api/proposals/vote.ts`) to exclude the most-recently-submitted
 * distribution row from a quarter's tally.
 *
 * "Most recent" is defined by the Tableland auto-increment primary key
 * (`id`) on the proposals table — it's monotonic in submission order, so
 * the row with the highest `id` for the (quarter, year) is always the
 * latest insert/update.
 *
 * Gating rules (kept here so both call sites can't drift):
 *   - The exclusion only fires when the requested (quarter, year) matches
 *     the *current* calendar quarter. Past-quarter audits/tallies have
 *     to reproduce their original outcome exactly, so we never touch
 *     historical inputs.
 *   - Controlled by the `EXCLUDE_LATEST_MEMBER_VOTE_FOR_CURRENT_CYCLE`
 *     flag in `const/config.ts`; passed in (rather than imported here)
 *     so this helper stays a pure function and is easy to unit-test.
 *   - Rows without a numeric `id` are left alone — keeps unit-test
 *     fixtures and any synthetic input that doesn't go through Tableland
 *     working unchanged.
 */
import { getCurrentQuarter } from '@/lib/utils/dates'
import type { DistributionVote } from '@/lib/tableland/types'

export type ExcludeLatestMemberVoteResult = {
  /** Votes after the exclusion (same reference as input when no-op). */
  votes: DistributionVote[]
  /** The row that was dropped, if any — useful for audit logging. */
  excluded: DistributionVote | null
}

export function excludeLatestMemberVoteIfApplicable({
  votes,
  quarter,
  year,
  enabled,
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
  enabled: boolean
  currentQuarter?: { quarter: number; year: number }
}): ExcludeLatestMemberVoteResult {
  if (!enabled || !votes || votes.length === 0) {
    return { votes, excluded: null }
  }

  const current = currentQuarter ?? getCurrentQuarter()
  if (quarter !== current.quarter || year !== current.year) {
    return { votes, excluded: null }
  }

  const maxId = votes.reduce((max, v) => {
    const id = Number(v.id)
    return Number.isFinite(id) && id > max ? id : max
  }, -Infinity)

  if (!Number.isFinite(maxId)) {
    return { votes, excluded: null }
  }

  const excluded = votes.find((v) => Number(v.id) === maxId) ?? null
  const filtered = votes.filter((v) => Number(v.id) !== maxId)
  return { votes: filtered, excluded }
}
