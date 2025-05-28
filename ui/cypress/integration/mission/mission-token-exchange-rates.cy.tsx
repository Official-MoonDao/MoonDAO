import MissionTokenExchangeRates from '@/components/mission/MissionTokenExchangeRates'

describe('MissionTokenExchangeRates', () => {
  const defaultProps = {
    currentStage: 2,
    tokenSymbol: 'MOON',
  }

  beforeEach(() => {
    cy.viewport(1000, 600)
    cy.mount(<MissionTokenExchangeRates {...defaultProps} />)
  })

  it('Renders with default props', () => {
    cy.get('#mission-token-exchange-rates').should('exist')
  })

  it('Displays correct exchange rates', () => {
    cy.get('#mission-token-exchange-rates').should('contain', '1 ETH =')
    cy.get('#mission-token-exchange-rates').should('contain', 'MOON')
  })

  it('Shows correct token symbol', () => {
    const customSymbol = 'TEST'
    cy.mount(
      <MissionTokenExchangeRates {...defaultProps} tokenSymbol={customSymbol} />
    )
    cy.get('#mission-token-exchange-rates').should('contain', customSymbol)
  })
})
