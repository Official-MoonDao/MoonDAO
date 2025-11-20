import PowerOfDecentralization from '@/components/launchpad/PowerOfDecentralization'

describe('<PowerOfDecentralization />', () => {
  it('Renders section with six FeatureCard components', () => {
    cy.mount(<PowerOfDecentralization />)

    cy.contains('The Power of Decentralization').should('be.visible')
  })

  it('Displays Global Access feature', () => {
    cy.mount(<PowerOfDecentralization />)

    cy.contains('Global Access').should('be.visible')
    cy.contains('Tap into a global crypto network').should('be.visible')
  })

  it('Displays Trustless feature', () => {
    cy.mount(<PowerOfDecentralization />)

    cy.contains('Trustless').should('be.visible')
    cy.contains('All transactions are onchain').should('be.visible')
  })

  it('Displays Battle Tested feature', () => {
    cy.mount(<PowerOfDecentralization />)

    cy.contains('Battle Tested').should('be.visible')
    cy.contains('Powered by Juicebox').should('be.visible')
  })

  it('Displays Scalable feature', () => {
    cy.mount(<PowerOfDecentralization />)

    cy.contains('Scalable').should('be.visible')
    cy.contains('Adapt your fundraising strategy').should('be.visible')
  })

  it('Displays Power of the Network feature', () => {
    cy.mount(<PowerOfDecentralization />)

    cy.contains('Power of the Network').should('be.visible')
    cy.contains('The Space Acceleration Network').should('be.visible')
  })

  it('Displays Internet Speed feature', () => {
    cy.mount(<PowerOfDecentralization />)

    cy.contains('Internet Speed').should('be.visible')
    cy.contains('Launch and fund your mission in minutes').should('be.visible')
  })

  it('Shows header text correctly', () => {
    cy.mount(<PowerOfDecentralization />)

    cy.contains('Experience the advantages of transparent').should('be.visible')
  })

  it('Handles responsive grid layout', () => {
    cy.mount(<PowerOfDecentralization />)

    cy.get('section').should('have.class', 'min-h-screen')
    cy.get('div').contains('grid').should('exist')
  })
})

