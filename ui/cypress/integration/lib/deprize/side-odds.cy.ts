import { mapOutcomeOddsToKeys } from '@/lib/deprize/side-odds'

describe('mapOutcomeOddsToKeys', () => {
  const outcomes = [
    { key: 'upright-working', teamId: 701 },
    { key: 'upright-short', teamId: 702 },
    { key: 'wrong-orientation', teamId: 703 },
    { key: 'lost-on-descent', teamId: 704 },
  ]

  it('converts LMSR percent probabilities to fractions of 1', () => {
    expect(
      mapOutcomeOddsToKeys({
        outcomes,
        teamIds: [701n, 702n, 703n, 704n],
        probabilities: [42, 13, 30, 15],
      })
    ).to.deep.equal({
      'upright-working': 0.42,
      'upright-short': 0.13,
      'wrong-orientation': 0.3,
      'lost-on-descent': 0.15,
    })
  })

  it('returns undefined on outcomes / teamIds length mismatch', () => {
    expect(
      mapOutcomeOddsToKeys({
        outcomes,
        teamIds: [701n, 702n, 703n],
        probabilities: [42, 13, 30, 15],
      })
    ).to.equal(undefined)
  })

  it('returns undefined on outcomes / probabilities length mismatch', () => {
    expect(
      mapOutcomeOddsToKeys({
        outcomes,
        teamIds: [701n, 702n, 703n, 704n],
        probabilities: [42, 13, 30],
      })
    ).to.equal(undefined)
  })

  it('returns undefined when a teamId checksum disagrees with the roster', () => {
    // Attributing "Lost on descent" odds to "Upright and working" is the
    // failure this guard exists to prevent.
    expect(
      mapOutcomeOddsToKeys({
        outcomes,
        teamIds: [701n, 702n, 999n, 704n],
        probabilities: [42, 13, 30, 15],
      })
    ).to.equal(undefined)
  })

  it('drops non-finite probabilities but keeps finite siblings', () => {
    expect(
      mapOutcomeOddsToKeys({
        outcomes,
        teamIds: [701n, 702n, 703n, 704n],
        probabilities: [42, NaN, 30, 15],
      })
    ).to.deep.equal({
      'upright-working': 0.42,
      'wrong-orientation': 0.3,
      'lost-on-descent': 0.15,
    })
  })

  it('returns undefined when no finite odds survive (loading / closed market)', () => {
    expect(
      mapOutcomeOddsToKeys({
        outcomes,
        teamIds: [701n, 702n, 703n, 704n],
        probabilities: [NaN, NaN, NaN, NaN],
      })
    ).to.equal(undefined)
  })

  it('returns undefined for an empty outcomes array', () => {
    expect(
      mapOutcomeOddsToKeys({ outcomes: [], teamIds: [], probabilities: [] })
    ).to.equal(undefined)
  })

  it('allows outcomes without a teamId checksum', () => {
    expect(
      mapOutcomeOddsToKeys({
        outcomes: [{ key: 'a' }, { key: 'b' }],
        teamIds: [1n, 2n],
        probabilities: [60, 40],
      })
    ).to.deep.equal({ a: 0.6, b: 0.4 })
  })
})
