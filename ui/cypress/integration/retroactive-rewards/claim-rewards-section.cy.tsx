import { BigNumber } from 'ethers'
import React from 'react'
import ClaimRewardsSection from '../../../components/home/ClaimRewardsSection'
import TestnetProviders from '../../mock/TestnetProviders'

describe('<ClaimRewardsSection />', () => {
  it('should render with no rewards available', () => {
    cy.mount(
      <TestnetProviders>
        <ClaimRewardsSection />
      </TestnetProviders>
    )

    // Should render the component structure
    cy.get('.bg-white\\/5').should('exist')

    // Should show "Retroactive Rewards" title
    cy.contains('Retroactive Rewards').should('be.visible')

    // Should show "Check back end of quarter" message when no rewards
    cy.contains('Check back end of quarter').should('be.visible')

    // Should show 0.00 amount
    cy.contains('0.00').should('be.visible')

    // Should show "vMOONEY available" text
    cy.contains('vMOONEY available').should('be.visible')

    // Should show disabled "No Rewards" button
    cy.contains('No Rewards')
      .should('be.visible')
      .and('have.class', 'opacity-50')
      .and('have.class', 'cursor-not-allowed')
  })

  it('should render component structure correctly', () => {
    cy.mount(
      <TestnetProviders>
        <ClaimRewardsSection />
      </TestnetProviders>
    )

    // Should render the component
    cy.get('.bg-white\\/5').should('exist')

    // Should show "Retroactive Rewards" title
    cy.contains('Retroactive Rewards').should('be.visible')

    // Should show vMOONEY icon
    cy.get('img[alt="vMOONEY"]').should('exist')

    // Should show amount display area
    cy.get('.bg-black\\/20').should('exist')
  })

  it('should display proper text content', () => {
    cy.mount(
      <TestnetProviders>
        <ClaimRewardsSection />
      </TestnetProviders>
    )

    // Should show main title
    cy.contains('Retroactive Rewards').should('be.visible')

    // Should show either "Ready to claim" or "Check back end of quarter"
    cy.get('body').then(($body) => {
      const hasReadyToClaim =
        $body.find(':contains("Ready to claim")').length > 0
      const hasCheckBack =
        $body.find(':contains("Check back end of quarter")').length > 0

      expect(hasReadyToClaim || hasCheckBack).to.be.true
    })

    // Should show either "vMOONEY tokens" or "vMOONEY available"
    cy.get('body').then(($body) => {
      const hasTokens = $body.find(':contains("vMOONEY tokens")').length > 0
      const hasAvailable =
        $body.find(':contains("vMOONEY available")').length > 0

      expect(hasTokens || hasAvailable).to.be.true
    })
  })

  it('should handle different component states', () => {
    cy.mount(
      <TestnetProviders>
        <ClaimRewardsSection />
      </TestnetProviders>
    )

    // Should show either claim button or no rewards button
    cy.get('body').then(($body) => {
      const hasClaimButton =
        $body.find('button:contains("Claim Rewards")').length > 0
      const hasNoRewardsButton =
        $body.find(':contains("No Rewards")').length > 0

      expect(hasClaimButton || hasNoRewardsButton).to.be.true
    })

    // Should show some amount (either 0.00 or a positive amount)
    cy.get('.font-RobotoMono').should('exist').and('be.visible')
  })

  it('should render vMOONEY icon correctly', () => {
    cy.mount(
      <TestnetProviders>
        <ClaimRewardsSection />
      </TestnetProviders>
    )

    // Should show vMOONEY icon
    cy.get('img[alt="vMOONEY"]')
      .should('exist')
      .and('have.attr', 'src', '/assets/vmooney-shield.svg')
      .and('have.attr', 'width', '16')
      .and('have.attr', 'height', '16')
  })

  it('should have proper responsive layout', () => {
    cy.mount(
      <TestnetProviders>
        <ClaimRewardsSection />
      </TestnetProviders>
    )

    // Check that flex layout is applied correctly
    cy.get('.flex.items-center.gap-3').should('exist')

    // Check text center alignment for amount
    cy.get('.text-center').should('exist')

    // Check full width button styling
    cy.get('body').then(($body) => {
      if ($body.find('button').length > 0) {
        cy.get('button').should('have.class', 'w-full')
      } else {
        cy.get('.w-full').should('exist') // The disabled state div
      }
    })
  })

  it('should display amount with proper formatting', () => {
    cy.mount(
      <TestnetProviders>
        <ClaimRewardsSection />
      </TestnetProviders>
    )

    // Should show amount with RobotoMono font
    cy.get('.font-RobotoMono')
      .should('exist')
      .and('have.class', 'font-bold')
      .and('have.class', 'text-lg')

    // Amount should be visible and properly formatted
    cy.get('.font-RobotoMono').should('be.visible')
  })
})
