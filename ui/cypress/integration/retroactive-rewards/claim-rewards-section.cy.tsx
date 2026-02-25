import { BigNumber } from 'ethers'
import React from 'react'
import * as UseRetroactiveRewards from '@/lib/tokens/hooks/useRetroactiveRewards'
import ClaimRewardsSection from '../../../components/home/ClaimRewardsSection'
import TestnetProviders from '../../mock/TestnetProviders'

describe('<ClaimRewardsSection />', () => {
  beforeEach(() => {
    // Component returns null when no rewards - stub to return withdrawable > 0 so it renders
    const mockWithdraw = cy.stub().resolves()
    cy.stub(UseRetroactiveRewards, 'default').returns({
      withdrawable: BigNumber.from('1000000000000000000'), // 1.00 displayed
      withdraw: mockWithdraw,
    })
  })

  it('should render with rewards available', () => {
    cy.mount(
      <TestnetProviders>
        <ClaimRewardsSection />
      </TestnetProviders>
    )

    // Should render the component structure
    cy.get('.bg-white\\/5').should('exist')

    // Should show "Retroactive Rewards" title
    cy.contains('Retroactive Rewards').should('be.visible')

    // Should show "Ready to claim" message when rewards available
    cy.contains('Ready to claim').should('be.visible')

    // Should show formatted amount (1.00)
    cy.contains('1.00').should('be.visible')

    // Should show "vMOONEY tokens" text
    cy.contains('vMOONEY tokens').should('be.visible')

    // Should show "Claim Rewards" button
    cy.contains('Claim Rewards').should('be.visible')
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

    // Should show "Ready to claim" when rewards available
    cy.contains('Ready to claim').should('be.visible')

    // Should show "vMOONEY tokens"
    cy.contains('vMOONEY tokens').should('be.visible')
  })

  it('should handle component state with rewards', () => {
    cy.mount(
      <TestnetProviders>
        <ClaimRewardsSection />
      </TestnetProviders>
    )

    // Should show claim button
    cy.contains('Claim Rewards').should('exist')

    // Should show formatted amount
    cy.get('.font-RobotoMono').should('exist').and('be.visible')
  })

  it('should render vMOONEY icon correctly', () => {
    cy.mount(
      <TestnetProviders>
        <ClaimRewardsSection />
      </TestnetProviders>
    )

    // Should show vMOONEY icon
    cy.get('img[alt="vMOONEY"]').should('exist')
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
    cy.get('button').should('have.class', 'w-full')
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
