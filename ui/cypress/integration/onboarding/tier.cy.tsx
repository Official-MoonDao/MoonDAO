import TestnetProviders from '@/cypress/mock/TestnetProviders'
import Tier from '@/components/onboarding/Tier'

describe('<Tier />', () => {
  let props: any

  beforeEach(() => {
    props = {
      label: 'Test Label',
      description: 'Test Description',
      points: ['Point 1: Description 1', 'Point 2: Description 2'],
      price: 1.5,
      usdPrice: 1000,
      onClick: cy.stub(),
      buttoncta: 'Click Me',
      type: 'team',
      compact: false,
      hasCitizen: false, // Ensure hasCitizen is false
    }

    cy.mount(
      <TestnetProviders>
        <Tier {...props} />
      </TestnetProviders>
    )
  })

  it('Renders the component with default props', () => {
    cy.get('h2').contains(props.label)
    cy.get('p').contains(props.description)
    cy.get('button').contains(props.buttoncta)
  })

  it('Displays points correctly', () => {
    props.points.forEach((point: string) => {
      const [title, description] = point.split(': ')
      cy.get('p').contains(title)
      cy.get('p').contains(description)
    })
  })

  it('Displays price correctly', () => {
    cy.get('p').contains(`~$${props.usdPrice} / Year`)
    cy.get('p').contains(`(${props.price} Arbitrum ETH)`)
  })

  it('Renders compact view correctly', () => {
    cy.mount(
      <TestnetProviders>
        <Tier {...props} compact={true} />
      </TestnetProviders>
    )
    cy.get('button').should('exist')
  })
})
