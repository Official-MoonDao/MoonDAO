import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { CYPRESS_CHAIN_SLUG, CYPRESS_CHAIN_V5 } from '@/cypress/mock/config'
import CitizenABI from 'const/abis/Citizen.json'
import { CITIZEN_ADDRESSES, ZERO_ADDRESS } from 'const/config'
import { ethers } from 'ethers'
import * as thirdweb from 'thirdweb'
import { serverClient } from '@/lib/thirdweb/serverClient'
import GuestActions from '@/components/subscription/GuestActions'

describe('<GuestActions />', () => {
  let props: any

  beforeEach(() => {
    // Component tests have no Next.js API routes — stub on-chain reads so
    // GuestActions never hits /api/rpc/* (Cannot POST in webpack-dev-server).
    cy.stub(thirdweb, 'readContract').resolves(
      ethers.utils.parseEther('0.01')
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
