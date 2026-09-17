import {
  evenPercents,
  percentsDiverged,
  weightsToPercents,
  normalizeWeights,
  validateWeights,
} from '@/lib/forecasts/weights'

describe('forecast weights validation', () => {
  it('length 1 rejects; 13 rejects; all-zero rejects; a negative rejects', () => {
    expect(validateWeights([1])).to.deep.equal({ ok: false, rule: 'length' })
    expect(validateWeights(Array(13).fill(1))).to.deep.equal({ ok: false, rule: 'length' })
    expect(validateWeights([0, 0])).to.deep.equal({ ok: false, rule: 'all-zero' })
    expect(validateWeights([3, -1])).to.deep.equal({ ok: false, rule: 'negative' })
  })

  it('[3, 1] normalizes to [0.75, 0.25]', () => {
    const parsed = validateWeights([3, 1])
    expect(parsed.ok).to.equal(true)
    if (parsed.ok) {
      expect(normalizeWeights(parsed.weights)).to.deep.equal([0.75, 0.25])
    }
  })

  it('even percents sum to 100 and detect edits', () => {
    expect(evenPercents(3)).to.deep.equal([33, 33, 34])
    expect(evenPercents(3).reduce((a, b) => a + b, 0)).to.equal(100)
    expect(weightsToPercents([3, 1])).to.deep.equal([75, 25])
    expect(percentsDiverged([33, 33, 34], 3)).to.equal(false)
    expect(percentsDiverged([50, 25, 25], 3)).to.equal(true)
  })
})
