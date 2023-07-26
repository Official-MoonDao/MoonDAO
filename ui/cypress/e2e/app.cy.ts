import common from '../../locales/en/common.json'

describe('MoonDAO App UI', () => {
  it('should load the index page', () => {
    console.log('')
    cy.visit('/')
    cy.get('h1').contains(common.indexTitle)
  })
  // it('should load the /lock page', () => {
  //   cy.visit('/lock')
  //   cy.get('h2').contains('Lock $MOONEY to get $vMOONEY')
  // })
})

export {}
