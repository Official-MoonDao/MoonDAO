import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { CYPRESS_CHAIN_V5 } from '@/cypress/mock/config'
import CreateMission from '@/components/mission/CreateMission'

describe('<CreateMission />', () => {
  let props: any

  beforeEach(() => {
    props = {
      selectedChain: CYPRESS_CHAIN_V5,
      missionCreatorContract: {},
      hatsContract: {},
      teamContract: {},
      setStatus: cy.stub(),
      userTeamsAsManager: [
        {
          teamId: 1,
          metadata: {
            name: 'Test Team',
          },
        },
      ],
    }
    cy.mountNextRouter('/')
    cy.mount(
      <TestnetProviders citizen={{ id: 1 }}>
        <CreateMission {...props} />
      </TestnetProviders>
    )
  })

  it('Should render the component', () => {
    cy.contains('Launch A Mission').should('exist')
  })

  it('Should progress through stages', () => {
    // STAGE 0 - Mission Overview
    cy.get('#mission-overview-stage').should('be.visible')

    // Fill in mission details
    cy.get('#mission-title').type('Test Mission')
    cy.get('#mission-tagline').type('Test Tagline')
    cy.get('#mission-website').type('https://test.com')
    cy.get('#mission-social').type('https://twitter.com/test')

    // Upload mission image
    cy.get('#mission-image').attachFile('images/Original.png')

    // Move to next stage
    cy.get('#continue-button').click({ force: true })

    // STAGE 1 - Mission Goals - wait for stage and input to be ready
    cy.get('#mission-goals-stage').should('be.visible')

    // Wait for the funding goal input to appear - try by placeholder since id might not work
    cy.get('input[placeholder="Enter a goal in USD"]', { timeout: 10000 })
      .should('exist')
      .should('be.visible')
      .should('not.be.disabled')
      .clear({ force: true })
      .type('1000', { force: true })

    // Configure token
    cy.get('#mission-token-toggle').within(() => {
      cy.contains('Yes').click()
    })

    // Fill in token details
    cy.get('#mission-token-name').type('Test Token')
    cy.get('#mission-token-symbol').type('TEST')

    // Move to next stage
    cy.get('#continue-button').click()

    // STAGE 2 - Mission Details
    cy.get('#mission-details-stage').should('be.visible')

    // Check if editor exists and type description
    cy.get('#mission-description-editor').should('exist')
    cy.get('#mission-description-editor').type('Test Description')

    // Move to next stage
    cy.get('#continue-button').click()

    // STAGE 3 - Confirmation
    cy.get('#mission-confirmation-stage').should('be.visible')

    // Accept terms
    cy.get('#terms-checkbox').check()
    cy.get('#token-security-checkbox').check()

    // Launch button should be enabled
    cy.get('#launch-mission-button').should('exist')
    cy.get('#launch-mission-button').should('not.be.disabled')
  })

  it('Should allow navigation between stages', () => {
    // Go to next stage
    cy.get('#mission-title').type('Test Mission')
    cy.get('#mission-image').attachFile('images/Original.png')
    cy.get('#continue-button').click()

    // Verify we're on the goals stage
    cy.get('#mission-goals-stage').should('be.visible')

    // Go back
    cy.get('#back-button').should('be.visible').click()

    // Check if we're back at first stage
    cy.get('#mission-overview-stage').should('be.visible')

    // Check if data is preserved
    cy.get('#mission-title').should('have.value', 'Test Mission')
  })
})
