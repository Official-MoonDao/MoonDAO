import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { CYPRESS_CHAIN_V5 } from '@/cypress/mock/config'
import CreateCitizen from '@/components/onboarding/CreateCitizen'

describe('<CreateCitizen />', () => {
  let props: any

  beforeEach(() => {
    // The creation flow is gated behind a sign-in guard, so simulate a
    // connected wallet for the happy-path tests.
    ;(window as any).__CYPRESS_MOCK_ADDRESS__ = '0x1234567890abcdef'
    props = {
      address: '0x1234567890abcdef',
      selectedChain: CYPRESS_CHAIN_V5,
      setSelectedTier: cy.stub(),
    }
    cy.mountNextRouter('/')
    cy.mount(
      <TestnetProviders>
        <CreateCitizen {...props} />
      </TestnetProviders>
    )
  })

  afterEach(() => {
    ;(window as any).__CYPRESS_MOCK_ADDRESS__ = undefined
  })

  it('Should render the component', () => {
    cy.get('div').contains('Join The Network').should('exist')
  })

  it('Should block the flow with a sign-in guard when not signed in', () => {
    ;(window as any).__CYPRESS_MOCK_ADDRESS__ = undefined
    cy.mount(
      <TestnetProviders>
        <CreateCitizen {...props} />
      </TestnetProviders>
    )
    cy.contains('Sign In to Continue').should('exist')
    cy.get('#citizen-signin-button').should('exist')
    // Design-stage content must not render until signed in.
    cy.contains('Upload a photo with a clear face').should('not.exist')
  })

  it('Should complete citizen onboarding flow', () => {
    //DESIGN
    cy.contains('Upload a photo with a clear face').should('exist')

    // Simulate image upload
    cy.get('input[type="file"]').attachFile('images/Original.png')

    // Click generate to start image generation
    cy.contains('Generate AI Photo').click({ force: true })

    // Click Next to advance to the typeform stage (only available in dev mode)
    cy.get('body').then(($body) => {
      if ($body.find('#citizen-next-button').length > 0) {
        cy.get('#citizen-next-button').click()

        //TYPEFORM
        cy.get('iframe', { timeout: 10000 }).should('exist')
        cy.get('iframe').should('have.attr', 'src').and('include', 'typeform')

        // Check if next button still exists before clicking
        cy.get('#citizen-next-button', { timeout: 5000 })
          .should('exist')
          .then(() => {
            cy.get('#citizen-next-button').click()

            //MINT
            cy.get('#citizen-checkout-button', { timeout: 5000 }).should('be.disabled')

            cy.get('input[type="checkbox"]').first().check()
            cy.get('input[type="checkbox"]').first().should('be.checked')

            cy.get('#citizen-checkout-button').should('not.be.disabled')
          })
      } else {
        // If buttons don't exist (not in dev mode), verify component still renders
        cy.get('input[type="file"]').should('exist')
        cy.contains('Upload a photo with a clear face').should('exist')
      }
    })
  })
})
