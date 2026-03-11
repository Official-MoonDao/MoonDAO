import React from 'react'
import ClaimRewardsSection from '../../../components/home/ClaimRewardsSection'
import TestnetProviders from '../../mock/TestnetProviders'

describe('<ClaimRewardsSection />', () => {
  it('should not render when no rewards available', () => {
    cy.mount(
      <TestnetProviders>
        <div data-testid="wrapper">
          <ClaimRewardsSection />
        </div>
      </TestnetProviders>
    )

    // Component returns null when there are no rewards,
    // so the wrapper should be empty
    cy.get('[data-testid="wrapper"]')
      .should('exist')
      .children()
      .should('have.length', 0)
  })
})
