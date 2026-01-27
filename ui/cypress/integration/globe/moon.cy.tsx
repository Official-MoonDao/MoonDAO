import Moon from '@/components/globe/Moon'

describe('<Moon />', () => {
  it('Renders component', () => {
    cy.mount(<Moon />)
    // WebGL/Three.js canvas creation is async - needs time to initialize context and load textures
    cy.get('canvas', { timeout: 10000 }).should('exist').and('be.visible')
  })
})
