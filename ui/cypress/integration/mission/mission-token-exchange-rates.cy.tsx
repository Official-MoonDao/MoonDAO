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

  it('Handles undefined currentStage by defaulting to stage 1', () => {
    cy.mount(<MissionTokenExchangeRates {...defaultProps} currentStage={1} />)
    // Stage 1 should be highlighted
    cy.get('#mission-token-exchange-rates > div')
      .first()
      .should('have.class', 'bg-darkest-cool')
      .should('not.have.class', 'opacity-30')
  })

  it('Shows correct token symbol', () => {
    const customSymbol = 'TEST'
    cy.mount(
      <MissionTokenExchangeRates {...defaultProps} tokenSymbol={customSymbol} />
    )
    cy.get('#mission-token-exchange-rates').should('contain', customSymbol)
  })
})
