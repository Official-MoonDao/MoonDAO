import assert from 'assert'
import {
  buildGtagInitScript,
  buildPagePath,
  classifyMintError,
  ctaLocationFromContext,
  flushPendingGa4,
  GA_MEASUREMENT_ID,
  getAttribution,
  joinCtaParams,
  normalizeWalletType,
  planForJoinHref,
  resetAnalyticsState,
  setAttributionGetter,
  setIsCitizen,
  trackBeginCheckout,
  trackJoinCtaClick,
  trackMintError,
  trackMintSuccess,
  trackMissionContribution,
  trackProposalVote,
  trackSignUp,
  transactionIdFromReceipt,
} from './ga4'

const TX = `0x${'ab'.repeat(32)}`
const WALLET = `0x${'cd'.repeat(20)}`

function installGtag() {
  const calls: unknown[][] = []
  const gtag = (...args: unknown[]) => {
    calls.push(args)
  }
  ;(global as { window?: unknown }).window = { gtag }
  return calls
}

function includes(actual: unknown, expected: Record<string, unknown>) {
  assert.equal(typeof actual, 'object')
  assert.notEqual(actual, null)
  for (const [key, value] of Object.entries(expected)) {
    assert.deepStrictEqual((actual as Record<string, unknown>)[key], value)
  }
}

describe('buildPagePath', () => {
  it('keeps the question mark between pathname and search', () => {
    assert.strictEqual(buildPagePath('/mission/4', 'tab=about'), '/mission/4?tab=about')
    assert.strictEqual(buildPagePath('/mission/4', '?tab=about'), '/mission/4?tab=about')
    assert.strictEqual(
      buildPagePath('/network', 'tab=citizens&page=2'),
      '/network?tab=citizens&page=2'
    )
    assert.strictEqual(
      buildPagePath('/join', '?utm_source=instagram'),
      '/join?utm_source=instagram'
    )
  })

  it('leaves a path with no search unchanged', () => {
    assert.strictEqual(buildPagePath('/join', ''), '/join')
    assert.strictEqual(buildPagePath('/join', '?'), '/join')
    assert.strictEqual(buildPagePath('/join', null), '/join')
    assert.strictEqual(buildPagePath('/join'), '/join')
  })
})

describe('gtag init script', () => {
  const script = buildGtagInitScript(GA_MEASUREMENT_ID)

  it('sends a single config and does not override page_path or send_page_view', () => {
    const configs = script.match(/gtag\('config'/g) || []
    assert.strictEqual(configs.length, 1)
    assert.equal(script.includes('page_path'), false)
    assert.equal(script.includes('send_page_view'), false)
    assert.equal(script.includes(`gtag('config', '${GA_MEASUREMENT_ID}'`), true)
  })

  it('sets traffic_type internal from the internal=1 cookie', () => {
    assert.equal(script.includes("get('internal') === '1'"), true)
    assert.equal(script.includes('internal=1; Path=/'), true)
    assert.equal(script.includes("config.traffic_type = 'internal'"), true)
  })

  it('falls back to the MoonDAO stream id', () => {
    assert.equal(buildGtagInitScript('not-an-id').includes(GA_MEASUREMENT_ID), true)
    assert.equal(buildGtagInitScript('<script>').includes('<script>'), false)
  })
})

describe('ga4 events', () => {
  afterEach(() => {
    resetAnalyticsState()
    delete (global as { window?: unknown }).window
  })

  it('does not throw when gtag is missing and flushes once it exists', () => {
    ;(global as { window?: unknown }).window = {}
    assert.doesNotThrow(() => trackJoinCtaClick({ cta_location: 'hero', plan: 'citizen' }))
    const calls = installGtag()
    flushPendingGa4()
    assert.deepStrictEqual(calls, [
      ['event', 'join_cta_click', { cta_location: 'hero', plan: 'citizen' }],
    ])
    flushPendingGa4()
    assert.strictEqual(calls.length, 1)
  })

  it('no-ops on the server', () => {
    assert.doesNotThrow(() =>
      trackBeginCheckout({
        plan: 'citizen',
        payment_method: 'crypto',
        value_eth: 0.036,
        value: 120,
      })
    )
  })

  it('sends begin_checkout with numeric value and value_eth', () => {
    const calls = installGtag()
    trackBeginCheckout({
      plan: 'citizen',
      payment_method: 'crypto',
      value_eth: 0.036,
      value: 120,
    })
    trackBeginCheckout({
      plan: 'citizen',
      payment_method: 'crypto',
      value_eth: Number.NaN,
      value: 120,
    })
    assert.deepStrictEqual(calls, [
      [
        'event',
        'begin_checkout',
        {
          plan: 'citizen',
          payment_method: 'crypto',
          value_eth: 0.036,
          currency: 'USD',
          value: 120,
        },
      ],
    ])
  })

  it('fires citizen_mint_success and purchase with the tx hash', () => {
    const calls = installGtag()
    trackMintSuccess({
      plan: 'citizen',
      value_eth: 0.036,
      value: 120,
      transaction_id: TX,
      payment_method: 'crypto',
    })
    assert.deepStrictEqual(
      calls.map((call) => call[1]),
      ['citizen_mint_success', 'purchase']
    )
    includes(calls[0][2], {
      plan: 'citizen',
      value_eth: 0.036,
      value: 120,
      currency: 'USD',
      transaction_id: TX,
      payment_method: 'crypto',
    })
    assert.deepStrictEqual(calls[1][2], {
      transaction_id: TX,
      value: 120,
      currency: 'USD',
      items: [{ item_id: 'citizen', item_name: 'Citizenship', price: 120 }],
    })
  })

  it('fires team_mint_success beside purchase', () => {
    const calls = installGtag()
    trackMintSuccess({
      plan: 'team',
      value_eth: 0.36,
      value: 900,
      transaction_id: TX,
      payment_method: 'card',
    })
    assert.strictEqual(calls[0][1], 'team_mint_success')
    includes(calls[1][2], {
      items: [{ item_id: 'team', item_name: 'Team', price: 900 }],
    })
  })

  it('drops a non-hash transaction id and wallet-looking strings', () => {
    const calls = installGtag()
    assert.strictEqual(transactionIdFromReceipt({ transactionHash: 'team-mint-4' }), undefined)
    assert.strictEqual(transactionIdFromReceipt({ transactionHash: TX }), TX)
    trackMintSuccess({
      plan: 'citizen',
      value_eth: 0,
      value: 0,
      transaction_id: WALLET,
      payment_method: 'crypto',
    })
    assert.strictEqual((calls[0][2] as { transaction_id?: string }).transaction_id, undefined)
    assert.strictEqual((calls[1][2] as { transaction_id?: string }).transaction_id, undefined)
  })

  it('merges attribution into mint, purchase, and mint_error only', () => {
    const calls = installGtag()
    setAttributionGetter(() => ({
      utm_source: 'instagram',
      gclid: 'abc',
      value: 1,
      email: 'person@example.com',
      address: WALLET,
      name: 'Ada',
    }))
    assert.deepStrictEqual(getAttribution(), {
      utm_source: 'instagram',
      gclid: 'abc',
      value: 1,
    })
    trackMintSuccess({
      plan: 'citizen',
      value_eth: 0.036,
      value: 80,
      transaction_id: TX,
      payment_method: 'crypto',
    })
    trackMintError({ plan: 'citizen', error_type: 'rejected', step: 'mint' })
    trackJoinCtaClick({ cta_location: 'nav', plan: 'citizen' })
    const success = calls[0][2] as Record<string, unknown>
    const purchase = calls[1][2] as Record<string, unknown>
    const failure = calls[2][2] as Record<string, unknown>
    const click = calls[3][2] as Record<string, unknown>
    assert.strictEqual(success.utm_source, 'instagram')
    assert.strictEqual(success.value, 80)
    assert.strictEqual(success.email, undefined)
    assert.strictEqual(success.address, undefined)
    assert.strictEqual(purchase.gclid, 'abc')
    assert.strictEqual(purchase.value, 80)
    includes(failure, {
      utm_source: 'instagram',
      plan: 'citizen',
      error_type: 'rejected',
      step: 'mint',
    })
    assert.deepStrictEqual(click, { cta_location: 'nav', plan: 'citizen' })
  })

  it('survives an attribution getter that throws', () => {
    const calls = installGtag()
    setAttributionGetter(() => {
      throw new Error('utm lookup failed')
    })
    assert.deepStrictEqual(getAttribution(), {})
    trackMintError({ mission_id: '4', error_type: 'network', step: 'contribute' })
    assert.deepStrictEqual(calls[0][2], {
      mission_id: '4',
      error_type: 'network',
      step: 'contribute',
    })
  })

  it('sets is_citizen as the strings true and false', () => {
    const calls = installGtag()
    setIsCitizen(true)
    setIsCitizen(false)
    assert.deepStrictEqual(calls, [
      ['set', 'user_properties', { is_citizen: 'true' }],
      ['set', 'user_properties', { is_citizen: 'false' }],
    ])
  })

  it('classifies mint failures and sends the other events', () => {
    const calls = installGtag()
    assert.strictEqual(classifyMintError({ code: 4001, message: 'User rejected' }), 'rejected')
    assert.strictEqual(
      classifyMintError({ message: 'insufficient funds for gas' }),
      'insufficient_funds'
    )
    assert.strictEqual(classifyMintError({ message: 'card declined' }), 'card_declined')
    assert.strictEqual(classifyMintError({ message: 'network timeout' }), 'network')
    trackMissionContribution({
      mission_id: '4',
      value_eth: 0.01,
      value: 30,
      transaction_id: TX,
      payment_method: 'crypto',
    })
    trackSignUp({ cta_location: 'footer' })
    trackProposalVote(42)
    assert.deepStrictEqual(
      calls.map((call) => call[1]),
      ['mission_contribution', 'sign_up', 'proposal_vote']
    )
    assert.deepStrictEqual(calls[1][2], { method: 'kit', cta_location: 'footer' })
    assert.deepStrictEqual(calls[2][2], { proposal_id: '42' })
  })
})

describe('join CTA hrefs', () => {
  it('treats /join links, including absolute moondao.com urls, as citizen', () => {
    assert.strictEqual(planForJoinHref('/join'), 'citizen')
    assert.strictEqual(planForJoinHref('/join?utm_source=instagram&utm_medium=bio'), 'citizen')
    assert.strictEqual(
      planForJoinHref(
        'https://moondao.com/join?utm_source=instagram&utm_medium=bio&utm_campaign=ig-bio-join'
      ),
      'citizen'
    )
    assert.strictEqual(planForJoinHref('https://www.moondao.com/join/'), 'citizen')
    assert.strictEqual(planForJoinHref('/citizen'), 'citizen')
    assert.strictEqual(planForJoinHref('/team'), 'team')
  })

  it('ignores profiles, other hosts, and unrelated paths', () => {
    assert.strictEqual(planForJoinHref('/citizen/ada'), null)
    assert.strictEqual(planForJoinHref('/join-us'), null)
    assert.strictEqual(planForJoinHref('https://example.com/join'), null)
    assert.strictEqual(planForJoinHref('mailto:hello@moondao.com'), null)
  })

  it('picks cta_location from the marker, then the page, then the landmark', () => {
    assert.deepStrictEqual(
      joinCtaParams('/join', { explicit: 'hero', pathname: '/mission/4', inNav: true }),
      { plan: 'citizen', cta_location: 'hero' }
    )
    assert.strictEqual(ctaLocationFromContext({ pathname: '/linktree', inNav: true }), 'linktree')
    assert.strictEqual(ctaLocationFromContext({ pathname: '/mission/4' }), 'mission4')
    assert.strictEqual(ctaLocationFromContext({ pathname: '/frank' }), 'mission4')
    assert.strictEqual(
      ctaLocationFromContext({ pathname: '/', inFooter: true, inNav: true }),
      'footer'
    )
    assert.strictEqual(ctaLocationFromContext({ pathname: '/', inNav: true }), 'nav')
    assert.strictEqual(ctaLocationFromContext({ pathname: '/', inHero: true }), 'hero')
    assert.strictEqual(ctaLocationFromContext({ pathname: '/network' }), 'page')
    assert.strictEqual(normalizeWalletType('privy'), 'embedded')
    assert.strictEqual(normalizeWalletType('coinbase_wallet'), 'coinbase')
    assert.strictEqual(normalizeWalletType('walletconnect'), 'walletconnect')
    assert.strictEqual(normalizeWalletType('MetaMask'), 'metamask')
  })
})
