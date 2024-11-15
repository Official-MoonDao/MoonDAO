import Moon from '@/components/globe/Moon'

describe('<Moon />', () => {
  it('Renders component', () => {
    cy.mount(<Moon />)
    cy.get('canvas').should('exist')
  })
})
