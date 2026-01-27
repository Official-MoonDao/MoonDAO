import Earth from '@/components/globe/Earth'

describe('<Earth />', () => {
  it('Renders component', () => {
    cy.mount(<Earth pointsData={[]} />)
    // WebGL/Three.js canvas creation is async - needs time to initialize context and load textures
    cy.get('canvas', { timeout: 10000 }).should('exist').and('be.visible')
  })
})
