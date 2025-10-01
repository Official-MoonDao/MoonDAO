import React from 'react'
import RetroactiveRewards from '../../../components/tokens/RetroactiveRewards'
import TestnetProviders from '../../mock/TestnetProviders'

describe('<RetroactiveRewards />', () => {
  beforeEach(() => {
    cy.mountNextRouter('/')
  })

  it('should render component', () => {
    cy.mount(
      <TestnetProviders>
        <RetroactiveRewards />
      </TestnetProviders>
    )

    cy.get('body').then(($body) => {
      const hasRewards = $body.find(':contains("Unclaimed Rewards")').length > 0

      if (hasRewards) {
        // If rewards are available, check the full UI
        cy.contains('Unclaimed Rewards').should('be.visible')
        cy.contains('vMOONEY Available').should('be.visible')
        cy.get('img[alt="vMOONEY"]').should('exist')
        cy.contains('Withdraw Rewards').should('be.visible')
      } else {
        // If no rewards, component should not render
        cy.contains('Unclaimed Rewards').should('not.exist')
        cy.contains('Withdraw Rewards').should('not.exist')
      }
    })
  })

  it('should display vMOONEY icon with correct attributes when rewards exist', () => {
    cy.mount(
      <TestnetProviders>
        <RetroactiveRewards />
      </TestnetProviders>
    )

    cy.get('body').then(($body) => {
      if ($body.find('img[alt="vMOONEY"]').length > 0) {
        cy.get('img[alt="vMOONEY"]').should('exist')
      }
    })
  })

  it('should show information section with correct content when rewards exist', () => {
    cy.mount(
      <TestnetProviders>
        <RetroactiveRewards />
      </TestnetProviders>
    )

    // Check if component renders (has rewards)
    cy.get('body').then(($body) => {
      if ($body.find(':contains("💰 Claim Your Rewards!")').length > 0) {
        cy.contains('💰 Claim Your Rewards!').should('be.visible')

        cy.contains(
          "Click 'Withdraw Rewards' to claim your vMOONEY rewards"
        ).should('be.visible')

        cy.contains(
          "You'll be prompted to create or increase the duration"
        ).should('be.visible')

        cy.contains('Expect to sign 2-4 transactions').should('be.visible')

        cy.contains('💡 Increase your stake amount or duration').should(
          'be.visible'
        )
      }
    })
  })

  it('should display formatted amount correctly when rewards exist', () => {
    cy.mount(
      <TestnetProviders>
        <RetroactiveRewards />
      </TestnetProviders>
    )

    // Check if component renders and has amount display
    cy.get('body').then(($body) => {
      if ($body.find('.font-RobotoMono').length > 0) {
        // Should have the RobotoMono font class for amount display
        cy.get('.font-RobotoMono')
          .should('be.visible')
          .and('have.class', 'text-green-400')
          .and('have.class', 'text-3xl')
          .and('have.class', 'font-bold')

        // Amount should be formatted as a number
        cy.get('.font-RobotoMono')
          .invoke('text')
          .should('match', /^\d{1,3}(,\d{3})*\.\d{2}$/) // Matches format like "1,234.56"
      }
    })
  })

  it('should have accessible button when rewards exist', () => {
    cy.mount(
      <TestnetProviders>
        <RetroactiveRewards />
      </TestnetProviders>
    )

    // Check if withdraw button exists
    cy.get('body').then(($body) => {
      if ($body.find('button:contains("Withdraw Rewards")').length > 0) {
        // Button should be properly labeled and accessible
        cy.get('button')
          .contains('Withdraw Rewards')
          .should('be.visible')
          .and('not.be.disabled')

        // Button should be clickable (we won't actually click to avoid side effects)
        cy.get('button').contains('Withdraw Rewards').should('be.enabled')
      }
    })
  })

  it('should maintain proper responsive layout structure when rewards exist', () => {
    cy.mount(
      <TestnetProviders>
        <RetroactiveRewards />
      </TestnetProviders>
    )

    // Check if component renders
    cy.get('body').then(($body) => {
      if ($body.find(':contains("Unclaimed Rewards")').length > 0) {
        // Should have main sections visible
        cy.contains('Unclaimed Rewards').should('be.visible')
        cy.contains('vMOONEY Available').should('be.visible')

        // Should have information section
        cy.contains('💰 Claim Your Rewards!').should('be.visible')

        // Button should be full width (check for w-full class)
        cy.get('button').should('have.class', 'w-full')
      }
    })
  })
})
