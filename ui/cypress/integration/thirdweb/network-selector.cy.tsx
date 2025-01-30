import TestnetProviders from '@/cypress/mock/TestnetProviders'
import NetworkSelector from '@/components/thirdweb/NetworkSelector'

describe('<NetworkSelector />', () => {
  it('Renders Network Selector', () => {
    cy.mount(
      <TestnetProviders>
        <NetworkSelector />
      </TestnetProviders>
    )

    cy.get('#network-selector').should('exist')
    cy.get('#network-selector-dropdown-button').click()
    cy.get('#network-selector-dropdown').should('exist')
  })
})
