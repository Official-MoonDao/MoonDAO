import TestnetProviders from '@/cypress/mock/TestnetProviders'
import TokenInfoSection from '@/components/mooney/TokenInfoSection'

describe('<TokenInfoSection />', () => {
  beforeEach(() => {
    cy.mountNextRouter('/')
  })

  it('renders token information section', () => {
    cy.mount(
      <TestnetProviders>
        <TokenInfoSection />
      </TestnetProviders>
    )

    cy.contains('Token Information').should('exist')
  })

  it('displays contract addresses card', () => {
    cy.mount(
      <TestnetProviders>
        <TokenInfoSection />
      </TestnetProviders>
    )

    cy.contains('Contract Addresses').should('exist')
  })

  it('displays quadratic voting card', () => {
    cy.mount(
      <TestnetProviders>
        <TokenInfoSection />
      </TestnetProviders>
    )

    cy.contains('Quadratic Voting Formula').should('exist')
  })

  it('shows token distribution chart', () => {
    cy.mount(
      <TestnetProviders>
        <TokenInfoSection />
      </TestnetProviders>
    )

    cy.contains('Token Usage & Allocation').should('exist')
  })

  it('displays projects system reward structure', () => {
    cy.mount(
      <TestnetProviders>
        <TokenInfoSection />
      </TestnetProviders>
    )

    cy.contains('Projects System Reward Structure').should('exist')
    cy.contains('Quarterly Reward Pool').should('exist')
  })
})

