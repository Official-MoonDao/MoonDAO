import { DEFAULT_CHAIN_V5 } from 'const/config'
import { FlagProvider } from 'const/flags'
import { SessionProvider } from 'next-auth/react'
import { NextQueryParamProvider } from 'next-query-params'
import React, { useEffect, useState, useMemo } from 'react'
import { Chain as ChainV5 } from 'thirdweb/chains'
import { useLightMode } from '../lib/utils/hooks/useLightMode'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { PrivyProvider } from '@privy-io/react-auth'
import { ThirdwebProvider } from 'thirdweb/react'
import { PrivyThirdwebV5Provider } from '@/lib/privy/PrivyThirdwebV5Provider'
import CitizenProvider from '@/lib/citizen/CitizenProvider'
import { reportWebVitals as reportVitals, monitorLongTasks, monitorPageVisibility, NextWebVitalsMetric } from '@/lib/performance/webVitals'
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

  // Initialize performance monitoring
  useEffect(() => {
    monitorLongTasks()
    const cleanup = monitorPageVisibility()
    return cleanup
  }, [])

  const chainContextValue = useMemo(
    () => ({
      selectedChain: selectedChainV5,
      setSelectedChain: setSelectedChainV5,
    }),
    [selectedChainV5]
  )

  const walletContextValue = useMemo(
    () => ({ selectedWallet, setSelectedWallet }),
    [selectedWallet]
  )

  return (
    <SessionProvider session={session}>
      <GTag GTAG={process.env.NEXT_PUBLIC_GTAG as string} />
      <ChainContextV5.Provider value={chainContextValue}>
        <PrivyWalletContext.Provider value={walletContextValue}>
          <PrivyProvider
            appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}
            config={{
              loginMethods: ['wallet', 'sms', 'google', 'twitter', 'discord', 'github'],
              appearance: {
                theme: '#252c4d',
                showWalletLoginFirst: false,
                logo: '/Original_White.png',
                accentColor: '#d85c4c',
              },
              legal: {
                termsAndConditionsUrl: 'https://docs.moondao.com/Legal/Website-Terms-and-Conditions',
                privacyPolicyUrl: 'https://docs.moondao.com/Legal/Website-Privacy-Policy',
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

// Next.js Web Vitals reporting
export function reportWebVitals(metric: NextWebVitalsMetric) {
  reportVitals(metric)
}

export default App
