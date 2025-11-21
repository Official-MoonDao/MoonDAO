import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { CYPRESS_CHAIN_V5 } from '@/cypress/mock/config'
import { useValidTeams, useValidCitizens } from '@/lib/network/useNetworkData'

const TeamsWrapper = ({ page = 1, search = '', enabled = true }: any) => {
  const result = useValidTeams({ page, search, enabled })

  return (
    <div>
      <div data-testid="teams-loading">{result.isLoading ? 'loading' : 'loaded'}</div>
      <div data-testid="teams-error">{result.error ? result.error.message : 'no-error'}</div>
      <div data-testid="teams-count">{result.data.length}</div>
      <div data-testid="teams-total">{result.totalCount}</div>
      <div data-testid="teams-max-page">{result.maxPage}</div>
      {result.data.map((team, i) => (
        <div key={i} data-testid={`team-${i}`}>
          {team.metadata.name}
        </div>
      ))}
    </div>
  )
}

const CitizensWrapper = ({ page = 1, search = '', enabled = true }: any) => {
  const result = useValidCitizens({ page, search, enabled })

  return (
    <div>
      <div data-testid="citizens-loading">{result.isLoading ? 'loading' : 'loaded'}</div>
      <div data-testid="citizens-error">{result.error ? result.error.message : 'no-error'}</div>
      <div data-testid="citizens-count">{result.data.length}</div>
      <div data-testid="citizens-total">{result.totalCount}</div>
      <div data-testid="citizens-max-page">{result.maxPage}</div>
      {result.data.map((citizen, i) => (
        <div key={i} data-testid={`citizen-${i}`}>
          {citizen.metadata.name}
        </div>
      ))}
    </div>
  )
}

describe('useNetworkData hooks', () => {
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
    location: '{"name":"Test Location","lat":40.7128,"lng":-74.0060}',
    website: 'https://test.com',
    discord: 'test#1234',
    twitter: '@test',
    view: 'public',
    formId: 'form123',
    owner: '0x1234567890123456789012345678901234567890',
  }

  beforeEach(() => {
    cy.mountNextRouter('/')
    
    cy.intercept('GET', '/api/tableland/query?statement=*SELECT*FROM*TEAMTABLE*', {
      statusCode: 200,
      body: [mockTeamRow],
    }).as('getTeams')

    cy.intercept('GET', '/api/tableland/query?statement=*SELECT*FROM*CITIZENTABLE*', {
      statusCode: 200,
      body: [mockCitizenRow],
    }).as('getCitizens')

    cy.intercept('GET', '/api/tableland/query*', (req) => {
      const url = decodeURIComponent(req.url)
      if (url.includes('COUNT') && url.includes('TEAMTABLE')) {
        req.reply({ statusCode: 200, body: [{ count: 10 }] })
      } else if (url.includes('COUNT') && url.includes('CITIZENTABLE')) {
        req.reply({ statusCode: 200, body: [{ count: 20 }] })
      }
    }).as('getCount')

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

  describe('useValidTeams', () => {
    it('should fetch and display teams', () => {
      cy.mount(
        <TestnetProviders>
          <TeamsWrapper page={1} search="" enabled={true} />
        </TestnetProviders>
      )

      cy.wait('@getCount', { timeout: 10000 })
      cy.wait('@getTeams', { timeout: 10000 })
      cy.get('[data-testid="teams-loading"]', { timeout: 15000 }).should('contain', 'loaded')
      
      cy.get('[data-testid="teams-count"]').should('contain', '1')
      cy.get('[data-testid="team-0"]').should('contain', 'Test Team')
    })

    it('should handle loading state', () => {
      cy.mount(
        <TestnetProviders>
          <TeamsWrapper page={1} search="" enabled={true} />
        </TestnetProviders>
      )

      cy.get('[data-testid="teams-loading"]').should('exist')
    })

    it('should handle search query', () => {
      cy.intercept('GET', '/api/tableland/query?statement=*WHERE*name*LIKE*Test*', {
        statusCode: 200,
        body: [mockTeamRow],
      }).as('getTeamsSearch')

      cy.mount(
        <TestnetProviders>
          <TeamsWrapper page={1} search="Test" enabled={true} />
        </TestnetProviders>
      )

      cy.wait('@getTeamsSearch')
      cy.get('[data-testid="teams-count"]').should('exist')
    })

    it('should calculate max page correctly', () => {
      cy.mount(
        <TestnetProviders>
          <TeamsWrapper page={1} search="" enabled={true} />
        </TestnetProviders>
      )

      cy.wait('@getCount', { timeout: 10000 })
      cy.get('[data-testid="teams-max-page"]').should('exist')
    })

    it('should not fetch when disabled', () => {
      cy.mount(
        <TestnetProviders>
          <TeamsWrapper page={1} search="" enabled={false} />
        </TestnetProviders>
      )

      cy.get('[data-testid="teams-count"]').should('contain', '0')
    })
  })

  describe('useValidCitizens', () => {
    it('should fetch and display citizens', () => {
      cy.mount(
        <TestnetProviders>
          <CitizensWrapper page={1} search="" enabled={true} />
        </TestnetProviders>
      )

      cy.wait('@getCount', { timeout: 10000 })
      cy.wait('@getCitizens', { timeout: 10000 })
      cy.get('[data-testid="citizens-loading"]', { timeout: 15000 }).should('contain', 'loaded')
      
      cy.get('[data-testid="citizens-count"]').should('contain', '1')
      cy.get('[data-testid="citizen-0"]').should('contain', 'Test Citizen')
    })

    it('should handle loading state', () => {
      cy.mount(
        <TestnetProviders>
          <CitizensWrapper page={1} search="" enabled={true} />
        </TestnetProviders>
      )

      cy.get('[data-testid="citizens-loading"]').should('exist')
    })

    it('should handle search query', () => {
      cy.intercept('GET', '/api/tableland/query?statement=*WHERE*name*LIKE*Test*', {
        statusCode: 200,
        body: [mockCitizenRow],
      }).as('getCitizensSearch')

      cy.mount(
        <TestnetProviders>
          <CitizensWrapper page={1} search="Test" enabled={true} />
        </TestnetProviders>
      )

      cy.wait('@getCitizensSearch')
      cy.get('[data-testid="citizens-count"]').should('exist')
    })

    it('should calculate max page correctly', () => {
      cy.mount(
        <TestnetProviders>
          <CitizensWrapper page={1} search="" enabled={true} />
        </TestnetProviders>
      )

      cy.wait('@getCount', { timeout: 10000 })
      cy.get('[data-testid="citizens-max-page"]').should('exist')
    })

    it('should not fetch when disabled', () => {
      cy.mount(
        <TestnetProviders>
          <CitizensWrapper page={1} search="" enabled={false} />
        </TestnetProviders>
      )

      cy.get('[data-testid="citizens-count"]').should('contain', '0')
    })
  })
})

