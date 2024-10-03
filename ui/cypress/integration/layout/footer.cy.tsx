import Footer from '@/components/layout/Footer'

describe('<Footer />', () => {
  beforeEach(() => {
    cy.mount(<Footer />)
  })

  it('Renders privacy policy and terms of service links', () => {
    // Check for Privacy Policy link
    cy.get('a[href="https://docs.moondao.com/Legal/Website-Privacy-Policy"]')
      .should('exist')
      .and('contain.text', 'Privacy Policy')
      .and('have.attr', 'target', '_blank')

    // Check for Terms of Service link
    cy.get(
      'a[href="https://docs.moondao.com/Legal/Website-Terms-and-Conditions"]'
    )
      .should('exist')
      .and('contain.text', 'Terms of Service')
      .and('have.attr', 'target', '_blank')
  })
})
