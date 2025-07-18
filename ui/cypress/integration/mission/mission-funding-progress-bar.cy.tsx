import TestnetProviders from '@/cypress/mock/TestnetProviders'
import MissionFundingProgressBar from '@/components/mission/MissionFundingProgressBar'

describe('<MissionFundingProgressBar />', () => {
  const defaultProps = {
    fundingGoal: 1000000000000000000, // 1 ETH in wei
    volume: 200000000000000000, // 0.2 ETH in wei
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
        <MissionFundingProgressBar {...defaultProps} />
      </TestnetProviders>
    )
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
})
