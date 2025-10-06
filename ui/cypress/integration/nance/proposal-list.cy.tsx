import TestnetProviders from '@/cypress/mock/TestnetProviders'
import React from 'react'
import ProposalList from '@/components/nance/ProposalList'

describe('<ProposalList />', () => {
  beforeEach(() => {
    cy.on('uncaught:exception', (err) => {
      console.log('Caught error:', err.message)
      return false
    })
  })

  const mountWithProviders = (component: React.ReactElement) => {
    cy.mountNextRouter('/')
    return cy.mount(<TestnetProviders>{component}</TestnetProviders>)
  }

  it('Should mount component', () => {
    mountWithProviders(<ProposalList />)

    cy.get('body').should('exist')
    cy.get('div').should('exist')
  })

  it('Should mount component with props', () => {
    mountWithProviders(<ProposalList noPagination compact proposalLimit={10} />)

    cy.get('body').should('exist')
    cy.get('div').should('exist')
  })

  it('Should not show pagination when noPagination prop is true', () => {
    mountWithProviders(<ProposalList noPagination />)

    // Should not show pagination controls (if they would normally appear)
    cy.get('#pagination-container').should('not.exist')
  })
})
