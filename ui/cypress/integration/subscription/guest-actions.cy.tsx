import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { CYPRESS_CHAIN_SLUG, CYPRESS_CHAIN_V5 } from '@/cypress/mock/config'
import CitizenABI from 'const/abis/Citizen.json'
import { CITIZEN_ADDRESSES, ZERO_ADDRESS } from 'const/config'
import * as thirdweb from 'thirdweb'
import { serverClient } from '@/lib/thirdweb/client'
import GuestActions from '@/components/subscription/GuestActions'

describe('<GuestActions />', () => {
  let props: any

  beforeEach(() => {
    props = {
      nativeBalance: 0,
      citizenContract: thirdweb.getContract({
        client: serverClient,
        address: CITIZEN_ADDRESSES[CYPRESS_CHAIN_SLUG],
        abi: CitizenABI as any,
        chain: CYPRESS_CHAIN_V5,
      }),
    }

    cy.mountNextRouter('/')
  })

  it('Renders component with fund action if native balance < cost of citizen nft', () => {
    cy.mount(
      <TestnetProviders>
        <GuestActions {...props} />
      </TestnetProviders>
    )
    cy.contains('Fund Wallet').should('exist')
  })

  describe('when native balance >= cost', () => {
    beforeEach(() => {
      // Set up stub before mounting - this needs to be active when component loads
      cy.stub(thirdweb, 'readContract').callsFake(async (options: any) => {
        if (options.method === 'getRenewalPrice') {
          return BigInt('11200000000000')
        }
        return BigInt(0)
      })
    })

    it('Renders component with become citizen action if native balance >= cost of citizen nft', () => {
      const testAddress = '0x1234567890123456789012345678901234567890'

      cy.mount(
        <TestnetProviders>
          <GuestActions {...props} address={testAddress} nativeBalance={1} />
        </TestnetProviders>
      )

      // Verify the component rendered
      cy.get('#guest-actions-container').should('exist')

      // eslint-disable-next-line cypress/no-unnecessary-waiting
      cy.wait(1500)
      cy.contains('Become a Citizen', { timeout: 15000 }).should('exist')
    })
  })
})
