import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { CYPRESS_CHAIN_V5 } from '@/cypress/mock/config'
import { CBOnramp } from '@/components/coinbase/CBOnramp'

describe('<CBOnramp />', () => {
  const mockAddress = '0x1234567890123456789012345678901234567890'
  const mockChain = CYPRESS_CHAIN_V5
  let mockOnExit: any

  beforeEach(() => {
    cy.mountNextRouter('/')
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
  })

  describe('Close Button', () => {
    it('renders close button and calls onExit when clicked', () => {
      cy.mount(
        <TestnetProviders>
          <CBOnramp
            address={mockAddress}
            selectedChain={mockChain}
            ethAmount={0.1}
            onExit={mockOnExit}
          />
        </TestnetProviders>
      )

      cy.get('[data-testid="cbonramp-close-button"]').should('exist').click()
      cy.then(() => {
        expect(mockOnExit).to.have.been.called
      })
    })
  })

  describe('Amount Input', () => {
    it('shows amount input when allowAmountInput is true', () => {
      cy.mount(
        <TestnetProviders>
          <CBOnramp
            address={mockAddress}
            selectedChain={mockChain}
            ethAmount={0}
            allowAmountInput={true}
          />
        </TestnetProviders>
      )

      cy.get('[data-testid="cbonramp-amount-input"]').should('exist')
    })

    it('does not show amount input when allowAmountInput is false', () => {
      cy.mount(
        <TestnetProviders>
          <CBOnramp
            address={mockAddress}
            selectedChain={mockChain}
            ethAmount={0.1}
            allowAmountInput={false}
          />
        </TestnetProviders>
      )

      cy.get('[data-testid="cbonramp-amount-input"]').should('not.exist')
    })

    it('shows predetermined amount when allowAmountInput is false', () => {
      cy.mount(
        <TestnetProviders>
          <CBOnramp
            address={mockAddress}
            selectedChain={mockChain}
            ethAmount={0.1234}
            allowAmountInput={false}
          />
        </TestnetProviders>
      )

      cy.get('[data-testid="cbonramp-predetermined-amount"]').should('exist')
      cy.get('[data-testid="cbonramp-predetermined-amount"]').should('contain', '0.1234 ETH')
    })

    it('allows typing leading zeros like 0.1', () => {
      cy.mount(
        <TestnetProviders>
          <CBOnramp
            address={mockAddress}
            selectedChain={mockChain}
            ethAmount={0}
            allowAmountInput={true}
          />
        </TestnetProviders>
      )

      cy.get('[data-testid="cbonramp-amount-input"]').type('0.1')
      cy.get('[data-testid="cbonramp-amount-input"]').should('have.value', '0.1')
    })

    it('allows typing 0.01', () => {
      cy.mount(
        <TestnetProviders>
          <CBOnramp
            address={mockAddress}
            selectedChain={mockChain}
            ethAmount={0}
            allowAmountInput={true}
          />
        </TestnetProviders>
      )

      cy.get('[data-testid="cbonramp-amount-input"]').type('0.01')
      cy.get('[data-testid="cbonramp-amount-input"]').should('have.value', '0.01')
    })

    it('validates decimal numbers correctly', () => {
      cy.mount(
        <TestnetProviders>
          <CBOnramp
            address={mockAddress}
            selectedChain={mockChain}
            ethAmount={0}
            allowAmountInput={true}
          />
        </TestnetProviders>
      )

      // eslint-disable-next-line cypress/no-assigning-return-values
      const input = cy.get('[data-testid="cbonramp-amount-input"]')
      input.type('1.5')
      input.should('have.value', '1.5')
    })

    it('rejects invalid characters', () => {
      cy.mount(
        <TestnetProviders>
          <CBOnramp
            address={mockAddress}
            selectedChain={mockChain}
            ethAmount={0}
            allowAmountInput={true}
          />
        </TestnetProviders>
      )

      // eslint-disable-next-line cypress/no-assigning-return-values
      const input = cy.get('[data-testid="cbonramp-amount-input"]')
      input.type('abc')
      input.should('have.value', '')
    })

    it('normalizes empty input to empty string on blur', () => {
      cy.mount(
        <TestnetProviders>
          <CBOnramp
            address={mockAddress}
            selectedChain={mockChain}
            ethAmount={0}
            allowAmountInput={true}
          />
        </TestnetProviders>
      )

      // eslint-disable-next-line cypress/no-assigning-return-values
      const input = cy.get('[data-testid="cbonramp-amount-input"]')
      input.type('abc')
      input.blur()
      input.should('have.value', '')
    })

    it('normalizes invalid input to empty string on blur', () => {
      cy.mount(
        <TestnetProviders>
          <CBOnramp
            address={mockAddress}
            selectedChain={mockChain}
            ethAmount={0}
            allowAmountInput={true}
          />
        </TestnetProviders>
      )

      // eslint-disable-next-line cypress/no-assigning-return-values
      const input = cy.get('[data-testid="cbonramp-amount-input"]')
      input.type('.')
      input.blur()
      input.should('have.value', '')
    })
  })
})
