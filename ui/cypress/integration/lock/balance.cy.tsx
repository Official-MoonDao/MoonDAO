import React from 'react'
import Balance from '../../../components/Balance'

describe('<Balance />', () => {
  it('Renders Balance', () => {
    cy.mount(<Balance id="test-balance" balance={'1'} loading={false} />)

    cy.get('#test-balance').should('have.text', '1')
  })
})
