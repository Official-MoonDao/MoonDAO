import { Ethereum, Goerli } from '@thirdweb-dev/chains'
import { ThirdwebProvider } from '@thirdweb-dev/react'
import React from 'react'
import { initSDK } from '../../../lib/thirdweb/thirdweb'
import SweepstakesSelection from '../../../components/zero-g/SweepstakesSelection'

describe('<SweepstakesSelection />', () => {
  let sweepstakesContract: any
  before(() => {
    const sdk = initSDK(Ethereum)
    sdk
      .getContract('0xB255c74F8576f18357cE6184DA033c6d93C71899')
      .then((contract) => {
        sweepstakesContract = contract
      })
  })
  it('Renders Sweepstakes Selection', () => {
    cy.mount(
      <ThirdwebProvider activeChain={Goerli}>
        <SweepstakesSelection sweepstakesContract={sweepstakesContract} />
      </ThirdwebProvider>
    )

    cy.get('#sweepstakes-winners').should('exist')

    //wait up to 30 seconds for winners to load
    const loop = Array.from({ length: 30 }, (v, k) => k + 1)
    cy.wrap(loop).each(() => {
      let isLoading = true
      cy.get('#sweepstakes-winners')
        .children()
        .then((children) => {
          if (children?.[1]) {
            //check that the first winner's discord username is displayed
            cy.get('#winner-discord-username').should('exist')

            //check that there are 10 winners
            cy.get('#sweepstakes-winners')
              .children()
              .should('have.length', 10)
              .then(() => (isLoading = false))
          } else {
            cy.wait(1000)
          }
        })
      if (!isLoading) {
        return false
      }
    })
  })
})
