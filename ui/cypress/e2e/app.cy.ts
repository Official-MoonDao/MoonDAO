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
    })
  })

  describe('MoonDAO App | Lock', () => {
    it('should load the lock page', () => {
      cy.visit('/lock')
    })
  })

  describe('MoonDAO App | Network', () => {
    it('should load the directory page', () => {
      cy.visit('/network')
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

  describe('MoonDAO App | About', () => {
    it('should load the about page', () => {
      cy.visit('/about')
    })

    it('should have iframe that takes up full window dimensions', () => {
      cy.visit('/about')

      // Get the viewport dimensions
      cy.window().then((win) => {
        const viewportWidth = win.innerWidth
        const viewportHeight = win.innerHeight

        // Check iframe dimensions match viewport
        cy.get('iframe')
          .should('be.visible')
          .and(($iframe) => {
            const iframeWidth = $iframe[0].getBoundingClientRect().width
            const iframeHeight = $iframe[0].getBoundingClientRect().height

            // Allow for small rounding differences (1px tolerance)
            expect(Math.abs(iframeWidth - viewportWidth)).to.be.lessThan(2)
            expect(Math.abs(iframeHeight - viewportHeight)).to.be.lessThan(2)
          })
      })
    })
  })

  describe('MoonDAO App | News', () => {
    it('should load the news page', () => {
      cy.visit('/news')
    })

    it('should have iframe that takes up full window dimensions', () => {
      cy.visit('/news')

      // Get the viewport dimensions
      cy.window().then((win) => {
        const viewportWidth = win.innerWidth
        const viewportHeight = win.innerHeight

        // Check iframe dimensions match viewport
        cy.get('iframe')
          .should('be.visible')
          .and(($iframe) => {
            const iframeWidth = $iframe[0].getBoundingClientRect().width
            const iframeHeight = $iframe[0].getBoundingClientRect().height

            // Allow for small rounding differences (1px tolerance)
            expect(Math.abs(iframeWidth - viewportWidth)).to.be.lessThan(2)
            expect(Math.abs(iframeHeight - viewportHeight)).to.be.lessThan(2)
          })
      })
    })
  })
})

export {}
