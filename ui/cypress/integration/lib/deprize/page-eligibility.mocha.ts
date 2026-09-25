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
      expect(getDePrizePageEligibility(req({ 'x-vercel-ip-country': 'US' })).country).to.equal(
        'CH'
      )
      expect(
        getDePrizePageEligibility(
          req({
            'x-vercel-ip-country': 'US',
            'x-deprize-mock-country': 'MX',
          })
        ).country
      ).to.equal('MX')
      expect(
        getDePrizePageEligibility(
          req({
            'x-vercel-ip-country': 'US',
            'x-deprize-mock-country': 'US',
          })
        ).country
      ).to.equal('CH')
      process.env.NEXT_PUBLIC_ENV = 'prod'
      expect(getDePrizePageEligibility(req({ 'x-vercel-ip-country': 'US' })).restricted).to.equal(
        true
      )
      expect(getDePrizePageEligibility(req({ 'x-vercel-ip-country': 'US' })).country).to.equal(
        'US'
      )
    } finally {
      if (prevEnv === undefined) delete process.env.NEXT_PUBLIC_ENV
      else process.env.NEXT_PUBLIC_ENV = prevEnv
      if (prevBypass === undefined) delete process.env.DEPRIZE_ELIGIBILITY_BYPASS
      else process.env.DEPRIZE_ELIGIBILITY_BYPASS = prevBypass
    }
  })

  it('bypasses a Vercel preview only on the Sepolia prize path', () => {
    const env = process.env as Record<string, string | undefined>
    const prevVercel = env.VERCEL_ENV
    const prevEnv = env.NEXT_PUBLIC_ENV
    const prevBypass = env.DEPRIZE_ELIGIBILITY_BYPASS
    try {
      delete env.DEPRIZE_ELIGIBILITY_BYPASS
      env.NEXT_PUBLIC_ENV = 'prod'
      env.VERCEL_ENV = 'preview'
      const us = { 'x-vercel-ip-country': 'US' }
      expect(getDePrizePageEligibility({ headers: us, url: '/deprize/sep' }).restricted).to.equal(
        false
      )
      expect(
        getDePrizePageEligibility({ headers: us, url: '/deprize/sep/6' }).restricted
      ).to.equal(false)
      expect(getDePrizePageEligibility({ headers: us, url: '/deprize/arb' }).restricted).to.equal(
        true
      )
      expect(getDePrizePageEligibility({ headers: us, url: '/deprize' }).restricted).to.equal(true)
      env.VERCEL_ENV = 'production'
      expect(getDePrizePageEligibility({ headers: us, url: '/deprize/sep' }).restricted).to.equal(
        true
      )
    } finally {
      for (const [key, value] of [
        ['VERCEL_ENV', prevVercel],
        ['NEXT_PUBLIC_ENV', prevEnv],
        ['DEPRIZE_ELIGIBILITY_BYPASS', prevBypass],
      ] as const) {
        if (value === undefined) delete env[key]
        else env[key] = value
      }
    }
  })

  it('bypasses under `next dev` without the flag, but never in production', () => {
    const env = process.env as Record<string, string | undefined>
    const prevNodeEnv = env.NODE_ENV
    const prevEnv = env.NEXT_PUBLIC_ENV
    const prevBypass = env.DEPRIZE_ELIGIBILITY_BYPASS
    try {
      delete env.DEPRIZE_ELIGIBILITY_BYPASS
      env.NEXT_PUBLIC_ENV = 'dev'
      env.NODE_ENV = 'development'
      expect(getDePrizePageEligibility(req()).restricted).to.equal(false)
      env.NODE_ENV = 'production'
      expect(getDePrizePageEligibility(req()).restricted).to.equal(true)
      env.NODE_ENV = 'development'
      env.NEXT_PUBLIC_ENV = 'prod'
      expect(getDePrizePageEligibility(req()).restricted).to.equal(true)
    } finally {
      for (const [key, value] of [
        ['NODE_ENV', prevNodeEnv],
        ['NEXT_PUBLIC_ENV', prevEnv],
        ['DEPRIZE_ELIGIBILITY_BYPASS', prevBypass],
      ] as const) {
        if (value === undefined) delete env[key]
        else env[key] = value
      }
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
