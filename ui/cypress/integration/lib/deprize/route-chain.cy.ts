import { expect } from 'chai'
import { chainForDeprizePath } from '@/lib/deprize/route-chain'

describe('chainForDeprizePath', () => {
  it('opens /deprize/sep pages on Sepolia', () => {
    expect(chainForDeprizePath('/deprize/sep')?.id).to.equal(11155111)
    expect(chainForDeprizePath('/deprize/sep/[id]')?.id).to.equal(11155111)
    expect(chainForDeprizePath('/deprize/sep/2')?.id).to.equal(11155111)
  })

  it('opens /deprize/arb pages on Arbitrum', () => {
    expect(chainForDeprizePath('/deprize/arb/[id]')?.id).to.equal(42161)
  })

  it('leaves unprefixed DePrize routes on the app default', () => {
    expect(chainForDeprizePath('/deprize')).to.equal(undefined)
    expect(chainForDeprizePath('/deprize/[id]')).to.equal(undefined)
    expect(chainForDeprizePath('/deprize/2')).to.equal(undefined)
  })
})
