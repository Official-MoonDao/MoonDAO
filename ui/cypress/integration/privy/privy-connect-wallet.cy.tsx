import { PrivyProvider } from '@privy-io/react-auth'
import { Sepolia } from '@thirdweb-dev/chains'
import { PrivyThirdwebSDKProvider } from '../../../lib/privy/PrivyThirdwebSDKProvider'
import ChainContext from '../../../lib/thirdweb/chain-context'
import { PrivyConnectWallet } from '../../../components/privy/PrivyConnectWallet'

describe('<PrivyConnectWallet />', () => {
  it('Renders Privy Web3 Connect Wallet Button', () => {
    cy.mount(
      <ChainContext.Provider
        value={{ selectedChain: Sepolia, setSelectedChain: () => {} }}
      >
        <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}>
          <PrivyThirdwebSDKProvider selectedChain={Sepolia}>
            <PrivyConnectWallet />
          </PrivyThirdwebSDKProvider>
        </PrivyProvider>
      </ChainContext.Provider>
    )

    cy.get('button').should('have.text', 'Connect')
  })
})
