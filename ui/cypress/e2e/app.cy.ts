//MAIN
describe('Main E2E Testing', () => {
  describe('MoonDAO App Layout', () => {
    it('should load the layout', () => {
      cy.visit('/', { timeout: 60000 })
      cy.get('#app-layout').should('exist')
    })
  })

  describe('MoonDAO App | Home', () => {
    it('should load the home page', () => {
      cy.visit('/', { timeout: 60000 })
    })
  })

  describe('MoonDAO App | Governance', () => {
    it('should load the governance page', () => {
      cy.visit('/governance', { timeout: 60000 })
    })
  })

  describe('MoonDAO App | Lock', () => {
    it('should load the lock page', () => {
      cy.visit('/lock', { timeout: 60000 })
    })
  })

  describe('MoonDAO App | Network', () => {
    it('should load the directory page', () => {
      cy.visit('/network', { timeout: 60000 })
    })
  })

  describe('MoonDAO App | Analytics', () => {
    it('should load the analytics page', () => {
      cy.visit('/analytics', { timeout: 60000 })
    })
  })

  describe('MoonDAO App | Events', () => {
    it('should load the events page', () => {
      cy.visit('/events', { timeout: 60000 })
    })
  })

  describe('MoonDAO App | Lifeship', () => {
    it('should load the lifeship page', () => {
      cy.visit('/lifeship', { timeout: 60000 })
    })
  })

  describe('MoonDAO App | Zero-G', () => {
    it('should load the zero-g page', () => {
      cy.visit('/zero-g', { timeout: 60000 })
    })
  })

  describe('MoonDAO App | About', () => {
    it('should have iframe that covers the viewport', () => {
      cy.visit('/about', { timeout: 60000 })

      // Check iframe is visible and positioned correctly
      cy.get('iframe', { timeout: 60000 })
        .should('be.visible')
        .and(($iframe) => {
          const iframe = $iframe[0]
          const rect = iframe.getBoundingClientRect()

          // Verify iframe is positioned at top-left
          expect(rect.top).to.equal(0)
          expect(rect.left).to.equal(0)

          // Verify iframe has full width (allow for scrollbars/browser chrome)
          expect(rect.width).to.be.closeTo(Cypress.config('viewportWidth'), 50)

          // Verify iframe has viewport height
          // Allow for small differences due to browser rendering
          expect(rect.height).to.be.closeTo(
            Cypress.config('viewportHeight'),
            15
          )
        })
    })
  })

  describe('MoonDAO App | News', () => {
    it('should load the news page', () => {
      cy.visit('/news', { timeout: 60000 })
    })

    it('should have iframe that covers the viewport', () => {
      cy.visit('/news', { timeout: 60000 })

      // Check iframe is visible and positioned correctly
      cy.get('iframe')
        .should('be.visible')
        .and(($iframe) => {
          const iframe = $iframe[0]
          const rect = iframe.getBoundingClientRect()

          // Verify iframe is positioned at top-left
          expect(rect.top).to.equal(0)
          expect(rect.left).to.equal(0)

          // Verify iframe has full width (allow for scrollbars/browser chrome)
          expect(rect.width).to.be.closeTo(Cypress.config('viewportWidth'), 50)

          // Verify iframe has viewport height (100vh)
          // Allow for small differences due to browser rendering
          expect(rect.height).to.be.closeTo(
            Cypress.config('viewportHeight'),
            15
          )
        })
    })
  })

  describe('MoonDAO App | Map', () => {
    it('should load the map page', () => {
      cy.visit('/map', { timeout: 60000 })
    })

    it('should have citizen locations with correct data structure and not all in Antarctica', () => {
      cy.visit('/map')
      cy.window().then((win) => {
        const nextData = (win as any).__NEXT_DATA__
        const citizensData = nextData.props.pageProps.citizensLocationData

        // Verify we have some data
        expect(citizensData).to.be.an('array')
        expect(citizensData.length).to.be.greaterThan(0)

        // Check that not all locations are Antarctica
        const antarcticaLocations = citizensData.filter(
          (location: any) => location.formattedAddress === 'Antarctica'
        )
        expect(antarcticaLocations.length).to.be.lessThan(citizensData.length)

        // Verify we have some valid coordinates
        const validLocations = citizensData.filter(
          (location: any) => location.lat !== -90 && location.lng !== 0
        )
        expect(validLocations.length).to.be.greaterThan(0)

        // Verify the data structure matches what Earth.tsx expects
        citizensData.forEach((location: any) => {
          // Check required properties
          expect(location).to.have.property('citizens').that.is.an('array')
          expect(location).to.have.property('names').that.is.an('array')
          expect(location)
            .to.have.property('formattedAddress')
            .that.is.a('string')
          expect(location).to.have.property('lat').that.is.a('number')
          expect(location).to.have.property('lng').that.is.a('number')
          expect(location).to.have.property('color').that.is.a('string')
          expect(location).to.have.property('size').that.is.a('number')

          // Verify color values match the logic in map.tsx
          if (location.citizens.length > 3) {
            expect(location.color).to.equal('#6a3d79')
          } else if (location.citizens.length > 1) {
            expect(location.color).to.equal('#5e4dbf')
          } else {
            expect(location.color).to.equal('#5556eb')
          }

          // Verify size values match the logic in map.tsx
          if (location.citizens.length > 1) {
            expect(location.size).to.equal(
              Math.min(location.citizens.length * 0.01, 0.4)
            )
          } else {
            expect(location.size).to.equal(0.01)
          }

          // Verify each citizen in the citizens array has required properties
          location.citizens.forEach((citizen: any) => {
            expect(citizen).to.have.property('id')
            expect(citizen).to.have.property('name')
            expect(citizen).to.have.property('image')
          })
        })
      })
    })
  })
})

export {}
