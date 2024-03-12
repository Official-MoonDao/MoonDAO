import React from 'react'
import MainCard from '../../../components/layout/MainCard'

describe('<MainCard />', () => {
  it('Renders Main Card', () => {
    cy.mount(<MainCard title={'test'} />)
    cy.get('.card-title').contains('test')

    cy.mount(<MainCard title={'test'} loading={true} />)

    cy.get('.btn').should('exist')
  })
})
