import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { interceptRpc, mockReceipt } from '@/cypress/mock/rpc'
import TestReceipt from '@/components/thirdweb/TestReceipt'

const TX_HASH =
  '0xbb8efb368d278ab8ed1c497f1c15f781c0c3accbea60418366e8b2abe0d39ea3'

describe('TestReceipt Component', () => {
  let props: any

  beforeEach(() => {
    // Serve the receipt from a mocked /api/rpc proxy — waitForReceipt polls
    // eth_blockNumber and eth_getTransactionReceipt, both answered here, so
    // the test never touches live Sepolia RPC.
    interceptRpc((method) =>
      method === 'eth_getTransactionReceipt' ? mockReceipt(TX_HASH) : undefined
    )

    props = { transactionHash: TX_HASH }
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

    cy.get('[data-testid="fetch-receipt-button"]').click()

    cy.get('[data-testid="success-message"], [data-testid="error-message"]', {
      timeout: 15000,
    }).should('be.visible')
  })
})
