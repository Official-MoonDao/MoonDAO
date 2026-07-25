import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { CYPRESS_CHAIN_SLUG, CYPRESS_CHAIN_V5 } from '@/cypress/mock/config'
import { encodeUint, interceptRpc } from '@/cypress/mock/rpc'
import CitizenABI from 'const/abis/Citizen.json'
import { CITIZEN_ADDRESSES, ZERO_ADDRESS } from 'const/config'
import * as thirdweb from 'thirdweb'
import { serverClient } from '@/lib/thirdweb/serverClient'
import GuestActions from '@/components/subscription/GuestActions'

describe('<GuestActions />', () => {
  let props: any

  beforeEach(() => {
    // Component tests have no Next API routes, so answer the /api/rpc proxy
    // at the network layer. getRenewalPrice → 0.01 ETH keeps both branches
    // deterministic: balance 0 < cost, balance 1 >= cost.
    interceptRpc((method) =>
      method === 'eth_call' ? encodeUint(10n ** 16n) : undefined
    )

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
