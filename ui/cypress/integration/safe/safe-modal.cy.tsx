import TestnetProviders from '@/cypress/mock/TestnetProviders'
import SafeModal from '@/components/safe/SafeModal'

describe('<SafeModal />', () => {
  let props: any

  beforeEach(() => {
    // Mock safe data
    props = {
      safeData: {
        safe: {},
        owners: ['0x123...', '0x456...'],
        threshold: 2,
        pendingTransactions: [],
        transactionsToSign: [
          {
            safeTxHash: '0xabc...',
            nonce: 1,
            data: '0x',
            dataDecoded: { method: 'rejectTransaction' },
            to: '0x789...',
            value: '1000000000000000000', // 1 ETH
            confirmations: [],
            confirmationsRequired: 2,
            isExecuted: false,
          },
        ],
        transactionsToExecute: [],
        addSigner: cy.stub(),
        removeSigner: cy.stub(),
        changeThreshold: cy.stub(),
        signPendingTransaction: cy.stub(),
        executeTransaction: cy.stub(),
        fetchPendingTransactions: cy.stub(),
        rejectTransaction: cy.stub(),
      },
      safeAddress: '0x123...',
      isEnabled: true,
      setEnabled: cy.stub(),
    }

    cy.mount(
      <TestnetProviders>
        <SafeModal {...props} />
      </TestnetProviders>
    )
  })

  describe('Modal Structure', () => {
    it('Renders the modal with basic information', () => {
      cy.get('[data-testid="safe-modal-content"]').should('exist')
      cy.get('[data-testid="safe-modal-title"]').should('contain', 'Safe')
      cy.get('[data-testid="safe-address"]').should('contain', 'Address:')
    })

    it('Closes modal when close button is clicked', () => {
      cy.get('[data-testid="safe-modal-close"]').click()
      cy.wrap(props.setEnabled).should('have.been.calledWith', false)
    })
  })

  describe('Signers Management', () => {
    it('Displays current signers', () => {
      cy.get('[data-testid="signers-section"]').should('exist')
      cy.get('[data-testid="signers-title"]').should('contain', 'Signers')
      cy.get('[data-testid="signer-0x123..."]').should('exist')
      cy.get('[data-testid="signer-0x456..."]').should('exist')
    })

    it('Shows add signer input and button', () => {
      cy.get('[data-testid="add-signer-section"]').should('exist')
      cy.get('[data-testid="new-signer-input"]').should('exist')
      cy.get('[data-testid="add-signer-button"]').should('exist')
    })

    it('Removes a signer when remove button is clicked', () => {
      cy.get('[data-testid="remove-signer-0x123..."]').click()
      cy.wrap(props.safeData.removeSigner).should(
        'have.been.calledWith',
        '0x123...'
      )
    })
  })

  describe('Threshold Management', () => {
    it('Displays threshold management section', () => {
      cy.get('[data-testid="threshold-section"]').should('exist')
      cy.get('[data-testid="threshold-title"]').should('contain', 'Threshold')
      cy.get('[data-testid="threshold-input"]').should('exist')
      cy.get('[data-testid="threshold-max"]').should('contain', '/ 2')
    })
  })

  describe('Transactions Management', () => {
    it('Displays transactions section', () => {
      cy.get('[data-testid="transactions-section"]').should('exist')
      cy.get('[data-testid="transactions-title"]').should(
        'contain',
        'Transactions'
      )
    })

    it('Shows transaction details correctly', () => {
      cy.get('[data-testid="transaction-0xabc..."]').should('exist')
      cy.get('[data-testid="transaction-method-0xabc..."]').should(
        'contain',
        'Reject Transaction'
      )
      cy.get('[data-testid="transaction-to-0xabc..."]').should(
        'contain',
        '0x789...'
      )
      cy.get('[data-testid="transaction-value-0xabc..."]').should(
        'contain',
        '1.0 ETH'
      )
      cy.get('[data-testid="transaction-confirmations-0xabc..."]').should(
        'contain',
        '0/2'
      )
    })

    it('Shows warning for multiple transactions with same nonce', () => {
      // Add another transaction with the same nonce
      props.safeData.transactionsToSign.push({
        ...props.safeData.transactionsToSign[0],
        safeTxHash: '0xdef...',
      })

      cy.mount(
        <TestnetProviders>
          <SafeModal {...props} />
        </TestnetProviders>
      )

      cy.get('[data-testid="duplicate-nonce-warning-1"]').should('exist')
      cy.contains('Multiple transactions with the same nonce').should('exist')
    })

    it('Handles transaction signing', () => {
      // Add a non-rejection transaction
      props.safeData.transactionsToSign = [
        {
          safeTxHash: '0xdef...',
          nonce: 2,
          data: '0x123...',
          dataDecoded: { method: 'addOwnerWithThreshold' },
          to: '0x789...',
          value: '0',
          confirmations: [],
          confirmationsRequired: 2,
          isExecuted: false,
        },
      ]

      cy.mount(
        <TestnetProviders>
          <SafeModal {...props} />
        </TestnetProviders>
      )

      cy.get('[data-testid="sign-transaction-0xdef..."]').click()
      cy.wrap(props.safeData.signPendingTransaction).should(
        'have.been.calledWith',
        '0xdef...'
      )
    })

    it('Handles transaction execution', () => {
      // Add a transaction with enough confirmations
      props.safeData.transactionsToSign = [
        {
          safeTxHash: '0xdef...',
          nonce: 2,
          data: '0x123...',
          dataDecoded: { method: 'addOwnerWithThreshold' },
          to: '0x789...',
          value: '0',
          confirmations: [{ owner: '0x123...' }, { owner: '0x456...' }],
          confirmationsRequired: 2,
          isExecuted: false,
        },
      ]

      cy.mount(
        <TestnetProviders>
          <SafeModal {...props} />
        </TestnetProviders>
      )

      cy.get('[data-testid="execute-transaction-0xdef..."]').click()
      cy.wrap(props.safeData.executeTransaction).should(
        'have.been.calledWith',
        '0xdef...'
      )
    })

    it('Shows no transactions message when there are no transactions', () => {
      props.safeData.transactionsToSign = []

      cy.mount(
        <TestnetProviders>
          <SafeModal {...props} />
        </TestnetProviders>
      )

      cy.get('[data-testid="no-transactions-message"]').should('exist')
    })
  })
})
