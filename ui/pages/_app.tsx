import { PrivyProvider } from '@privy-io/react-auth'
import { Chain, Mumbai, Polygon, Sepolia } from '@thirdweb-dev/chains'
import React, { useEffect, useState } from 'react'
import { PrivyThirdwebSDKProvider } from '../lib/privy/PrivyThirdwebSDKProvider'
import ChainContext from '../lib/thirdweb/chain-context'
import { useLightMode } from '../lib/utils/hooks/useLightMode'
import GTag from '../components/layout/GTag'
import Layout from '../components/layout/Layout'
import '../styles/globals.css'

function App({ Component, pageProps: { session, ...pageProps } }: any) {
  const [selectedChain, setSelectedChain]: any = useState<Chain>(
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Polygon : Sepolia
  )

  const [lightMode, setLightMode] = useLightMode()

  useEffect(() => {
    setLightMode(false)
  })

  return (
    <>
      <GTag />
      <ChainContext.Provider value={{ selectedChain, setSelectedChain }}>
        <PrivyProvider
          appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}
          config={{
            loginMethods: ['wallet', 'sms', 'google', 'twitter'],
            appearance: {
              theme: '#252c4d',
              showWalletLoginFirst: false,
              logo: 'Original_White.png',
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
            <Layout lightMode={lightMode} setLightMode={setLightMode}>
              <Component {...pageProps} />
            </Layout>
          </PrivyThirdwebSDKProvider>
        </PrivyProvider>
      </ChainContext.Provider>
    </>
  )
}

export default App
