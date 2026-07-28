import {
  GENERIC_DEPRIZE_COMPETITION,
  areRaceOutcomesPublishable,
  chainHasRaceBindings,
  findDePrizeIdForGoal,
  getDePrizeCompetition,
  getDePrizeQuestionId,
  getDePrizeRaceBinding,
  isDePrizeGoalMarketPublishable,
  isKnownDePrizeCompetition,
  partitionDePrizeIndexByRace,
} from '@/lib/deprize/competitions'

describe('deprize competitions registry', () => {
  it('returns the generic fallback for an unknown id on a known chain', () => {
    const c = getDePrizeCompetition('sepolia', 999)
    expect(c).to.deep.equal(GENERIC_DEPRIZE_COMPETITION)
    expect(isKnownDePrizeCompetition('sepolia', 999)).to.equal(false)
    expect(getDePrizeQuestionId('sepolia', 999)).to.equal(undefined)
  })

  it('returns the generic fallback for an unknown chain', () => {
    const c = getDePrizeCompetition('arbitrum', 9)
    expect(c).to.deep.equal(GENERIC_DEPRIZE_COMPETITION)
    expect(isKnownDePrizeCompetition('arbitrum', 9)).to.equal(false)
    expect(getDePrizeQuestionId('arbitrum', 9)).to.equal(undefined)
  })

  it('returns the generic fallback when deprizeId is undefined', () => {
    const c = getDePrizeCompetition('sepolia', undefined)
    expect(c).to.deep.equal(GENERIC_DEPRIZE_COMPETITION)
    expect(isKnownDePrizeCompetition('sepolia', undefined)).to.equal(false)
    expect(getDePrizeQuestionId('sepolia', undefined)).to.equal(undefined)
  })

  it('looks up the Sepolia DePrize 9 QA fixture (questionId from DEPRIZE_QA.md)', () => {
    expect(isKnownDePrizeCompetition('sepolia', 9)).to.equal(true)
    const c = getDePrizeCompetition('sepolia', 9)
    expect(c.title).to.equal('Fission surface power')
    expect(c.tagline).to.be.a('string').and.not.equal(GENERIC_DEPRIZE_COMPETITION.tagline)
    expect(c.metaDescription).to.be.a('string').and.have.length.greaterThan(0)
    expect(c.questionId).to.equal(
      '0xab937cdea2250786bf37ee2dd06f244bbeed62159c337927074523844d5759fb'
    )
    expect(getDePrizeQuestionId('sepolia', 9)).to.equal(c.questionId)
  })

  it('binds Sepolia DePrize 9 to shared-fission-power with teamId checksums', () => {
    const binding = getDePrizeRaceBinding('sepolia', 9)
    expect(binding).to.not.equal(undefined)
    expect(binding!.sharedGoalId).to.equal('shared-fission-power')
    expect(binding!.raceLabel).to.equal('Fission surface power')
    expect(binding!.outcomes.map((o) => o.projectId)).to.deep.equal([
      'westinghouse-fission-surface-power',
      'lockheed-fission-surface-power',
      'ix-fission-surface-power',
    ])
    expect(binding!.outcomes.map((o) => o.teamId)).to.deep.equal([301, 302, 303])
  })

  it('returns a stable binding identity so consumers can memoize on it', () => {
    expect(getDePrizeRaceBinding('sepolia', 9)).to.equal(getDePrizeRaceBinding('sepolia', 9))
    expect(getDePrizeRaceBinding('sepolia', 1)).to.equal(undefined)
    expect(getDePrizeRaceBinding('sepolia', 1)).to.equal(getDePrizeRaceBinding('sepolia', 1))
  })

  it('reverse-looks up the DePrize id for a bound goal (hit and miss)', () => {
    expect(findDePrizeIdForGoal('sepolia', 'shared-fission-power')).to.equal(9)
    expect(findDePrizeIdForGoal('sepolia', 'shared-landing-pads')).to.equal(undefined)
    expect(findDePrizeIdForGoal('arbitrum', 'shared-fission-power')).to.equal(undefined)
    expect(findDePrizeIdForGoal('sepolia', undefined)).to.equal(undefined)
  })

  it('publishes the Sepolia fixture and refuses unbound / unconsented non-Sepolia', () => {
    expect(isDePrizeGoalMarketPublishable('sepolia', 'shared-fission-power')).to.equal(true)
    expect(isDePrizeGoalMarketPublishable('sepolia', 'shared-landing-pads')).to.equal(false)
    expect(isDePrizeGoalMarketPublishable('arbitrum', 'shared-fission-power')).to.equal(false)

    // Pure consent helper: non-Sepolia requires every outcome consented.
    const unconsented = [
      { projectId: 'a', consented: true },
      { projectId: 'b' },
    ]
    const consented = [
      { projectId: 'a', consented: true },
      { projectId: 'b', consented: true },
    ]
    expect(areRaceOutcomesPublishable('arbitrum', unconsented)).to.equal(false)
    expect(areRaceOutcomesPublishable('arbitrum', consented)).to.equal(true)
    expect(areRaceOutcomesPublishable('sepolia', unconsented)).to.equal(true)
    expect(areRaceOutcomesPublishable('arbitrum', undefined)).to.equal(false)
  })

  it('partitions the index by raceLabel and keeps unbound chains flat', () => {
    expect(chainHasRaceBindings('sepolia')).to.equal(true)
    expect(chainHasRaceBindings('arbitrum')).to.equal(false)

    const sepolia = partitionDePrizeIndexByRace('sepolia', 10)
    expect(sepolia[0]).to.deep.equal({
      raceLabel: 'Fission surface power',
      deprizeIds: [9],
      showHeading: true,
    })
    const other = sepolia.find((g) => g.raceLabel === null)
    expect(other).to.not.equal(undefined)
    expect(other!.showHeading).to.equal(true)
    expect(other!.deprizeIds).to.include(1)
    expect(other!.deprizeIds).to.include(10)
    expect(other!.deprizeIds).to.not.include(9)

    const arbitrum = partitionDePrizeIndexByRace('arbitrum', 3)
    expect(arbitrum).to.deep.equal([
      { raceLabel: null, deprizeIds: [1, 2, 3], showHeading: false },
    ])
  })
})
