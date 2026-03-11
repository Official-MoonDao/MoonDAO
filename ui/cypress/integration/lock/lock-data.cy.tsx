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

    //check lock data balances - vMOONEY is now calculated via linear decay from lock
    // 1 MOONEY locked for 1 year = ~0.25 vMOONEY (1/4 of MAXTIME)
    cy.get('#lock-data')
      .get('#lock-data-vmooney-balance')
      .should('include.text', '0.25')
    cy.get('#lock-data')
      .get('#lock-data-locked-mooney')
      .should('have.text', '1.00')
  })
})
