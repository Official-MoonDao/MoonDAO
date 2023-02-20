import { ethers } from 'ethers'
import { SessionProvider } from 'next-auth/react'
import { useEffect, useState } from 'react'
import React from 'react'
import { NftProvider } from 'use-nft'
import { WagmiConfig, createClient } from 'wagmi'
import { connectors, provider as externalProvider } from '../lib/connectors'
import { ErrorProvider } from '../components/layout/ErrorProvider'
import Layout from '../components/layout/Layout'
import '../styles/globals.css'

declare let window: any
function App({ Component, pageProps: { session, ...pageProps } }: any) {
  const [client, setClient] = useState<any>()

  useEffect(() => {
    let provider = externalProvider

    const userProvider =
      window.ethereum || (window as unknown as any).web3?.currentProvider
    if (userProvider && process.env.NEXT_PUBLIC_CHAIN !== 'local') {
      provider = () => {
        console.log(
          `Provider: Connected to the user's provider on chain with ID ${parseInt(
            userProvider.networkVersion
          )}`
        )
        return new ethers.providers.Web3Provider(
          userProvider,
          process.env.NEXT_PUBLIC_CHAIN
        )
      }
    }
    setClient(
      createClient({
        autoConnect: true,
        connectors,
        provider: provider(),
      })
    )
  }, [])

  return (
    <>
      {client && (
        <WagmiConfig client={client}>
          <NftProvider fetcher={['ethers', { provider: externalProvider() }]}>
            <SessionProvider session={session}>
              <ErrorProvider>
                <Layout>
                  <Component {...pageProps} />
                </Layout>
              </ErrorProvider>
            </SessionProvider>
          </NftProvider>
        </WagmiConfig>
      )}
    </>
  )
}

export default App
