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
})
