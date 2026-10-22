/// <reference types="node" />
/// <reference types="mocha" />
import assert from 'assert'
import fs from 'fs'
import type { NextApiRequest } from 'next'
import path from 'path'
import { kitPayload, redactKitBody, subscribeEmailToKit } from '../lib/convert-kit/kitSubscribe'
import { fetchActiveSubscriberLabel } from '../lib/convert-kit/subscriberCount'
import {
  classifySubscriber,
  emailLogRef,
  MIN_SUBMIT_MS,
  normalizeEmail,
} from '../lib/convert-kit/subscriberFilter'
import {
  FALLBACK_SUBSCRIBER_LABEL,
  formatSubscriberLabel,
  SUBSCRIBER_COUNT_REVALIDATE_SECONDS,
} from '../lib/convert-kit/subscriberLabel'
import {
  handleNewsletterSubscribe,
  type NewsletterSubscribeDeps,
} from '../pages/api/convertkit/subscribe'

const NOW = 1_700_000_000_000
const SECRET = 'ada@moon.com'

function mockRes() {
  const res = {
    statusCode: 0,
    payload: undefined as unknown,
    status(code: number) {
      res.statusCode = code
      return res
    },
    json(body: unknown) {
      res.payload = body
      return res
    },
  }
  return res
}

function mockReq(body: unknown, headers: Record<string, string> = {}): NextApiRequest {
  return {
    method: 'POST',
    body,
    headers,
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as NextApiRequest
}

function harness(body: unknown) {
  const calls: { url: string; body: Record<string, unknown> }[] = []
  const logs: { event: string; detail: Record<string, unknown> }[] = []
  const limited: { ip: string[]; email: string[] } = { ip: [], email: [] }
  let ipAllowed = true
  let emailAllowed = true
  const deps: NewsletterSubscribeDeps = {
    now: () => NOW,
    sleep: async () => {},
    env: { CONVERT_KIT_API_KEY: 'kit-secret' },
    limiter: {
      async limitIp(ip: string) {
        limited.ip.push(ip)
        return ipAllowed
      },
      async limitEmail(email: string) {
        limited.email.push(email)
        return emailAllowed
      },
    },
    fetchImpl: (async (url: string, init?: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init?.body || '{}')) })
      return new Response(JSON.stringify({ subscription: { id: 1 } }), { status: 200 })
    }) as typeof fetch,
    log: (event, detail) => logs.push({ event, detail }),
    clientIp: () => '203.0.113.8',
  }
  return {
    calls,
    logs,
    limited,
    deps,
    blockIp() {
      ipAllowed = false
    },
    blockEmail() {
      emailAllowed = false
    },
    async post(next = body) {
      const res = mockRes()
      await handleNewsletterSubscribe(mockReq(next), res as never, deps)
      return res
    },
  }
}

const ready = {
  email: SECRET,
  formId: '3715552',
  company: '',
  formStartedAt: NOW - MIN_SUBMIT_MS,
  fields: {
    first_utm_source: 'ig',
    first_utm_campaign: 'spring',
    first_referrer: 'https://instagram.com/',
    first_landing_page: '/join-us',
    first_fbclid: 'fb1',
    email: SECRET,
    utm_source: 'last',
  },
}

describe('newsletter subscribe route', () => {
  it('returns Kit success and forwards only the existing first-touch fields', async () => {
    const test = harness(ready)
    const res = await test.post()
    assert.strictEqual(res.statusCode, 200)
    assert.deepStrictEqual(res.payload, { success: true })
    assert.strictEqual(test.calls.length, 1)
    assert.strictEqual(test.calls[0].url, 'https://api.convertkit.com/v3/forms/3715552/subscribe')
    assert.deepStrictEqual(test.calls[0].body, {
      api_key: 'kit-secret',
      email: SECRET,
      fields: {
        first_utm_source: 'ig',
        first_utm_campaign: 'spring',
        first_referrer: 'https://instagram.com/',
        first_landing_page: '/join-us',
        first_fbclid: 'fb1',
      },
    })
    assert.equal(JSON.stringify(test.calls[0].body).includes('reactivate'), false)
    assert.deepStrictEqual(test.limited.email, [normalizeEmail(SECRET)])
  })

  it('returns 502 when Kit keeps failing and 400 for a real Kit rejection', async () => {
    const failing = harness(ready)
    let attempts = 0
    failing.deps.fetchImpl = (async () => {
      attempts += 1
      return new Response('upstream down', { status: 503 })
    }) as typeof fetch
    const down = await failing.post()
    assert.strictEqual(down.statusCode, 502)
    assert.deepStrictEqual(down.payload, { success: false })
    assert.strictEqual(attempts, 3)
    assert.equal(JSON.stringify(failing.logs).includes(SECRET), false)

    const invalid = harness(ready)
    invalid.deps.fetchImpl = (async () =>
      new Response('{"message":"Email address is invalid"}', { status: 400 })) as typeof fetch
    const rejected = await invalid.post()
    assert.strictEqual(rejected.statusCode, 400)
  })

  it('retries without an unknown Kit field and then returns success', async () => {
    const test = harness(ready)
    const bodies: string[] = []
    test.deps.fetchImpl = (async (_url: string, init?: RequestInit) => {
      const raw = String(init?.body || '')
      bodies.push(raw)
      if (bodies.length === 1) {
        return new Response('{"message":"Custom field `first_fbclid` does not exist"}', {
          status: 422,
        })
      }
      return new Response('{}', { status: 200 })
    }) as typeof fetch
    const res = await test.post()
    assert.strictEqual(res.statusCode, 200)
    const second = JSON.parse(bodies[1])
    assert.strictEqual(second.fields.first_fbclid, undefined)
    assert.strictEqual(second.fields.first_utm_source, 'ig')
    assert.equal(JSON.stringify(test.logs).includes(SECRET), false)
    assert.equal(redactKitBody(`subscriber ${SECRET} failed`).includes(SECRET), false)
  })

  it('retries a network error once and does not resubscribe on the payload', async () => {
    const test = harness(ready)
    let attempts = 0
    test.deps.fetchImpl = (async (_url: string, init?: RequestInit) => {
      attempts += 1
      if (attempts === 1) throw new Error('socket hang up')
      return new Response('{}', { status: 200 })
    }) as typeof fetch
    const res = await test.post()
    assert.strictEqual(res.statusCode, 200)
    assert.strictEqual(attempts, 2)
    assert.equal(kitPayload('k', SECRET).reactivate, undefined)
  })

  it('returns 502 when the Kit key is missing and 400 for a bad request', async () => {
    const test = harness(ready)
    test.deps.env = {}
    const missing = await test.post()
    assert.strictEqual(missing.statusCode, 502)
    assert.strictEqual(test.calls.length, 0)

    const bad = await test.post({ email: 'not-an-email', formId: '3715552' })
    assert.strictEqual(bad.statusCode, 400)
    const other = mockRes()
    await handleNewsletterSubscribe(
      { method: 'GET', body: {}, headers: {}, socket: {} } as NextApiRequest,
      other as never,
      test.deps
    )
    assert.strictEqual(other.statusCode, 400)
  })

  it('shows success for filtered signups and logs without the full email', async () => {
    const cases: unknown[] = [
      { ...ready, company: 'Acme Bots' },
      { ...ready, formStartedAt: NOW },
      { ...ready, email: 'a.b.c.d@gmail.com' },
      { ...ready, email: 'bot@project.iam.gserviceaccount.com' },
      { ...ready, email: 'no-reply@moon.com' },
      { ...ready, email: 'test@gmail.com' },
      { ...ready, email: 'one@mailinator.com' },
    ]
    for (const body of cases) {
      const test = harness(body)
      const res = await test.post()
      assert.strictEqual(res.statusCode, 200)
      assert.deepStrictEqual(res.payload, { success: true })
      assert.strictEqual(test.calls.length, 0)
      const logged = JSON.stringify(test.logs)
      const email = (body as { email: string }).email
      assert.equal(logged.includes(email), false)
      assert.equal(test.logs[0].detail.domain !== undefined, true)
    }

    const dots = harness({ ...ready, email: 'a.b@gmail.com' })
    const allowed = await dots.post()
    assert.strictEqual(allowed.statusCode, 200)
    assert.strictEqual(dots.calls.length, 1)

    const omitted = harness({ ...ready, formStartedAt: undefined })
    const dropped = await omitted.post()
    assert.strictEqual(dropped.statusCode, 200)
    assert.strictEqual(omitted.calls.length, 0)

    const network = harness({
      email: SECRET,
      formId: '7238581',
      fields: ready.fields,
    })
    const citizen = await network.post()
    assert.strictEqual(citizen.statusCode, 200)
    assert.strictEqual(network.calls.length, 1)
    assert.strictEqual(network.calls[0].url.endsWith('/7238581/subscribe'), true)
  })

  it('rate limits by ip and normalized email without calling Kit', async () => {
    const byIp = harness(ready)
    byIp.blockIp()
    const ipRes = await byIp.post()
    assert.strictEqual(ipRes.statusCode, 200)
    assert.strictEqual(byIp.calls.length, 0)
    assert.strictEqual(byIp.logs[0].detail.reason, 'rate_ip')
    assert.equal(JSON.stringify(byIp.logs).includes(SECRET), false)

    const byEmail = harness({ ...ready, email: 'a.b+tag@gmail.com' })
    byEmail.blockEmail()
    const emailRes = await byEmail.post()
    assert.strictEqual(emailRes.statusCode, 200)
    assert.deepStrictEqual(byEmail.limited.email, ['ab@gmail.com'])
    assert.strictEqual(byEmail.logs[0].detail.reason, 'rate_email')
    const ref = emailLogRef('a.b+tag@gmail.com')
    assert.strictEqual(ref.domain, 'gmail.com')
    assert.strictEqual(ref.localHash.length, 12)
  })
})

describe('subscriber filter', () => {
  it('classifies junk addresses and collapses gmail aliases', () => {
    assert.strictEqual(normalizeEmail('A.B+News@googlemail.com'), 'ab@gmail.com')
    assert.strictEqual(
      classifySubscriber({
        email: 'a.b.c.d@gmail.com',
        company: '',
        formStartedAt: NOW - MIN_SUBMIT_MS,
        now: NOW,
      }),
      'gmail_dots'
    )
    assert.strictEqual(
      classifySubscriber({
        email: 'reader@sub.mailinator.com',
        company: '  ',
        formStartedAt: NOW - 10_000,
        now: NOW,
      }),
      'disposable'
    )
    assert.strictEqual(
      classifySubscriber({
        email: 'ada@moon.com',
        company: '',
        formStartedAt: NOW - MIN_SUBMIT_MS,
        now: NOW,
      }),
      null
    )
  })
})

describe('subscriber count', () => {
  it('rounds down to a clean figure and falls back without logging an email', async () => {
    assert.strictEqual(formatSubscriberLabel(8234), '8,000+')
    assert.strictEqual(formatSubscriberLabel(8000), '8,000+')
    assert.strictEqual(formatSubscriberLabel(12550), '12,000+')
    assert.strictEqual(formatSubscriberLabel(950), '900+')
    assert.strictEqual(formatSubscriberLabel(12), null)
    assert.strictEqual(SUBSCRIBER_COUNT_REVALIDATE_SECONDS, 86400)

    let sawKey = ''
    const label = await fetchActiveSubscriberLabel({ KIT_V4_API_KEY: 'server-key' }, (async (
      _url: string,
      init?: RequestInit
    ) => {
      sawKey = String((init?.headers as Record<string, string>)['X-Kit-Api-Key'] || '')
      return new Response(
        JSON.stringify({
          pagination: { total_count: 8234 },
          subscribers: [{ email_address: SECRET }],
        }),
        { status: 200 }
      )
    }) as typeof fetch)
    assert.strictEqual(label, '8,000+')
    assert.strictEqual(sawKey, 'server-key')
    assert.equal(label.includes(SECRET), false)

    const fallback = await fetchActiveSubscriberLabel({}, (async () => {
      throw new Error('down')
    }) as typeof fetch)
    assert.strictEqual(fallback, FALLBACK_SUBSCRIBER_LABEL)

    const fromExisting = await fetchActiveSubscriberLabel(
      { CONVERT_KIT_V4_API_KEY: 'legacy-key' },
      (async () => new Response('nope', { status: 503 })) as typeof fetch
    )
    assert.strictEqual(fromExisting, FALLBACK_SUBSCRIBER_LABEL)
  })

  it('uses the Kit v3 active total when v4 is absent, and falls back when v3 fails', async () => {
    const secret = 'v3-secret'
    const calls: string[] = []
    const logs: string[] = []
    const methods = ['log', 'info', 'warn', 'error', 'debug'] as const
    const originals = methods.map((name) => console[name].bind(console))
    for (const name of methods) {
      console[name] = (...args: unknown[]) => {
        logs.push(args.map((arg) => String(arg)).join(' '))
      }
    }
    try {
      const label = await fetchActiveSubscriberLabel(
        {
          CONVERT_KIT_V4_API_KEY: 'legacy-key',
          CONVERT_KIT_API_SECRET: secret,
          CONVERT_KIT_API_KEY: 'public-key',
        },
        (async (url: string) => {
          calls.push(url)
          if (url.includes('api.kit.com')) return new Response('nope', { status: 503 })
          return new Response(
            JSON.stringify({
              total_subscribers: 8234,
              subscribers: [{ email_address: SECRET, state: 'active' }],
            }),
            { status: 200 }
          )
        }) as typeof fetch
      )
      assert.strictEqual(label, '8,000+')
      assert.strictEqual(calls.length, 2)
      assert.equal(calls[0].includes('api_secret'), false)
      const parsed = new URL(calls[1])
      assert.strictEqual(
        `${parsed.origin}${parsed.pathname}`,
        'https://api.convertkit.com/v3/subscribers'
      )
      assert.strictEqual(parsed.searchParams.get('api_secret'), secret)
      assert.strictEqual(parsed.searchParams.get('subscriber_state'), 'active')
      assert.equal(parsed.searchParams.get('api_secret') === 'public-key', false)
      const logged = logs.join('\n')
      assert.equal(logged.includes(secret), false)
      assert.equal(logged.includes('api_secret'), false)
      assert.equal(logged.includes(SECRET), false)

      const failed = await fetchActiveSubscriberLabel(
        { CONVERT_KIT_API_KEY: 'public-key' },
        (async () => new Response('nope', { status: 500 })) as typeof fetch
      )
      assert.strictEqual(failed, FALLBACK_SUBSCRIBER_LABEL)

      const thrown = await fetchActiveSubscriberLabel(
        { CONVERT_KIT_API_SECRET: secret },
        (async () => {
          throw new Error(`down ${secret}`)
        }) as typeof fetch
      )
      assert.strictEqual(thrown, FALLBACK_SUBSCRIBER_LABEL)
      assert.equal(logs.join('\n').includes(secret), false)

      const mixed = await fetchActiveSubscriberLabel(
        { CONVERT_KIT_API_SECRET: secret },
        (async () =>
          new Response(
            JSON.stringify({
              total_subscribers: 15000,
              subscribers: [{ state: 'cancelled', email_address: SECRET }],
            }),
            { status: 200 }
          )) as typeof fetch
      )
      assert.strictEqual(mixed, FALLBACK_SUBSCRIBER_LABEL)
    } finally {
      methods.forEach((name, index) => {
        console[name] = originals[index]
      })
    }
  })
})

describe('signup pages', () => {
  const root = path.join(__dirname, '..')

  it('join-us uses the live label, a daily revalidate, and the join_us event', () => {
    const source = fs.readFileSync(path.join(root, 'pages/join-us.tsx'), 'utf8')
    assert.equal(source.includes('revalidate: SUBSCRIBER_COUNT_REVALIDATE_SECONDS'), true)
    assert.equal(source.includes('ctaLocation="join_us"'), true)
    assert.equal(source.includes('KIT_V4_API_KEY'), false)
    assert.equal(source.includes('CONVERT_KIT'), false)
    assert.equal(source.includes('https://moondao.com/discord'), true)
    assert.equal(source.includes('LogoSidebar'), true)
    assert.equal(source.includes('—'), false)
  })

  it('linktree shows the newsletter button with the instagram url', () => {
    const source = fs.readFileSync(path.join(root, 'pages/linktree.tsx'), 'utf8')
    assert.equal(
      source.includes(
        'https://moondao.com/join-us?utm_source=instagram&utm_medium=bio&utm_campaign=ig-bio-newsletter'
      ),
      true
    )
    assert.equal(source.includes('/assets/linktree/icon-newsletter-96.png'), true)
    assert.equal(source.includes('moondao.ck.page'), false)
  })

  it('confirmation pages use the newsletter copy', () => {
    const almost = fs.readFileSync(path.join(root, 'pages/almost-there.tsx'), 'utf8')
    const thanks = fs.readFileSync(path.join(root, 'pages/thank-you.tsx'), 'utf8')
    assert.equal(almost.includes('Sign up again'), true)
    assert.equal(almost.includes('Try Again'), false)
    assert.equal(almost.includes('Promotions'), true)
    assert.equal(thanks.includes("You're confirmed. Welcome to MoonDAO."), true)
    assert.equal(
      thanks.includes(
        'https://moondao.com/citizen?utm_source=kit&utm_medium=web&utm_campaign=confirm&utm_content=thank-you'
      ),
      true
    )
    assert.equal(thanks.includes('Go to the homepage'), true)
    assert.equal(almost.includes('—'), false)
    assert.equal(thanks.includes('—'), false)
  })
})

describe('kit subscribe helper', () => {
  it('does not put the api key or an email into the redacted log line', async () => {
    const logs: Record<string, unknown>[] = []
    const result = await subscribeEmailToKit({
      email: SECRET,
      formId: '3715552',
      apiKey: 'kit-secret',
      fields: { first_utm_source: 'ig' },
      sleep: async () => {},
      log: (_event, detail) => logs.push(detail),
      fetchImpl: (async () =>
        new Response(`{"email":"${SECRET}","api_key":"kit-secret"}`, {
          status: 500,
        })) as typeof fetch,
    })
    assert.strictEqual(result.ok, false)
    assert.strictEqual(result.status, 502)
    const text = JSON.stringify(logs)
    assert.equal(text.includes(SECRET), false)
    assert.equal(text.includes('kit-secret'), false)
  })
})
