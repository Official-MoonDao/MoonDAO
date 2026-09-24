import {
  GENERIC_DEPRIZE_COMPETITION,
  chainHasRaceBindings,
  deprizeChainLabel,
  deprizeChainSlugFromPrefix,
  deprizeForecastHref,
  deprizeIndexHref,
  deprizePrefixedHref,
  findDePrizeChainSlugs,
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

  it('binds Sepolia DePrize 1 as the superseded Touchdown generation', () => {
    expect(isKnownDePrizeCompetition('sepolia', 1)).to.equal(true)
    const c = getDePrizeCompetition('sepolia', 1)
    expect(c.title).to.equal('Touchdown')
    expect(c.sharedGoalId).to.equal('shared-next-landing')
    expect(c.supersededBy).to.equal(2)
    expect(c.questionId).to.equal(
      '0x2c633f9b1a6bd1a6252c49ed56f89d554a85e421ff84a146b1ae9e21f6311f7b'
    )
    expect(getDePrizeQuestionId('sepolia', 1)).to.equal(c.questionId)
  })

  it('binds Sepolia DePrize 2 as the live Touchdown generation', () => {
    expect(isKnownDePrizeCompetition('sepolia', 2)).to.equal(true)
    const c = getDePrizeCompetition('sepolia', 2)
    expect(c.title).to.equal('Touchdown')
    expect(c.sharedGoalId).to.equal('shared-next-landing')
    expect(c.supersedes).to.equal(1)
    expect(c.questionId).to.equal(
      '0x6498f99ba51f63aa7576860e9aff4a7afbc1e805e6c2aef9d4601840249c5898'
    )
    expect(resolveLiveDePrizeId('sepolia', 1)).to.equal(2)
    expect(getDePrizeGenerationNumber('sepolia', 2)).to.equal(2)
    const binding = getDePrizeRaceBinding('sepolia', 2)
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
    expect(binding!.outcomes.map((o) => o.vehicleLabel)).to.deep.equal([
      'Griffin Mission One',
      'Nova-C IM-3',
      'Blue Ghost M2',
      'Blue Moon MK1',
      "Chang'e-7",
      undefined,
    ])
  })

  it('has no unbound Sepolia featured prize', () => {
    expect(getFeaturedLiveDePrizeId('sepolia')).to.equal(undefined)
    expect(getFeaturedLiveDePrizeId('arbitrum')).to.equal(1)
  })

  it('returns a stable binding identity so consumers can memoize on it', () => {
    expect(getDePrizeRaceBinding('sepolia', 2)).to.equal(getDePrizeRaceBinding('sepolia', 2))
    expect(getDePrizeRaceBinding('sepolia', 99)).to.equal(undefined)
    expect(getDePrizeRaceBinding('sepolia', 99)).to.equal(getDePrizeRaceBinding('sepolia', 99))
  })

  it('reverse-looks up the DePrize id for a bound goal (hit and miss)', () => {
    expect(findDePrizeIdForGoal('sepolia', 'shared-next-landing')).to.equal(2)
    expect(findDePrizeIdForGoal('sepolia', 'shared-fission-power')).to.equal(undefined)
    expect(findDePrizeIdForGoal('sepolia', 'shared-night-shift')).to.equal(3)
    expect(findDePrizeIdForGoal('sepolia', 'shared-lunar-rover')).to.equal(4)
    expect(findDePrizeIdForGoal('sepolia', 'shared-first-tracks')).to.equal(5)
    expect(findDePrizeIdForGoal('sepolia', 'shared-ice')).to.equal(6)
    expect(findDePrizeIdForGoal('sepolia', 'shared-mass-driver')).to.equal(undefined)
    expect(findDePrizeIdForGoal('arbitrum', 'shared-fission-power')).to.equal(undefined)
    expect(findDePrizeIdForGoal('sepolia', undefined)).to.equal(undefined)
  })

  it('reports a bound race regardless of consent, and unbound goals as unbound', () => {
    expect(isDePrizeGoalMarketBound('sepolia', 'shared-next-landing')).to.equal(true)
    expect(isDePrizeGoalMarketBound('sepolia', 'shared-fission-power')).to.equal(false)
    expect(isDePrizeGoalMarketBound('sepolia', 'shared-night-shift')).to.equal(true)
    expect(isDePrizeGoalMarketBound('sepolia', 'shared-lunar-rover')).to.equal(true)
    expect(isDePrizeGoalMarketBound('sepolia', 'shared-first-tracks')).to.equal(true)
    expect(isDePrizeGoalMarketBound('sepolia', 'shared-ice')).to.equal(true)
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

    const sepolia = partitionDePrizeIndexByRace('sepolia', 2)
    expect(sepolia).to.deep.equal([
      {
        raceLabel: 'Next lunar landing',
        deprizeIds: [1, 2],
        showHeading: true,
      },
    ])

    const arbitrum = partitionDePrizeIndexByRace('arbitrum', 3)
    expect(arbitrum).to.deep.equal([
      { raceLabel: null, deprizeIds: [1, 2, 3], showHeading: false },
    ])
  })

  it('deep-links predictions to the forecast panel', () => {
    expect(deprizeForecastHref(1)).to.equal('/deprize/1#deprize-forecast')
    expect(deprizeForecastHref('harsh-mistress')).to.equal(
      '/deprize/harsh-mistress#deprize-forecast'
    )
  })
})

describe('deprize chain-prefixed links', () => {
  it('maps sep and arb prefixes onto registry slugs', () => {
    expect(deprizeChainSlugFromPrefix('sep')).to.equal('sepolia')
    expect(deprizeChainSlugFromPrefix('sepolia')).to.equal('sepolia')
    expect(deprizeChainSlugFromPrefix('arb')).to.equal('arbitrum')
    expect(deprizeChainSlugFromPrefix('nope')).to.equal(undefined)
    expect(deprizeChainLabel('sepolia')).to.equal('Sepolia')
  })

  it('builds a path that pins the registry', () => {
    expect(deprizePrefixedHref('sepolia', 2)).to.equal('/deprize/sep/2')
    expect(deprizePrefixedHref('arbitrum', 1)).to.equal('/deprize/arb/1')
    expect(deprizePrefixedHref('sepolia', 'shared-next-landing')).to.equal(
      '/deprize/sep/shared-next-landing'
    )
    expect(deprizeIndexHref('sepolia')).to.equal('/deprize/sep')
    expect(deprizeIndexHref('arbitrum')).to.equal('/deprize/arb')
    expect(deprizeIndexHref('ethereum')).to.equal('/deprize')
  })

  it('finds which registries know an id', () => {
    expect(findDePrizeChainSlugs(2)).to.deep.equal(['sepolia'])
    expect(findDePrizeChainSlugs(1).sort()).to.deep.equal(['arbitrum', 'sepolia'])
    expect(findDePrizeChainSlugs(99)).to.deep.equal([])
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

  it('walks the Sepolia Touchdown lineage to the open generation', () => {
    expect(resolveLiveDePrizeId('sepolia', 1)).to.equal(2)
    expect(getDePrizeGenerationNumber('sepolia', 1)).to.equal(1)
    expect(getDePrizeGenerationNumber('sepolia', 2)).to.equal(2)
    expect(resolveLiveDePrizeId('sepolia', undefined)).to.equal(undefined)
    expect(getDePrizeGenerationNumber('sepolia', undefined)).to.equal(1)
  })
})
