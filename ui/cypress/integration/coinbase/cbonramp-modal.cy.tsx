import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { CYPRESS_CHAIN_V5 } from '@/cypress/mock/config'
import { CBOnrampModal } from '@/components/coinbase/CBOnrampModal'

describe('<CBOnrampModal />', () => {
  const mockAddress = '0x1234567890123456789012345678901234567890'
  const mockChain = CYPRESS_CHAIN_V5
  let mockSetEnabled: any
  let mockOnExit: any

  beforeEach(() => {
    cy.mountNextRouter('/')
    mockSetEnabled = cy.stub()
    mockOnExit = cy.stub()
    // Mock API endpoints
    cy.intercept('GET', '/api/coinbase/eth-price', { fixture: 'coinbase/eth-price.json' }).as(
      'ethPrice'
    )
    cy.intercept('POST', '/api/coinbase/session-token', {
      fixture: 'coinbase/session-token.json',
    }).as('sessionToken')
    cy.intercept('POST', '/api/coinbase/buy-quote', { fixture: 'coinbase/buy-quote.json' }).as(
      'buyQuote'
    )
    cy.intercept('POST', '/api/coinbase/onramp-jwt', { fixture: 'coinbase/onramp-jwt.json' }).as(
      'onrampJWT'
    )
  })

  it('renders modal when enabled is true', () => {
    cy.mount(
      <TestnetProviders>
        <CBOnrampModal
          enabled={true}
          setEnabled={mockSetEnabled}
          address={mockAddress}
          selectedChain={mockChain}
          ethAmount={0.1}
          context="test"
        />
      </TestnetProviders>
    )

    cy.get('[data-testid="cbonramp-modal-content"]').should('exist')
  })

  it('does not render modal when enabled is false', () => {
    cy.mount(
      <TestnetProviders>
        <CBOnrampModal
          enabled={false}
          setEnabled={mockSetEnabled}
          address={mockAddress}
          selectedChain={mockChain}
          ethAmount={0.1}
          context="test"
        />
      </TestnetProviders>
    )

    cy.get('[data-testid="cbonramp-modal-content"]').should('not.exist')
  })

  it('passes allowAmountInput prop to CBOnramp', () => {
    cy.mount(
      <TestnetProviders>
        <CBOnrampModal
          enabled={true}
          setEnabled={mockSetEnabled}
          address={mockAddress}
          selectedChain={mockChain}
          ethAmount={0}
          allowAmountInput={true}
          context="test"
        />
      </TestnetProviders>
    )

    cy.get('[data-testid="cbonramp-amount-input"]').should('exist')
  })

  it('calls onExit callback on exit', () => {
    cy.mount(
      <TestnetProviders>
        <CBOnrampModal
          enabled={true}
          setEnabled={mockSetEnabled}
          address={mockAddress}
          selectedChain={mockChain}
          ethAmount={0.1}
          context="test"
          onExit={mockOnExit}
        />
      </TestnetProviders>
    )

    cy.get('[data-testid="cbonramp-close-button"]').click()
    cy.then(() => {
      expect(mockOnExit).to.have.been.called
      expect(mockSetEnabled).to.have.been.calledWith(false)
    })
  })
})
