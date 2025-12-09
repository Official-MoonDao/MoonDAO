import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { CYPRESS_CHAIN_V5 } from '@/cypress/mock/config'
import CreateCitizen from '@/components/onboarding/CreateCitizen'

describe('<CreateCitizen />', () => {
  let props: any

  beforeEach(() => {
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

  it('Should render the component', () => {
    cy.get('div').contains('Join The Network').should('exist')
  })

  it('Should complete citizen onboarding flow', () => {
    //DESIGN
    cy.contains('Create your unique and personalized AI passport photo.').should('exist')

    // Simulate image upload
    cy.get('input[type="file"]').attachFile('images/Original.png')

    // Click generate to start image generation
    cy.contains('Generate Image').click()

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
        cy.contains('Create your unique and personalized AI passport photo.').should('exist')
      }
    })
  })
})
