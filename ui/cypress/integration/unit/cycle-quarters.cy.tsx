import { PROJECT_CYCLE } from 'const/config'
import {
  getProposalCycle,
  getRetroCohort,
  getSubmissionTargetCycle,
  shiftQuarter,
} from '../../../lib/projectCycle/cycleQuarters'

describe('cycleQuarters', () => {
  it('reads the proposal cycle from PROJECT_CYCLE', () => {
    expect(getProposalCycle()).to.deep.equal({
      quarter: PROJECT_CYCLE.quarter,
      year: PROJECT_CYCLE.year,
    })
  })

  it('rolls the retro cohort back one quarter, including Q1 → prior Q4', () => {
    expect(getRetroCohort({ quarter: 4, year: 2026 })).to.deep.equal({
      quarter: 3,
      year: 2026,
    })
    expect(getRetroCohort({ quarter: 1, year: 2027 })).to.deep.equal({
      quarter: 4,
      year: 2026,
    })
    expect(shiftQuarter({ quarter: 1, year: 2027 }, -1)).to.deep.equal({
      quarter: 4,
      year: 2026,
    })
  })

  it('tags new proposals to the live cycle during intake', () => {
    expect(getSubmissionTargetCycle('intake')).to.deep.equal(getProposalCycle())
  })

  it('retargets new proposals to the next cycle once the slate locks', () => {
    expect(getSubmissionTargetCycle('senate', { quarter: 4, year: 2026 })).to.deep.equal({
      quarter: 1,
      year: 2027,
    })
    expect(getSubmissionTargetCycle('member', { quarter: 4, year: 2026 })).to.deep.equal({
      quarter: 1,
      year: 2027,
    })
    expect(getSubmissionTargetCycle('idle', { quarter: 4, year: 2026 })).to.deep.equal({
      quarter: 1,
      year: 2027,
    })
  })
})
