import GeometricDecayChart from '@/components/mooney/GeometricDecayChart'
import { generateQuarterlyData } from '@/lib/mooney/utils/geometricDecay'

describe('<GeometricDecayChart />', () => {
  const mockData = generateQuarterlyData(undefined, 7)

  it('renders the chart with data', () => {
    cy.mount(<GeometricDecayChart data={mockData} />)

    cy.get('svg').should('exist')
    cy.contains('-5% per quarter').should('exist')
  })

  it('displays quarterly labels', () => {
    cy.mount(<GeometricDecayChart data={mockData} />)

    mockData.forEach((point) => {
      cy.contains(point.quarter).should('exist')
    })
  })

  it('renders with custom reduction rate', () => {
    cy.mount(<GeometricDecayChart data={mockData} reductionRate={0.1} />)

    cy.contains('-10% per quarter').should('exist')
  })

  it('handles empty data gracefully', () => {
    cy.mount(<GeometricDecayChart data={[]} />)

    cy.get('svg').should('not.exist')
  })
})

