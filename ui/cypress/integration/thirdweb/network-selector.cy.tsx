import { PrivyProvider } from '@privy-io/react-auth'
import { Sepolia } from '@thirdweb-dev/chains'
import { PrivyThirdwebSDKProvider } from '../../../lib/privy/PrivyThirdwebSDKProvider'
import ChainContext from '../../../lib/thirdweb/chain-context'
import NetworkSelector from '@/components/thirdweb/NetworkSelector'

describe('<NetworkSelector />', () => {
  it('Renders Network Selector', () => {
    cy.mount(
      <ChainContext.Provider
        value={{ selectedChain: Sepolia, setSelectedChain: () => {} }}
      >
        <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}>
          <PrivyThirdwebSDKProvider selectedChain={Sepolia}>
            <NetworkSelector />
          </PrivyThirdwebSDKProvider>
        </PrivyProvider>
      </ChainContext.Provider>
    )

    cy.get('#network-selector').should('exist')
    cy.get('#network-selector-dropdown-button').click()
    cy.get('#network-selector-dropdown').should('exist')
  })
})
