import { DEPRIZE_AVAILABILITY_LEGEND } from '@/lib/deprize/constants'
import {
  buildOddsWireEmbed,
  nextOddsWireSnapshot,
  parseOddsWireSnapshot,
  planOddsWirePost,
} from '@/lib/deprize/oddsWire'
import { escapeDiscordUserText } from '@/lib/discord/escapeUserText'

const NOW = Date.parse('2026-09-16T12:00:00.000Z')
const BASE = { v: 1 as const, p: [50, 50], outcomeCount: 2, postedAt: null, postedCount: 0 }

function decide(overrides: Partial<Parameters<typeof planOddsWirePost>[0]> = {}) {
  return planOddsWirePost({
    previous: BASE,
    current: [50, 50],
    closed: false,
    now: NOW,
    ...overrides,
  })
}

describe('odds wire snapshot parse', () => {
  it('returns null for null, broken JSON, empty object, and v2', () => {
    expect(parseOddsWireSnapshot(null)).to.equal(null)
    expect(parseOddsWireSnapshot('{')).to.equal(null)
    expect(parseOddsWireSnapshot('{}')).to.equal(null)
    expect(parseOddsWireSnapshot(JSON.stringify({ v: 2, p: [1], outcomeCount: 1, postedCount: 0 }))).to.equal(
      null
    )
  })
})

describe('odds wire transition table', () => {
  it('first-run writes a baseline and does not post', () => {
    const plan = decide({ previous: null })
    expect(plan).to.deep.equal({ post: false, reason: 'first-run' })
    const next = nextOddsWireSnapshot({
      previous: null,
      current: [40, 60],
      plan,
      posted: null,
      now: NOW,
    })
    expect(next.write).to.equal(true)
    if (next.write) {
      expect(next.value.p).to.deep.equal([40, 60])
      expect(next.value.postedAt).to.equal(null)
      expect(next.value.postedCount).to.equal(0)
    }
  })

  it('unparseable-baseline re-baselines without posting', () => {
    const plan = decide({ previous: null, unparseable: true })
    expect(plan.reason).to.equal('unparseable-baseline')
    const next = nextOddsWireSnapshot({
      previous: null,
      current: [10, 90],
      plan,
      posted: null,
      now: NOW,
    })
    expect(next.write).to.equal(true)
  })

  it('outcome-set-changed overwrites the baseline and does not post', () => {
    const plan = decide({ current: [30, 30, 40] })
    expect(plan.reason).to.equal('outcome-set-changed')
    const next = nextOddsWireSnapshot({
      previous: BASE,
      current: [30, 30, 40],
      plan,
      posted: null,
      now: NOW,
    })
    expect(next.write).to.equal(true)
    if (next.write) expect(next.value.outcomeCount).to.equal(3)
  })

  it('bad-read does not write', () => {
    const plan = decide({ current: [50, Number.NaN] })
    expect(plan.reason).to.equal('bad-read')
    expect(
      nextOddsWireSnapshot({
        previous: BASE,
        current: [50, Number.NaN],
        plan,
        posted: null,
        now: NOW,
      }).write
    ).to.equal(false)
  })

  it('market-closed does not write', () => {
    const plan = decide({ closed: true, current: [100, 0] })
    expect(plan.reason).to.equal('market-closed')
    expect(
      nextOddsWireSnapshot({
        previous: BASE,
        current: [100, 0],
        plan,
        posted: null,
        now: NOW,
      }).write
    ).to.equal(false)
  })

  it('below-threshold does not write', () => {
    const plan = decide({ current: [54.9, 45.1] })
    expect(plan.reason).to.equal('below-threshold')
    expect(
      nextOddsWireSnapshot({
        previous: BASE,
        current: [54.9, 45.1],
        plan,
        posted: null,
        now: NOW,
      }).write
    ).to.equal(false)
  })

  it('cooldown does not write', () => {
    const previous = { ...BASE, postedAt: NOW - 10 * 60_000, postedCount: 1 }
    const plan = decide({ previous, current: [60, 40] })
    expect(plan.reason).to.equal('cooldown')
    expect(
      nextOddsWireSnapshot({
        previous,
        current: [60, 40],
        plan,
        posted: null,
        now: NOW,
      }).write
    ).to.equal(false)
  })

  it('daily-cap does not write', () => {
    const previous = { ...BASE, postedAt: NOW - 2 * 60 * 60_000, postedCount: 6 }
    const plan = decide({ previous, current: [70, 30] })
    expect(plan.reason).to.equal('daily-cap')
  })

  it('move + successful post advances the baseline', () => {
    const plan = decide({ current: [55, 45] })
    expect(plan).to.deep.equal({ post: true, reason: 'move' })
    const next = nextOddsWireSnapshot({
      previous: BASE,
      current: [55, 45],
      plan,
      posted: { ok: true, messageId: '1' },
      now: NOW,
    })
    expect(next.write).to.equal(true)
    if (next.write) {
      expect(next.value.p).to.deep.equal([55, 45])
      expect(next.value.postedAt).to.equal(NOW)
      expect(next.value.postedCount).to.equal(1)
    }
  })

  it('move + failed post leaves the baseline unchanged', () => {
    const plan = decide({ current: [55, 45] })
    const next = nextOddsWireSnapshot({
      previous: BASE,
      current: [55, 45],
      plan,
      posted: { ok: false, status: 429, retryable: true, reason: 'discord-retryable' },
      now: NOW,
    })
    expect(next.write).to.equal(false)
  })
})

describe('odds wire thresholds and drift', () => {
  it('+5.0 posts, +4.9 does not, identical vector does not', () => {
    expect(decide({ current: [55, 45] }).reason).to.equal('move')
    expect(decide({ current: [54.9, 45.1] }).reason).to.equal('below-threshold')
    expect(decide({ current: [50, 50] }).reason).to.equal('below-threshold')
  })

  it('NaN and length mismatch never treat Infinity as a move', () => {
    expect(decide({ current: [Number.NaN, 50] }).reason).to.equal('bad-read')
    expect(decide({ current: [50, 50, 0] }).reason).to.equal('outcome-set-changed')
  })

  it('cooldown expiry then posts (suppression delays, it does not cancel)', () => {
    const previous = { ...BASE, postedAt: NOW - 10 * 60_000, postedCount: 1 }
    expect(decide({ previous, current: [60, 40] }).reason).to.equal('cooldown')
    expect(
      decide({ previous, current: [60, 40], now: NOW + 61 * 60_000 }).reason
    ).to.equal('move')
  })

  it('slow drift: six ~1pt runs stay quiet, then a post at cumulative ≥ 5', () => {
    let previous = BASE
    for (let i = 1; i <= 4; i++) {
      const current = [50 + i, 50 - i]
      const plan = decide({ previous, current })
      expect(plan.reason).to.equal('below-threshold')
    }
    const plan = decide({ previous, current: [55, 45] })
    expect(plan.reason).to.equal('move')
    void previous
  })
})

describe('odds wire embed', () => {
  it('footer.text is the availability legend constant', () => {
    const embed = buildOddsWireEmbed({
      title: 'Touchdown',
      deprizeId: 22,
      site: 'https://moondao.com',
      labels: ['Firefly', '@everyone'],
      current: [20, 80],
      previous: [18, 82],
    })
    expect(embed.footer?.text).to.equal(DEPRIZE_AVAILABILITY_LEGEND)
    expect(embed.description).to.include(escapeDiscordUserText('@everyone'))
    expect(embed.description).to.not.match(/(^|[^\\])@everyone/)
  })
})
