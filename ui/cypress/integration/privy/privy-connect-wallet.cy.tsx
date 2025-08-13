import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { PrivyConnectWallet } from '../../../components/privy/PrivyConnectWallet'

describe('<PrivyConnectWallet />', () => {
  it('Renders Privy Web3 Connect Wallet Button', () => {
    cy.mountNextRouter('/')
    cy.mount(
      <TestnetProviders>
        <PrivyConnectWallet />
      </TestnetProviders>
    )

    cy.get('#sign-in-button').should('exist')
  })
})
