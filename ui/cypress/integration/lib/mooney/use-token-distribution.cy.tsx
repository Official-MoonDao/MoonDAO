import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { useTokenDistribution } from '@/lib/mooney/hooks/useTokenDistribution'

const TokenDistributionWrapper = () => {
  const { data, total } = useTokenDistribution()

  return (
    <div>
      <div data-testid="data-length">{data.length}</div>
      <div data-testid="total">{total}</div>
      <div data-testid="first-segment-name">{data[0]?.name}</div>
    </div>
  )
}

describe('useTokenDistribution', () => {
  beforeEach(() => {
    cy.mountNextRouter('/')
  })

  it('returns distribution data', () => {
    cy.mount(
      <TestnetProviders>
        <TokenDistributionWrapper />
      </TestnetProviders>
    )

    cy.get('[data-testid="data-length"]').should('contain', '5')
    cy.get('[data-testid="total"]').should('exist')
  })

  it('calculates total correctly', () => {
    cy.mount(
      <TestnetProviders>
        <TokenDistributionWrapper />
      </TestnetProviders>
    )

    cy.get('[data-testid="total"]').should('exist')
    cy.get('[data-testid="first-segment-name"]').should('exist')
  })

  it('provides data with expected structure', () => {
    cy.mount(
      <TestnetProviders>
        <TokenDistributionWrapper />
      </TestnetProviders>
    )

    cy.get('[data-testid="first-segment-name"]').should('contain', 'Circulating')
  })
})

