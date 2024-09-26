import common from '../../locales/en/common.json'

//MAIN
describe('Main E2E Testing', () => {
  describe('MoonDAO App Layout', () => {
    it('should load the layout', () => {
      cy.visit('/')
      cy.get('#app-layout').should('exist')
    })
  })

  describe('MoonDAO App | Home', () => {
    it('should load the home page', () => {
      cy.visit('/')
    })
  })

  describe('MoonDAO App | Governance', () => {
    it('should load the governance page', () => {
      cy.visit('/governance')
      cy.get('#gov-cards').should('exist')
    })
  })

  describe('MoonDAO App | Lock', () => {
    it('should load the lock page', () => {
      cy.visit('/lock')
    })
  })

  describe('MoonDAO App | Directory', () => {
    it('should load the directory page', () => {
      cy.visit('/directory')
    })
  })

  describe('MoonDAO App | Analytics', () => {
    it('should load the analytics page', () => {
      cy.visit('/analytics')
    })
  })

  describe('MoonDAO App | Events', () => {
    it('should load the events page', () => {
      cy.visit('/events')
      cy.get('#scheduled-events').should('exist')
    })
  })

  describe('MoonDAO App | Lifeship', () => {
    it('should load the lifeship page', () => {
      cy.visit('/lifeship')
    })
  })

  describe('MoonDAO App | Zero-G', () => {
    it('should load the zero-g page', () => {
      cy.visit('/zero-g')
    })
  })
})

export {}
