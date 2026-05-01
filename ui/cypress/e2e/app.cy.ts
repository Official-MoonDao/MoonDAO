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
      cy.visit('/treasury', { timeout: 60000 })
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
          const vw = Cypress.config('viewportWidth')
          const vh = Cypress.config('viewportHeight')

          // BrowserStack / Firefox / WebKit / Chrome differ on sub-pixel layout and chrome; keep checks meaningful but tolerant.
          expect(rect.top).to.be.closeTo(0, 60)
          expect(rect.left).to.be.closeTo(0, 60)
          expect(rect.width).to.be.closeTo(vw, 160)
          expect(rect.height).to.be.closeTo(vh, 120)
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
          const vw = Cypress.config('viewportWidth')
          const vh = Cypress.config('viewportHeight')

          expect(rect.top).to.be.closeTo(0, 60)
          expect(rect.left).to.be.closeTo(0, 60)
          expect(rect.width).to.be.closeTo(vw, 160)
          expect(rect.height).to.be.closeTo(vh, 120)
        })
    })
  })

  describe('MoonDAO App | Town Hall', () => {
    it('should load the townhall page', () => {
      cy.visit('/townhall', { timeout: 60000 })
    })

    it('should have search functionality', () => {
      cy.visit('/townhall', { timeout: 60000 })
      
      cy.get('input[name="search"]').should('exist')
      cy.get('input[name="search"]').should('be.visible')
    })

    it('should display summaries list', () => {
      cy.visit('/townhall', { timeout: 60000 })
      
      cy.get('div').should('exist')
    })

    it('should have info banner at bottom', () => {
      cy.visit('/townhall', { timeout: 60000 })
      
      cy.contains('improving our AI summaries').should('exist')
    })
  })

  describe('MoonDAO App | Launch', () => {
    it('should load the launch page with non-empty mission data', () => {
      // Regression: a refactor in `lib/launchpad/fetchMissions.ts` shipped with
      // `abi: {} as any` for the mission table contract, which made every
      // `getTableName` call throw "Could not resolve method", silently
      // returning an empty mission list.  When that was fixed, a second
      // regression surfaced: `fetchFeaturedMission.ts` returned `_deadline`
      // and `_refundPeriod` as `undefined`, which Next.js refuses to
      // serialize through getStaticProps and which 500's the page.  This
      // test guards both: the launch page must respond 200 AND ship a
      // non-empty `missions` array on `__NEXT_DATA__.props.pageProps`.
      cy.visit('/launch', { timeout: 60000 })
      cy.window().then((win) => {
        const nextData = (win as any).__NEXT_DATA__
        expect(nextData, '__NEXT_DATA__ should be present on /launch').to
          .exist
        const props = nextData && nextData.props ? nextData.props : {}
        const pageProps = props.pageProps || {}
        const missions = pageProps.missions
        expect(missions, 'missions should be an array').to.be.an('array')
        expect(
          missions.length,
          'missions array should not be empty — fetchMissions is failing ' +
            'on the server'
        ).to.be.greaterThan(0)
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

        expect(citizensData).to.be.an('array')
        expect(citizensData.length).to.be.greaterThan(0)

        const antarcticaLocations = citizensData.filter(
          (location: any) => location.formattedAddress === 'Antarctica'
        )
        expect(antarcticaLocations.length).to.be.lessThan(citizensData.length)

        const validLocations = citizensData.filter(
          (location: any) => !(location.lat === -90 && location.lng === 0)
        )
        expect(validLocations.length).to.be.greaterThan(0)

        citizensData.forEach((location: any) => {
          // Check required properties
          expect(location).to.have.property('citizens').that.is.an('array')
          expect(location).to.have.property('names').that.is.an('array')
          expect(location).to.have.property('formattedAddress').that.is.a('string')
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
            expect(location.size).to.equal(Math.min(location.citizens.length * 0.01, 0.4))
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
