import Footer from '@/components/layout/Footer'

describe('<Footer />', () => {
  beforeEach(() => {
    cy.mount(<Footer />)
  })

  it('Renders privacy policy and terms of service links', () => {
    // Check for Privacy Policy link
    cy.get('a[href="/privacy-policy"]')
      .should('exist')
      .and('contain.text', 'Privacy Policy')

    // Check for Terms of Service link
    cy.get('a[href="/terms-of-service"]')
      .should('exist')
      .and('contain.text', 'Terms of Service')
  })
})
