import {
  GENERIC_DEPRIZE_COMPETITION,
  chainHasRaceBindings,
  findDePrizeIdForGoal,
  generationNumberOf,
  getDePrizeCompetition,
  getDePrizeGenerationNumber,
  getDePrizeQuestionId,
  getDePrizeRaceBinding,
  getFeaturedLiveDePrizeId,
  isCompetitorClaimed,
  isDePrizeGoalMarketBound,
  isKnownDePrizeCompetition,
  isRaceBindingComplete,
  liveTipOf,
  partitionDePrizeIndexByRace,
  resolveLiveDePrizeId,
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

  it('binds Sepolia DePrize 21 Touchdown to shared-next-landing', () => {
    expect(isKnownDePrizeCompetition('sepolia', 21)).to.equal(true)
    const c = getDePrizeCompetition('sepolia', 21)
    expect(c.title).to.equal('Touchdown')
    expect(c.sharedGoalId).to.equal('shared-next-landing')
    expect(c.questionId).to.equal(
      '0x18f9e4f8e5b291580b00bd23299194b169a66c3513229c5e16240e05d8520f17'
    )
    const binding = getDePrizeRaceBinding('sepolia', 21)
    expect(binding!.outcomes.map((o) => o.projectId)).to.deep.equal([
      'astrobotic-griffin',
      'im-nova-c',
      'firefly-blue-ghost',
      'blue-origin-blue-moon-mk1',
      'cnsa-change-7',
      '__open-field__',
    ])
    expect(binding!.outcomes.map((o) => o.teamId)).to.deep.equal([
      601, 602, 603, 604, 605, 24,
    ])
    expect(binding!.outcomes[5].field).to.equal(true)
  })

  it('registers Sepolia DePrize 20 as the unbound Harsh Mistress featured prize', () => {
    expect(isKnownDePrizeCompetition('sepolia', 20)).to.equal(true)
    const c = getDePrizeCompetition('sepolia', 20)
    expect(c.title).to.equal('The Moon Is A Harsh Mistress')
    expect(c.sharedGoalId).to.equal(undefined)
    expect(c.questionId).to.equal(
      '0xe6430ff8d51a6e5389d1c23cfa5dcab4682407f866a208ef3ea60120b271d5cf'
    )
    expect(getDePrizeRaceBinding('sepolia', 20)).to.equal(undefined)
    expect(getFeaturedLiveDePrizeId('sepolia')).to.equal(20)
    expect(getFeaturedLiveDePrizeId('arbitrum')).to.equal(1)
  })

  it('returns a stable binding identity so consumers can memoize on it', () => {
    expect(getDePrizeRaceBinding('sepolia', 9)).to.equal(getDePrizeRaceBinding('sepolia', 9))
    expect(getDePrizeRaceBinding('sepolia', 1)).to.equal(undefined)
    expect(getDePrizeRaceBinding('sepolia', 1)).to.equal(getDePrizeRaceBinding('sepolia', 1))
  })

  it('reverse-looks up the DePrize id for a bound goal (hit and miss)', () => {
    expect(findDePrizeIdForGoal('sepolia', 'shared-fission-power')).to.equal(9)
    expect(findDePrizeIdForGoal('sepolia', 'shared-crewed-lander')).to.equal(10)
    expect(findDePrizeIdForGoal('sepolia', 'shared-lunar-rover')).to.equal(12)
    expect(findDePrizeIdForGoal('sepolia', 'shared-isru-oxygen')).to.equal(15)
    expect(findDePrizeIdForGoal('sepolia', 'shared-landing-pads')).to.equal(17)
    expect(findDePrizeIdForGoal('sepolia', 'shared-habitat')).to.equal(18)
    expect(findDePrizeIdForGoal('sepolia', 'shared-lunar-comms')).to.equal(19)
    expect(findDePrizeIdForGoal('sepolia', 'shared-next-landing')).to.equal(21)
    expect(findDePrizeIdForGoal('sepolia', 'shared-mass-driver')).to.equal(undefined)
    expect(findDePrizeIdForGoal('arbitrum', 'shared-fission-power')).to.equal(undefined)
    expect(findDePrizeIdForGoal('sepolia', undefined)).to.equal(undefined)
  })

  it('reports a bound race regardless of consent, and unbound goals as unbound', () => {
    expect(isDePrizeGoalMarketBound('sepolia', 'shared-fission-power')).to.equal(true)
    expect(isDePrizeGoalMarketBound('sepolia', 'shared-crewed-lander')).to.equal(true)
    expect(isDePrizeGoalMarketBound('sepolia', 'shared-landing-pads')).to.equal(true)
    expect(isDePrizeGoalMarketBound('sepolia', 'shared-habitat')).to.equal(true)
    expect(isDePrizeGoalMarketBound('sepolia', 'shared-lunar-comms')).to.equal(true)
    expect(isDePrizeGoalMarketBound('sepolia', 'shared-next-landing')).to.equal(true)
    expect(isDePrizeGoalMarketBound('sepolia', 'shared-mass-driver')).to.equal(false)
    // Arbitrum has no binding at all, so there is no market to report.
    expect(isDePrizeGoalMarketBound('arbitrum', 'shared-fission-power')).to.equal(false)
    expect(isDePrizeGoalMarketBound('sepolia', undefined)).to.equal(false)
  })

  it('treats binding completeness as chain-agnostic and independent of consent', () => {
    // Consent is no longer a visibility gate: an unconsented roster is publishable.
    expect(
      isRaceBindingComplete([{ projectId: 'a', consented: true }, { projectId: 'b' }])
    ).to.equal(true)
    expect(isRaceBindingComplete([{ projectId: 'a' }, { projectId: 'b' }])).to.equal(true)
    expect(isRaceBindingComplete(undefined)).to.equal(false)
    expect(isRaceBindingComplete([])).to.equal(false)

    // A field-only roster names nobody, so there is nothing to price.
    expect(
      isRaceBindingComplete([{ projectId: '__open-field__', field: true }])
    ).to.equal(false)
    expect(
      isRaceBindingComplete([
        { projectId: 'a' },
        { projectId: '__open-field__', field: true },
      ])
    ).to.equal(true)
  })

  it('gates branding on claim status without touching visibility', () => {
    expect(isCompetitorClaimed({ projectId: 'a', consented: true })).to.equal(true)
    expect(isCompetitorClaimed({ projectId: 'a' })).to.equal(false)
    expect(isCompetitorClaimed({ projectId: 'a', consented: false })).to.equal(false)
    expect(isCompetitorClaimed(undefined)).to.equal(false)
  })

  it('partitions the index by raceLabel and keeps unbound chains flat', () => {
    expect(chainHasRaceBindings('sepolia')).to.equal(true)
    expect(chainHasRaceBindings('arbitrum')).to.equal(false)

    const sepolia = partitionDePrizeIndexByRace('sepolia', 20)
    expect(sepolia[0]).to.deep.equal({
      raceLabel: 'Fission surface power',
      deprizeIds: [9],
      showHeading: true,
    })
    const lander = sepolia.find((g) => g.raceLabel === 'Crewed lunar landing')
    expect(lander?.deprizeIds).to.deep.equal([10])
    const pads = sepolia.find((g) => g.raceLabel === 'Landing pads')
    expect(pads?.deprizeIds).to.deep.equal([17])
    const habitat = sepolia.find((g) => g.raceLabel === 'Pressurized habitat')
    expect(habitat?.deprizeIds).to.deep.equal([18])
    const comms = sepolia.find((g) => g.raceLabel === 'Lunar comms')
    expect(comms?.deprizeIds).to.deep.equal([19])
    const touchdown = partitionDePrizeIndexByRace('sepolia', 21).find(
      (g) => g.raceLabel === 'Next lunar landing'
    )
    expect(touchdown?.deprizeIds).to.deep.equal([21])
    const other = sepolia.find((g) => g.raceLabel === null)
    expect(other).to.not.equal(undefined)
    expect(other!.showHeading).to.equal(true)
    expect(other!.deprizeIds).to.include(1)
    expect(other!.deprizeIds).to.include(11)
    expect(other!.deprizeIds).to.include(20)
    expect(other!.deprizeIds).to.not.include(9)
    expect(other!.deprizeIds).to.not.include(10)
    expect(other!.deprizeIds).to.not.include(17)

    const arbitrum = partitionDePrizeIndexByRace('arbitrum', 3)
    expect(arbitrum).to.deep.equal([
      { raceLabel: null, deprizeIds: [1, 2, 3], showHeading: false },
    ])
  })
})

describe('deprize generation lineage', () => {
  // g1 -> g2 -> g3, the shape a twice-superseded race leaves behind.
  const chain = {
    1: { supersededBy: 2 },
    2: { supersedes: 1, supersededBy: 3 },
    3: { supersedes: 2 },
  }

  it('walks every generation forward to the same live tip', () => {
    expect(liveTipOf(chain, 1)).to.equal(3)
    expect(liveTipOf(chain, 2)).to.equal(3)
    expect(liveTipOf(chain, 3)).to.equal(3)
  })

  it('numbers generations 1-indexed walking backward', () => {
    expect(generationNumberOf(chain, 1)).to.equal(1)
    expect(generationNumberOf(chain, 2)).to.equal(2)
    expect(generationNumberOf(chain, 3)).to.equal(3)
  })

  it('treats an unlinked or unknown id as a lone first generation', () => {
    expect(liveTipOf({}, 7)).to.equal(7)
    expect(generationNumberOf({}, 7)).to.equal(1)
    expect(liveTipOf({ 7: {} }, 7)).to.equal(7)
    expect(generationNumberOf({ 7: {} }, 7)).to.equal(1)
  })

  it('stops at the last distinct generation on a malformed cyclic registry', () => {
    const cyclic = {
      1: { supersedes: 2, supersededBy: 2 },
      2: { supersedes: 1, supersededBy: 1 },
    }
    expect(liveTipOf(cyclic, 1)).to.equal(2)
    expect(generationNumberOf(cyclic, 1)).to.equal(2)
  })

  it('is a no-op on the real registry, which has no lineage seeded yet', () => {
    expect(resolveLiveDePrizeId('sepolia', 9)).to.equal(9)
    expect(getDePrizeGenerationNumber('sepolia', 9)).to.equal(1)
    expect(resolveLiveDePrizeId('sepolia', undefined)).to.equal(undefined)
    expect(getDePrizeGenerationNumber('sepolia', undefined)).to.equal(1)
  })
})
