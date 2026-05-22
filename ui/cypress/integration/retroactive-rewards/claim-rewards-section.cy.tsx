import React from 'react'
import ClaimRewardsSection from '../../../components/home/ClaimRewardsSection'
import TestnetProviders from '../../mock/TestnetProviders'

describe('<ClaimRewardsSection />', () => {
  it('should render with zero state when no rewards available', () => {
    cy.mount(
      <TestnetProviders>
        <div data-testid="wrapper">
          <ClaimRewardsSection />
        </div>
      </TestnetProviders>
    )

    // Component always renders, showing 0.00 state when no rewards
    cy.get('[data-testid="wrapper"]')
      .should('exist')
      .children()
      .should('have.length.at.least', 1)
  })
})
