import React from 'react'
import Search from '../../../components/layout/Search'

describe('<Search />', () => {
  it('Renders the search component', () => {
    cy.mount(<Search input="" setInput={() => {}} />)

    cy.get('.bg-search').should('exist')
    cy.get('img[alt="Search Icon"]').should('be.visible')
    cy.get('input[name="search"]').should('exist')
  })

  it('Displays the current input value', () => {
    cy.mount(<Search input="initial value" setInput={() => {}} />)

    cy.get('input[name="search"]').should('have.value', 'initial value')
  })

  it('Has correct placeholder text', () => {
    cy.mount(<Search input="" setInput={() => {}} />)

    cy.get('input[name="search"]').should(
      'have.attr',
      'placeholder',
      'Search...'
    )
  })

  it('Uses custom placeholder when provided', () => {
    cy.mount(<Search input="" setInput={() => {}} placeholder="Search jobs..." />)

    cy.get('input[name="search"]').should(
      'have.attr',
      'placeholder',
      'Search jobs...'
    )
  })
})
