/// <reference types="node" />
/// <reference types="mocha" />
import assert from 'assert'
import vm from 'vm'
import { COOKIE_CONSENT_EXEMPT_REGIONS, cookieBannerDecision } from '../geo/countryCode'
import {
  buildGtagInitScript,
  buildPiiStripScript,
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
  trackExtendCitizenshipError,
  trackExtendCitizenshipOpen,
  trackExtendCitizenshipSubmit,
  trackExtendCitizenshipSuccess,
  cleanHistoryTarget,
  installGa4HistoryGuards,
  isPiiQueryKey,
  stripPiiFromUrl,
  stripPiiSearch,
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

  it('sets both consent defaults and any stored choice before gtag config', () => {
    const grantedDefault = script.indexOf(
      "gtag('consent', 'default', { 'analytics_storage': 'granted'"
    )
    const deniedDefault = script.indexOf(
      "gtag('consent', 'default', { 'analytics_storage': 'denied', 'wait_for_update': 500 }"
    )
    const stored = script.indexOf("localStorage.getItem('cookie_consent')")
    const grantUpdate = script.indexOf("cc === 'true'")
    const denyUpdate = script.indexOf("cc === 'false'")
    const config = script.indexOf("gtag('config'")
    assert.ok(grantedDefault >= 0)
    assert.ok(grantedDefault < deniedDefault)
    assert.ok(deniedDefault < stored)
    assert.ok(stored < grantUpdate)
    assert.ok(grantUpdate < denyUpdate)
    assert.ok(denyUpdate < config)
    assert.deepStrictEqual(JSON.parse(script.match(/'region': (\[[\s\S]*?\])/)?.[1] || 'null'), [
      ...COOKIE_CONSENT_EXEMPT_REGIONS,
    ])
    for (const region of COOKIE_CONSENT_EXEMPT_REGIONS) {
      assert.strictEqual(cookieBannerDecision(region), 'grant')
    }
    // CookieBanner persists JSON.stringify(true|false), which is these exact strings.
    assert.strictEqual(JSON.stringify(true), 'true')
    assert.strictEqual(JSON.stringify(false), 'false')
  })

  it('applies a stored grant or denial before the config hit', () => {
    const granted = runInitScript('true').map((call) => call[0])
    const denied = runInitScript('false').map((call) => call[0])
    const unset = runInitScript(null)
    const thrown = runInitScript(new Error('storage blocked'))
    assert.deepStrictEqual(granted, ['js', 'consent', 'consent', 'consent', 'config'])
    assert.deepStrictEqual(denied, ['js', 'consent', 'consent', 'consent', 'config'])
    assert.deepStrictEqual(
      unset.map((call) => call[0]),
      ['js', 'consent', 'consent', 'config']
    )
    assert.deepStrictEqual(
      thrown.map((call) => call[0]),
      ['js', 'consent', 'consent', 'config']
    )

    const grantedCalls = runInitScript('true')
    const configAt = grantedCalls.findIndex((call) => call[0] === 'config')
    const updateAt = grantedCalls.findIndex((call) => call[0] === 'consent' && call[1] === 'update')
    assert.ok(updateAt > 0 && updateAt < configAt)
    assert.deepStrictEqual(grantedCalls[1][2], {
      analytics_storage: 'granted',
      region: [...COOKIE_CONSENT_EXEMPT_REGIONS],
    })
    assert.deepStrictEqual(grantedCalls[2][2], {
      analytics_storage: 'denied',
      wait_for_update: 500,
    })
    assert.deepStrictEqual(grantedCalls[updateAt][2], { analytics_storage: 'granted' })
    assert.deepStrictEqual(runInitScript('false')[3][2], { analytics_storage: 'denied' })
    assert.equal(
      unset.some((call) => call[1] === 'update'),
      false
    )
    assert.equal(
      runInitScript('null').some((call) => call[1] === 'update'),
      false
    )
  })
})

function runInitScript(consent: string | null | Error) {
  const script = buildGtagInitScript(GA_MEASUREMENT_ID)
  const sandbox: Record<string, any> = {
    URLSearchParams,
    document: { cookie: '' },
    localStorage: {
      getItem(key: string) {
        if (key !== 'cookie_consent') return null
        if (consent instanceof Error) throw consent
        return consent
      },
    },
    location: { search: '' },
  }
  sandbox.window = sandbox
  vm.createContext(sandbox)
  vm.runInContext(script, sandbox)
  // Values created inside the vm have that realm's prototypes, so copy them
  // into this realm before deepStrictEqual.
  // dataLayer is an array from the vm realm. Copy with this realm's Array.from
  // so deepStrictEqual does not reject it for a foreign prototype.
  return Array.from(sandbox.dataLayer as ArrayLike<ArrayLike<unknown>>, (entry) =>
    Array.from(entry, (value) => copyOutOfVm(value))
  )
}

function copyOutOfVm(value: unknown): unknown {
  if (typeof value === 'string') return `${value}`
  if (typeof value === 'number' || typeof value === 'boolean' || value == null) return value
  if (Array.isArray(value)) return Array.from(value, (item) => copyOutOfVm(item))
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value as object)) {
      out[`${key}`] = copyOutOfVm((value as Record<string, unknown>)[key])
    }
    return out
  }
  return value
}

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
    assert.deepStrictEqual(click, {
      cta_location: 'nav',
      plan: 'citizen',
      utm_source: 'instagram',
    })
    assert.strictEqual((click as { email?: string }).email, undefined)
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

  it('adds vote stage and surface when a caller provides them', () => {
    const calls = installGtag()
    trackProposalVote(274, { vote_stage: 'senate', surface: 'projects_list' })
    trackProposalVote('', { vote_stage: 'member', surface: 'modal' })
    assert.deepStrictEqual(calls, [
      [
        'event',
        'proposal_vote',
        { proposal_id: '274', vote_stage: 'senate', surface: 'projects_list' },
      ],
    ])
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

describe('extend citizenship events', () => {
  beforeEach(() => {
    resetAnalyticsState()
  })

  it('records open, submit, success, and error without a wallet or email', () => {
    const calls = installGtag()
    setAttributionGetter(() => ({ utm_source: 'kit', email: 'person@example.com' }))
    trackExtendCitizenshipOpen({ surface: 'extend_modal' })
    trackExtendCitizenshipSubmit({ years: 1, value_eth: 0.036, value: 80 })
    trackExtendCitizenshipSuccess({
      years: 1,
      value_eth: 0.036,
      value: 80,
      transaction_id: TX,
    })
    trackExtendCitizenshipError({ error_type: 'rejected', step: 'extend' })
    assert.deepStrictEqual(
      calls.map((call) => call[1]),
      [
        'extend_citizenship_open',
        'extend_citizenship_submit',
        'extend_citizenship_success',
        'extend_citizenship_error',
      ]
    )
    includes(calls[0][2], { plan: 'citizen', surface: 'extend_modal', utm_source: 'kit' })
    includes(calls[2][2], { transaction_id: TX, years: 1, value: 80 })
    includes(calls[3][2], { error_type: 'rejected', step: 'extend' })
    const encoded = JSON.stringify(calls)
    assert.equal(encoded.includes('person@example.com'), false)
    assert.equal(encoded.includes(WALLET), false)
  })

  it('drops a success event when years are missing and ignores a non-hash transaction id', () => {
    const calls = installGtag()
    trackExtendCitizenshipSubmit({ years: 0 })
    trackExtendCitizenshipSuccess({ years: 1, transaction_id: WALLET })
    assert.strictEqual(calls.length, 1)
    assert.strictEqual((calls[0][2] as { transaction_id?: string }).transaction_id, undefined)
  })
})

describe('pii query stripping', () => {
  it('removes email, name, and phone params and keeps the campaign', () => {
    assert.strictEqual(isPiiQueryKey('email'), true)
    assert.strictEqual(isPiiQueryKey('E-Mail'), true)
    assert.strictEqual(isPiiQueryKey('phone_number'), true)
    assert.strictEqual(isPiiQueryKey('utm_source'), false)
    assert.strictEqual(isPiiQueryKey('utm_campaign'), false)
    assert.strictEqual(isPiiQueryKey('fbclid'), false)
    assert.strictEqual(
      stripPiiFromUrl('/marketplace/39?email=person@example.com', 'https://moondao.com'),
      '/marketplace/39'
    )
    assert.strictEqual(
      stripPiiFromUrl(
        '/marketplace/39?email=&utm_source=ig&name=Ada&phone=555',
        'https://moondao.com'
      ),
      '/marketplace/39?utm_source=ig'
    )
    assert.strictEqual(stripPiiSearch('?tab=about&e-mail=a@b.com'), '?tab=about')
    assert.strictEqual(
      cleanHistoryTarget('/join?utm_campaign=spring&first_name=Pat', 'https://moondao.com'),
      '/join?utm_campaign=spring'
    )
  })

  it('strips email before the single config call', () => {
    const calls = runInitScript(null)
    assert.strictEqual(calls.filter((call) => call[0] === 'config').length, 1)
    assert.equal(
      calls.some((call) => call[0] === 'event' && call[1] === 'page_view'),
      false
    )

    const script = buildGtagInitScript(GA_MEASUREMENT_ID)
    assert.equal(script.includes('replaceState'), false)
    const seen: string[] = []
    const sandbox: Record<string, any> = {
      URLSearchParams,
      document: { cookie: '' },
      localStorage: { getItem: () => null },
      location: {
        pathname: '/marketplace/39',
        search: '?email=person@example.com&utm_source=ig',
        hash: '',
      },
      history: {
        state: null,
        replaceState(_state: unknown, _title: string, url: string) {
          seen.push(url)
          const parsed = new URL(url, 'https://moondao.com')
          sandbox.location.pathname = parsed.pathname
          sandbox.location.search = parsed.search
          sandbox.location.hash = parsed.hash
        },
      },
    }
    sandbox.window = sandbox
    vm.createContext(sandbox)
    vm.runInContext(buildPiiStripScript(), sandbox)
    vm.runInContext(script, sandbox)
    assert.deepStrictEqual(seen, ['/marketplace/39?utm_source=ig'])
    assert.strictEqual(sandbox.location.search, '?utm_source=ig')
    const queued = Array.from(sandbox.dataLayer as ArrayLike<ArrayLike<unknown>>, (entry) =>
      Array.from(entry, (value) => (typeof value === 'string' ? `${value}` : value))
    )
    assert.strictEqual(queued.filter((call) => call[0] === 'config').length, 1)
    assert.equal(JSON.stringify(queued).includes('person@example.com'), false)
    assert.equal(script.includes('page_path'), false)
    assert.equal(script.includes('send_page_view'), false)
  })
})

describe('history guards', () => {
  const previous = (global as { window?: unknown }).window

  afterEach(() => {
    if (previous === undefined) delete (global as { window?: unknown }).window
    else (global as { window?: unknown }).window = previous
  })

  it('strips pii, skips shallow updates, and forwards a real navigation', () => {
    const calls: string[] = []
    const nativePush = (_state: unknown, _title: string, url?: string | URL | null) => {
      calls.push(`native:${url}`)
    }
    const wrappedPush = (_state: unknown, _title: string, url?: string | URL | null) => {
      calls.push(`wrapped:${url}`)
    }
    const windowMock = {
      location: { origin: 'https://moondao.com' },
      history: {
        pushState: wrappedPush,
        replaceState: wrappedPush,
      },
      __mdNativeHistory: {
        pushState: nativePush,
        replaceState: nativePush,
      },
    }
    ;(global as { window?: unknown }).window = windowMock
    installGa4HistoryGuards()
    windowMock.history.pushState(
      { options: { shallow: true } },
      '',
      '/network?email=person@example.com&tab=list'
    )
    windowMock.history.pushState({}, '', '/faq?email=person@example.com&utm_source=ig')
    assert.deepStrictEqual(calls, ['native:/network?tab=list', 'wrapped:/faq?utm_source=ig'])
  })
})
