import { CYPRESS_CHAIN_V5 } from '@/cypress/mock/config'
import { ZERO_ADDRESS } from 'thirdweb'
import * as thirdweb from 'thirdweb'
import { fetchTokenMetadata } from '@/lib/mission/fetchTokenServerData'

describe('fetchTokenServerData', () => {
  beforeEach(() => {
    // Restore any previous stubs
    cy.window().then((win) => {
      if ((win as any).cyStubRestore) {
        ;(win as any).cyStubRestore()
      }
    })
    // Reset any existing stubs
    if ((thirdweb as any).readContract?.restore) {
      ;(thirdweb as any).readContract.restore()
    }
  })

  it('returns default data when tokenAddress is zero address', async () => {
    const tokenData = await fetchTokenMetadata(ZERO_ADDRESS, CYPRESS_CHAIN_V5)
    expect(tokenData.tokenAddress).to.equal(ZERO_ADDRESS)
    expect(tokenData.tokenName).to.equal('')
    expect(tokenData.tokenSymbol).to.equal('')
    expect(tokenData.tokenSupply).to.equal('')
  })

  it('handles errors gracefully', () => {
    // Stub readContract to throw an error
    cy.stub(thirdweb, 'readContract').rejects(new Error('RPC Error'))

    const tokenAddress = '0x1234567890123456789012345678901234567890'
    fetchTokenMetadata(tokenAddress, CYPRESS_CHAIN_V5).then((data) => {
      expect(data).to.have.property('tokenAddress')
      expect(data).to.have.property('tokenName')
      expect(data).to.have.property('tokenSymbol')
      expect(data.tokenAddress).to.equal(tokenAddress)
    })
  })
})
