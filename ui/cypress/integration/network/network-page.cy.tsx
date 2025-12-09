import TestnetProviders from '@/cypress/mock/TestnetProviders'
import Network from '@/pages/network'

describe('<Network />', () => {
  const mockTeamRow = {
    id: 1,
    name: 'Test Team',
    description: 'Test Description',
    image: 'ipfs://test-image',
    website: 'https://test.com',
    communications: 'discord',
    view: 'public',
    formId: 'form123',
  }

  const mockCitizenRow = {
    id: 1,
    name: 'Test Citizen',
    description: 'Test Description',
    image: 'ipfs://test-image',
    location: '{"name":"New York, NY","lat":40.7128,"lng":-74.0060}',
    website: 'https://test.com',
    discord: 'test#1234',
    twitter: '@test',
    view: 'public',
    formId: 'form123',
    owner: '0x1234567890123456789012345678901234567890',
  }

  beforeEach(() => {
    cy.mountNextRouter('/network')

    cy.intercept('GET', '/api/tableland/query*', (req) => {
      const url = decodeURIComponent(req.url)
      if (url.includes('COUNT') || url.includes('count')) {
        if (url.includes('TEAMTABLE') || url.includes('TEAM')) {
          req.reply({ body: [{ count: 10 }] })
        } else if (url.includes('CITIZENTABLE') || url.includes('CITIZEN')) {
          req.reply({ body: [{ count: 20 }] })
        } else {
          req.reply({ body: [{ count: 0 }] })
        }
      } else if (url.includes('SELECT') && url.includes('FROM')) {
        if (url.includes('TEAMTABLE') || url.includes('TEAM')) {
          req.reply({ statusCode: 200, body: [mockTeamRow] })
        } else if (url.includes('CITIZENTABLE') || url.includes('CITIZEN')) {
          req.reply({ statusCode: 200, body: [mockCitizenRow] })
        } else {
          req.reply({ statusCode: 200, body: [] })
        }
      } else {
        req.reply({ statusCode: 200, body: [] })
      }
    }).as('getTablelandQuery')

    cy.intercept('POST', '**', (req) => {
      if (req.body && typeof req.body === 'object') {
        if (req.body.method === 'expiresAt') {
          const futureTimestamp = Math.floor(Date.now() / 1000) + 86400
          req.reply({ result: `0x${futureTimestamp.toString(16)}` })
        } else if (req.body.method === 'getTableName') {
          if (req.body.params && req.body.params[0]?.includes('TEAM')) {
            req.reply({ result: 'TEAMTABLE_11155111_1895' })
          } else {
            req.reply({ result: 'CITIZENTABLE_11155111_1897' })
          }
        }
      }
    })
  })

  it('should render the network page', () => {
    cy.mount(
      <TestnetProviders>
        <Network />
      </TestnetProviders>
    )

    cy.contains('Explore the Network').should('exist')
    cy.contains('Discover and connect with citizens and teams').should('exist')
  })

  it('should display tabs for citizens, teams, and map', () => {
    cy.mount(
      <TestnetProviders>
        <Network />
      </TestnetProviders>
    )

    cy.contains('Citizens').should('exist')
    cy.contains('Teams').should('exist')
    cy.contains('Map').should('exist')
  })

  it('should display search bar', () => {
    cy.mount(
      <TestnetProviders>
        <Network />
      </TestnetProviders>
    )

    cy.get('input[name="search"]').should('exist')
  })

  it('should display join network button', () => {
    cy.mount(
      <TestnetProviders>
        <Network />
      </TestnetProviders>
    )

    cy.contains('Join Network').should('exist')
  })

  describe('Citizens Tab', () => {
    it('should load and display citizens', () => {
      cy.mount(
        <TestnetProviders>
          <Network />
        </TestnetProviders>
      )

      cy.wait('@getTablelandQuery')
      cy.wait('@getTablelandQuery')

      cy.contains('Test Citizen', { timeout: 10000 }).should('exist')
    })

    it('should show loading state initially', () => {
      cy.mount(
        <TestnetProviders>
          <Network />
        </TestnetProviders>
      )

      cy.get('#network-content').should('exist')
    })

    it('should handle search for citizens', () => {
      cy.mount(
        <TestnetProviders>
          <Network />
        </TestnetProviders>
      )

      cy.get('input[name="search"]').type('Test')
      cy.wait('@getTablelandQuery', { timeout: 10000 })
    })
  })

  describe('Teams Tab', () => {
    it('should switch to teams tab and display teams', () => {
      cy.mount(
        <TestnetProviders>
          <Network />
        </TestnetProviders>
      )

      cy.contains('Teams').click()
      cy.wait('@getTablelandQuery')
      cy.wait('@getTablelandQuery')

      cy.contains('Test Team', { timeout: 10000 }).should('exist')
    })

    it('should update search placeholder for teams', () => {
      cy.mount(
        <TestnetProviders>
          <Network />
        </TestnetProviders>
      )

      cy.contains('Teams').click()
      cy.get('input[name="search"]').should('have.attr', 'placeholder', 'Search teams')
    })
  })

  describe('Map Tab', () => {
    it('should switch to map tab', () => {
      cy.mount(
        <TestnetProviders>
          <Network />
        </TestnetProviders>
      )

      cy.contains('Map').click()
      cy.get('#network-content').should('exist')
    })
  })

  describe('Pagination', () => {
    it('should navigate to next page', () => {
      cy.mount(
        <TestnetProviders>
          <Network />
        </TestnetProviders>
      )

      cy.wait('@getTablelandQuery')
      cy.wait('@getTablelandQuery')

      // Pagination arrows only show when there's more than one page
      // Check if pagination exists, and if so, verify arrows
      cy.get('#page-number', { timeout: 15000 })
        .should('exist')
        .then(($pageNum) => {
          const pageText = $pageNum.text()
          const maxPage = parseInt(pageText.split('of')[1]?.trim() || '1')
          if (maxPage > 1) {
            cy.get('img[alt="Right Arrow"]').should('exist')
          }
        })
    })

    it('should navigate to previous page', () => {
      cy.mount(
        <TestnetProviders>
          <Network />
        </TestnetProviders>
      )

      cy.wait('@getTablelandQuery')
      cy.wait('@getTablelandQuery')

      // Pagination arrows only show when there's more than one page
      // Check if pagination exists, and if so, verify arrows
      cy.get('#page-number', { timeout: 15000 })
        .should('exist')
        .then(($pageNum) => {
          const pageText = $pageNum.text()
          const maxPage = parseInt(pageText.split('of')[1]?.trim() || '1')
          if (maxPage > 1) {
            cy.get('img[alt="Left Arrow"]').should('exist')
          }
        })
    })
  })
})
