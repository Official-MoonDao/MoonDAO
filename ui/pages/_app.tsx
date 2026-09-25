import { DEPLOYED_ORIGIN } from 'const/config'
import { DEFAULT_CHAIN_V5 } from 'const/defaultChain'
import { FlagProvider } from 'const/flags'
import { nextDeprizeChainPin } from '@/lib/deprize/deprizeChainPin'
import { chainForDeprizePath } from '@/lib/deprize/route-chain'
import { SessionProvider } from 'next-auth/react'
import { NextQueryParamProvider } from 'next-query-params'
import { useRouter } from 'next/router'
import React, { useEffect, useState, useMemo, startTransition } from 'react'
import { Chain as ChainV5 } from 'thirdweb/chains'
import { useLightMode } from '../lib/utils/hooks/useLightMode'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { getChainById } from '@/lib/thirdweb/chain'
import { PrivyProvider } from '@privy-io/react-auth'
import { ThirdwebProvider } from 'thirdweb/react'
import { PrivyThirdwebV5Provider } from '@/lib/privy/PrivyThirdwebV5Provider'
import { WalletChainSync } from '@/lib/privy/WalletChainSync'
import CitizenProvider from '@/lib/citizen/CitizenProvider'
import { reportWebVitals as reportVitals, monitorLongTasks, monitorPageVisibility, NextWebVitalsMetric } from '@/lib/performance/webVitals'
import GTag from '../components/layout/GTag'
import Layout from '../components/layout/Layout'
import { OnrampReturnHandler } from '@/components/onramp/OnrampReturnHandler'
import '../styles/globals.css'

function App({ Component, pageProps: { session, ...pageProps } }: any) {
  const router = useRouter()
  // Prefixed prize URLs name the network. Apply that before wallet sync so a
  // refresh of /deprize/sep/2 does not come back on the Arbitrum default.
  // Leaving the prefix restores the chain from before the visit. Otherwise a
  // look at the Sepolia index leaves Citizen, balances, and embedded wallets
  // on testnet for the rest of the session.
  const routeChain = chainForDeprizePath(router.pathname)
  const [selectedWallet, setSelectedWallet] = useState<number>(0)
  const [selectedChainV5, setSelectedChainV5] = useState<ChainV5>(
    () => routeChain ?? DEFAULT_CHAIN_V5
  )
  const [pinnedDeprizePath, setPinnedDeprizePath] = useState(router.pathname)
  const [restoreChainId, setRestoreChainId] = useState<number | null>(null)
  const chainPin = nextDeprizeChainPin(
    {
      selectedChainId: selectedChainV5.id,
      pinnedPath: pinnedDeprizePath,
      restoreChainId,
    },
    router.pathname,
    DEFAULT_CHAIN_V5.id
  )
  if (
    chainPin.pinnedPath !== pinnedDeprizePath ||
    chainPin.restoreChainId !== restoreChainId ||
    chainPin.selectedChainId !== selectedChainV5.id
  ) {
    setPinnedDeprizePath(chainPin.pinnedPath)
    setRestoreChainId(chainPin.restoreChainId)
    if (chainPin.selectedChainId !== selectedChainV5.id) {
      setSelectedChainV5(getChainById(chainPin.selectedChainId) ?? DEFAULT_CHAIN_V5)
    }
  }

  const [lightMode, setLightMode] = useLightMode()

  // Force dark mode once on mount (the site has no light theme). useLightMode
  // already initializes to false, so this is a no-op unless something flipped
  // it; wrap in startTransition so it cannot race Layout's dehydrated
  // Suspense boundaries during hydration.
  useEffect(() => {
    startTransition(() => setLightMode(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
              loginMethods: ['wallet', 'sms', 'email', 'google', 'twitter', 'discord', 'github'],
              // Auto-provision an embedded wallet for users who sign up without
              // one (e.g. via SMS/social on a magic-link invite) so they have an
              // address to receive their sponsored citizen mint.
              embeddedWallets: {
                ethereum: {
                  createOnLogin: 'users-without-wallets',
                },
              },
              appearance: {
                theme: '#252c4d',
                showWalletLoginFirst: false,
                logo: '/Original_White.png',
                accentColor: '#d85c4c',
              },
              legal: {
                termsAndConditionsUrl: `${DEPLOYED_ORIGIN}/terms-of-service`,
                privacyPolicyUrl: `${DEPLOYED_ORIGIN}/privacy-policy`,
              },
              fundingMethodConfig: {
                moonpay: {
                  paymentMethod: 'credit_debit_card',
                  uiConfig: {
                    accentColor: '#696FFD',
                    theme: 'dark',
                  },
                },
              },
            }}
          >
            <ThirdwebProvider>
              <WalletChainSync />
              <PrivyThirdwebV5Provider selectedChain={selectedChainV5}>
                <CitizenProvider selectedChain={selectedChainV5}>
                  <NextQueryParamProvider>
                    <OnrampReturnHandler />
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
