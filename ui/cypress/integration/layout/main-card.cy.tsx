import React from 'react'
import MainCard from '../../../components/layout/MainCard'

describe('<MainCard />', () => {
  it('Renders Main Card', () => {
    cy.mount(<MainCard title={'test'} />)
    cy.get('.card-title').contains('test')

    const loading = cy.mount(<MainCard title={'test'} loading={true} />)

    loading.get('.btn').should('exist')
  })
})
