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
    useETHPrice?: (
      amount: number,
      direction: 'ETH_TO_USD' | 'USD_TO_ETH'
    ) => {
      data: number
      isLoading: boolean
      refresh: () => void
    }
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
      win.useETHPrice = (
        amount: number,
        direction: 'ETH_TO_USD' | 'USD_TO_ETH'
      ) => {
        return {
          data: 2000, // Return the ETH price directly
          isLoading: false,
          refresh: () => {},
        }
      }
    })

    // Mock the ETH price API route
    cy.intercept('GET', '/api/etherscan/eth-price', {
      statusCode: 200,
      body: {
        result: {
          ethusd: '2000', // Mock ETH price at $2000
        },
      },
    }).as('getEthPrice')

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
      stage: 1, // Change to stage 1 or 2 to show payment inputs
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
    })

    it('Should display mission statistics correctly', () => {
      cy.contains('10').should('exist') // Payments count
      cy.contains('1').should('exist') // Volume in ETH
      cy.contains('5%').should('exist') // Last 7 days percent
    })

    it('Should show token exchange rates', () => {
      cy.contains('Current Supply').should('exist')
      cy.contains('1 $TEST').should('exist') // Token supply
    })
  })

  describe('Payment Flow', () => {
    it('Should handle USD input and update ETH input correctly', () => {
      // Wait for the API call to complete
      cy.wait('@getEthPrice')

      // Wait for the component to be ready
      cy.get('#usd-contribution-input').should('exist')

      // Type $100 in USD input
      cy.get('#usd-contribution-input').type('100')

      // Wait for the value to be updated
      cy.get('#eth-contribution-input').should('have.value', '0.050000')
    })

    it('Should handle ETH input and update USD input correctly', () => {
      // Wait for the API call to complete
      cy.wait('@getEthPrice')

      // Wait for the component to be ready
      cy.get('#eth-contribution-input').should('exist')

      // Type 0.1 ETH
      cy.get('#eth-contribution-input').type('0.1')

      // Wait for the value to be updated
      cy.get('#usd-contribution-input').should('have.value', '200.00')
    })

    it('Should maintain synchronization between USD and ETH inputs', () => {
      // Wait for the API call to complete
      cy.wait('@getEthPrice')

      // Wait for the component to be ready
      cy.get('#usd-contribution-input').should('exist')

      // Type $100 in USD input
      cy.get('#usd-contribution-input').type('100')

      // Wait for the value to be updated
      cy.get('#eth-contribution-input').should('have.value', '0.050000')

      // Clear USD input
      cy.get('#usd-contribution-input').clear()

      // Wait for the value to be cleared
      cy.get('#eth-contribution-input').should('have.value', '')
    })
  })

  describe('Token Credit Claim', () => {
    beforeEach(() => {
      // Mock token credit to be greater than 0
      cy.window().then((win) => {
        win.useRead = () => ({ data: '2000000000000000000' }) // 2 tokens credit
      })

      // Update props to ensure token symbol exists
      props.token = {
        ...props.token,
        tokenSymbol: 'TEST',
        tokenName: 'Test Token',
        tokenAddress: CYPRESS_MISSION_TOKEN_ADDRESS,
        tokenSupply: '1000000000000000000', // 1 token
      }

      // Reload the component
      cy.mount(
        <TestnetProviders>
          <MissionPayRedeem {...props} />
        </TestnetProviders>
      )
    })

    it('Should not show claim button when no token credit is available', () => {
      // Mock token credit to be 0
      cy.window().then((win) => {
        win.useRead = () => ({ data: '0' })
      })

      // Reload the component
      cy.mount(
        <TestnetProviders>
          <MissionPayRedeem {...props} />
        </TestnetProviders>
      )

      // Verify claim button doesn't exist
      cy.get('#claim-button').should('not.exist')
    })
  })

  describe('Token Redemption', () => {
    beforeEach(() => {
      // Set stage to 3 and mock token balance
      props.subgraphData.volume = '1000000000000000000' // 1 ETH

      // Mock token balance to be greater than 0
      cy.window().then((win) => {
        win.useWatchTokenBalance = () => 5
      })

      cy.mount(
        <TestnetProviders>
          <MissionPayRedeem {...props} stage={3} />
        </TestnetProviders>
      )
    })

    it('Should not show redeem container when in stage 3 but no token balance', () => {
      // Mock token balance to be 0
      cy.window().then((win) => {
        win.useWatchTokenBalance = () => 0
      })

      cy.mount(
        <TestnetProviders>
          <MissionPayRedeem {...props} />
        </TestnetProviders>
      )

      cy.get('#mission-redeem-container').should('not.exist')
    })

    it('Should not show redeem container when not in stage 3', () => {
      cy.mount(
        <TestnetProviders>
          <MissionPayRedeem {...props} stage={1} />
        </TestnetProviders>
      )

      cy.get('#mission-redeem-container').should('not.exist')
    })
  })
})
