import {
  ODDS_HOUR_MS,
  ODDS_MIN_SPAN_MS,
  ODDS_RESAMPLE_POINTS,
  availableOddsRanges,
  buildOddsTimeDomain,
  buildOddsValueDomain,
  formatOddsTick,
  padOddsSamples,
  resampleOddsHistory,
  sliceOddsTimeDomain,
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

  describe('buildOddsValueDomain', () => {
    it('zooms in when the outcomes are clustered', () => {
      const history: OddsSample[] = [
        { t: 1, p: [10, 12, 8, 15] },
        { t: 2, p: [14, 11, 9, 18] },
      ]
      const d = buildOddsValueDomain(history, 4)
      expect(d.min).to.be.at.most(8)
      expect(d.max).to.be.at.least(18)
      expect(d.max - d.min).to.be.lessThan(40)
      expect(d.ticks[0]).to.equal(d.min)
      expect(d.ticks[d.ticks.length - 1]).to.equal(d.max)
    })

    it('falls back to 0-100 when the outcomes span the full range', () => {
      const d = buildOddsValueDomain([{ t: 1, p: [2, 98] }], 2)
      expect(d).to.deep.equal({ min: 0, max: 100, ticks: [0, 25, 50, 75, 100] })
    })

    it('keeps a minimum window for flat odds and stays inside 0-100', () => {
      const flat = buildOddsValueDomain([{ t: 1, p: [50, 50] }], 2)
      expect(flat.max - flat.min).to.be.at.least(10)
      const low = buildOddsValueDomain([{ t: 1, p: [0, 1] }], 2)
      expect(low.min).to.equal(0)
      const high = buildOddsValueDomain([{ t: 1, p: [99, 100] }], 2)
      expect(high.max).to.equal(100)
    })

    it('returns 0-100 for empty history', () => {
      expect(buildOddsValueDomain([], 3).ticks).to.deep.equal([0, 25, 50, 75, 100])
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

  describe('availableOddsRanges & sliceOddsTimeDomain', () => {
    it('shows only timeframes meaningful for the market age', () => {
      expect(availableOddsRanges(15 * 60 * 1000)).to.deep.equal(['ALL'])
      expect(availableOddsRanges(21 * ODDS_HOUR_MS)).to.deep.equal(['1H', '6H', 'ALL'])
      expect(availableOddsRanges(26 * DAY)).to.deep.equal(['1H', '6H', '1D', '1W', 'ALL'])
      expect(availableOddsRanges(45 * DAY)).to.deep.equal(['1H', '6H', '1D', '1W', '1M', 'ALL'])
    })

    it('slices the time domain to the requested trailing window', () => {
      const open = Date.UTC(2026, 10, 1, 0, 0)
      const now = open + 10 * DAY
      const domain = sliceOddsTimeDomain([{ t: open, p: [50, 50] }], '1D', open, now)
      expect(domain.tMax).to.equal(now)
      expect(domain.tMin).to.equal(now - DAY)
      expect(domain.spanMs).to.equal(DAY)
      expect(domain.ticks.length).to.be.at.least(2)
      for (const t of domain.ticks) {
        expect(t).to.be.at.least(domain.tMin)
        expect(t).to.be.at.most(domain.tMax)
      }
    })
  })

  describe('resampleOddsHistory', () => {
    it('collapses intra-bucket burst spikes and preserves the exact live endpoint', () => {
      const open = Date.UTC(2026, 10, 1, 0, 0)
      const now = open + 20 * DAY
      const burst = open + 15 * DAY
      const history: OddsSample[] = [
        { t: open, p: [20, 80] },
        { t: burst, p: [65, 35] },
        { t: burst + 30_000, p: [25, 75] },
        { t: burst + 60_000, p: [30, 70] },
      ]
      const domain = buildOddsTimeDomain(history, open, now)
      const resampled = resampleOddsHistory(history, domain)

      expect(resampled).to.have.length(ODDS_RESAMPLE_POINTS + 1)
      expect(resampled[0]).to.deep.equal({ t: open, p: [20, 80] })
      expect(resampled[resampled.length - 1]).to.deep.equal({ t: now, p: [30, 70] })
      // The 30-second needle spike to 65% inside one 8-hour bucket should be gone.
      for (const s of resampled) {
        expect(s.p[0]).to.be.at.most(30)
      }
    })

    it('carries forward prior odds when zoomed into a trailing slice with no new trades', () => {
      const open = Date.UTC(2026, 10, 1, 0, 0)
      const trade = open + 2 * DAY
      const now = open + 10 * DAY
      const history: OddsSample[] = [
        { t: open, p: [50, 50] },
        { t: trade, p: [72, 28] },
      ]
      const domain = sliceOddsTimeDomain(history, '1D', open, now)
      const resampled = resampleOddsHistory(history, domain, 10)

      expect(resampled).to.have.length(11)
      for (const s of resampled) {
        expect(s.p).to.deep.equal([72, 28])
      }
    })
  })
})
