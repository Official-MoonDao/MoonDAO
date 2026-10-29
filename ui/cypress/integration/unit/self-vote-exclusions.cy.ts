import {
  buildSelfVoteExclusions,
  isSelfVoteExcluded,
  teamSelfVoteRuleApplies,
} from '@/lib/proposals/selfVoteExclusions'

const AUTHOR = '0x4CBf10c36b481d6afF063070E35b4F42E7Aad201'
const MEMBER_A = '0x4911503fcf75ecb454ded9e4677e16a185569e25'
const MEMBER_B = '0x86c779b3741e83a36a2a236780d436e4ec673af4'
const OUTSIDER = '0x000000000000000000000000000000000000dEaD'

describe('selfVoteExclusions', () => {
  it('applies the team rule from Q4 2026 onward only', () => {
    expect(teamSelfVoteRuleApplies(3, 2026)).to.equal(false)
    expect(teamSelfVoteRuleApplies(4, 2025)).to.equal(false)
    expect(teamSelfVoteRuleApplies(4, 2026)).to.equal(true)
    expect(teamSelfVoteRuleApplies(1, 2027)).to.equal(true)
  })

  it('bars the author and every team wallet from their own project, case-insensitively', () => {
    const exclusions = buildSelfVoteExclusions({
      projectIdToAuthor: { '158': AUTHOR },
      projectIdToTeamWallets: { '158': [AUTHOR.toLowerCase(), MEMBER_A, MEMBER_B] },
    })
    expect(isSelfVoteExcluded(exclusions, '158', AUTHOR.toLowerCase())).to.equal(true)
    expect(isSelfVoteExcluded(exclusions, '158', MEMBER_A.toUpperCase().replace('0X', '0x'))).to.equal(true)
    expect(isSelfVoteExcluded(exclusions, '158', MEMBER_B)).to.equal(true)
    expect(isSelfVoteExcluded(exclusions, '158', OUTSIDER)).to.equal(false)
  })

  it('only bars a team from its own project', () => {
    const exclusions = buildSelfVoteExclusions({
      projectIdToAuthor: { '158': AUTHOR },
      projectIdToTeamWallets: { '158': [MEMBER_A] },
    })
    expect(isSelfVoteExcluded(exclusions, '159', MEMBER_A)).to.equal(false)
    expect(isSelfVoteExcluded(exclusions, '159', AUTHOR)).to.equal(false)
  })

  it('falls back to author-only when no team wallets are passed', () => {
    const exclusions = buildSelfVoteExclusions({ projectIdToAuthor: { '158': AUTHOR } })
    expect(isSelfVoteExcluded(exclusions, '158', AUTHOR)).to.equal(true)
    expect(isSelfVoteExcluded(exclusions, '158', MEMBER_A)).to.equal(false)
    expect(isSelfVoteExcluded(exclusions, '158', undefined)).to.equal(false)
  })
})
