import GoFurtherTogether from '@/components/launchpad/GoFurtherTogether'

describe('<GoFurtherTogether />', () => {
  it('Renders section with three BenefitCard components', () => {
    cy.mount(<GoFurtherTogether />)

    cy.contains('Go Further Together').should('be.visible')
  })

  it('Displays correct content for Finance card', () => {
    cy.mount(<GoFurtherTogether />)

    cy.contains('Finance').should('be.visible')
    cy.contains('Fund with your debit card').should('be.visible')
  })

  it('Displays correct content for Coordinate card', () => {
    cy.mount(<GoFurtherTogether />)

    cy.contains('Coordinate').should('be.visible')
    cy.contains('Contributions earn mission tokens').should('be.visible')
  })

  it('Displays correct content for Verify card', () => {
    cy.mount(<GoFurtherTogether />)

    cy.contains('Verify').should('be.visible')
    cy.contains('Secured by code, not promises').should('be.visible')
  })

  it('Shows bottom text correctly', () => {
    cy.mount(<GoFurtherTogether />)

    cy.contains('Join a revolution in space funding').should('be.visible')
    cy.contains('immediately coordinate governance').should('be.visible')
  })

  it('Handles responsive grid layout', () => {
    cy.mount(<GoFurtherTogether />)

    cy.get('section').should('have.class', 'min-h-screen')
    cy.get('div').contains('grid').should('exist')
  })
})

