import TokenDistributionChart from '@/components/mooney/TokenDistributionChart'
import { TOKEN_DISTRIBUTION_DATA } from '@/lib/mooney/utils/tokenData'

describe('<TokenDistributionChart />', () => {
  it('renders the chart with data', () => {
    cy.mount(<TokenDistributionChart data={TOKEN_DISTRIBUTION_DATA} />)

    cy.get('svg').should('exist')
    cy.contains('Total Supply').should('exist')
  })

  it('displays all distribution segments', () => {
    cy.mount(<TokenDistributionChart data={TOKEN_DISTRIBUTION_DATA} />)

    TOKEN_DISTRIBUTION_DATA.forEach((segment) => {
      cy.contains(segment.name).should('exist')
      cy.contains(`${segment.value.toFixed(2)}%`).should('exist')
    })
  })

  it('renders custom total supply', () => {
    cy.mount(
      <TokenDistributionChart data={TOKEN_DISTRIBUTION_DATA} totalSupply="3.0B" />
    )

    cy.contains('3.0B').should('exist')
  })
})

