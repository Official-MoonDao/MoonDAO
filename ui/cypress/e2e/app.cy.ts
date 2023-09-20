import common from '../../locales/en/common.json'

//MAIN
describe('Main E2E Testing', () => {
  describe('MoonDAO App Layout', () => {
    it('should load the layout', () => {
      cy.visit('/')
      cy.get('#app-layout').should('exist')
    })

    it('external links should be correct', () => {
      cy.visit('/')
      const externalLinks = [
        'https://moondao.com',
        'https://snapshot.org/#/tomoondao.eth',
        'https://moondao.com/docs/introduction',
        'https://moondao.ck.page/profile',
        'https://market.moondao.com',
      ]

      Array.from({
        length: cy.get('#layout-external-links').children.length,
      }).map((link: any, i) => {
        link.get('a').should('have.attr', 'href', externalLinks[i])
      })
    })
  })

  describe('MoonDAO App | Home', () => {
    it('should load the home page', () => {
      cy.visit('/')
      cy.get('#home-card').should('exist')
    })

    it('home cards should have the correct internal and external links', () => {
      cy.visit('/')
      const links = [
        'https://app.uniswap.org/#/swap?inputCurrency=ETH&outputCurrency=0x20d4DB1946859E2Adb0e5ACC2eac58047aD41395&chain=mainnet',
        '/lock',
        'https://wallet.polygon.technology/',
        '/announcements',
        '/analytics',
        '/calendar',
        'https://market.moondao.com',
        'https://discord.gg/moondao',
        'https://twitter.com/OfficialMoonDAO',
      ]

      Array.from({
        length: cy.get('#home-card-pages').children.length,
      }).map((page: any, i: number) => {
        page.get('a').should('have.attr', 'href', links[i])
      })
    })
  })

  describe('MoonDAO App | Lock', () => {
    it('should load the lock page', () => {
      cy.visit('/lock')
    })
  })
})

//MISSIONS
describe('Missions E2E Testing', () => {
  describe('MoonDAO App | Lifeship', () => {
    it('should load the lifeship page', () => {
      cy.visit('/lifeship')
      cy.get('h2').contains('LifeShip')
    })
  })

  describe('MoonDAO App | Zero-G', () => {
    it('should load the zero-g page', () => {
      cy.visit('/zero-g')
      cy.get('h1').contains('Zero-G Flight')
    })
  })
})

//DASHBOARD
describe('Dashboard E2E Testing', () => {
  describe('MoonDAO App | Announcements', () => {
    it('should load the announcements page', () => {
      cy.visit('/announcements')
      cy.get('#dashboard-announcements').should('exist')
    })
  })

  describe('MoonDAO App | Analytics', () => {
    it('should load the analytics page', () => {
      cy.visit('/analytics')

      it('should toggle to the treasury page', () => {
        cy.get('#dashboard-analytics-toggle').click()
        cy.url().should(
          'equal',
          'http://localhost:3000/dashboard/analytics?treasury=true'
        )
      })

      it('should load the treasury page', () => {
        cy.get('#dashboard-treasury-page').should('exist')
        cy.get('#dashboard-treasury-assets')
        cy.get('#dashboard-treasury-transactions').should('exist')
      })
    })
  })

  describe('MoonDAO App | Calendar', () => {
    it('should load the calendar page', () => {
      cy.visit('/calendar')
      cy.get('h1').contains(common.calendarTitle)
      cy.get('p').contains(common.calendarDesc)
      cy.get('#dashboard-calendar').should('exist')
    })
  })
})

export {}
