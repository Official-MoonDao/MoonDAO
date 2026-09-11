/**
 * Mocha-only: Next's Cypress webpack cannot load a spec that imports the
 * getServerSideProps helper (`ChunkLoadError: Loading chunk spec-N`).
 */
import {
  DEPRIZE_PAGE_CACHE_CONTROL,
  getDePrizePageEligibility,
  resolveDePrizePageProps,
} from '@/lib/deprize/pageEligibility'

function req(headers: Record<string, string> = {}) {
  return { headers }
}

describe('deprize page eligibility', () => {
  it('restricts an unknown country', () => {
    expect(getDePrizePageEligibility(req()).restricted).to.equal(true)
    expect(getDePrizePageEligibility(req()).country).to.equal(null)
    expect(getDePrizePageEligibility(req({ 'x-vercel-ip-country': 'XX' }))).to.deep.equal({
      restricted: true,
      country: null,
    })
    expect(getDePrizePageEligibility(req({ 'x-vercel-ip-country': 'T1' }))).to.deep.equal({
      restricted: true,
      country: null,
    })
  })

  it('restricts listed countries and occupied Ukrainian regions', () => {
    expect(getDePrizePageEligibility(req({ 'x-vercel-ip-country': 'US' }))).to.deep.equal({
      restricted: true,
      country: 'US',
    })
    expect(getDePrizePageEligibility(req({ 'x-vercel-ip-country': 'PR' })).restricted).to.equal(
      true
    )
    expect(getDePrizePageEligibility(req({ 'x-vercel-ip-country': 'GB' })).restricted).to.equal(
      true
    )
    expect(
      getDePrizePageEligibility(
        req({
          'x-vercel-ip-country': 'UA',
          'x-vercel-ip-country-region': '43',
        })
      )
    ).to.deep.equal({ restricted: true, country: 'UA' })
  })

  it('allows a permitted country, including an unlisted UA region', () => {
    expect(getDePrizePageEligibility(req({ 'x-vercel-ip-country': 'CH' }))).to.deep.equal({
      restricted: false,
      country: 'CH',
    })
    expect(
      getDePrizePageEligibility(
        req({
          'x-vercel-ip-country': 'UA',
          'x-vercel-ip-country-region': '30',
        })
      ).restricted
    ).to.equal(false)
  })

  it('does not treat a commercial VPN header as a page restriction', () => {
    const result = getDePrizePageEligibility(
      req({
        'x-vercel-ip-country': 'CH',
        'x-vercel-ip-city': 'Zurich',
      })
    )
    expect(result).to.deep.equal({ restricted: false, country: 'CH' })
  })

  it('honors the non-prod bypass and never honors it in production', () => {
    const prevEnv = process.env.NEXT_PUBLIC_ENV
    const prevBypass = process.env.DEPRIZE_ELIGIBILITY_BYPASS
    try {
      process.env.NEXT_PUBLIC_ENV = 'dev'
      process.env.DEPRIZE_ELIGIBILITY_BYPASS = '1'
      expect(getDePrizePageEligibility(req({ 'x-vercel-ip-country': 'US' })).restricted).to.equal(
        false
      )
      process.env.NEXT_PUBLIC_ENV = 'prod'
      expect(getDePrizePageEligibility(req({ 'x-vercel-ip-country': 'US' })).restricted).to.equal(
        true
      )
    } finally {
      if (prevEnv === undefined) delete process.env.NEXT_PUBLIC_ENV
      else process.env.NEXT_PUBLIC_ENV = prevEnv
      if (prevBypass === undefined) delete process.env.DEPRIZE_ELIGIBILITY_BYPASS
      else process.env.DEPRIZE_ELIGIBILITY_BYPASS = prevBypass
    }
  })

  it('sets private no-store cache headers on every DePrize page response', () => {
    const headers: Record<string, string> = {}
    const result = resolveDePrizePageProps(req({ 'x-vercel-ip-country': 'US' }), {
      setHeader(name, value) {
        headers[name] = value
      },
    })
    expect(result).to.deep.equal({ props: { restricted: true } })
    expect(headers['Cache-Control']).to.equal(DEPRIZE_PAGE_CACHE_CONTROL)
    expect(headers['CDN-Cache-Control']).to.equal(DEPRIZE_PAGE_CACHE_CONTROL)
    expect(headers['Vercel-CDN-Cache-Control']).to.equal(DEPRIZE_PAGE_CACHE_CONTROL)
  })
})
