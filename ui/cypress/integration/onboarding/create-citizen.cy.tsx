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
    cy.contains(
      'Create your unique and personalized AI passport photo.'
    ).should('exist')
    // Simulate image upload
    cy.get('input[type="file"]').attachFile('images/Original.png')
    cy.contains('Generate').click()

    //TYPEFORM
    cy.contains('Please complete your citizen profile.').should('exist')
    cy.get('iframe').should('exist')
    cy.get('iframe').should('have.attr', 'src').should('include', 'typeform')
    cy.contains('NEXT').click()

    //MINT
    cy.get('#citizen-checkout-button').should('be.disabled')

    cy.get('input[type="checkbox"]').check()
    cy.get('input[type="checkbox"]').should('be.checked')

    cy.get('#citizen-checkout-button').should('not.be.disabled')
  })
})
