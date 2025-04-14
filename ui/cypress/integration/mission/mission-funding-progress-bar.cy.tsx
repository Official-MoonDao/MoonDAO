import TestnetProviders from '@/cypress/mock/TestnetProviders'
import MissionFundingProgressBar from '@/components/mission/MissionFundingProgressBar'

describe('<MissionFundingProgressBar />', () => {
  const defaultProps = {
    fundingGoal: 1000000000000000000, // 1 ETH in wei
    volume: 200000000000000000, // 0.2 ETH in wei
    stage: 1,
  }

  beforeEach(() => {
    cy.mountNextRouter('/')
  })

  it('Should render the progress bar with correct stage information', () => {
    cy.mount(
      <TestnetProviders>
        <MissionFundingProgressBar {...defaultProps} />
      </TestnetProviders>
    )

    cy.get('div').contains('Stage 1: Ignition').should('exist')
    cy.get('.relative.w-full.rounded-full').first().should('exist')
  })

  it('Should calculate and display correct progress percentage', () => {
    cy.mount(
      <TestnetProviders>
        <MissionFundingProgressBar {...defaultProps} />
      </TestnetProviders>
    )

    cy.get('.relative.w-full.rounded-full')
      .first()
      .within(() => {
        cy.get('.absolute.inset-0')
          .first()
          .within(() => {
            cy.get('.h-full.bg-gradient-to-l')
              .first()
              .should('have.attr', 'style')
              .and('include', 'width: 100%')
          })
      })
  })

  it('Should not render when stage is invalid', () => {
    cy.mount(
      <TestnetProviders>
        <MissionFundingProgressBar {...defaultProps} stage={0} />
      </TestnetProviders>
    )

    cy.get('div').contains('Stage 1: Ignition').should('not.exist')
  })

  it('Should render in compact mode when specified', () => {
    cy.mount(
      <TestnetProviders>
        <MissionFundingProgressBar {...defaultProps} compact={true} />
      </TestnetProviders>
    )

    cy.get('.mb-4').should('exist')
    cy.get('.mb-12').should('not.exist')
  })

  it('Should show funding goal indicator when stage 2 or 3 and progress >= 20%', () => {
    cy.mount(
      <TestnetProviders>
        <MissionFundingProgressBar {...defaultProps} stage={2} />
      </TestnetProviders>
    )

    cy.get('#funding-goal-indicator-container').should('exist')
    cy.get('#funding-goal-indicator').should('exist')
    cy.contains('Ignition Goal Achieved').should('exist')
  })

  it('Should show "Funding Goal Achieved" for stage 3', () => {
    cy.mount(
      <TestnetProviders>
        <MissionFundingProgressBar {...defaultProps} stage={3} />
      </TestnetProviders>
    )

    cy.contains('Funding Goal Achieved').should('exist')
  })
})
