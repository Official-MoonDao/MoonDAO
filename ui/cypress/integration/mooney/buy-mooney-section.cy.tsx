import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { CYPRESS_CHAIN_V5 } from '@/cypress/mock/config'
import BuyMooneySection from '@/components/mooney/BuyMooneySection'

describe('<BuyMooneySection />', () => {
  beforeEach(() => {
    cy.mountNextRouter('/')
  })

  it('renders buy section', () => {
    cy.mount(
      <TestnetProviders>
        <BuyMooneySection
          selectedChain={CYPRESS_CHAIN_V5}
          swapComponent={<div>Swap Component</div>}
        />
      </TestnetProviders>
    )

    cy.contains('Buy MOONEY').should('exist')
  })

  it('displays network selector', () => {
    cy.mount(
      <TestnetProviders>
        <BuyMooneySection
          selectedChain={CYPRESS_CHAIN_V5}
          swapComponent={<div>Swap Component</div>}
        />
      </TestnetProviders>
    )

    cy.contains('Network Selection').should('exist')
  })

  it('shows next steps section', () => {
    cy.mount(
      <TestnetProviders>
        <BuyMooneySection
          selectedChain={CYPRESS_CHAIN_V5}
          swapComponent={<div>Swap Component</div>}
        />
      </TestnetProviders>
    )

    cy.contains('Next Steps').should('exist')
    cy.contains('Lock for Voting Power').should('exist')
    cy.contains('View Governance').should('exist')
  })

  it('renders custom title and description', () => {
    cy.mount(
      <TestnetProviders>
        <BuyMooneySection
          title="Custom Title"
          description="Custom description"
          selectedChain={CYPRESS_CHAIN_V5}
          swapComponent={<div>Swap Component</div>}
        />
      </TestnetProviders>
    )

    cy.contains('Custom Title').should('exist')
    cy.contains('Custom description').should('exist')
  })
})

