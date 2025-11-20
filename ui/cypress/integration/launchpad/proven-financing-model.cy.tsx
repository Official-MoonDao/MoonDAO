import ProvenFinancingModel from '@/components/launchpad/ProvenFinancingModel'

describe('<ProvenFinancingModel />', () => {
  it('Renders section with four AchievementCard components', () => {
    cy.mount(<ProvenFinancingModel />)

    cy.contains('Proven Financing Model').should('be.visible')
  })

  it('Displays $8 Million achievement', () => {
    cy.mount(<ProvenFinancingModel />)

    cy.contains('$8').should('be.visible')
    cy.contains('Million').should('be.visible')
    cy.contains('Dollars raised through decentralized funding').should('be.visible')
  })

  it('Displays 12,000 holders achievement', () => {
    cy.mount(<ProvenFinancingModel />)

    cy.contains('12,000').should('be.visible')
    cy.contains('holders').should('be.visible')
    cy.contains('$MOONEY token holders').should('be.visible')
  })

  it('Displays 80 Projects achievement', () => {
    cy.mount(<ProvenFinancingModel />)

    cy.contains('80').should('be.visible')
    cy.contains('Projects').should('be.visible')
    cy.contains('Successfully funded and launched').should('be.visible')
  })

  it('Displays 2 People achievement', () => {
    cy.mount(<ProvenFinancingModel />)

    cy.contains('2').should('be.visible')
    cy.contains('People').should('be.visible')
    cy.contains('Successfully sent to space').should('be.visible')
  })

  it('Shows bottom text correctly', () => {
    cy.mount(<ProvenFinancingModel />)

    cy.contains("MoonDAO's journey from concept to space").should('be.visible')
    cy.contains('We raised millions').should('be.visible')
  })

  it('Handles responsive grid layout', () => {
    cy.mount(<ProvenFinancingModel />)

    cy.get('section').should('have.class', 'min-h-screen')
    cy.get('div').contains('grid').should('exist')
  })
})

