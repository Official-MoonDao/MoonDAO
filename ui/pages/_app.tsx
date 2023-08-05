import { Chain, Ethereum, Goerli, Mumbai, Polygon } from '@thirdweb-dev/chains'
import { ThirdwebProvider, walletConnect } from '@thirdweb-dev/react'
import { metamaskWallet, coinbaseWallet, safeWallet } from '@thirdweb-dev/react'
import React, { useState } from 'react'
import { useLocalStorage } from 'usehooks-ts'
import ChainContext from '../lib/thirdweb/chain-context'
import GTag from '../components/layout/GTag'
import Layout from '../components/layout/Layout'
import '../styles/globals.css'

function App({ Component, pageProps: { session, ...pageProps } }: any) {
  const [selectedChain, setSelectedChain]: any = useState<Chain>(
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Ethereum : Goerli
  )

  const [lightMode, setLightMode] = useLocalStorage('lightMode', false)

  return (
    <>
      <GTag />
      <ChainContext.Provider value={{ selectedChain, setSelectedChain }}>
        <ThirdwebProvider
          clientId={process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID}
          activeChain={selectedChain}
          supportedChains={[Ethereum, Polygon, Goerli, Mumbai]}
          supportedWallets={[
            metamaskWallet(),
            coinbaseWallet(),
            safeWallet(),
            walletConnect(),
          ]}
        >
          <Layout lightMode={lightMode} setLightMode={setLightMode}>
            <Component {...pageProps} />
          </Layout>
        </ThirdwebProvider>
      </ChainContext.Provider>
    </>
  )
}

export default App
