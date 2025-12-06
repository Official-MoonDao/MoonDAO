import TestnetProviders from '@/cypress/mock/TestnetProviders'
import TestReceipt from '@/components/thirdweb/TestReceipt'

describe('TestReceipt Component', () => {
  let props: any

  beforeEach(() => {
    props = {
      transactionHash: '0xbb8efb368d278ab8ed1c497f1c15f781c0c3accbea60418366e8b2abe0d39ea3',
    }

    cy.mount(
      <TestnetProviders>
        <TestReceipt {...props} />
      </TestnetProviders>
    )
  })

  it('should render and test receipt fetching', () => {
    // Verify component renders correctly
    cy.get('[data-testid="test-receipt-title"]').should('contain', 'Test Receipt Fetching')
    cy.get('[data-testid="tx-hash-display"]').should('contain', props.transactionHash)
    cy.get('[data-testid="fetch-receipt-button"]').should('be.visible')
    cy.get('[data-testid="fetch-receipt-button"]').should('not.be.disabled')

    // Click fetch button - this triggers waitForReceipt
    cy.get('[data-testid="fetch-receipt-button"]').click()

    // Verify loading state appears
    cy.get('[data-testid="fetch-receipt-button"]', { timeout: 5000 }).should(
      'contain',
      'Fetching...'
    )
    cy.get('[data-testid="fetch-receipt-button"]').should('be.disabled')
  })
})
