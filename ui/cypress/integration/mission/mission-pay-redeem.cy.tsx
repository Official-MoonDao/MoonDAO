import TestnetProviders from '@/cypress/mock/TestnetProviders'
import {
  CYPRESS_CHAIN_V5,
  CYPRESS_MISSION_PRIMARY_TERMINAL_ADDRESS,
  CYPRESS_MISSION_TOKEN_ADDRESS,
  cypressThirdwebClient,
} from '@/cypress/mock/config'
import MissionPayRedeem from '@/components/mission/MissionPayRedeem'

describe('<MissionPayRedeem />', () => {
  let props: any

  beforeEach(() => {
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
      },
      stage: 4,
      ruleset: [{}, {}],
      primaryTerminalAddress: CYPRESS_MISSION_PRIMARY_TERMINAL_ADDRESS,
      forwardClient: cypressThirdwebClient,
    }

    cy.mountNextRouter('/')
    cy.mount(
      <TestnetProviders>
        <MissionPayRedeem {...props} />
      </TestnetProviders>
    )
  })

  it('Should render the component with initial state', () => {
    cy.get('#mission-pay-redeem-container').should('exist')

    cy.get('#mission-pay-container').should('exist')
    cy.contains('Payments').should('exist')
    cy.contains('Total Raised').should('exist')
    cy.contains('Last 7 Days').should('exist')
  })

  it('Should handle payment input and output calculation', () => {
    cy.get('input[type="number"]').type('0.1')

    cy.contains('You receive').should('exist')
  })

  it('Should display payments count correctly', () => {
    cy.contains('10').should('exist')
  })

  it('Should display volume correctly', () => {
    cy.contains('1').should('exist')
  })
})
