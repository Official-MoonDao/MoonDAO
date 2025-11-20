import LaunchHero from '@/components/launchpad/LaunchHero'

describe('<LaunchHero />', () => {
  const defaultProps = {
    citizenHasAccess: true,
    onLaunchClick: cy.stub().as('onLaunchClick'),
  }

  it('Renders hero section with logo and heading', () => {
    cy.mount(<LaunchHero {...defaultProps} />)

    cy.contains('Launchpad').should('be.visible')
    cy.contains('Fund the future of space exploration').should('be.visible')
    cy.get('img[alt="MoonDAO"]').should('exist')
  })

  it('Shows launch button when citizenHasAccess is true', () => {
    cy.mount(<LaunchHero {...defaultProps} />)

    cy.contains('Launch Your Mission').should('be.visible')
  })

  it('Hides launch button when citizenHasAccess is false', () => {
    cy.mount(<LaunchHero {...defaultProps} citizenHasAccess={false} />)

    cy.contains('Launch Your Mission').should('not.exist')
  })

  it('Calls onLaunchClick when button is clicked', () => {
    cy.mount(<LaunchHero {...defaultProps} />)

    cy.contains('Launch Your Mission').click()
    cy.get('@onLaunchClick').should('have.been.calledOnce')
  })

  it('Scroll indicator exists and is clickable', () => {
    cy.mount(<LaunchHero {...defaultProps} />)

    cy.contains('Scroll to explore').should('be.visible')
    cy.get('svg').should('exist')
  })

  it('Handles responsive layout classes', () => {
    cy.mount(<LaunchHero {...defaultProps} />)

    cy.get('section').should('have.class', 'h-screen')
    cy.contains('Launchpad').should('have.class', 'text-2xl')
  })
})

