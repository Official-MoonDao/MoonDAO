import GetStartedToday from '@/components/launchpad/GetStartedToday'

describe('<GetStartedToday />', () => {
  const defaultProps = {
    citizenHasAccess: true,
    onLaunchClick: cy.stub().as('onLaunchClick'),
  }

  it('Renders section with logo and heading', () => {
    cy.mount(<GetStartedToday {...defaultProps} />)

    cy.contains('Get Started Today').should('be.visible')
    cy.get('img[alt="MoonDAO Logo"]').should('exist')
  })

  it('Shows launch button when citizenHasAccess is true', () => {
    cy.mount(<GetStartedToday {...defaultProps} />)

    cy.contains('Launch Your Mission').should('be.visible')
  })

  it('Hides launch button when citizenHasAccess is false', () => {
    cy.mount(<GetStartedToday {...defaultProps} citizenHasAccess={false} />)

    cy.contains('Launch Your Mission').should('not.exist')
  })

  it('Calls onLaunchClick when button is clicked', () => {
    cy.mount(<GetStartedToday {...defaultProps} />)

    cy.get('#launch-mission-button-3').click()
    cy.get('@onLaunchClick').should('have.been.calledOnce')
  })

  it('Displays correct text content', () => {
    cy.mount(<GetStartedToday {...defaultProps} />)

    cy.contains('The next great space mission starts here').should('be.visible')
    cy.contains('Join the decentralized space race').should('be.visible')
  })

  it('Handles responsive layout', () => {
    cy.mount(<GetStartedToday {...defaultProps} />)

    cy.get('section').should('have.class', 'min-h-screen')
  })
})

