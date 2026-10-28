import { PROJECT_CYCLE } from 'const/config'
import type { MemberVoteOutcome } from '../../../lib/proposals/computeMemberVoteOutcome'
import {
  isOpenMemberVoteAuditSealed,
  loadMemberVoteAudit,
} from '../../../lib/proposals/memberVoteAuditSeal'

const cycle = {
  quarter: PROJECT_CYCLE.quarter,
  year: PROJECT_CYCLE.year,
}

const past =
  cycle.quarter === 1
    ? { quarter: 4, year: cycle.year - 1 }
    : { quarter: cycle.quarter - 1, year: cycle.year }

describe('open member vote audit seal', () => {
  it('hides the current cycle while submissions are open', () => {
    expect(
      isOpenMemberVoteAuditSealed({
        quarter: cycle.quarter,
        year: cycle.year,
        cycleQuarter: cycle.quarter,
        cycleYear: cycle.year,
        memberVoteSubmissionsOpen: true,
      })
    ).to.equal(true)
  })

  it('publishes the current cycle once submissions close', () => {
    expect(
      isOpenMemberVoteAuditSealed({
        quarter: cycle.quarter,
        year: cycle.year,
        cycleQuarter: cycle.quarter,
        cycleYear: cycle.year,
        memberVoteSubmissionsOpen: false,
      })
    ).to.equal(false)
  })

  it('leaves a past cycle public while the current vote is open', () => {
    expect(
      isOpenMemberVoteAuditSealed({
        quarter: past.quarter,
        year: past.year,
        cycleQuarter: cycle.quarter,
        cycleYear: cycle.year,
        memberVoteSubmissionsOpen: true,
      })
    ).to.equal(false)
  })
})

describe('loadMemberVoteAudit', () => {
  const fakeOutcome = { quarter: cycle.quarter, year: cycle.year } as MemberVoteOutcome

  it('does not load ballots while the current vote is open', async () => {
    let computed = false
    const payload = await loadMemberVoteAudit({
      quarter: cycle.quarter,
      year: cycle.year,
      cycleQuarter: cycle.quarter,
      cycleYear: cycle.year,
      memberVoteSubmissionsOpen: true,
      compute: async () => {
        computed = true
        return fakeOutcome
      },
    })
    expect(computed).to.equal(false)
    expect(payload).to.deep.equal({
      outcome: null,
      sealed: true,
      quarter: cycle.quarter,
      year: cycle.year,
    })
  })

  it('returns the tally once submissions close', async () => {
    const payload = await loadMemberVoteAudit({
      quarter: cycle.quarter,
      year: cycle.year,
      cycleQuarter: cycle.quarter,
      cycleYear: cycle.year,
      memberVoteSubmissionsOpen: false,
      compute: async () => fakeOutcome,
    })
    expect(payload.sealed).to.equal(false)
    expect(payload.outcome).to.equal(fakeOutcome)
  })

  it('still loads a past quarter during an open vote', async () => {
    const payload = await loadMemberVoteAudit({
      quarter: past.quarter,
      year: past.year,
      cycleQuarter: cycle.quarter,
      cycleYear: cycle.year,
      memberVoteSubmissionsOpen: true,
      compute: async () => fakeOutcome,
    })
    expect(payload.sealed).to.equal(false)
    expect(payload.outcome).to.equal(fakeOutcome)
    expect(payload.quarter).to.equal(past.quarter)
  })
})
