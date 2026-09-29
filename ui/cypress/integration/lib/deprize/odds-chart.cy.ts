import {
  ODDS_MIN_SPAN_MS,
  buildOddsTimeDomain,
  formatOddsTick,
  padOddsSamples,
  type OddsSample,
} from '@/lib/deprize/odds-chart'

const DAY = 24 * 60 * 60 * 1000

function nextDay(ms: number): number {
  const d = new Date(ms)
  d.setDate(d.getDate() + 1)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

describe('deprize odds chart domain', () => {
  describe('buildOddsTimeDomain', () => {
    it('anchors tMin to market open and tMax to now', () => {
      const open = Date.UTC(2026, 5, 18, 0, 1, 24) // Jun 18
      const now = Date.UTC(2026, 6, 18, 0, 0, 0) // Jul 18
      const history: OddsSample[] = [{ t: now - 60_000, p: [3, 11, 86] }]

      const domain = buildOddsTimeDomain(history, open, now)

      expect(domain.tMin).to.equal(open)
      expect(domain.tMax).to.equal(now)
      expect(domain.ticks.length).to.be.greaterThan(1)
      for (const t of domain.ticks) {
        expect(t).to.be.at.least(open)
        expect(t).to.be.at.most(now)
      }
    })

    it('labels every calendar day in a short window so none are skipped', () => {
      const open = Date.UTC(2026, 8, 21, 18, 0)
      const now = Date.UTC(2026, 8, 25, 20, 0)
      const domain = buildOddsTimeDomain([{ t: open, p: [20, 80] }], open, now)
      const labels = domain.ticks.map((t) => formatOddsTick(t, domain.spanMs))
      const expected: string[] = []
      const cursor = new Date(open)
      cursor.setHours(0, 0, 0, 0)
      const end = new Date(now)
      end.setHours(0, 0, 0, 0)
      for (let day = cursor.getTime(); day <= end.getTime(); day = nextDay(day)) {
        expected.push(formatOddsTick(day + 12 * 60 * 60 * 1000, domain.spanMs))
      }
      expect(labels).to.deep.equal(expected)
      expect(new Set(labels).size).to.equal(labels.length)
    })

    it('does not floor the domain before market open', () => {
      // Prior nice-step alignment floored Jun 18 → Jun 15.
      const open = Date.UTC(2026, 5, 18, 0, 1, 24)
      const now = open + 30 * DAY
      const history: OddsSample[] = [{ t: now, p: [3, 11, 86] }]
      const domain = buildOddsTimeDomain(history, open, now)
      expect(domain.tMin).to.equal(open)
      expect(domain.tMin).to.be.greaterThan(Date.UTC(2026, 5, 15))
    })

    it('uses a minimum span for tightly clustered samples', () => {
      const now = 1_700_000_000_000
      const history: OddsSample[] = [
        { t: now - 1_000, p: [50, 50] },
        { t: now, p: [51, 49] },
      ]
      const domain = buildOddsTimeDomain(history, undefined, now)
      expect(domain.spanMs).to.equal(ODDS_MIN_SPAN_MS)
      expect(domain.tMax - domain.tMin).to.equal(ODDS_MIN_SPAN_MS)
    })

    it('gives a one-day window a distinct hour on every tick', () => {
      const open = Date.UTC(2026, 8, 21, 18, 31)
      const now = open + 27 * 60 * 60 * 1000
      const domain = buildOddsTimeDomain([{ t: open, p: [17, 83] }], open, now)
      const labels = domain.ticks.map((t) => formatOddsTick(t, domain.spanMs))
      expect(new Set(labels).size).to.equal(labels.length)
      expect(labels[0]).to.match(/\d/)
      expect(labels[0]).to.not.equal(labels[1])
    })

    it('returns an empty domain for empty history', () => {
      expect(buildOddsTimeDomain([], 123, 456)).to.deep.equal({
        tMin: 0,
        tMax: 0,
        ticks: [],
        spanMs: 0,
      })
    })
  })

  describe('padOddsSamples', () => {
    it('extends the series to both domain edges', () => {
      const domain = {
        tMin: 1000,
        tMax: 5000,
        ticks: [1000, 2000, 3000, 4000, 5000],
        spanMs: 4000,
      }
      const history: OddsSample[] = [
        { t: 2500, p: [10, 90] },
        { t: 3000, p: [20, 80] },
      ]
      const padded = padOddsSamples(history, domain)
      expect(padded[0]).to.deep.equal({ t: 1000, p: [10, 90] })
      expect(padded[padded.length - 1]).to.deep.equal({ t: 5000, p: [20, 80] })
      expect(padded).to.have.length(4)
    })

    it('duplicates a lone sample so the chart has two points', () => {
      const domain = {
        tMin: 1000,
        tMax: 2000,
        ticks: [1000, 1250, 1500, 1750, 2000],
        spanMs: 1000,
      }
      const padded = padOddsSamples([{ t: 1000, p: [33, 33, 34] }], domain)
      expect(padded).to.have.length(2)
      expect(padded[0].t).to.equal(1000)
      expect(padded[1].t).to.equal(2000)
      expect(padded[1].p).to.deep.equal([33, 33, 34])
    })
  })
})
