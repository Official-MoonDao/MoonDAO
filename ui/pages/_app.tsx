import { PrivyProvider } from '@privy-io/react-auth'
import { DEFAULT_CHAIN_V5 } from 'const/config'
import { FlagProvider } from 'const/flags'
import { SessionProvider } from 'next-auth/react'
import { NextQueryParamProvider } from 'next-query-params'
import { useRouter } from 'next/router'
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
import BottomNavBar from '../components/pwa/BottomNavBar'
import LoadingAnimation from '../components/pwa/LoadingAnimation'
import '../styles/globals.css'

function App({ Component, pageProps: { session, ...pageProps } }: any) {
  const router = useRouter()
  const [selectedWallet, setSelectedWallet] = useState<number>(0)
  const [selectedChainV5, setSelectedChainV5]: any = useState<ChainV5>(DEFAULT_CHAIN_V5)

  const [lightMode, setLightMode] = useLightMode()

  const [isPWA] = useState(() => {
    if (typeof window === 'undefined') return false
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    )
  })

  // Only show loading for PWA
  const [isAppLoading, setIsAppLoading] = useState(isPWA)

  useEffect(() => {
    setLightMode(false)

    // Only run loading logic for PWA
    if (isPWA) {
      let hasHidden = false
      const timeouts: NodeJS.Timeout[] = []

      const hideLoading = () => {
        if (!hasHidden) {
          hasHidden = true
          console.log('[PWA] Hiding loading screen')
          setIsAppLoading(false)
        }
      }

      // Failsafe: Force hide after 3 seconds maximum
      const maxTimeout = setTimeout(() => {
        console.log('[PWA] Max timeout reached, forcing loading screen to hide')
        hideLoading()
      }, 3000)
      timeouts.push(maxTimeout)

      const startTime = Date.now()

      // Check if app is ready
      const checkReady = () => {
        const isRouterReady = router.isReady
        const isDocumentReady = document.readyState === 'complete'

        console.log('[PWA] Checking ready state:', { isRouterReady, isDocumentReady })

        if (isRouterReady && isDocumentReady) {
          // Wait minimum 1s for smooth transition, then hide
          const elapsed = Date.now() - startTime
          const remainingTime = Math.max(0, 1000 - elapsed)

          const hideTimeout = setTimeout(() => {
            hideLoading()
          }, remainingTime)
          timeouts.push(hideTimeout)
        } else if (!hasHidden) {
          const checkTimeout = setTimeout(checkReady, 100)
          timeouts.push(checkTimeout)
        }
      }

      checkReady()

      return () => {
        // Clear all timeouts on cleanup
        timeouts.forEach(clearTimeout)
      }
    }
  }, [isPWA, router.isReady, setLightMode])

  return (
    <>
      <LoadingAnimation isLoading={isAppLoading} minDisplayTime={1000} />
      <SessionProvider session={session}>
        <GTag GTAG={process.env.NEXT_PUBLIC_GTAG as string} />
        <ChainContextV5.Provider
          value={{
            selectedChain: selectedChainV5,
            setSelectedChain: setSelectedChainV5,
          }}
        >
          <PrivyWalletContext.Provider value={{ selectedWallet, setSelectedWallet }}>
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
                  termsAndConditionsUrl:
                    'https://docs.moondao.com/Legal/Website-Terms-and-Conditions',
                  privacyPolicyUrl: 'https://docs.moondao.com/Legal/Website-Privacy-Policy',
                },
              }}
            >
              <ThirdwebProvider>
                <PrivyThirdwebV5Provider selectedChain={selectedChainV5}>
                  <CitizenProvider selectedChain={selectedChainV5}>
                    <NextQueryParamProvider>
                      <div className={isPWA ? 'pb-20' : ''}>
                        <Layout lightMode={lightMode} setLightMode={setLightMode}>
                          <FlagProvider>
                            <Component {...pageProps} />
                          </FlagProvider>
                        </Layout>
                      </div>
                      {isPWA && <BottomNavBar />}
                    </NextQueryParamProvider>
                  </CitizenProvider>
                </PrivyThirdwebV5Provider>
              </ThirdwebProvider>
            </PrivyProvider>
          </PrivyWalletContext.Provider>
        </ChainContextV5.Provider>
      </SessionProvider>
    </>
  )
}

export default App
