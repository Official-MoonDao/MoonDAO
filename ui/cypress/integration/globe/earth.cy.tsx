import Earth from '@/components/globe/Earth'

describe('<Earth />', () => {
  it('Renders component', () => {
    cy.mount(<Earth pointsData={[]} />)
    cy.get('canvas').should('exist')
  })
})
