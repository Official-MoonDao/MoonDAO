import React from 'react'
import { Steps } from '../../../components/layout/Steps'

describe('<Steps />', () => {
  it('Renders Steps', () => {
    cy.mount(
      <Steps
        id="test-steps"
        steps={['Step 1', 'Step 2', 'Step 3']}
        currStep={0}
        lastStep={2}
        setStep={() => {}}
      />
    )
    cy.get('#test-steps').should('exist')
    cy.get('#test-steps button').should('have.length', 3)
    cy.get('#test-steps button').first().should('have.attr', 'aria-current', 'step')
    cy.get('#test-steps button').first().should('contain.text', 'Step 1')
  })
})
