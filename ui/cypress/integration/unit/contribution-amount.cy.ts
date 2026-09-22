import {
  CONTRIBUTE_SIGN_IN_LABEL,
  OVERVIEW_DEFAULT_CONTRIBUTION_USD,
  contributeOpenButtonLabel,
  defaultContributionUsd,
  hasPositiveContributionUsd,
  parseContributionUsd,
} from '@/lib/mission/contributionAmount'

describe('contribution amount defaults', () => {
  it('starts the Overview Flight form at the $100 support tier', () => {
    expect(defaultContributionUsd(4)).to.equal(OVERVIEW_DEFAULT_CONTRIBUTION_USD)
    expect(defaultContributionUsd('4')).to.equal('100')
  })

  it('leaves other missions blank instead of a fake $0', () => {
    expect(defaultContributionUsd(1)).to.equal('')
    expect(defaultContributionUsd(undefined)).to.equal('')
    expect(defaultContributionUsd('nope')).to.equal('')
  })

  it('treats blank and zero as not ready to contribute', () => {
    expect(hasPositiveContributionUsd('')).to.equal(false)
    expect(hasPositiveContributionUsd('0')).to.equal(false)
    expect(hasPositiveContributionUsd('0.00')).to.equal(false)
    expect(hasPositiveContributionUsd(null)).to.equal(false)
    expect(parseContributionUsd('')).to.be.NaN
  })

  it('accepts a positive formatted USD amount', () => {
    expect(hasPositiveContributionUsd('100')).to.equal(true)
    expect(hasPositiveContributionUsd('1,000')).to.equal(true)
    expect(parseContributionUsd('1,000.50')).to.equal(1000.5)
  })

  it('asks for an amount before offering contribute or sign-in', () => {
    expect(contributeOpenButtonLabel('')).to.equal('Enter an amount')
    expect(contributeOpenButtonLabel('0')).to.equal('Enter an amount')
    expect(contributeOpenButtonLabel('100')).to.equal('Contribute')
    expect(CONTRIBUTE_SIGN_IN_LABEL).to.equal('Sign in to contribute')
  })
})
