import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { Toaster } from 'react-hot-toast'
import * as SafeHooks from '@/lib/nance/SafeHooks'
import { SafeData } from '@/lib/safe/useSafe'
import * as PrivyComponents from '@/components/privy/PrivyWeb3Button'
import SafeSendModal from '@/components/safe/SafeSendModal'

describe('<SafeSendModal />', () => {
  let mockSafeData: SafeData
  let props: any
  const mockSafeAddress = '0x1234567890123456789012345678901234567890'

  const mockBalances = [
    {
      tokenAddress: null,
      token: null,
      balance: '1000000000000000000', // 1 ETH
    },
    {
      tokenAddress: '0x1234567890123456789012345678901234567890',
      token: {
        symbol: 'USDC',
        decimals: 6,
      },
      balance: '1000000', // 1 USDC
    },
  ]

  beforeEach(() => {
    // Mock the useSafeBalances hook
    cy.stub(SafeHooks, 'useSafeBalances').returns({
      data: mockBalances,
      isLoading: false,
    })

    // Mock the PrivyWeb3Button component
    cy.stub(PrivyComponents, 'PrivyWeb3Button').callsFake(
      ({ action, children, isDisabled, ...props }) => (
        <button
          {...props}
          data-testid="send-button"
          type="submit"
          disabled={isDisabled}
          onClick={async () => {
            if (action && !isDisabled) {
              await action()
            }
          }}
        >
          {children || 'Send'}
        </button>
      )
    )

    mockSafeData = {
      sendFunds: cy.stub().resolves(),
      safe: undefined,
      currentNonce: 0,
      queueSafeTx: cy.stub(),
      lastSafeTxExecuted: null,
      addSigner: cy.stub(),
      removeSigner: cy.stub(),
      changeThreshold: cy.stub(),
      executeTransaction: cy.stub(),
      owners: [],
      threshold: 1,
      pendingTransactions: [],
      transactionsToSign: [],
      transactionsToExecute: [],
      signPendingTransaction: cy.stub(),
      fetchPendingTransactions: cy.stub(),
      rejectTransaction: cy.stub(),
    }

    props = {
      safeData: mockSafeData,
      safeAddress: mockSafeAddress,
      setEnabled: cy.stub(),
    }

    cy.mountNextRouter('/')
  })

  it('Renders the modal with correct title and address', () => {
    cy.mount(
      <TestnetProviders>
        <SafeSendModal {...props} />
        <Toaster />
      </TestnetProviders>
    )
    cy.get('[data-testid="safe-modal-title"]').should('contain', 'Send Funds')
    cy.get('[data-testid="safe-address"]').should('contain', '0x1234...7890')
  })

  it('Closes the modal when close button is clicked', () => {
    const setEnabled = cy.stub()
    cy.mount(
      <TestnetProviders>
        <SafeSendModal
          safeData={mockSafeData}
          safeAddress={mockSafeAddress}
          setEnabled={setEnabled}
        />
        <Toaster />
      </TestnetProviders>
    )
    cy.get('[data-testid="safe-modal-close"]').click()
    cy.wrap(setEnabled).should('have.been.calledWith', false)
  })

  it('Validates address input', () => {
    cy.mount(
      <TestnetProviders>
        <SafeSendModal {...props} />
        <Toaster />
      </TestnetProviders>
    )

    // Test invalid address
    cy.get('[data-testid="recipient-address"]').type('invalid-address')
    cy.get('[data-testid="send-button"]').should('be.disabled')

    // Test valid address
    cy.get('[data-testid="recipient-address"]').clear()
    cy.get('[data-testid="recipient-address"]').type(
      '0x1234567890123456789012345678901234567890'
    )
    cy.get('[data-testid="amount-input"]').type('1')
    cy.get('[data-testid="send-button"]').should('be.enabled')
  })

  it('Validates amount input', () => {
    cy.mount(
      <TestnetProviders>
        <SafeSendModal {...props} />
        <Toaster />
      </TestnetProviders>
    )

    // Test invalid amount (0)
    cy.get('[data-testid="recipient-address"]').type(
      '0x1234567890123456789012345678901234567890'
    )
    cy.get('[data-testid="amount-input"]').type('0')
    cy.get('[data-testid="send-button"]').should('be.disabled')

    // Test valid amount
    cy.get('[data-testid="amount-input"]').clear()
    cy.get('[data-testid="amount-input"]').type('1')
    cy.get('[data-testid="send-button"]').should('be.enabled')
  })
})
