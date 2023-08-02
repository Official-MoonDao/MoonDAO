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
      cy.get('h1').contains(common.lockCardTitle)
      cy.get('p').contains(common.lockTitle)
      cy.get('p').contains(common.lockDesc)
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

  describe('MoonDAO App | Announcements', () => {
    it('should load the announcements page', () => {
      cy.visit('/dashboard/announcements')
      cy.get('#dashboard-announcements').should('exist')
    })
  })

  describe('MoonDAO App | Proposals', () => {
    it('should load the proposals page', () => {
      cy.visit('/dashboard/proposals')
      cy.get('#dashboard-proposals').should('exist')
    })
  })

  describe('MoonDAO App | Analytics', () => {
    it('should load the analytics-vmooney page', () => {
      cy.visit('/dashboard/analytics')
    })
  })

  describe('MoonDAO App | Calendar', () => {
    it('should load the calendar page', () => {
      cy.visit('/dashboard/calendar')
      cy.get('h1').contains(common.calendarTitle)
      cy.get('p').contains(common.calendarDesc)
      cy.get('#dashboard-calendar').should('exist')
    })
  })
})

export {}
