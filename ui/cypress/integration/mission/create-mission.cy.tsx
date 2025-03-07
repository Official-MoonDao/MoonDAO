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
      <TestnetProviders>
        <CreateMission {...props} />
      </TestnetProviders>
    )
  })

  it('Should render the component', () => {
    cy.get('#launch-mission-description').should('exist')
  })

  it('Should progress through stages', () => {
    // STAGE 0 - Mission Overview
    cy.get('#mission-overview-stage').should('exist')

    // Fill in mission details
    cy.get('#mission-title').type('Test Mission')
    cy.get('#mission-tagline').type('Test Tagline')
    cy.get('#mission-website').type('https://test.com')
    cy.get('#mission-social').type('https://twitter.com/test')

    // Upload mission image
    cy.get('#mission-image').attachFile('images/Original.png')

    // Move to next stage
    cy.get('#continue-button').click()

    // STAGE 1 - Mission Details
    cy.get('#mission-details-stage').should('exist')

    // Check if editor exists and type description
    cy.get('#mission-description-editor').should('exist')

    // Move to next stage
    cy.get('#continue-button').click()

    // STAGE 2 - Mission Goals
    cy.get('#fundraising-deadline-toggle').within(() => {
      cy.contains('Yes').click()
    })
    cy.get('#funding-goal-toggle').within(() => {
      cy.contains('Yes').click()
    })
    cy.get('#mission-token-toggle').within(() => {
      cy.contains('Yes').click()
    })

    // Fill in token details
    cy.get('#mission-token-name').type('Test Token')
    cy.get('#mission-token-symbol').type('TEST')

    // Move to next stage
    cy.get('#continue-button').click()

    // STAGE 3 - Confirmation
    cy.get('#mission-confirmation-stage').should('exist')

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

    // Go back
    cy.get('#back-button').click()

    // Check if we're back at first stage
    cy.get('#mission-overview-stage').should('exist')

    // Check if data is preserved
    cy.get('#mission-title').should('have.value', 'Test Mission')
  })
})
