/// <reference types="node" />
import { expect } from 'chai'
import type { ActivitySnapshot } from '../lib/activity-summary/collectActivity'
import { generateActivitySummary } from '../lib/activity-summary/generate'
import {
  buildSummaryUserPrompt,
  hasActivity,
  normalizeSummary,
} from '../lib/activity-summary/prompt'
import type { ActivitySummary } from '../lib/activity-summary/prompt'
import { fetchMintTimestamps } from '../lib/activity-summary/mintTimes'
import { pickForDay } from '../lib/activity-summary/spotlight'
import { getOrCreateSummary, SummaryStore, summaryKeys } from '../lib/activity-summary/store'
import { parseLumaCalendarPage } from '../lib/townhall/luma'

const NOW = new Date('2026-10-23T12:00:00Z')

function snapshot(overrides: Partial<ActivitySnapshot> = {}): ActivitySnapshot {
  return {
    periodStart: '2026-10-16T12:00:00.000Z',
    periodEnd: NOW.toISOString(),
    citizens: [
      {
        id: 412,
        name: 'Ada Lovelace',
        location: 'London, UK',
        bio: 'Engineer',
        image: 'ipfs://QmAda',
      },
    ],
    totalCitizens: 640,
    teams: [],
    jobs: [{ id: 7, title: 'Lunar Habitat Designer', teamId: 3 }],
    listings: [],
    proposals: [
      { mdp: 180, name: 'Moon Rover Grant', status: 'member-vote' },
      { mdp: 181, name: 'Regolith Kiln', status: 'senate-review' },
    ],
    upcomingEvents: [
      {
        id: 'evt-1',
        name: 'Weekly Town Hall',
        startAt: '2026-10-24T17:00:00.000Z',
        url: 'https://lu.ma/moondao-townhall',
        image: 'https://images.lumacdn.com/cover.png',
        guestCount: 42,
      },
    ],
    latestTownHall: null,
    mooney: { price: 0.0004, priceChange24h: 1.2 },
    spotlight: {},
    ...overrides,
  }
}

function emptySnapshot(): ActivitySnapshot {
  return snapshot({ citizens: [], jobs: [], proposals: [], upcomingEvents: [] })
}

const MODEL_OUTPUT = {
  sections: [
    { kind: 'citizens', summary: 'Ada Lovelace joined from London.', refs: ['citizen:412'] },
    {
      kind: 'governance',
      summary: 'MDP-180 is awaiting a decision.',
      refs: ['proposal:180', 'proposal:999'],
    },
    { kind: 'governance', summary: 'Duplicate section.', refs: [] },
    { kind: 'weather', summary: 'Not a real kind.', refs: [] },
    { kind: 'events', summary: 'Town hall on Saturday.', refs: ['event:evt-1'] },
  ],
}

describe('activity summary prompt', () => {
  it('gives every linkable item a ref and leaves out URLs', () => {
    const prompt = buildSummaryUserPrompt(snapshot())
    expect(prompt).to.include('"ref": "citizen:412"')
    expect(prompt).to.include('"mdp": 180')
    expect(prompt).to.not.include('"ref": "proposal:')
    expect(prompt).to.include('"status": "member-vote"')
    expect(prompt).to.include('"status": "senate-review"')
    expect(prompt).to.include('"ref": "job:7"')
    expect(prompt).to.include('"ref": "event:evt-1"')
    expect(prompt).to.include('"guestCount": 42')
    expect(prompt).to.not.include('lu.ma')
    expect(prompt).to.not.include('lumacdn')
    expect(prompt).to.not.include('ipfs://')
  })

  it('treats a week with nothing in it as no activity', () => {
    expect(hasActivity(snapshot())).to.equal(true)
    expect(hasActivity(emptySnapshot())).to.equal(false)
  })
})

describe('normalizeSummary', () => {
  const summary = normalizeSummary({
    raw: MODEL_OUTPUT,
    snapshot: snapshot(),
    model: 'test-model',
    now: NOW,
  })!

  it('orders sections and drops duplicate and unknown kinds', () => {
    expect(summary.sections.map((s) => s.kind)).to.deep.equal(['governance', 'events', 'citizens'])
    expect(summary.sections[0].summary).to.equal('MDP-180 is awaiting a decision.')
  })

  it('links governance to the vote page instead of each proposal', () => {
    expect(summary.sections[0].links).to.deep.equal([{ label: 'Go to the vote', href: '/projects' }])

    const senateOnly = normalizeSummary({
      raw: MODEL_OUTPUT,
      snapshot: snapshot({ proposals: [{ mdp: 181, name: 'Regolith Kiln', status: 'senate-review' }] }),
      model: 'm',
    })!
    expect(senateOnly.sections[0].links).to.deep.equal([
      { label: 'View proposals', href: '/projects' },
    ])
  })

  it('links only refs that exist in the snapshot', () => {
    expect(summary.sections[2].links).to.deep.equal([
      {
        label: 'Ada Lovelace',
        href: '/citizen/ada-lovelace-412',
        image: 'ipfs://QmAda',
        detail: 'London, UK',
      },
    ])
    expect(summary.sections[1].links).to.deep.equal([
      {
        label: 'Weekly Town Hall',
        href: 'https://lu.ma/moondao-townhall',
        image: 'https://images.lumacdn.com/cover.png',
        startAt: '2026-10-24T17:00:00.000Z',
        detail: '42 going',
      },
    ])
  })

  it('records the period, model and generation time', () => {
    expect(summary.periodStart).to.equal('2026-10-16T12:00:00.000Z')
    expect(summary.model).to.equal('test-model')
    expect(summary.generatedAt).to.equal(NOW.toISOString())
  })

  it('returns null when no section is usable', () => {
    expect(normalizeSummary({ raw: { sections: [] }, snapshot: snapshot(), model: 'm' })).to.equal(null)
    expect(
      normalizeSummary({
        raw: { sections: [{ kind: 'weather', summary: 'x' }, { kind: 'jobs', summary: '' }] },
        snapshot: snapshot(),
        model: 'm',
      })
    ).to.equal(null)
    expect(normalizeSummary({ raw: 'nonsense', snapshot: snapshot(), model: 'm' })).to.equal(null)
  })

  it('does not need a headline', () => {
    expect(summary).to.not.have.property('headline')
    expect(summary.sections).to.have.length(3)
  })

  it('does not link a town hall URL that is not https', () => {
    const s = snapshot({
      upcomingEvents: [
        { id: 'evt-1', name: 'Town Hall', startAt: '2026-10-24T17:00:00Z', url: 'javascript:alert(1)' },
      ],
    })
    const result = normalizeSummary({ raw: MODEL_OUTPUT, snapshot: s, model: 'm' })!
    const events = result.sections.find((sec) => sec.kind === 'events')!
    expect(events.links).to.deep.equal([])
  })
})

describe('spotlights', () => {
  const quietWeek = snapshot({
    citizens: [],
    jobs: [],
    proposals: [],
    upcomingEvents: [],
    spotlight: {
      citizen: { id: 88, name: 'Grace Hopper', bio: 'Compiler pioneer' },
      job: { id: 3, title: 'Regolith Engineer' },
      project: { mdp: 150, name: 'Lunar Garden', description: 'Growing plants in regolith' },
    },
  })
  const raw = {
    sections: [
      { kind: 'citizenSpotlight', summary: 'Meet Grace Hopper.', refs: ['citizen:88'] },
      { kind: 'jobs', summary: 'Featured role: Regolith Engineer.', refs: ['job:3'] },
      { kind: 'governance', summary: 'Featured project: Lunar Garden.', refs: ['project:150'] },
    ],
  }

  it('counts a week with only spotlights as having something to show', () => {
    expect(hasActivity(quietWeek)).to.equal(true)
  })

  it('passes spotlight items with refs and links them', () => {
    const prompt = buildSummaryUserPrompt(quietWeek)
    expect(prompt).to.include('"ref": "citizen:88"')
    expect(prompt).to.include('"ref": "project:150"')

    const result = normalizeSummary({ raw, snapshot: quietWeek, model: 'm' })!
    const byKind = Object.fromEntries(result.sections.map((s) => [s.kind, s]))
    expect(byKind.citizenSpotlight.links).to.deep.equal([
      { label: 'Grace Hopper', href: '/citizen/grace-hopper-88' },
    ])
    expect(byKind.jobs.links).to.deep.equal([{ label: 'Regolith Engineer', href: '/jobs/3' }])
    expect(byKind.governance.links).to.deep.equal([{ label: 'Lunar Garden', href: '/project/150' }])
  })

  it('flags spotlight sections from the snapshot, not the model', () => {
    const result = normalizeSummary({ raw, snapshot: quietWeek, model: 'm' })!
    expect(result.sections.every((s) => s.spotlight)).to.equal(true)

    const busyWeek = normalizeSummary({ raw: MODEL_OUTPUT, snapshot: snapshot(), model: 'm' })!
    expect(busyWeek.sections.some((s) => s.spotlight)).to.equal(false)
  })

  it('drops a "citizens" section in a week nobody joined', () => {
    const misfiled = {
      sections: [{ kind: 'citizens', summary: 'Grace Hopper joined.', refs: ['citizen:88'] }],
    }
    expect(normalizeSummary({ raw: misfiled, snapshot: quietWeek, model: 'm' })).to.equal(null)
  })
})

describe('new citizens and the citizen spotlight', () => {
  const newcomers = Array.from({ length: 10 }, (_, i) => ({ id: 300 - i, name: `Citizen ${300 - i}` }))
  const week = snapshot({
    citizens: newcomers,
    spotlight: { citizen: { id: 88, name: 'Grace Hopper', bio: 'Compiler pioneer' } },
  })
  const raw = {
    sections: [
      { kind: 'citizens', summary: 'Ten citizens joined, including Citizen 300.', refs: ['citizen:300'] },
      { kind: 'citizenSpotlight', summary: 'Meet Grace Hopper.', refs: [] },
    ],
  }
  const result = normalizeSummary({ raw, snapshot: week, model: 'm' })!
  const byKind = Object.fromEntries(result.sections.map((s) => [s.kind, s]))

  it('lists new citizens from the data, newest first, with a +N more link', () => {
    const links = byKind.citizens.links
    expect(links).to.have.length(9)
    expect(links.slice(0, 8).map((l) => l.label)).to.deep.equal(
      newcomers.slice(0, 8).map((c) => c.name)
    )
    expect(links[8]).to.deep.equal({ label: '+2 more', href: '/citizens', more: true })
  })

  it('shows the spotlight as its own section next to New Citizens', () => {
    expect(result.sections.map((s) => s.kind)).to.deep.equal(['citizens', 'citizenSpotlight'])
    expect(byKind.citizens.spotlight).to.equal(false)
    expect(byKind.citizenSpotlight.spotlight).to.equal(true)
    expect(byKind.citizenSpotlight.links).to.deep.equal([
      { label: 'Grace Hopper', href: '/citizen/grace-hopper-88' },
    ])
  })
})

describe('pickForDay', () => {
  const pool = [{ id: 30 }, { id: 10 }, { id: 20 }]

  it('is stable within a UTC day and moves to the next item the next day', () => {
    const morning = pickForDay(pool, new Date('2026-10-23T01:00:00Z'))
    const evening = pickForDay(pool, new Date('2026-10-23T23:00:00Z'))
    const tomorrow = pickForDay(pool, new Date('2026-10-24T01:00:00Z'))
    expect(morning).to.equal(evening)
    expect(tomorrow).to.not.equal(morning)
  })

  it('does not depend on the order rows came back in', () => {
    const day = new Date('2026-10-23T12:00:00Z')
    expect(pickForDay(pool, day)!.id).to.equal(pickForDay([...pool].reverse(), day)!.id)
  })

  it('returns undefined for an empty pool', () => {
    expect(pickForDay([], NOW)).to.equal(undefined)
  })
})

describe('parseLumaCalendarPage', () => {
  function page(data: unknown) {
    const json = JSON.stringify({ props: { pageProps: { initialData: { data } } } })
    return `<html><script id="__NEXT_DATA__" type="application/json">${json}</script></html>`
  }
  const event = (id: string, name: string, startAt: string, extra: Record<string, unknown> = {}) => ({
    event: { api_id: id, name, start_at: startAt, url: `slug-${id}`, ...extra },
  })

  it('returns upcoming events soonest first, deduplicated across lists', () => {
    const html = page({
      featured_items: [
        { ...event('b', 'Project Demo Day! | MoonDAO Town Hall', '2026-11-05T20:00:00Z'), guest_count: 12 },
        event('past', 'Old Town Hall', '2026-10-01T20:00:00Z'),
      ],
      upcoming: {
        entries: [
          event('a', 'Astronaut Ron Garan | MoonDAO Town Hall', '2026-10-29T19:00:00Z', {
            cover_url: 'https://images.lumacdn.com/a.png',
          }),
          event('b', 'Project Demo Day! | MoonDAO Town Hall', '2026-11-05T20:00:00Z'),
        ],
      },
    })
    expect(parseLumaCalendarPage(html, NOW)).to.deep.equal([
      {
        id: 'a',
        name: 'Astronaut Ron Garan | MoonDAO Town Hall',
        startAt: '2026-10-29T19:00:00Z',
        url: 'https://lu.ma/slug-a',
        coverUrl: 'https://images.lumacdn.com/a.png',
        guestCount: undefined,
      },
      {
        id: 'b',
        name: 'Project Demo Day! | MoonDAO Town Hall',
        startAt: '2026-11-05T20:00:00Z',
        url: 'https://lu.ma/slug-b',
        coverUrl: undefined,
        guestCount: 12,
      },
    ])
  })

  it('keeps a plain weekly town hall only when it is the soonest event', () => {
    const html = page({
      featured_items: [
        event('1', 'MoonDAO Town Hall', '2026-10-29T19:00:00Z'),
        event('2', 'MoonDAO Town Hall', '2026-11-05T20:00:00Z'),
        event('3', 'Special Guest | MoonDAO Town Hall', '2026-11-12T20:00:00Z'),
      ],
    })
    expect(parseLumaCalendarPage(html, NOW).map((e) => e.id)).to.deep.equal(['1', '3'])
  })

  it('returns nothing for a page without the embedded data', () => {
    expect(parseLumaCalendarPage('<html></html>', NOW)).to.deep.equal([])
    expect(
      parseLumaCalendarPage('<script id="__NEXT_DATA__" type="application/json">{oops</script>', NOW)
    ).to.deep.equal([])
  })
})

describe('fetchMintTimestamps', () => {
  const ZERO = '0x0000000000000000000000000000000000000000'
  const ok = {
    status: '1',
    result: [
      { from: ZERO, tokenID: '265', timeStamp: '1792430000' },
      { from: '0xabc', tokenID: '100', timeStamp: '1792440000' },
      { from: ZERO, tokenID: '264', timeStamp: '1791000000' },
    ],
  }
  const rateLimited = { status: '0', message: 'NOTOK', result: 'Max calls per sec rate limit reached (3/sec)' }

  function replies(...bodies: any[]) {
    let calls = 0
    const fetchImpl = async () => ({ ok: true, json: async () => bodies[Math.min(calls++, bodies.length - 1)] })
    return { fetchImpl, calls: () => calls }
  }
  const base = { contractAddress: '0xcitizen', chainId: 42161, apiKey: 'k', sleep: async () => {} }

  it('returns mint times only, ignoring later transfers', async () => {
    const { fetchImpl } = replies(ok)
    expect(await fetchMintTimestamps({ ...base, fetchImpl })).to.deep.equal({
      '265': 1792430000,
      '264': 1791000000,
    })
  })

  it('retries after a rate-limit reply', async () => {
    const r = replies(rateLimited, ok)
    expect(await fetchMintTimestamps({ ...base, fetchImpl: r.fetchImpl })).to.have.property('265')
    expect(r.calls()).to.equal(2)
  })

  it('returns null, not an empty map, when it stays rate limited', async () => {
    const r = replies(rateLimited)
    expect(await fetchMintTimestamps({ ...base, fetchImpl: r.fetchImpl })).to.equal(null)
    expect(r.calls()).to.equal(3)
  })

  it('returns null without an API key and {} when there are no transfers', async () => {
    expect(await fetchMintTimestamps({ ...base, apiKey: undefined })).to.equal(null)
    const { fetchImpl } = replies({ status: '0', message: 'No transactions found', result: [] })
    expect(await fetchMintTimestamps({ ...base, fetchImpl })).to.deep.equal({})
  })
})

describe('generateActivitySummary', () => {
  function fakeFetch(body: any, ok = true) {
    const calls: any[] = []
    const impl = async (url: string, init: any) => {
      calls.push({ url, init })
      return { ok, json: async () => body }
    }
    return { impl, calls }
  }

  it('sends the prompt to Groq and normalizes the reply', async () => {
    const { impl, calls } = fakeFetch({
      choices: [{ message: { content: '```json\n' + JSON.stringify(MODEL_OUTPUT) + '\n```' } }],
    })
    const outcome = await generateActivitySummary({
      snapshot: snapshot(),
      apiKey: 'test-key',
      fetchImpl: impl,
      now: NOW,
    })
    expect(outcome.ok).to.equal(true)
    if (outcome.ok) expect(outcome.summary.sections).to.have.length(3)
    expect(calls[0].url).to.equal('https://api.groq.com/openai/v1/chat/completions')
    expect(calls[0].init.headers.Authorization).to.equal('Bearer test-key')
    expect(JSON.parse(calls[0].init.body).response_format).to.deep.equal({ type: 'json_object' })
  })

  it('reports provider errors, empty replies and invalid JSON', async () => {
    const err = await generateActivitySummary({
      snapshot: snapshot(),
      apiKey: 'k',
      fetchImpl: fakeFetch({ error: { message: 'rate limited' } }, false).impl,
    })
    expect(err).to.deep.equal({ ok: false, error: 'rate limited' })

    const empty = await generateActivitySummary({
      snapshot: snapshot(),
      apiKey: 'k',
      fetchImpl: fakeFetch({ choices: [] }).impl,
    })
    expect(empty.ok).to.equal(false)

    const invalid = await generateActivitySummary({
      snapshot: snapshot(),
      apiKey: 'k',
      fetchImpl: fakeFetch({ choices: [{ message: { content: 'not json' } }] }).impl,
    })
    expect(invalid).to.deep.equal({ ok: false, error: 'Summary provider returned invalid JSON.' })
  })
})

describe('getOrCreateSummary', () => {
  const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString()
  const SUMMARY = { generatedAt: NOW.toISOString() } as ActivitySummary
  const YESTERDAY = { generatedAt: daysAgo(1) } as ActivitySummary
  const LAST_WEEK = { generatedAt: daysAgo(3) } as ActivitySummary

  function fakeStore(initial: Record<string, unknown> = {}) {
    const data = new Map<string, unknown>(Object.entries(initial))
    const store: SummaryStore = {
      async get<T>(key: string) {
        return (data.get(key) as T) ?? null
      },
      async set(key, value, opts) {
        if (opts?.nx && data.has(key)) return null
        data.set(key, value)
        return 'OK'
      },
      async del(key) {
        data.delete(key)
        return 1
      },
    }
    return { store, data }
  }

  const keys = summaryKeys(NOW)

  it("returns today's cached summary without generating", async () => {
    const { store } = fakeStore({ [keys.day]: SUMMARY })
    let generated = 0
    const result = await getOrCreateSummary({
      store,
      now: NOW,
      generate: async () => {
        generated++
        return YESTERDAY
      },
    })
    expect(result).to.deep.equal({ summary: SUMMARY, source: 'cache' })
    expect(generated).to.equal(0)
  })

  it('generates once, stores it for today and as latest, and releases the lock', async () => {
    const { store, data } = fakeStore()
    const result = await getOrCreateSummary({ store, now: NOW, generate: async () => SUMMARY })
    expect(result).to.deep.equal({ summary: SUMMARY, source: 'fresh' })
    expect(data.get(keys.day)).to.equal(SUMMARY)
    expect(data.get(keys.latest)).to.equal(SUMMARY)
    expect(data.has(keys.lock)).to.equal(false)
  })

  it('serves the latest summary while another request holds the lock', async () => {
    const { store } = fakeStore({ [keys.lock]: '1', [keys.latest]: YESTERDAY })
    let generated = 0
    const result = await getOrCreateSummary({
      store,
      now: NOW,
      generate: async () => {
        generated++
        return SUMMARY
      },
    })
    expect(result).to.deep.equal({ summary: YESTERDAY, source: 'fallback' })
    expect(generated).to.equal(0)
  })

  it('falls back to the latest summary when generation fails', async () => {
    const { store, data } = fakeStore({ [keys.latest]: YESTERDAY })
    const result = await getOrCreateSummary({ store, now: NOW, generate: async () => null })
    expect(result).to.deep.equal({ summary: YESTERDAY, source: 'fallback' })
    expect(data.has(keys.day)).to.equal(false)
    expect(data.has(keys.lock)).to.equal(false)
  })

  it('does not fall back to a summary older than two days', async () => {
    const failed = fakeStore({ [keys.latest]: LAST_WEEK })
    expect(
      await getOrCreateSummary({ store: failed.store, now: NOW, generate: async () => null })
    ).to.deep.equal({ summary: null, source: 'none' })

    const locked = fakeStore({ [keys.lock]: '1', [keys.latest]: LAST_WEEK })
    expect(
      await getOrCreateSummary({ store: locked.store, now: NOW, generate: async () => SUMMARY })
    ).to.deep.equal({ summary: null, source: 'none' })
  })

  it('releases the lock when generation throws', async () => {
    const { store, data } = fakeStore()
    let threw = false
    try {
      await getOrCreateSummary({
        store,
        now: NOW,
        generate: async () => {
          throw new Error('boom')
        },
      })
    } catch {
      threw = true
    }
    expect(threw).to.equal(true)
    expect(data.has(keys.lock)).to.equal(false)
  })

  it('namespaces keys by environment', () => {
    expect(summaryKeys(NOW, 'production').day).to.equal('activity-summary:v7:production:2026-10-23')
    expect(summaryKeys(NOW, 'preview').latest).to.equal('activity-summary:v7:preview:latest')
    expect(summaryKeys(NOW, 'preview').lock).to.not.equal(summaryKeys(NOW, 'production').lock)
  })

  it('generates directly when Redis is not configured', async () => {
    const result = await getOrCreateSummary({ store: null, generate: async () => SUMMARY })
    expect(result).to.deep.equal({ summary: SUMMARY, source: 'fresh' })
  })
})
