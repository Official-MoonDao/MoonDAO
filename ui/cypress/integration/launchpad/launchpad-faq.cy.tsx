import LaunchpadFAQ from '@/components/launchpad/LaunchpadFAQ'

describe('<LaunchpadFAQ />', () => {
  it('Renders FAQ section with header', () => {
    cy.mount(<LaunchpadFAQ />)

    cy.contains('Frequently Asked Questions').should('be.visible')
    cy.contains('Everything you need to know about launching').should('be.visible')
  })

  it('Displays LaunchpadFAQs component correctly', () => {
    cy.mount(<LaunchpadFAQ />)

    cy.get('section').should('have.class', 'min-h-screen')
  })

  it('Shows decorative background elements', () => {
    cy.mount(<LaunchpadFAQ />)

    cy.get('section').should('have.class', 'bg-gradient-to-b')
    cy.get('div').contains('rounded-full').should('exist')
  })

  it('Handles responsive layout', () => {
    cy.mount(<LaunchpadFAQ />)

    cy.get('section').should('have.class', 'min-h-screen')
    cy.get('div').contains('container').should('exist')
  })

  it('Has correct container structure', () => {
    cy.mount(<LaunchpadFAQ />)

    cy.get('div').contains('max-w-5xl').should('exist')
    cy.get('div').contains('backdrop-blur-sm').should('exist')
  })
})

