import React from 'react'
import GradientLink from '../../../components/layout/GradientLink'

describe('<GradientLink />', () => {
  it('Renders Gradient Link', () => {
    cy.mount(<GradientLink text="test" href="/" />)

    cy.get('p').contains('test →')
    cy.get('#gradient-link').get('a').should('have.attr', 'href', '/')
  })
})
