import { mapOutcomeOddsToProjectIds } from '@/lib/deprize/goal-odds'

describe('mapOutcomeOddsToProjectIds', () => {
  const outcomes = [
    { projectId: 'westinghouse-fission-surface-power', teamId: 301 },
    { projectId: 'lockheed-fission-surface-power', teamId: 302 },
    { projectId: 'ix-fission-surface-power', teamId: 303 },
  ]

  it('converts LMSR percent probabilities to fractions of 1', () => {
    const mapped = mapOutcomeOddsToProjectIds({
      outcomes,
      teamIds: [301n, 302n, 303n],
      probabilities: [34, 35, 31],
    })
    expect(mapped).to.deep.equal({
      oddsByProjectId: {
        'westinghouse-fission-surface-power': 0.34,
        'lockheed-fission-surface-power': 0.35,
        'ix-fission-surface-power': 0.31,
      },
      fieldOdds: undefined,
    })
  })

  it('returns undefined on outcomes / teamIds length mismatch', () => {
    expect(
      mapOutcomeOddsToProjectIds({
        outcomes,
        teamIds: [301n, 302n],
        probabilities: [34, 35, 31],
      })
    ).to.equal(undefined)
  })

  it('returns undefined on outcomes / probabilities length mismatch', () => {
    expect(
      mapOutcomeOddsToProjectIds({
        outcomes,
        teamIds: [301n, 302n, 303n],
        probabilities: [34, 35],
      })
    ).to.equal(undefined)
  })

  it('returns undefined when a teamId checksum disagrees with the roster', () => {
    expect(
      mapOutcomeOddsToProjectIds({
        outcomes,
        teamIds: [301n, 999n, 303n],
        probabilities: [34, 35, 31],
      })
    ).to.equal(undefined)
  })

  it('drops non-finite probabilities but keeps finite siblings', () => {
    const mapped = mapOutcomeOddsToProjectIds({
      outcomes,
      teamIds: [301n, 302n, 303n],
      probabilities: [34, NaN, 31],
    })
    expect(mapped).to.deep.equal({
      oddsByProjectId: {
        'westinghouse-fission-surface-power': 0.34,
        'ix-fission-surface-power': 0.31,
      },
      fieldOdds: undefined,
    })
  })

  it('returns undefined when no finite odds survive (loading / closed market)', () => {
    // A closed LMSR reads all-NaN. An empty map here would let a merge
    // overwrite curator priors with nothing.
    expect(
      mapOutcomeOddsToProjectIds({
        outcomes,
        teamIds: [301n, 302n, 303n],
        probabilities: [NaN, NaN, NaN],
      })
    ).to.equal(undefined)
  })

  it('allows outcomes without a teamId checksum', () => {
    const mapped = mapOutcomeOddsToProjectIds({
      outcomes: [
        { projectId: 'a' },
        { projectId: 'b' },
      ],
      teamIds: [1n, 2n],
      probabilities: [60, 40],
    })
    expect(mapped).to.deep.equal({
      oddsByProjectId: { a: 0.6, b: 0.4 },
      fieldOdds: undefined,
    })
  })

  it('returns undefined for an empty outcomes array', () => {
    expect(
      mapOutcomeOddsToProjectIds({
        outcomes: [],
        teamIds: [],
        probabilities: [],
      })
    ).to.equal(undefined)
  })

  it('routes field slots into fieldOdds and never into oddsByProjectId', () => {
    const mapped = mapOutcomeOddsToProjectIds({
      outcomes: [
        { projectId: 'westinghouse-fission-surface-power', teamId: 301 },
        { projectId: 'lockheed-fission-surface-power', teamId: 302 },
        { projectId: '__open-field__', teamId: 999, field: true },
      ],
      teamIds: [301n, 302n, 999n],
      probabilities: [40, 45, 15],
    })
    expect(mapped).to.deep.equal({
      oddsByProjectId: {
        'westinghouse-fission-surface-power': 0.4,
        'lockheed-fission-surface-power': 0.45,
      },
      fieldOdds: 0.15,
    })
  })
})
