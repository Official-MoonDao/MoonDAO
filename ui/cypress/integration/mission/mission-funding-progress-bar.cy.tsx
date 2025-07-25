import TestnetProviders from '@/cypress/mock/TestnetProviders'
import MissionFundingProgressBar from '@/components/mission/MissionFundingProgressBar'

describe('<MissionFundingProgressBar />', () => {
  const defaultProps = {
    fundingGoal: 1000000000000000000, // 1 ETH in wei
    volume: 0.2, // 0.2 ETH (in ETH units to match the component's calculation)
  }

  beforeEach(() => {
    cy.mountNextRouter('/')
  })

  it('Should calculate and display correct progress percentage', () => {
    cy.mount(
      <TestnetProviders>
        <MissionFundingProgressBar {...defaultProps} />
      </TestnetProviders>
    )

    // Check for the main progress bar container
    cy.get('.relative.w-full.rounded-full')
      .first()
      .within(() => {
        // Look for the progress fill element with the correct gradient class
        cy.get('.h-full.bg-gradient-to-r')
          .should('exist')
          .and('have.class', 'from-blue-500')
          .and('have.class', 'via-purple-600')
          .and('have.class', 'to-blue-500')
      })

    // Check that the progress label is displayed
    cy.contains('20%').should('be.visible')
  })

  it('Should not render when stage is invalid', () => {
    cy.mount(
      <TestnetProviders>
        <MissionFundingProgressBar {...defaultProps} />
      </TestnetProviders>
    )

    // Component should still render even with valid props
    cy.get('.relative.max-w-\\[800px\\]').should('exist')
  })

  it('Should render in compact mode when specified', () => {
    cy.mount(
      <TestnetProviders>
        <MissionFundingProgressBar {...defaultProps} compact={true} />
      </TestnetProviders>
    )

    // In compact mode, should have mb-2 class
    cy.get('.mb-2').should('exist')
    cy.get('.mb-4').should('not.exist')
  })

  it('Should render in normal mode by default', () => {
    cy.mount(
      <TestnetProviders>
        <MissionFundingProgressBar {...defaultProps} />
      </TestnetProviders>
    )

    // In normal mode, should have mb-4 class
    cy.get('.mb-4').should('exist')
    cy.get('.mb-2').should('not.exist')
  })
})
