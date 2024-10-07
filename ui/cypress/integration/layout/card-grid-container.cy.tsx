import CardGridContainer from '@/components/layout/CardGridContainer'

describe('CardGridContainer', () => {
  it('Renders children correctly', () => {
    cy.mount(
      <CardGridContainer>
        <div data-testid="child1">Child 1</div>
        <div data-testid="child2">Child 2</div>
      </CardGridContainer>
    )

    cy.get('#card-grid-container').should('exist')
    cy.get('[data-testid="child1"]').should('exist')
    cy.get('[data-testid="child2"]').should('exist')
  })
})
