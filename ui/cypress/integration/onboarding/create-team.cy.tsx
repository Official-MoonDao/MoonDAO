import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { CYPRESS_CHAIN_V5 } from '@/cypress/mock/config'
import CreateTeam from '@/components/onboarding/CreateTeam'

describe('<CreateTeam />', () => {
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
        <CreateTeam {...props} />
      </TestnetProviders>
    )
  })

  it('Should render the component', () => {
    cy.get('div').contains('Join The Network').should('exist')
  })

  it('Should complete team onboarding flow', () => {
    //DESIGN
    cy.contains(
      'Design your unique onchain registration by uploading your logo or image. For best results, use an image with a white or transparent background.'
    ).should('exist')
    // Simulate image upload
    cy.get('input[type="file"]').attachFile('images/Original.png')
    cy.contains('Next').click()

    //TYPEFORM
    cy.contains('Please complete your team profile.').should('exist')
    cy.get('iframe').should('exist')
    cy.get('iframe').should('have.attr', 'src').should('include', 'typeform')
    cy.contains('NEXT').click()

    //MINT
    cy.get('#team-checkout-button').should('be.disabled')

    cy.get('input[type="checkbox"]').check()
    cy.get('input[type="checkbox"]').should('be.checked')

    cy.get('#team-checkout-button').should('not.be.disabled')
  })
})
