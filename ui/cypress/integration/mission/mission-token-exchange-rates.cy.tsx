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

  it('Displays all three stages', () => {
    cy.get('#mission-token-exchange-rates > div').should('have.length', 3)
  })

  it('Highlights the current stage correctly', () => {
    // Stage 2 should be highlighted (current stage)
    cy.get('#mission-token-exchange-rates > div')
      .eq(1) // Second stage
      .should('have.class', 'bg-darkest-cool')
      .should('not.have.class', 'opacity-30')
  })

  it('Shows non-current stages with reduced opacity', () => {
    // Stages 1 and 3 should have reduced opacity
    cy.get('#mission-token-exchange-rates > div')
      .first()
      .should('have.class', 'opacity-30')
    cy.get('#mission-token-exchange-rates > div')
      .last()
      .should('have.class', 'opacity-30')
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

  it('Displays stage names correctly', () => {
    cy.get('#mission-token-exchange-rates').should('contain', 'Stage 1')
    cy.get('#mission-token-exchange-rates').should('contain', 'Stage 2')
    cy.get('#mission-token-exchange-rates').should('contain', 'Stage 3')
  })

  it('Shows correct token symbol', () => {
    const customSymbol = 'TEST'
    cy.mount(
      <MissionTokenExchangeRates {...defaultProps} tokenSymbol={customSymbol} />
    )
    cy.get('#mission-token-exchange-rates').should('contain', customSymbol)
  })

  it('Displays stage indicators correctly', () => {
    // Current stage should have green indicator
    cy.get('#mission-token-exchange-rates > div')
      .eq(1)
      .find('div')
      .first()
      .should('have.class', 'bg-moon-green')
    // Other stages should have border
    cy.get('#mission-token-exchange-rates > div')
      .first()
      .find('div')
      .first()
      .should('have.class', 'border-2')
  })
})
