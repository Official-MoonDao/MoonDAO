import TestnetProviders from '@/cypress/mock/TestnetProviders'
import ContractAddressCard from '@/components/mooney/ContractAddressCard'

describe('<ContractAddressCard />', () => {
  beforeEach(() => {
    cy.mountNextRouter('/')
  })

  it('renders contract addresses section', () => {
    cy.mount(
      <TestnetProviders>
        <ContractAddressCard />
      </TestnetProviders>
    )

    cy.contains('Contract Addresses').should('exist')
  })

  it('displays supported chains', () => {
    cy.mount(
      <TestnetProviders>
        <ContractAddressCard />
      </TestnetProviders>
    )

    cy.contains('Ethereum').should('exist')
    cy.contains('Arbitrum').should('exist')
    cy.contains('Polygon').should('exist')
    cy.contains('Base').should('exist')
  })

  it('shows contract addresses for each chain', () => {
    cy.mount(
      <TestnetProviders>
        <ContractAddressCard />
      </TestnetProviders>
    )

    cy.get('code').should('have.length.at.least', 4)
  })
})
