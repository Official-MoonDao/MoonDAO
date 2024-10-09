import React from 'react'
import Address from '@/components/layout/Address'

describe('<Address />', () => {
  it('Renders address', () => {
    cy.mount(<Address address="0x1234567890123456789012345678901234567890" />)
    cy.get('button').should('have.text', '0x1234...7890')
  })
})
