import { mintBetArgs } from '@/lib/deprize/mintBet'

describe('deprize mint bet shape', () => {
  it('always ends with the compliance permit deadline and signature', () => {
    const signature = `0x${'ab'.repeat(65)}` as const
    const args = mintBetArgs({
      deprizeId: 1,
      outcomeIndex: 3,
      shares: 7n,
      maxCost: 9n,
      deadline: '1893456000',
      signature,
    })
    expect(args).to.have.length(6)
    expect(args).to.deep.equal([1n, 3n, 7n, 9n, 1893456000n, signature])
  })
})
