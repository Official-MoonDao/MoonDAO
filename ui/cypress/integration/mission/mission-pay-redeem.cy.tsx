import TestnetProviders from '@/cypress/mock/TestnetProviders'
import {
  CYPRESS_CHAIN_V5,
  CYPRESS_MISSION_PRIMARY_TERMINAL_ADDRESS,
  CYPRESS_MISSION_TOKEN_ADDRESS,
  cypressThirdwebClient,
} from '@/cypress/mock/config'
import { JB_NATIVE_TOKEN_ADDRESS } from 'const/config'
import MissionPayRedeem from '@/components/mission/MissionPayRedeem'

declare global {
  interface Window {
    cypressMock?: {
      safe: {
        isOwner: (address: string) => Promise<boolean>
      }
    }
    useActiveAccount?: () => any
    useNativeBalance?: () => string
    useWatchTokenBalance?: () => number
    useRead?: () => { data: string }
  }
}

describe('<MissionPayRedeem />', () => {
  let props: any
  let mockPrimaryTerminalContract: any
  let mockJbControllerContract: any

  const mockActiveAccount = {
    address: '0x1234567890123456789012345678901234567890',
  }

  beforeEach(() => {
    cy.on('uncaught:exception', () => false)

    // Initialize contract mocks inside beforeEach
    mockPrimaryTerminalContract = {
      pay: cy.stub().resolves({ hash: '0x123' }),
      cashOutTokensOf: cy.stub().resolves({ hash: '0x123' }),
    }

    mockJbControllerContract = {
      claimTokensFor: cy.stub().resolves({ hash: '0x123' }),
    }

    // Mock window objects
    cy.window().then((win) => {
      win.cypressMock = {
        safe: {
          isOwner: () => Promise.resolve(true),
        },
      }
      // Mock hooks
      win.useActiveAccount = () => mockActiveAccount
      win.useNativeBalance = () => '1.5' // 1.5 ETH
      win.useWatchTokenBalance = () => 10 // 10 tokens
      win.useRead = () => ({ data: '1000000000000000000' }) // 1 token credit
    })

    props = {
      selectedChain: CYPRESS_CHAIN_V5,
      mission: {
        id: '1',
        projectId: '1',
        metadata: {
          logoUri: '/assets/icon-star.svg',
          name: 'Test Mission',
        },
      },
      token: {
        tokenSymbol: 'TEST',
        tokenName: 'Test Token',
        tokenAddress: CYPRESS_MISSION_TOKEN_ADDRESS,
        tokenSupply: '1000000000000000000', // 1 token
      },
      fundingGoal: 100,
      subgraphData: {
        paymentsCount: 10,
        volume: '1000000000000000000', // 1 ETH
        last7DaysPercent: 5,
      },
      teamNFT: {
        metadata: {
          name: 'Test Team NFT',
        },
        owner: '0x1234567890123456789012345678901234567890',
      },
      stage: 3, // Stage 3 for redemption testing
      ruleset: [{}, {}],
      primaryTerminalAddress: CYPRESS_MISSION_PRIMARY_TERMINAL_ADDRESS,
      jbControllerContract: mockJbControllerContract,
      forwardClient: cypressThirdwebClient,
    }

    cy.mountNextRouter('/')
    cy.mount(
      <TestnetProviders>
        <MissionPayRedeem {...props} />
      </TestnetProviders>
    )
  })

  describe('Initial Render', () => {
    it('Should render the component with initial state', () => {
      cy.get('#mission-pay-redeem-container').should('exist')
      cy.get('#mission-pay-container').should('exist')
      cy.contains('Payments').should('exist')
      cy.contains('Total Raised').should('exist')
      cy.contains('Last 7 Days').should('exist')
    })

    it('Should display mission statistics correctly', () => {
      cy.contains('10').should('exist') // Payments count
      cy.contains('1').should('exist') // Volume in ETH
      cy.contains('5%').should('exist') // Last 7 days percent
    })

    it('Should show token exchange rates', () => {
      cy.get('#mission-token-stats').should('exist')
      cy.contains('Current Supply').should('exist')
      cy.contains('1 $TEST').should('exist') // Token supply
    })
  })

  describe('Payment Flow', () => {
    it('Should handle payment input and calculate output', () => {
      cy.get('#payment-input').type('0.1')
      cy.get('#token-output').should('exist')
      cy.get('#token-output').should('contain', '0.00')
    })

    it('Should open payment modal and handle message input', () => {
      cy.contains('button', 'Contribute').click()
      cy.get('#mission-pay-modal').should('exist')

      const testMessage = 'Test payment message'
      cy.get('#payment-message-input').type(testMessage)
      cy.get('#payment-message-input').should('have.value', testMessage)
    })

    it('Should close payment modal', () => {
      cy.contains('button', 'Contribute').click()
      cy.contains('button', 'Cancel').click()
      cy.get('#mission-pay-modal').should('not.exist')
    })
  })

  describe('Mobile View', () => {
    beforeEach(() => {
      cy.viewport('iphone-x')
    })

    it('Should show mobile contribution button', () => {
      cy.get('.fixed.bottom-0.left-0.w-full')
        .should('be.visible')
        .within(() => {
          cy.contains('button', 'Contribute').should('be.visible')
        })
    })

    it('Should show mobile redemption button in stage 3', () => {
      cy.get('.fixed.bottom-0.left-0.w-full')
        .should('be.visible')
        .within(() => {
          cy.get('#redeem-button').should('be.visible')
        })
    })
  })
})
