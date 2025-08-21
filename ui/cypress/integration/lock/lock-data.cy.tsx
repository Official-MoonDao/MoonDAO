import { BigNumber } from 'ethers'
import React from 'react'
import { LockData } from '../../../components/lock/LockData'

describe('<LockData />', () => {
  it('Renders Lock Data', () => {
    cy.mount(
      <LockData
        hasLock={true}
        VMOONEYBalance={BigNumber.from('1000000000000000000')}
        VMOONEYBalanceLoading={false}
        VMOONEYLock={[
          BigNumber.from('1000000000000000000'),
          BigNumber.from(Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365),
        ]}
        VMOONEYLockLoading={false}
      />
    )
    cy.get('#lock-data').should('exist')

    //check lock data balances
    cy.get('#lock-data')
      .get('#lock-data-vmooney-balance')
      .should('have.text', '1')
    cy.get('#lock-data')
      .get('#lock-data-locked-mooney')
      .should('have.text', '1.00')
  })
})
