import { PrivyProvider } from '@privy-io/react-auth'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ErrorBoundary } from 'react-error-boundary'
import { ThirdwebProvider } from 'thirdweb/react'
import CitizenProvider from '@/lib/citizen/CitizenProvider'
import JuiceProviders from '@/lib/juicebox/JuiceProviders'
import { PrivyThirdwebV5Provider } from '@/lib/privy/PrivyThirdwebV5Provider'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { CYPRESS_CHAIN_V5 } from './config'

const queryClient = new QueryClient()

function ErrorFallback({ error }: { error: Error }) {
  return (
    <div role="alert">
      <p>Something went wrong:</p>
      <pre>{error.message}</pre>
    </div>
  )
}

export default function TestnetProviders({ citizen = false, children }: any) {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <QueryClientProvider client={queryClient}>
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
            <PrivyProvider
              appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}
              config={{
                loginMethods: ['email', 'wallet'],
                appearance: {
                  theme: 'light',
                  accentColor: '#000000',
                },
              }}
            >
              <ThirdwebProvider>
                <PrivyThirdwebV5Provider selectedChain={CYPRESS_CHAIN_V5}>
                  <CitizenProvider
                    selectedChain={CYPRESS_CHAIN_V5}
                    mock={citizen}
                  >
                    {children}
                  </CitizenProvider>
                </PrivyThirdwebV5Provider>
              </ThirdwebProvider>
            </PrivyProvider>
          </PrivyWalletContext.Provider>
        </ChainContextV5.Provider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
