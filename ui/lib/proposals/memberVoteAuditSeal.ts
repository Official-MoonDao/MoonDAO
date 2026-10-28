import type { MemberVoteOutcome } from '@/lib/proposals/computeMemberVoteOutcome'

/**
 * Whether the public Member Vote audit must stay sealed.
 *
 * `/projects` already hides the results panel while submissions are open
 * (`memberVoteSubmissionsOpen`). `/projects/audit` is a direct URL that
 * used to return the same ballots anyway — who voted for which project
 * and the running tally. Seal that payload for the live cycle only.
 * Past quarters stay public so historical audits remain reproducible.
 */
export function isOpenMemberVoteAuditSealed({
  quarter,
  year,
  cycleQuarter,
  cycleYear,
  memberVoteSubmissionsOpen,
}: {
  quarter: number
  year: number
  cycleQuarter: number
  cycleYear: number
  memberVoteSubmissionsOpen: boolean
}): boolean {
  return memberVoteSubmissionsOpen && quarter === cycleQuarter && year === cycleYear
}

export type MemberVoteAuditPayload = {
  outcome: MemberVoteOutcome | null
  sealed: boolean
  quarter: number
  year: number
}

/**
 * Build the public audit payload. When the live vote is sealed, `compute`
 * is not called, so ballots are never loaded for that request.
 */
export async function loadMemberVoteAudit(params: {
  quarter: number
  year: number
  cycleQuarter: number
  cycleYear: number
  memberVoteSubmissionsOpen: boolean
  compute: () => Promise<MemberVoteOutcome | null>
}): Promise<MemberVoteAuditPayload> {
  const { quarter, year } = params
  if (
    isOpenMemberVoteAuditSealed({
      quarter,
      year,
      cycleQuarter: params.cycleQuarter,
      cycleYear: params.cycleYear,
      memberVoteSubmissionsOpen: params.memberVoteSubmissionsOpen,
    })
  ) {
    return { outcome: null, sealed: true, quarter, year }
  }
  const outcome = await params.compute()
  return { outcome: outcome ?? null, sealed: false, quarter, year }
}
