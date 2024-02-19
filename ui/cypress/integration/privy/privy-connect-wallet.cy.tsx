import { PrivyProvider } from '@privy-io/react-auth'
import { Chain, Mumbai } from '@thirdweb-dev/chains'
import React, { useState } from 'react'
import { PrivyThirdwebSDKProvider } from '../../../lib/privy/PrivyThirdwebSDKProvider'
import ChainContext from '../../../lib/thirdweb/chain-context'
import { PrivyConnectWallet } from '../../../components/privy/PrivyConnectWallet'

describe('<PrivyConnectWallet />', () => {
  //first load privy provider
  it('Renders Privy Web3 Connect Wallet Button', () => {
    cy.mount(
      <ChainContext.Provider
        value={{ selectedChain: Mumbai, setSelectedChain: () => {} }}
      >
        <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}>
          <PrivyThirdwebSDKProvider selectedChain={Mumbai}>
            <PrivyConnectWallet />
          </PrivyThirdwebSDKProvider>
        </PrivyProvider>
      </ChainContext.Provider>
    )

    cy.get('button').should('have.text', 'Connect')
  })
})
