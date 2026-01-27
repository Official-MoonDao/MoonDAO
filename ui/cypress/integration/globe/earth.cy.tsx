import Earth from '@/components/globe/Earth'

describe('<Earth />', () => {
  it('Renders component with canvas', () => {
    cy.mount(<Earth pointsData={[]} />)

    // Wait for canvas to render (Globe component creates a canvas element)
    cy.get('canvas', { timeout: 15000 }).should('exist')
  })
})
