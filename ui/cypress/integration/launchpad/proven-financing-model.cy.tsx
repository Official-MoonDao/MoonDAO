import ProvenFinancingModel from '@/components/launchpad/ProvenFinancingModel'

describe('<ProvenFinancingModel />', () => {
  beforeEach(() => {
    cy.mountNextRouter('/')
  })

  it('Renders section with four AchievementCard components', () => {
    cy.mount(<ProvenFinancingModel />)

    cy.contains('Proven Financing Model').should('be.visible')
  })
})
