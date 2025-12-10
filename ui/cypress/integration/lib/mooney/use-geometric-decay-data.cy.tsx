import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { useGeometricDecayData } from '@/lib/mooney/hooks/useGeometricDecayData'

const GeometricDecayWrapper = () => {
  const { quarterlyData, scheduleInfo } = useGeometricDecayData()

  return (
    <div>
      <div data-testid="quarterly-data-length">{quarterlyData.length}</div>
      <div data-testid="first-quarter">{quarterlyData[0]?.quarter}</div>
      <div data-testid="starting-quarter">{scheduleInfo.startingQuarter}</div>
      <div data-testid="reduction-rate">{scheduleInfo.reductionRatePercent}</div>
    </div>
  )
}

describe('useGeometricDecayData', () => {
  beforeEach(() => {
    cy.mountNextRouter('/')
  })

  it('returns quarterly data', () => {
    cy.mount(
      <TestnetProviders>
        <GeometricDecayWrapper />
      </TestnetProviders>
    )

    cy.get('[data-testid="quarterly-data-length"]').should('contain', '7')
  })

  it('provides schedule info', () => {
    cy.mount(
      <TestnetProviders>
        <GeometricDecayWrapper />
      </TestnetProviders>
    )

    cy.get('[data-testid="starting-quarter"]').should('exist')
    cy.get('[data-testid="reduction-rate"]').should('contain', '5')
  })

  it('generates quarterly data with correct format', () => {
    cy.mount(
      <TestnetProviders>
        <GeometricDecayWrapper />
      </TestnetProviders>
    )

    cy.get('[data-testid="first-quarter"]').should('exist')
  })
})

