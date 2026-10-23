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
import { getOrCreateSummary, SummaryStore, summaryKeys } from '../lib/activity-summary/store'

const NOW = new Date('2026-10-23T12:00:00Z')

function snapshot(overrides: Partial<ActivitySnapshot> = {}): ActivitySnapshot {
  return {
    periodStart: '2026-10-16T12:00:00.000Z',
    periodEnd: NOW.toISOString(),
    citizens: [{ id: 412, name: 'Ada Lovelace', location: 'London, UK', bio: 'Engineer' }],
    totalCitizens: 640,
    teams: [],
    jobs: [{ id: 7, title: 'Lunar Habitat Designer', teamId: 3 }],
    listings: [],
    proposals: [
      { mdp: 180, name: 'Moon Rover Grant', status: 'member-vote' },
      { mdp: 181, name: 'Regolith Kiln', status: 'senate-review' },
    ],
    nextTownHall: {
      name: 'Weekly Town Hall',
      startAt: '2026-10-24T17:00:00.000Z',
      url: 'https://lu.ma/moondao-townhall',
    },
    latestTownHall: null,
    mooney: { price: 0.0004, priceChange24h: 1.2 },
    ...overrides,
  }
}

function emptySnapshot(): ActivitySnapshot {
  return snapshot({ citizens: [], jobs: [], proposals: [], nextTownHall: null })
}

const MODEL_OUTPUT = {
  headline: 'A new grant proposal is open and a town hall is coming up.',
  sections: [
    { kind: 'citizens', summary: 'Ada Lovelace joined from London.', refs: ['citizen:412'] },
    {
      kind: 'governance',
      summary: 'MDP-180 is awaiting a decision.',
      refs: ['proposal:180', 'proposal:999'],
    },
    { kind: 'governance', summary: 'Duplicate section.', refs: [] },
    { kind: 'weather', summary: 'Not a real kind.', refs: [] },
    { kind: 'events', summary: 'Town hall on Saturday.', refs: ['event:townhall'] },
  ],
}

describe('activity summary prompt', () => {
  it('gives every linkable item a ref and leaves out URLs', () => {
    const prompt = buildSummaryUserPrompt(snapshot())
    expect(prompt).to.include('"ref": "citizen:412"')
    expect(prompt).to.include('"ref": "proposal:180"')
    expect(prompt).to.include('"status": "member-vote"')
    expect(prompt).to.include('"status": "senate-review"')
    expect(prompt).to.include('"ref": "job:7"')
    expect(prompt).to.include('"ref": "event:townhall"')
    expect(prompt).to.not.include('lu.ma')
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

  it('links only refs that exist in the snapshot', () => {
    expect(summary.sections[0].links).to.deep.equal([
      { label: 'MDP-180: Moon Rover Grant', href: '/project/180' },
    ])
    expect(summary.sections[2].links).to.deep.equal([
      { label: 'Ada Lovelace', href: '/citizen/ada-lovelace-412' },
    ])
    expect(summary.sections[1].links[0].href).to.equal('https://lu.ma/moondao-townhall')
  })

  it('records the period, model and generation time', () => {
    expect(summary.periodStart).to.equal('2026-10-16T12:00:00.000Z')
    expect(summary.model).to.equal('test-model')
    expect(summary.generatedAt).to.equal(NOW.toISOString())
  })

  it('returns null when there is no headline or no usable section', () => {
    expect(normalizeSummary({ raw: { sections: MODEL_OUTPUT.sections }, snapshot: snapshot(), model: 'm' })).to.equal(null)
    expect(normalizeSummary({ raw: { headline: 'Hi', sections: [] }, snapshot: snapshot(), model: 'm' })).to.equal(null)
    expect(normalizeSummary({ raw: 'nonsense', snapshot: snapshot(), model: 'm' })).to.equal(null)
  })

  it('does not link a town hall URL that is not https', () => {
    const s = snapshot({
      nextTownHall: { name: 'Town Hall', startAt: '2026-10-24T17:00:00Z', url: 'javascript:alert(1)' },
    })
    const result = normalizeSummary({ raw: MODEL_OUTPUT, snapshot: s, model: 'm' })!
    const events = result.sections.find((sec) => sec.kind === 'events')!
    expect(events.links).to.deep.equal([])
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
  const SUMMARY = { headline: 'Today' } as ActivitySummary
  const YESTERDAY = { headline: 'Yesterday' } as ActivitySummary

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
    expect(summaryKeys(NOW, 'production').day).to.equal('activity-summary:production:2026-10-23')
    expect(summaryKeys(NOW, 'preview').latest).to.equal('activity-summary:preview:latest')
    expect(summaryKeys(NOW, 'preview').lock).to.not.equal(summaryKeys(NOW, 'production').lock)
  })

  it('generates directly when Redis is not configured', async () => {
    const result = await getOrCreateSummary({ store: null, generate: async () => SUMMARY })
    expect(result).to.deep.equal({ summary: SUMMARY, source: 'fresh' })
  })
})
