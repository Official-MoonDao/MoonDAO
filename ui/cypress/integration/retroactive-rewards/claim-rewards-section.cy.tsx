import React from 'react'
import * as UseRetroactiveRewards from '@/lib/tokens/hooks/useRetroactiveRewards'
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

  it('should not render when no rewards available', () => {
    cy.stub(UseRetroactiveRewards, 'default').returns({
      withdrawable: BigNumber.from(0),
      withdraw: cy.stub().resolves(),
    })

    cy.mount(
      <TestnetProviders>
        <ClaimRewardsSection />
      </TestnetProviders>
    )

    // Component returns null when no rewards - Retroactive Rewards section should not be visible
    cy.contains('Retroactive Rewards').should('not.exist')
  })
})
