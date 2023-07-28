import common from '../../locales/en/common.json'

describe('E2E Testing', () => {
  //Home Page
  describe('MoonDAO App | Home', () => {
    it('should load the index page', () => {
      cy.visit('/')
      cy.get('#home-card').should('exist')
    })
  })

  //Lock page
  describe('MoonDAO App | Lock', () => {
    it('should load the lock page', () => {
      cy.visit('/lock')
      cy.get('h2').contains(common.lockCardTitle)
      cy.get('p').contains(common.lockTitle)
      cy.get('p').contains(common.lockDesc)
      cy.get('#gradient-link').contains(common.learnMore)
    })
  })

  //Lifeship page
  describe('MoonDAO App | Lifeship', () => {
    it('should load the lifeship page', () => {
      cy.visit('/lifeship')
      cy.get('h2').contains('LifeShip')
    })
  })
})

export {}
