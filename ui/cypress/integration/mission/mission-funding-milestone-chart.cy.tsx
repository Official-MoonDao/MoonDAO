import MissionFundingMilestoneChart from '@/components/mission/MissionFundingMilestoneChart'

describe('MissionFundingMilestoneChart', () => {
  const mockSubgraphData = {
    volume: 1000000000000000000, // 1 ETH in wei
  }

  const defaultProps = {
    subgraphData: mockSubgraphData,
    fundingGoal: 5000000000000000000, // 5 ETH in wei
    height: 300,
  }

  beforeEach(() => {
    cy.viewport(1000, 600)
  })

  it('Renders with default props', () => {
    cy.mount(<MissionFundingMilestoneChart {...defaultProps} />)
    cy.get('.recharts-wrapper').should('exist')
  })

  it('Displays the correct number of milestones', () => {
    cy.mount(<MissionFundingMilestoneChart {...defaultProps} />)
    cy.get('.recharts-line').should('exist')
    cy.get('.recharts-dot').should('have.length', 4) // 4 milestones
  })

  it('Shows tooltip on hover', () => {
    cy.mount(<MissionFundingMilestoneChart {...defaultProps} />)
    cy.get('.recharts-line').first().trigger('mouseover', { force: true })
    cy.get('.recharts-tooltip-wrapper').should('be.visible')
  })

  it('Displays correct milestone data in tooltip', () => {
    cy.mount(<MissionFundingMilestoneChart {...defaultProps} />)
    cy.get('.recharts-line').first().trigger('mouseover', { force: true })
    cy.get('.recharts-tooltip-wrapper').should('contain', 'Milestone')
    cy.get('.recharts-tooltip-wrapper').should('contain', 'ETH')
    cy.get('.recharts-tooltip-wrapper').should('contain', 'tokens/ETH')
  })

  it('Shows progress bar', () => {
    cy.mount(<MissionFundingMilestoneChart {...defaultProps} />)
    cy.get('#funding-progress').should('exist')
  })

  it('Handles zero volume correctly', () => {
    const zeroVolumeProps = {
      ...defaultProps,
      subgraphData: { volume: 0 },
    }
    cy.mount(<MissionFundingMilestoneChart {...zeroVolumeProps} />)
    cy.get('.recharts-wrapper').should('exist')
  })

  it('Handles undefined subgraphData', () => {
    const undefinedDataProps = {
      ...defaultProps,
      subgraphData: undefined,
    }
    cy.mount(<MissionFundingMilestoneChart {...undefinedDataProps} />)
    cy.get('.recharts-wrapper').should('exist')
  })
})
