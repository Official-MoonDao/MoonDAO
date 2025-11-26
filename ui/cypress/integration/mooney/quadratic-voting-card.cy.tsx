import QuadraticVotingCard from '@/components/mooney/QuadraticVotingCard'

describe('<QuadraticVotingCard />', () => {
  it('renders with default props', () => {
    cy.mount(<QuadraticVotingCard />)

    cy.contains('Quadratic Voting Formula').should('exist')
    cy.contains('Voting Power = √(vMOONEY)').should('exist')
  })

  it('displays custom formula', () => {
    cy.mount(<QuadraticVotingCard formula="Custom Formula" />)

    cy.contains('Custom Formula').should('exist')
  })

  it('shows examples', () => {
    cy.mount(<QuadraticVotingCard />)

    cy.contains('10,000 vMOONEY').should('exist')
    cy.contains('1,000,000 vMOONEY').should('exist')
  })

  it('displays custom examples', () => {
    const customExamples = [
      { input: '5,000 vMOONEY', output: '√5,000 = 70.7 voting power' },
    ]

    cy.mount(<QuadraticVotingCard examples={customExamples} />)

    cy.contains('5,000 vMOONEY').should('exist')
  })

  it('shows fair governance description', () => {
    cy.mount(<QuadraticVotingCard />)

    cy.contains('Fair Governance').should('exist')
    cy.contains('Prevents whale dominance').should('exist')
  })
})

