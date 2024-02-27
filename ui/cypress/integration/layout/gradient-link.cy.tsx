import React from 'react'
import GradientLink from '../../../components/layout/GradientLink'

describe('<GradientLink />', () => {
  it('Renders Gradient Link', () => {
    cy.mount(<GradientLink text="test" href="/" />)

    cy.get('p').should('have.text', 'test →')
    cy.get('a').click()
    cy.url().should('include', '/')
  })
})
