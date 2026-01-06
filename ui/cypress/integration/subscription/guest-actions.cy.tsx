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
    cy.get('.header').should('exist')
    cy.contains('Fund Wallet').should('exist')
  })

  it('Renders component with become citizen action if native balance >= cost of citizen nft', () => {
    cy.mount(
      <TestnetProviders>
        <GuestActions {...props} address={ZERO_ADDRESS} nativeBalance={1} />
      </TestnetProviders>
    )
    cy.get('.header').should('exist')
    cy.contains('Become a Citizen').should('exist')
  })
})
