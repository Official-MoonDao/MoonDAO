import { PrivyProvider } from '@privy-io/react-auth'
import { DEFAULT_CHAIN_V5 } from 'const/config'
import { FlagProvider } from 'const/flags'
import { SessionProvider } from 'next-auth/react'
import { NextQueryParamProvider } from 'next-query-params'
import React, { useEffect, useState } from 'react'
import { Chain as ChainV5 } from 'thirdweb/chains'
import { ThirdwebProvider } from 'thirdweb/react'
import { useLightMode } from '../lib/utils/hooks/useLightMode'
import CitizenProvider from '@/lib/citizen/CitizenProvider'
import { PrivyThirdwebV5Provider } from '@/lib/privy/PrivyThirdwebV5Provider'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import GTag from '../components/layout/GTag'
import Layout from '../components/layout/Layout'
import '../styles/globals.css'

function App({ Component, pageProps: { session, ...pageProps } }: any) {
  const [selectedWallet, setSelectedWallet] = useState<number>(0)
  const [selectedChainV5, setSelectedChainV5]: any =
    useState<ChainV5>(DEFAULT_CHAIN_V5)

  const [lightMode, setLightMode] = useLightMode()

  useEffect(() => {
    setLightMode(false)
  })

  return (
    <SessionProvider session={session}>
      <GTag GTAG={process.env.NEXT_PUBLIC_GTAG as string} />
      <ChainContextV5.Provider
        value={{
          selectedChain: selectedChainV5,
          setSelectedChain: setSelectedChainV5,
        }}
      >
        <PrivyWalletContext.Provider
          value={{ selectedWallet, setSelectedWallet }}
        >
          <PrivyProvider
            appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}
            config={{
              loginMethods: ['wallet', 'sms', 'google', 'twitter', 'discord'],
              appearance: {
                theme: '#252c4d',
                showWalletLoginFirst: false,
                logo: '/Original_White.png',
                accentColor: '#d85c4c',
              },
              legal: {
                termsAndConditionsUrl:
                  'https://docs.moondao.com/Legal/Website-Terms-and-Conditions',
                privacyPolicyUrl:
                  'https://docs.moondao.com/Legal/Website-Privacy-Policy',
              },
            }}
          >
            <ThirdwebProvider>
              <PrivyThirdwebV5Provider selectedChain={selectedChainV5}>
                <CitizenProvider selectedChain={selectedChainV5}>
                  <NextQueryParamProvider>
                    <Layout lightMode={lightMode} setLightMode={setLightMode}>
                      <FlagProvider>
                        <Component {...pageProps} />
                      </FlagProvider>
                    </Layout>
                  </NextQueryParamProvider>
                </CitizenProvider>
              </PrivyThirdwebV5Provider>
            </ThirdwebProvider>
          </PrivyProvider>
        </PrivyWalletContext.Provider>
      </ChainContextV5.Provider>
    </SessionProvider>
  )
}

export default App
