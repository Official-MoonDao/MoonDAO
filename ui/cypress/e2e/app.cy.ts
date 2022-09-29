describe('MoonDAO App UI', () => {

  it('should load the index page', () => {
    cy.visit('/')
    cy.get('h1').contains('Welcome to MoonDAO')
  }),

  it('should load the /lock page', () => {
    cy.visit('/lock')
    cy.get('h2').contains('Lock $MOONEY to get $vMOONEY')
  })
})

export {}
