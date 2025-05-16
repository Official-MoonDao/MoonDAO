import '../support/commands'

describe('Mission E2E Testing', () => {
  it('Should allow team managers to create and manage a Mission', () => {
    // Skip test if running in CI
    if (Cypress.env('CI')) {
      cy.log('Skipping test in CI environment')
      return
    }

    cy.visit('/launch')
    cy.loginWithPrivy()

    // 1. Create a mission without a token
    cy.get('#launch-mission-button-1').click()

    // Fill in mission details
    cy.get('#mission-title').type('Test Mission')
    cy.get('#mission-tagline').type('Test Tagline')
    cy.get('#mission-website').type('https://test.com')
    cy.get('#mission-social').type('https://twitter.com/test')

    // Upload mission image
    cy.get('#mission-image').within(() => {
      cy.get('input[type="file"]').attachFile('mission-logo.png')
    })

    // Continue to next stage
    cy.get('#continue-button').click()

    // Set funding goal
    cy.get('#funding-goal-input').type('1000')

    cy.get('#continue-button').click()

    // Add mission description
    cy.get('#mission-details-stage').should('be.visible')

    cy.get('#mission-description-editor').should('exist')

    // Move to next stage
    cy.get('#continue-button').click()

    // Accept terms and launch mission
    cy.get('#terms-checkbox').click()

    cy.get('#launch-mission-button').should('be.enabled')
  })

  it('Should allow anyone to contribute to a Mission', () => {
    // Skip test if running in CI
    if (Cypress.env('CI')) {
      cy.log('Skipping test in CI environment')
      return
    }

    cy.visit('/mission/0')
    cy.wait(5000)
    cy.loginWithPrivy()

    cy.get('#usd-contribution-input').type('100')

    cy.get('#open-contribute-modal').click()

    cy.get('#contribute-button').should('be.disabled')

    cy.get('#contribution-terms-checkbox').click()

    cy.get('#contribute-button').should('be.enabled')

    cy.wait(5000)
  })

  it('Should allow managers to deploy a Mission Token', () => {
    // Skip test if running in CI
    if (Cypress.env('CI')) {
      cy.log('Skipping test in CI environment')
      return
    }

    cy.visit('/mission/12')
    cy.wait(5000)
    cy.loginWithPrivy()

    cy.contains('Deploy Token').click()
  })

  it('Should allow contributors to get a refund', () => {
    // Skip test if running in CI
    if (Cypress.env('CI')) {
      cy.log('Skipping test in CI environment')
      return
    }

    cy.visit('/mission/11')
    cy.wait(5000)
    cy.loginWithPrivy()

    cy.contains('Redeem').click()
  })
})

export {}
