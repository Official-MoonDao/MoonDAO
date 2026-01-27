import Moon from '@/components/globe/Moon'

describe('<Moon />', () => {
  it('Renders component with canvas', () => {
    cy.mount(<Moon />)

    // Wait for canvas to render (Globe component creates a canvas element)
    cy.get('canvas', { timeout: 15000 }).should('exist')
  })
})
