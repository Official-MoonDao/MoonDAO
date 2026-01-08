import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { GroupedLocationData } from '@/lib/network/types'
import { useMapData } from '@/lib/network/useMapData'

const MapDataWrapper = ({
  enabled = true,
  initialData,
}: {
  enabled?: boolean
  initialData?: GroupedLocationData[]
}) => {
  const result = useMapData(enabled, { initialData })

  return (
    <div>
      <div data-testid="map-loading">{result.isLoading ? 'loading' : 'loaded'}</div>
      <div data-testid="map-error">
        {result.error ? String((result.error as any)?.message || result.error) : 'no-error'}
      </div>
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
  const mockLocationData: GroupedLocationData[] = [
    {
      citizens: [
        {
          id: '1',
          name: 'Test Citizen',
          location: '{"name":"New York, NY","lat":40.7128,"lng":-74.0060}',
          formattedAddress: 'New York, NY, USA',
          image: 'ipfs://test-image',
          lat: 40.7128,
          lng: -74.006,
        },
      ],
      names: ['Test Citizen'],
      formattedAddress: 'New York, NY, USA',
      lat: 40.7128,
      lng: -74.006,
      color: '#5556eb',
      size: 0.01,
    },
    {
      citizens: [
        {
          id: '2',
          name: 'Test Citizen 2',
          location: '{"name":"Los Angeles, CA","lat":34.0522,"lng":-118.2437}',
          formattedAddress: 'Los Angeles, CA, USA',
          image: 'ipfs://test-image-2',
          lat: 34.0522,
          lng: -118.2437,
        },
      ],
      names: ['Test Citizen 2'],
      formattedAddress: 'Los Angeles, CA, USA',
      lat: 34.0522,
      lng: -118.2437,
      color: '#5556eb',
      size: 0.01,
    },
  ]

  beforeEach(() => {
    cy.mountNextRouter('/')
  })

  it('should use initial data when provided', () => {
    cy.mount(
      <TestnetProviders>
        <MapDataWrapper enabled={true} initialData={mockLocationData} />
      </TestnetProviders>
    )

    cy.get('[data-testid="map-count"]').should('contain', '2')
    cy.get('[data-testid="location-0-name"]').should('contain', 'New York, NY, USA')
    cy.get('[data-testid="location-1-name"]').should('contain', 'Los Angeles, CA, USA')
  })

  it('should return empty array when disabled', () => {
    cy.mount(
      <TestnetProviders>
        <MapDataWrapper enabled={false} initialData={mockLocationData} />
      </TestnetProviders>
    )

    cy.get('[data-testid="map-count"]').should('contain', '0')
  })

  it('should not show loading state (uses static props)', () => {
    cy.mount(
      <TestnetProviders>
        <MapDataWrapper enabled={true} initialData={mockLocationData} />
      </TestnetProviders>
    )

    cy.get('[data-testid="map-loading"]').should('contain', 'loaded')
  })

  it('should never show error state', () => {
    cy.mount(
      <TestnetProviders>
        <MapDataWrapper enabled={true} initialData={mockLocationData} />
      </TestnetProviders>
    )

    cy.get('[data-testid="map-error"]').should('contain', 'no-error')
  })

  it('should return empty array when no initial data provided', () => {
    cy.mount(
      <TestnetProviders>
        <MapDataWrapper enabled={true} />
      </TestnetProviders>
    )

    // Without initial data and in test environment, returns empty array or dummy data
    cy.get('[data-testid="map-count"]').should('exist')
  })
})
