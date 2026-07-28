import {
  GENERIC_DEPRIZE_COMPETITION,
  getDePrizeCompetition,
  getDePrizeQuestionId,
  isKnownDePrizeCompetition,
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
    expect(c.title).to.equal('Sepolia QA fixture')
    expect(c.tagline).to.be.a('string').and.not.equal(GENERIC_DEPRIZE_COMPETITION.tagline)
    expect(c.metaDescription).to.be.a('string').and.have.length.greaterThan(0)
    expect(c.questionId).to.equal(
      '0xab937cdea2250786bf37ee2dd06f244bbeed62159c337927074523844d5759fb'
    )
    expect(getDePrizeQuestionId('sepolia', 9)).to.equal(c.questionId)
  })
})
