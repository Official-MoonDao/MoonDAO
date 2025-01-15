import { PrivyProvider } from '@privy-io/react-auth'
import { Chain, Arbitrum, Sepolia, ArbitrumSepolia } from '@thirdweb-dev/chains'
import { DEFAULT_CHAIN, DEFAULT_CHAIN_V5 } from 'const/config'
import { NextQueryParamProvider } from 'next-query-params'
import React, { useEffect, useState } from 'react'
import {
  arbitrum,
  arbitrumSepolia,
  sepolia,
  Chain as ChainV5,
} from 'thirdweb/chains'
import { ThirdwebProvider } from 'thirdweb/react'
import { PrivyThirdwebSDKProvider } from '../lib/privy/PrivyThirdwebSDKProvider'
import ChainContext from '../lib/thirdweb/chain-context'
import { useLightMode } from '../lib/utils/hooks/useLightMode'
import CitizenProvider from '@/lib/citizen/CitizenProvider'
import { PrivyThirdwebV5Provider } from '@/lib/privy/PrivyThirdwebV5Provider'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import GTag from '../components/layout/GTag'
import Layout from '../components/layout/Layout'
import '../styles/globals.css'

function App({ Component, pageProps: { session, ...pageProps } }: any) {
  const [selectedChain, setSelectedChain]: any = useState<Chain>(DEFAULT_CHAIN)
  console.log('DEFAULT_CHAIN', DEFAULT_CHAIN)
  //const [selectedChain, setSelectedChain]: any = useState<Chain>(
  //process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Arbitrum : ArbitrumSepolia
  //)

  const [selectedChainV5, setSelectedChainV5]: any =
    useState<ChainV5>(DEFAULT_CHAIN_V5)
  console.log('DEFAULT_CHAIN_V5', DEFAULT_CHAIN_V5)

  const [lightMode, setLightMode] = useLightMode()

  useEffect(() => {
    setLightMode(false)
  })

  return (
    <>
      <GTag GTAG={process.env.NEXT_PUBLIC_GTAG as string} />
      <ChainContext.Provider value={{ selectedChain, setSelectedChain }}>
        <ChainContextV5.Provider
          value={{
            selectedChain: selectedChainV5,
            setSelectedChain: setSelectedChainV5,
          }}
        >
          <PrivyProvider
            appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}
            config={{
              loginMethods: ['wallet', 'sms', 'google', 'twitter'],
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
            <PrivyThirdwebSDKProvider selectedChain={selectedChain}>
              <ThirdwebProvider>
                <PrivyThirdwebV5Provider selectedChain={selectedChain}>
                  <CitizenProvider selectedChain={selectedChain}>
                    <Layout lightMode={lightMode} setLightMode={setLightMode}>
                      <NextQueryParamProvider>
                        <Component {...pageProps} />
                      </NextQueryParamProvider>
                    </Layout>
                  </CitizenProvider>
                </PrivyThirdwebV5Provider>
              </ThirdwebProvider>
            </PrivyThirdwebSDKProvider>
          </PrivyProvider>
        </ChainContextV5.Provider>
      </ChainContext.Provider>
    </>
  )
}

export default App
