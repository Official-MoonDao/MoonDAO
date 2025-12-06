import PowerOfDecentralization from '@/components/launchpad/PowerOfDecentralization'

describe('<PowerOfDecentralization />', () => {
  beforeEach(() => {
    cy.mountNextRouter('/')
  })

  it('Renders section with six FeatureCard components', () => {
    cy.mount(<PowerOfDecentralization />)

    cy.contains('The Power of Decentralization').should('be.visible')
  })
})
