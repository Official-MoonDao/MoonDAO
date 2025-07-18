import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { ethers } from 'ethers'
import SafeTransactions from '@/components/safe/SafeTransactions'

describe('SafeTransactions', () => {
  let mockSafeData: any
  const mockAddress = '0xdef'

  beforeEach(() => {
    // Create stubs inside beforeEach
    const queueSafeTxStub = cy.stub().resolves('0x123')
    const addSignerStub = cy.stub().resolves('0x123')
    const removeSignerStub = cy.stub().resolves('0x123')
    const changeThresholdStub = cy.stub().resolves('0x123')
    const signPendingTransactionStub = cy.stub().resolves()
    const executeTransactionStub = cy.stub().resolves()
    const rejectTransactionStub = cy.stub().resolves()
    const fetchPendingTransactionsStub = cy.stub().resolves()

    // Create mockSafeData with stubs
    mockSafeData = {
      safe: undefined,
      queueSafeTx: queueSafeTxStub,
      lastSafeTxExecuted: null,
      addSigner: addSignerStub,
      removeSigner: removeSignerStub,
      changeThreshold: changeThresholdStub,
      signPendingTransaction: signPendingTransactionStub,
      executeTransaction: executeTransactionStub,
      rejectTransaction: rejectTransactionStub,
      threshold: 2,
      owners: [mockAddress, '0xabc'],
      pendingTransactions: [
        {
          safeTxHash: '0x123',
          nonce: 1,
          to: '0x0724d0eb7b6d32AEDE6F9e492a5B1436b537262b',
          value: ethers.utils.parseEther('1').toString(),
          data: '0x',
          dataDecoded: {
            method: 'transfer',
            parameters: [],
          },
          confirmations: [], // Empty confirmations to ensure !hasSigned
          confirmationsRequired: 2,
          isExecuted: false,
          operation: 0,
          submissionDate: new Date().toISOString(),
          modified: new Date().toISOString(),
          blockNumber: null,
          transactionHash: null,
          safeTxGas: 0,
          baseGas: 0,
          gasPrice: '0',
          gasToken: '0x0000000000000000000000000000000000000000',
          refundReceiver: '0x0000000000000000000000000000000000000000',
          isSuccessful: null,
          signatures: null,
        },
      ],
      transactionsToSign: [],
      transactionsToExecute: [],
      fetchPendingTransactions: fetchPendingTransactionsStub,
      currentNonce: 1,
    }

    cy.mount(
      <TestnetProviders>
        <SafeTransactions address={mockAddress} safeData={mockSafeData} />
      </TestnetProviders>
    )
  })

  it('renders transactions section', () => {
    cy.get('[data-testid="transactions-section"]').should('exist')
    cy.get('[data-testid="transactions-title"]').should(
      'contain',
      'Transactions'
    )
  })

  it('displays list of pending transactions', () => {
    cy.get('[data-testid="transactions-list"]').should('exist')
    cy.get('[data-testid="transaction-0x123"]').should('exist')
  })

  it('shows transaction details correctly', () => {
    cy.get('[data-testid="transaction-0x123"]').within(() => {
      cy.get('[data-testid="transaction-nonce-1"]').should(
        'contain',
        'Nonce: 1'
      )
      cy.get('[data-testid="transaction-to-0x123"]').should(
        'contain',
        '0x0724d0eb7b6d32AEDE6F9e492a5B1436b537262b'
      )
      cy.get('[data-testid="transaction-value-0x123"]').should(
        'contain',
        '1.0 ETH'
      )
      cy.get('[data-testid="transaction-confirmations-0x123"]').should(
        'contain',
        '0/2'
      )
    })
  })

  it('toggles transaction data visibility', () => {
    cy.get('[data-testid="toggle-data-0x123"]').click()
    cy.get('[data-testid="transaction-data-0x123"]').should('be.visible')
    cy.get('[data-testid="toggle-data-0x123"]').click()
    cy.get('[data-testid="transaction-data-0x123"]').should('not.exist')
  })

  it('shows signed status for signed transactions', () => {
    const signedSafeData = {
      ...mockSafeData,
      pendingTransactions: [
        {
          ...mockSafeData.pendingTransactions[0],
          confirmations: [
            {
              owner: mockAddress,
              signature: '0x123',
              submissionDate: new Date().toISOString(),
              transactionHash: null,
            },
          ],
        },
      ],
    }
    cy.mount(
      <TestnetProviders>
        <SafeTransactions address={mockAddress} safeData={signedSafeData} />
      </TestnetProviders>
    )
    cy.get('[data-testid="transaction-0x123"]').within(() => {
      cy.get('[data-testid="signed-status-0x123"]').should(
        'contain',
        'You have signed this transaction'
      )
    })
  })

  it('shows execute button when transaction has enough confirmations', () => {
    const executableSafeData = {
      ...mockSafeData,
      currentNonce: 1,
      pendingTransactions: [
        {
          ...mockSafeData.pendingTransactions[0],
          nonce: 1,
          confirmations: [
            {
              owner: mockAddress,
              signature: '0x123',
              submissionDate: new Date().toISOString(),
              transactionHash: null,
            },
            {
              owner: '0xabc',
              signature: '0x456',
              submissionDate: new Date().toISOString(),
              transactionHash: null,
            },
          ],
        },
      ],
    }
    cy.mount(
      <TestnetProviders>
        <SafeTransactions address={mockAddress} safeData={executableSafeData} />
      </TestnetProviders>
    )
    cy.get('[data-testid="execute-transaction-0x123"]').should('exist')
  })

  it('shows no transactions message when there are no pending transactions', () => {
    const emptySafeData = {
      ...mockSafeData,
      pendingTransactions: [],
    }
    cy.mount(
      <TestnetProviders>
        <SafeTransactions address={mockAddress} safeData={emptySafeData} />
      </TestnetProviders>
    )
    cy.get('[data-testid="no-transactions-message"]').should(
      'contain',
      'No pending transactions'
    )
  })

  it('shows reject button after signing when transaction is not executed', () => {
    const signedButNotExecutedSafeData = {
      ...mockSafeData,
      pendingTransactions: [
        {
          ...mockSafeData.pendingTransactions[0],
          nonce: 1,
          data: '0x123',
          dataDecoded: {
            method: 'transfer',
            args: [],
          },
          confirmations: [
            {
              owner: mockAddress,
              signature: '0x123',
              submissionDate: new Date().toISOString(),
              transactionHash: null,
            },
          ],
          isExecuted: false,
        },
      ],
    }

    cy.mount(
      <TestnetProviders>
        <SafeTransactions
          address={mockAddress}
          safeData={signedButNotExecutedSafeData}
        />
      </TestnetProviders>
    )

    cy.get('[data-testid="transaction-0x123"]').within(() => {
      cy.get('[data-testid="signed-status-0x123"]').should(
        'contain',
        'You have signed this transaction'
      )
      cy.get('[data-testid="reject-after-sign-0x123"]').should('exist')
    })
  })

  it('does not show execute button when transaction has enough confirmations but wrong nonce', () => {
    const executableSafeData = {
      ...mockSafeData,
      currentNonce: 2, // Different from transaction's nonce
      pendingTransactions: [
        {
          ...mockSafeData.pendingTransactions[0],
          nonce: 1,
          confirmations: [
            {
              owner: mockAddress,
              signature: '0x123',
              submissionDate: new Date().toISOString(),
              transactionHash: null,
            },
            {
              owner: '0xabc',
              signature: '0x456',
              submissionDate: new Date().toISOString(),
              transactionHash: null,
            },
          ],
        },
      ],
    }
    cy.mount(
      <TestnetProviders>
        <SafeTransactions address={mockAddress} safeData={executableSafeData} />
      </TestnetProviders>
    )
    cy.get('[data-testid="execute-transaction-0x123"]').should('not.exist')
  })
})
