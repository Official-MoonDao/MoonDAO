import { PROJECT_ACTIVE, PROJECT_VOTE_FAILED } from '@/lib/nance/types'

export function isSnapshotVoteRow(row: any): boolean {
  let parsed: any = row?.vote
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed)
    } catch {
      // Unparseable but present: a real voter row, not the snapshot sentinel.
      return false
    }
  }
  return !!(parsed && typeof parsed === 'object' && parsed.kind === 'snapshot')
}

export function isDecidedMemberVote(active: unknown): boolean {
  return active === PROJECT_ACTIVE || active === PROJECT_VOTE_FAILED
}

export type SnapshotRetryDecision =
  | { write: true }
  | { write: false; status: number; body: Record<string, unknown> }

export function snapshotRetryDecision({
  decidedPassed,
  tallyPassed,
  hasSnapshotRow,
  votingPowerUnavailable,
}: {
  decidedPassed: boolean
  tallyPassed: boolean
  hasSnapshotRow: boolean
  votingPowerUnavailable: boolean
}): SnapshotRetryDecision {
  if (hasSnapshotRow) {
    return { write: false, status: 200, body: { written: true, alreadyExisted: true } }
  }
  if (votingPowerUnavailable) {
    return {
      write: false,
      status: 503,
      body: {
        error:
          'Could not resolve voting power (all voters returned 0 vMOONEY). ' +
          'This usually indicates a transient RPC/Engine failure. Please retry.',
      },
    }
  }
  // A snapshot that contradicts the recorded decision would mislead every
  // page render, so a recount that has drifted since the close is refused.
  if (tallyPassed !== decidedPassed) {
    return {
      write: false,
      status: 409,
      body: {
        error:
          'A recount no longer matches the recorded result, so no snapshot was ' +
          'written. The page keeps showing the live tally.',
      },
    }
  }
  return { write: true }
}
