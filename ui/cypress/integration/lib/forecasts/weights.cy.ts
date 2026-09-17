import { normalizeWeights, validateWeights } from '@/lib/forecasts/weights'

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
})
