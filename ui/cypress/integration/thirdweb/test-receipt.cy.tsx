import TestnetProviders from '@/cypress/mock/TestnetProviders'
import TestReceipt from '@/components/thirdweb/TestReceipt'

describe('TestReceipt Component', () => {
  let props: any
  beforeEach(() => {
    props = {
      transactionHash:
        '0xbb8efb368d278ab8ed1c497f1c15f781c0c3accbea60418366e8b2abe0d39ea3',
    }
    cy.mount(
      <TestnetProviders>
        <TestReceipt {...props} />
      </TestnetProviders>
    )
  })

  it('should render and test receipt fetching', () => {
    cy.get('[data-testid="test-receipt-title"]').should(
      'contain',
      'Test Receipt Fetching'
    )
    cy.get('[data-testid="tx-hash-display"]').should(
      'contain',
      props.transactionHash
    )
    cy.get('[data-testid="fetch-receipt-button"]').should('be.visible')

    // Click fetch button
    cy.get('[data-testid="fetch-receipt-button"]').click()

    // Should show loading state
    cy.get('[data-testid="fetch-receipt-button"]').should(
      'contain',
      'Fetching...'
    )

    // Should eventually show either success or error
    cy.get('[data-testid="success-message"], [data-testid="error-message"]', {
      timeout: 30000,
    }).should('be.visible')
  })
})
