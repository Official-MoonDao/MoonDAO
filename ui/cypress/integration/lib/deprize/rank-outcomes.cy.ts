import { rankOutcomes } from '@/lib/deprize/rank-outcomes'

const o = (index: number, probability: number) => ({ index, probability })
const noField = () => false

describe('deprize rankOutcomes', () => {
  it('orders by implied chance, highest first', () => {
    const ranked = rankOutcomes([o(0, 15), o(1, 60), o(2, 25)], { isField: noField })
    expect(ranked.map((x) => x.index)).to.deep.equal([1, 2, 0])
  })

  it('keeps registry order on ties', () => {
    const ranked = rankOutcomes([o(0, 20), o(1, 20), o(2, 60), o(3, 20)], { isField: noField })
    expect(ranked.map((x) => x.index)).to.deep.equal([2, 0, 1, 3])
  })

  it('sinks NaN below numbers but keeps them above the field', () => {
    const ranked = rankOutcomes([o(0, NaN), o(1, 10), o(2, NaN)], {
      isField: (i) => i === 2,
    })
    expect(ranked.map((x) => x.index)).to.deep.equal([1, 0, 2])
  })

  it('pins the Open Field last even when it has the highest chance', () => {
    const ranked = rankOutcomes([o(0, 10), o(1, 80), o(2, 10)], { isField: (i) => i === 1 })
    expect(ranked.map((x) => x.index)).to.deep.equal([0, 2, 1])
  })

  it('puts the winner first once resolved, field still last', () => {
    const ranked = rankOutcomes([o(0, 10), o(1, 70), o(2, 20)], {
      isField: (i) => i === 2,
      winningIndex: 0,
    })
    expect(ranked.map((x) => x.index)).to.deep.equal([0, 1, 2])
  })

  it('does not mutate the input', () => {
    const input = [o(0, 15), o(1, 60)]
    rankOutcomes(input, { isField: noField })
    expect(input.map((x) => x.index)).to.deep.equal([0, 1])
  })
})
