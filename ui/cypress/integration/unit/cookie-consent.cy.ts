import { cookieBannerDecision, normalizeGeoCountry } from '@/lib/geo/countryCode'

describe('cookie banner country decision', () => {
  it('normalizes edge country codes', () => {
    expect(normalizeGeoCountry('us')).to.equal('US')
    expect(normalizeGeoCountry(' US, US ')).to.equal('US')
    expect(normalizeGeoCountry('USA')).to.equal('US')
    expect(normalizeGeoCountry('United States')).to.equal('US')
    expect(normalizeGeoCountry('XX')).to.equal(null)
    expect(normalizeGeoCountry('T1')).to.equal(null)
    expect(normalizeGeoCountry('')).to.equal(null)
    expect(normalizeGeoCountry(null)).to.equal(null)
    expect(normalizeGeoCountry('not-a-country')).to.equal(null)
  })

  it('grants without a prompt for the US and its territories', () => {
    for (const code of ['US', 'us', 'USA', 'PR', 'GU', 'VI', 'AS', 'MP', 'UM']) {
      expect(cookieBannerDecision(code)).to.equal('grant')
    }
  })

  it('prompts only for a confirmed non-US country', () => {
    expect(cookieBannerDecision('GB')).to.equal('prompt')
    expect(cookieBannerDecision('DE')).to.equal('prompt')
    expect(cookieBannerDecision('CA')).to.equal('prompt')
  })

  it('does not prompt when the country is unknown', () => {
    expect(cookieBannerDecision(null)).to.equal('skip')
    expect(cookieBannerDecision(undefined)).to.equal('skip')
    expect(cookieBannerDecision('XX')).to.equal('skip')
    expect(cookieBannerDecision('T1')).to.equal('skip')
  })
})
