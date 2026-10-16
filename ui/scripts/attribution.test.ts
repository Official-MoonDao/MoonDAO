import { expect } from 'chai'
import {
  ATTRIBUTION_COOKIE_NAME,
  ATTRIBUTION_MAX_AGE_SECONDS,
  ATTRIBUTION_STORAGE_KEY,
  ATTRIBUTION_TTL_MS,
  applyTouch,
  buildAttributionCookie,
  buildClearedAttributionCookie,
  captureClientAttribution,
  decorateRouterUrl,
  extractAttributionParams,
  getAttribution,
  kitFieldsFromAttribution,
  mergeAttributionQuery,
  parseRecord,
  reduceCapture,
  resetAttributionForTests,
  sanitizeKitFields,
  serializeRecord,
  toFlatAttribution,
  typeformEmbedUrl,
  typeformHiddenFields,
  withAttribution,
  type CaptureInput,
  type StoredAttribution,
} from '../lib/analytics/attribution'

const NOW = 1_700_000_000_000
const ORIGIN = 'https://moondao.com'
const NINETY_DAYS_SECONDS = 90 * 24 * 60 * 60

function capture(overrides: Partial<CaptureInput> = {}) {
  return reduceCapture({
    search: '',
    path: '/',
    referrer: '',
    origin: ORIGIN,
    now: NOW,
    consent: true,
    record: null,
    memory: null,
    ...overrides,
  })
}

describe('attribution capture', () => {
  it('reads utm params and click ids and ignores everything else', () => {
    const params = extractAttributionParams(
      '?utm_source=ads&utm_medium=cpc&utm_campaign=q4&utm_term=moon&utm_content=hero&gclid=abc&fbclid=fb&wbraid=wb&gbraid=gb&email=person@example.com&name=Pat'
    )
    expect(params).to.deep.equal({
      utm_source: 'ads',
      utm_medium: 'cpc',
      utm_campaign: 'q4',
      utm_term: 'moon',
      utm_content: 'hero',
      gclid: 'abc',
      fbclid: 'fb',
      wbraid: 'wb',
      gbraid: 'gb',
    })
  })

  it('drops blank values and anything that looks like an email', () => {
    expect(
      extractAttributionParams('?utm_source=%20&utm_medium=&gclid=person%40example.com&fbclid=ok')
    ).to.deep.equal({ fbclid: 'ok' })
  })

  it('stores the landing path and a query-stripped external referrer', () => {
    const result = capture({
      search: '?utm_source=ads&gclid=abc',
      path: '/?email=person@example.com',
      referrer: 'https://news.example/story?email=person@example.com',
    })
    expect(result.persist).to.equal(true)
    expect(result.record?.first.landing_page).to.equal('/')
    expect(result.record?.first.referrer).to.equal('https://news.example/story')
    expect(result.record?.first).to.equal(result.record?.last)
  })

  it('drops a same-site referrer', () => {
    const result = capture({
      search: '?utm_source=ads',
      referrer: 'https://moondao.com/join?utm_source=ads',
    })
    expect(result.record?.first.referrer).to.equal('')
  })
})

describe('attribution persistence', () => {
  const landed = capture({
    search: '?utm_source=ads&gclid=abc',
    path: '/',
    referrer: 'https://google.com/aclk?q=secret',
  })
  const record = landed.record as StoredAttribution

  it('round-trips the record through JSON and a 90 day cookie', () => {
    expect(ATTRIBUTION_MAX_AGE_SECONDS).to.equal(NINETY_DAYS_SECONDS)
    expect(ATTRIBUTION_TTL_MS).to.equal(NINETY_DAYS_SECONDS * 1000)
    expect(record.expires_at).to.equal(NOW + ATTRIBUTION_TTL_MS)

    const cookie = buildAttributionCookie(
      serializeRecord(record),
      ATTRIBUTION_MAX_AGE_SECONDS,
      true
    )
    expect(cookie).to.include('md_attribution=')
    expect(cookie).to.include('Path=/')
    expect(cookie).to.include('Max-Age=7776000')
    expect(cookie).to.include('SameSite=Lax')
    expect(cookie).to.include('Secure')
    expect(buildAttributionCookie('{}', ATTRIBUTION_MAX_AGE_SECONDS, false)).to.not.include(
      'Secure'
    )
    expect(buildClearedAttributionCookie()).to.include('Max-Age=0')

    const encoded = cookie.slice('md_attribution='.length).split(';')[0]
    const parsed = parseRecord(decodeURIComponent(encoded), NOW)
    expect(parsed?.last.utm_source).to.equal('ads')
    expect(parsed?.last.gclid).to.equal('abc')
    expect(parsed?.last.referrer).to.equal('https://google.com/aclk')
    expect(parsed?.expires_at).to.equal(record.expires_at)
  })

  it('rejects expired, corrupt, and email-bearing stored values', () => {
    expect(parseRecord(serializeRecord(record), record.expires_at)).to.equal(null)
    expect(parseRecord('{', NOW)).to.equal(null)
    expect(parseRecord(JSON.stringify({ v: 2 }), NOW)).to.equal(null)

    const raw = JSON.parse(serializeRecord(record)) as {
      first: { utm_source?: string }
      last: { utm_source?: string }
    }
    raw.first.utm_source = 'a@b.com'
    raw.last.utm_source = 'a@b.com'
    const parsed = parseRecord(JSON.stringify(raw), NOW)
    expect(parsed?.last.utm_source).to.equal(undefined)
    expect(parsed?.last.gclid).to.equal('abc')
  })

  it('returns an empty object on the server', () => {
    expect(typeof window).to.equal('undefined')
    expect(getAttribution()).to.deep.equal({})
  })
})

describe('last-touch rules', () => {
  const landed = capture({
    search: '?utm_source=ads&utm_medium=cpc&gclid=abc',
    path: '/',
    referrer: 'https://google.com/aclk',
  })
  const record = landed.record as StoredAttribution

  it('does not overwrite last touch when the next URL has no campaign params', () => {
    const next = capture({
      record,
      search: '',
      path: '/join',
      referrer: 'https://moondao.com/',
      now: NOW + 5_000,
    })
    expect(next.persist).to.equal(false)
    expect(next.record).to.equal(record)
    expect(next.record?.last.landing_page).to.equal('/')
    expect(next.record?.last.utm_medium).to.equal('cpc')
  })

  it('does not overwrite last touch with blank params', () => {
    const next = capture({
      record,
      search: '?utm_source=&utm_medium=%20&gclid=',
      path: '/citizen',
      now: NOW + 5_000,
    })
    expect(next.persist).to.equal(false)
    expect(next.record).to.equal(record)
  })

  it('treats params copied onto the next funnel URL as the same campaign', () => {
    const next = capture({
      record,
      search: '?utm_source=ads&utm_medium=cpc&gclid=abc',
      path: '/citizen',
      now: NOW + 5_000,
    })
    expect(next.persist).to.equal(false)
    expect(next.record?.first.landing_page).to.equal('/')
    expect(next.record?.last.landing_page).to.equal('/')
  })

  it('keeps first touch and replaces last touch when a new campaign arrives', () => {
    const next = capture({
      record,
      search: '?utm_source=newsletter&utm_medium=',
      path: '/join',
      referrer: 'https://news.example/issue?email=person@example.com',
      now: NOW + 8_000,
    })
    expect(next.persist).to.equal(true)
    expect(next.record?.first.utm_source).to.equal('ads')
    expect(next.record?.first.gclid).to.equal('abc')
    expect(next.record?.first.landing_page).to.equal('/')
    expect(next.record?.first.referrer).to.equal('https://google.com/aclk')
    expect(next.record?.last.utm_source).to.equal('newsletter')
    expect(next.record?.last.utm_medium).to.equal(undefined)
    expect(next.record?.last.gclid).to.equal(undefined)
    expect(next.record?.last.landing_page).to.equal('/join')
    expect(next.record?.last.referrer).to.equal('https://news.example/issue')
    expect(next.record?.expires_at).to.equal(NOW + 8_000 + ATTRIBUTION_TTL_MS)
  })

  it('starts a new first touch after the 90 day window', () => {
    const next = capture({
      record,
      search: '?utm_source=fresh&fbclid=new',
      path: '/team',
      now: record.expires_at,
    })
    expect(next.record?.first.utm_source).to.equal('fresh')
    expect(next.record?.first.fbclid).to.equal('new')
    expect(next.record?.first.landing_page).to.equal('/team')
    expect(next.record?.last).to.equal(next.record?.first)
    expect(next.record?.first.gclid).to.equal(undefined)
  })
})

describe('consent', () => {
  it('keeps the touch in memory and does not persist before a choice', () => {
    const pending = capture({
      consent: null,
      search: '?utm_source=ads&gclid=abc',
      path: '/',
      referrer: 'https://google.com/aclk?q=secret',
    })
    expect(pending.persist).to.equal(false)
    expect(pending.clear).to.equal(false)
    expect(pending.record).to.equal(null)
    expect(pending.memory?.last.utm_source).to.equal('ads')
    expect(pending.memory?.last.referrer).to.equal('https://google.com/aclk')

    const internal = capture({
      consent: null,
      memory: pending.memory,
      search: '',
      path: '/join',
      now: NOW + 1_000,
    })
    expect(internal.memory).to.equal(pending.memory)
    expect(internal.persist).to.equal(false)
  })

  it('persists the in-memory touch once consent is granted', () => {
    const pending = capture({
      consent: null,
      search: '?utm_source=ads&gclid=abc',
      path: '/',
    })
    const granted = capture({
      consent: true,
      record: null,
      memory: pending.memory,
      search: '?utm_source=ads&gclid=abc',
      path: '/join',
      now: NOW + 2_000,
    })
    expect(granted.persist).to.equal(true)
    expect(granted.memory).to.equal(null)
    expect(granted.record?.first.landing_page).to.equal('/')
    expect(granted.record?.last.utm_source).to.equal('ads')
    expect(toFlatAttribution(granted.record).utm_source).to.equal('ads')
    expect(toFlatAttribution(granted.record).first_utm_source).to.equal('ads')
    expect(toFlatAttribution(granted.record).first_landing_page).to.equal('/')
    expect(toFlatAttribution(granted.record).gclid).to.equal('abc')
  })

  it('clears stored attribution when consent is denied', () => {
    const record = capture({ search: '?utm_source=ads' }).record
    const denied = capture({
      consent: false,
      record,
      memory: record,
      search: '?utm_source=ads&gclid=abc',
    })
    expect(denied).to.deep.equal({ record: null, memory: null, persist: false, clear: true })
  })
})

describe('funnel passthrough', () => {
  const params = { utm_source: 'ads', gclid: 'abc', fbclid: 'fb' }

  it('adds campaign params to join, citizen, and team links', () => {
    expect(withAttribution('/join', params)).to.equal('/join?utm_source=ads&gclid=abc&fbclid=fb')
    expect(withAttribution('/citizen?invite=tok#pay', params)).to.equal(
      '/citizen?invite=tok&utm_source=ads&gclid=abc&fbclid=fb#pay'
    )
    expect(withAttribution('/team', { utm_source: 'ads' })).to.equal('/team?utm_source=ads')
  })

  it('does not overwrite params already on the link or decorate other paths', () => {
    expect(withAttribution('/join?utm_source=keep&page=2', params)).to.equal(
      '/join?utm_source=keep&page=2&gclid=abc&fbclid=fb'
    )
    expect(withAttribution('/docs', params)).to.equal('/docs')
    expect(withAttribution('/citizen/ada-1', params)).to.equal('/citizen/ada-1')
    expect(withAttribution('/team/12', params)).to.equal('/team/12')
    expect(withAttribution('https://example.com/join', params)).to.equal('https://example.com/join')
    expect(withAttribution('//evil.example/join', params)).to.equal('//evil.example/join')
  })

  it('decorates router url objects for the funnel only', () => {
    const docs = { pathname: '/docs', query: { page: '1' } }
    expect(decorateRouterUrl(docs, params)).to.equal(docs)

    const join = decorateRouterUrl({ pathname: '/join', query: { tab: 'map' } }, params)
    expect(join.query).to.deep.equal({ tab: 'map', utm_source: 'ads', gclid: 'abc', fbclid: 'fb' })

    const citizen = decorateRouterUrl(
      { pathname: '/citizen', query: { utm_source: 'keep', invite: 'tok' } },
      params
    )
    expect(citizen.query).to.deep.equal({
      utm_source: 'keep',
      invite: 'tok',
      gclid: 'abc',
      fbclid: 'fb',
    })
  })

  it('keeps campaign params when a shallow query replaces the rest', () => {
    expect(
      mergeAttributionQuery(
        { utm_source: 'ads', gclid: ['abc'], tab: 'old', email: 'person@example.com' },
        { tab: 'map', page: '1' }
      )
    ).to.deep.equal({ tab: 'map', page: '1', utm_source: 'ads', gclid: 'abc' })
  })

  it('stringifies numeric route params so dynamic pages keep their id', () => {
    expect(
      mergeAttributionQuery(
        { utm_source: 'ads', onrampSuccess: 'true' },
        { tokenId: 1, tab: 'about', onrampSuccess: 'true' }
      )
    ).to.deep.equal({
      tokenId: '1',
      tab: 'about',
      onrampSuccess: 'true',
      utm_source: 'ads',
    })
  })
})

describe('browser persistence', () => {
  const scope = globalThis as { window?: unknown; document?: unknown }
  const previousWindow = scope.window
  const previousDocument = scope.document

  afterEach(() => {
    resetAttributionForTests()
    if (previousWindow === undefined) delete scope.window
    else scope.window = previousWindow
    if (previousDocument === undefined) delete scope.document
    else scope.document = previousDocument
  })

  function installBrowser() {
    const values = new Map<string, string>()
    const state = {
      consent: null as string | null,
      search: '?utm_source=ads&gclid=abc',
      pathname: '/',
      referrer: 'https://google.com/aclk?q=secret',
    }
    const cookieSets: string[] = []
    let cookie = ''
    const localStorage = {
      getItem: (key: string) => {
        if (key === 'cookie_consent') return state.consent
        return values.has(key) ? (values.get(key) as string) : null
      },
      setItem: (key: string, value: string) => {
        values.set(key, value)
      },
      removeItem: (key: string) => {
        values.delete(key)
      },
    }
    const documentMock = {
      get referrer() {
        return state.referrer
      },
      get cookie() {
        return cookie
      },
      set cookie(value: string) {
        cookieSets.push(value)
        cookie = value.includes('Max-Age=0') ? '' : value.split(';')[0]
      },
    }
    const windowMock = {
      localStorage,
      location: {
        get search() {
          return state.search
        },
        get pathname() {
          return state.pathname
        },
        origin: 'https://moondao.com',
        protocol: 'https:',
      },
      document: documentMock,
    }
    scope.window = windowMock
    scope.document = documentMock
    return { values, state, cookieSets }
  }

  it('does not write the cookie or localStorage before consent', () => {
    const browser = installBrowser()
    captureClientAttribution(Date.now())
    expect(browser.values.has(ATTRIBUTION_STORAGE_KEY)).to.equal(false)
    expect(browser.cookieSets).to.deep.equal([])
    expect(getAttribution()).to.deep.equal({})
  })

  it('writes first and last touch to the cookie and localStorage for 90 days', () => {
    const browser = installBrowser()
    const now = Date.now()
    browser.state.consent = 'true'
    captureClientAttribution(now)

    const stored = browser.values.get(ATTRIBUTION_STORAGE_KEY) as string
    const parsed = parseRecord(stored, now)
    expect(parsed?.first.utm_source).to.equal('ads')
    expect(parsed?.last.gclid).to.equal('abc')
    expect(parsed?.first.landing_page).to.equal('/')
    expect(parsed?.first.referrer).to.equal('https://google.com/aclk')
    expect(browser.cookieSets[0]).to.include(`${ATTRIBUTION_COOKIE_NAME}=`)
    expect(browser.cookieSets[0]).to.include('Max-Age=7776000')
    expect(browser.cookieSets[0]).to.include('SameSite=Lax')
    expect(browser.cookieSets[0]).to.include('Secure')
    expect(getAttribution()).to.include({
      utm_source: 'ads',
      gclid: 'abc',
      landing_page: '/',
      first_utm_source: 'ads',
      first_landing_page: '/',
    })

    browser.state.search = ''
    browser.state.pathname = '/join'
    browser.state.referrer = 'https://moondao.com/'
    captureClientAttribution(now + 5_000)
    expect(browser.values.get(ATTRIBUTION_STORAGE_KEY)).to.equal(stored)
    expect(browser.cookieSets).to.have.length(1)
    expect(getAttribution().landing_page).to.equal('/')
  })

  it('clears both stores when consent is denied', () => {
    const browser = installBrowser()
    browser.state.consent = 'true'
    captureClientAttribution(Date.now())
    browser.state.consent = 'false'
    captureClientAttribution(Date.now() + 1_000)
    expect(browser.values.has(ATTRIBUTION_STORAGE_KEY)).to.equal(false)
    expect(browser.cookieSets[browser.cookieSets.length - 1]).to.include('Max-Age=0')
    expect(getAttribution()).to.deep.equal({})
  })
})

describe('downstream fields', () => {
  it('builds a flat object with last-touch keys and first_ variants', () => {
    const first = applyTouch(
      null,
      { utm_source: 'ads', gclid: 'abc' },
      '/',
      'https://google.com/aclk',
      NOW
    )
    const record = applyTouch(
      first,
      { utm_source: 'newsletter' },
      '/join',
      '',
      NOW + 10
    ) as StoredAttribution
    expect(toFlatAttribution(record)).to.deep.equal({
      utm_source: 'newsletter',
      landing_page: '/join',
      first_utm_source: 'ads',
      first_gclid: 'abc',
      first_landing_page: '/',
      first_referrer: 'https://google.com/aclk',
    })
  })

  it('passes attribution into Typeform hidden fields and Kit fields without extra PII', () => {
    const flat = toFlatAttribution(
      capture({ search: '?utm_source=ads&gclid=abc&wbraid=wb', path: '/' }).record
    )
    expect(typeformHiddenFields(flat)).to.deep.equal({
      utm_source: 'ads',
      gclid: 'abc',
      wbraid: 'wb',
      landing_page: '/',
    })
    expect(typeformEmbedUrl('abc123', flat)).to.equal(
      'https://form.typeform.com/to/abc123?utm_source=ads&gclid=abc&wbraid=wb&landing_page=%2F'
    )
    expect(kitFieldsFromAttribution(flat)?.utm_source).to.equal('ads')
    expect(kitFieldsFromAttribution(flat)?.first_gclid).to.equal('abc')
    expect(
      sanitizeKitFields({
        utm_source: 'ads',
        email: 'person@example.com',
        name: 'Pat',
        gclid: 'person@example.com',
        fbclid: 'fb',
      })
    ).to.deep.equal({ utm_source: 'ads', fbclid: 'fb' })
  })
})
