import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { CYPRESS_CHAIN_V5 } from '@/cypress/mock/config'
import JuiceProviders from '@/lib/juicebox/JuiceProviders'
import MissionFundingMilestoneChart from '@/components/mission/MissionFundingMilestoneChart'

describe('MissionFundingMilestoneChart', () => {
  const mockSubgraphData = {
    volume: 1000000000000000000, // 1 ETH in wei
  }

  const defaultProps = {
    subgraphData: mockSubgraphData,
    fundingGoal: 5000000000000000000, // 5 ETH in wei
    height: 300,
    projectId: 0,
  }

  beforeEach(() => {
    cy.viewport(1000, 600)
    cy.mountNextRouter('/')
    cy.mount(
      <TestnetProviders>
        <JuiceProviders projectId={0} selectedChain={CYPRESS_CHAIN_V5}>
          <MissionFundingMilestoneChart {...defaultProps} />
        </JuiceProviders>
      </TestnetProviders>
    )
  })

  it('Renders with default props', () => {
    cy.get('.recharts-wrapper').should('exist')
  })

  it('Displays the correct number of milestones', () => {
    cy.get('.recharts-line').should('exist')
    cy.get('.recharts-dot').should('have.length', 4) // 4 milestones
  })

  it('Shows tooltip on hover', () => {
    cy.get('.recharts-line').first().trigger('mouseover', { force: true })
    cy.get('.recharts-tooltip-wrapper').should('be.visible')
  })

  it('Displays correct milestone data in tooltip', () => {
    cy.get('.recharts-line').first().trigger('mouseover', { force: true })
    cy.get('.recharts-tooltip-wrapper').should('contain', 'Milestone')
    cy.get('.recharts-tooltip-wrapper').should('contain', 'ETH')
    cy.get('.recharts-tooltip-wrapper').should('contain', 'tokens/ETH')
  })

  it('Shows progress bar', () => {
    cy.get('#funding-progress').should('exist')
  })

  it('Handles zero volume correctly', () => {
    const zeroVolumeProps = {
      ...defaultProps,
      subgraphData: { volume: 0 },
    }
    cy.mount(
      <TestnetProviders>
        <JuiceProviders projectId={0} selectedChain={CYPRESS_CHAIN_V5}>
          <MissionFundingMilestoneChart {...zeroVolumeProps} />
        </JuiceProviders>
      </TestnetProviders>
    )
    cy.get('.recharts-wrapper').should('exist')
  })

  it('Handles undefined subgraphData', () => {
    const undefinedDataProps = {
      ...defaultProps,
      subgraphData: undefined,
    }
    cy.mount(
      <TestnetProviders>
        <JuiceProviders projectId={0} selectedChain={CYPRESS_CHAIN_V5}>
          <MissionFundingMilestoneChart {...undefinedDataProps} />
        </JuiceProviders>
      </TestnetProviders>
    )
    cy.get('.recharts-wrapper').should('exist')
  })
})
