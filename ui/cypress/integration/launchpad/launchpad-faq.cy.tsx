import LaunchpadFAQ from '@/components/launchpad/LaunchpadFAQ'

describe('<LaunchpadFAQ />', () => {
  it('Renders FAQ section with header', () => {
    cy.mount(<LaunchpadFAQ />)

    cy.contains('Frequently Asked Questions').should('be.visible')
    cy.contains('Everything you need to know about launching').should('be.visible')
  })
})
