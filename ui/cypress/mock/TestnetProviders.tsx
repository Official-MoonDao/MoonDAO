import { PrivyProvider } from '@privy-io/react-auth'
import { ThirdwebProvider } from 'thirdweb/react'
import CitizenProvider from '@/lib/citizen/CitizenProvider'
import { PrivyThirdwebV5Provider } from '@/lib/privy/PrivyThirdwebV5Provider'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { CYPRESS_CHAIN_V5 } from './config'

export default function TestnetProviders({ citizen = false, children }: any) {
  return (
    <ChainContextV5.Provider
      value={{
        selectedChain: CYPRESS_CHAIN_V5,
        setSelectedChain: () => {},
      }}
    >
      <PrivyWalletContext.Provider
        value={{
          selectedWallet: 0,
          setSelectedWallet: () => {},
        }}
      >
        <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}>
          <ThirdwebProvider>
            <PrivyThirdwebV5Provider selectedChain={CYPRESS_CHAIN_V5}>
              <CitizenProvider selectedChain={CYPRESS_CHAIN_V5} mock={citizen}>
                {children}
              </CitizenProvider>
            </PrivyThirdwebV5Provider>
          </ThirdwebProvider>
        </PrivyProvider>
      </PrivyWalletContext.Provider>
    </ChainContextV5.Provider>
  )
}
