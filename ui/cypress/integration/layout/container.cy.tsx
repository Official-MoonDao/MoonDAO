import Container from '@/components/layout/Container'

describe('Container', () => {
  it('Renders children correctly', () => {
    cy.mountNextRouter('/')
    cy.mount(
      <Container>
        <div data-testid="child">Test Child</div>
      </Container>
    )

    cy.get('#content-container-section').should('exist')
    cy.get('[data-testid="child"]').should('exist').and('contain', 'Test Child')
  })
})
