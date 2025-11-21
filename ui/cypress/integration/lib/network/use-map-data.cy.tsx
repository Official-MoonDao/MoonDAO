import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { useMapData } from '@/lib/network/useMapData'

const MapDataWrapper = ({ enabled = true }: { enabled?: boolean }) => {
  const result = useMapData(enabled)

  return (
    <div>
      <div data-testid="map-loading">{result.isLoading ? 'loading' : 'loaded'}</div>
      <div data-testid="map-error">{result.error ? result.error.message : 'no-error'}</div>
      <div data-testid="map-count">{result.data.length}</div>
      {result.data.map((location, i) => (
        <div key={i} data-testid={`location-${i}`}>
          <div data-testid={`location-${i}-name`}>{location.formattedAddress}</div>
          <div data-testid={`location-${i}-lat`}>{location.lat}</div>
          <div data-testid={`location-${i}-lng`}>{location.lng}</div>
        </div>
      ))}
    </div>
  )
}

describe('useMapData', () => {
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
    cy.mountNextRouter('/')

    cy.intercept('POST', '**', (req) => {
      if (req.body && typeof req.body === 'object') {
        if (req.body.method === 'expiresAt') {
          const futureTimestamp = Math.floor(Date.now() / 1000) + 86400
          req.reply({ result: `0x${futureTimestamp.toString(16)}` })
        } else if (req.body.method === 'getTableName') {
          req.reply({ result: 'CITIZENTABLE_11155111_1897' })
        }
      }
    })
  })

  it('should fetch and process map data when enabled', () => {
    cy.intercept('GET', '/api/tableland/query?statement=*SELECT*FROM*CITIZENTABLE*', {
      statusCode: 200,
      body: [mockCitizenRow],
    }).as('getCitizens')

    cy.mount(
      <TestnetProviders>
        <MapDataWrapper enabled={true} />
      </TestnetProviders>
    )

    cy.wait('@getCitizens')
    cy.get('[data-testid="map-count"]').should('exist')
  })

  it('should not fetch when disabled', () => {
    cy.mount(
      <TestnetProviders>
        <MapDataWrapper enabled={false} />
      </TestnetProviders>
    )

    cy.get('[data-testid="map-count"]').should('contain', '0')
  })

  it('should handle loading state', () => {
    cy.mount(
      <TestnetProviders>
        <MapDataWrapper enabled={true} />
      </TestnetProviders>
    )

    cy.get('[data-testid="map-loading"]').should('exist')
  })
})
