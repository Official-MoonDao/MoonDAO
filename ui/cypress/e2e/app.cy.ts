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

  describe('MoonDAO App | Zero-G', () => {
    it('should load the zero-g page', () => {
      cy.visit('/zero-g')
      cy.get('h2').contains('Zero-G')
    })
  })

  describe('MoonDAO App | Analytics', () => {
    it('should load the analytics page', () => {
      cy.visit('/dashboard/analytics')
      cy.get('h1').contains(common.analyticsTitle)
      cy.get('p').contains(common.analyticsDesc)
    })
  })
})

export {}
