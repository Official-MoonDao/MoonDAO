import { Chain, Ethereum, Goerli, Mumbai, Polygon } from '@thirdweb-dev/chains'
import { ThirdwebProvider } from '@thirdweb-dev/react'
import { SessionProvider } from 'next-auth/react'
import React, { useState } from 'react'
import { useLocalStorage } from 'usehooks-ts'
import ChainContext from '../lib/thirdweb/chain-context'
import Layout from '../components/layout/Layout'
import '../styles/globals.css'

function App({ Component, pageProps: { session, ...pageProps } }: any) {
  const [selectedChain, setSelectedChain]: any = useState<Chain>(
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Ethereum : Goerli
  )

  const [lightMode, setLightMode] = useLocalStorage('lightMode', false)
  return (
    <ChainContext.Provider value={{ selectedChain, setSelectedChain }}>
      <ThirdwebProvider
        activeChain={selectedChain}
        supportedChains={[Ethereum, Polygon, Goerli, Mumbai]}
      >
        <SessionProvider session={session}>
          <Layout lightMode={lightMode} setLightMode={setLightMode}>
            <Component {...pageProps} />
          </Layout>
        </SessionProvider>
      </ThirdwebProvider>
    </ChainContext.Provider>
  )
}

export default App
