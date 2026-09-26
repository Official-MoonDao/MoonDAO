import { arbitrumMintUsesLegacyBet } from '@/lib/deprize/mintBet'

describe('deprize mint bet shape', () => {
  it('uses the pre-permit bet only on Arbitrum One', () => {
    expect(arbitrumMintUsesLegacyBet(42161)).to.equal(true)
    expect(arbitrumMintUsesLegacyBet(11155111)).to.equal(false)
    expect(arbitrumMintUsesLegacyBet(421614)).to.equal(false)
    expect(arbitrumMintUsesLegacyBet(1)).to.equal(false)
  })
})
