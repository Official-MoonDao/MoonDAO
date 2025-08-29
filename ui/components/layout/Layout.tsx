import CitizenABI from 'const/abis/Citizen.json'
import { CITIZEN_ADDRESSES } from 'const/config'
import useTranslation from 'next-translate/useTranslation'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React from 'react'
import { useState } from 'react'
import { useContext } from 'react'
import { Toaster } from 'react-hot-toast'
import { Analytics } from "@vercel/analytics/next"
import CitizenContext from '@/lib/citizen/citizen-context'
import useNavigation from '@/lib/navigation/useNavigation'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { LogoSidebarLight, LogoSidebar } from '../assets'
import { PrivyConnectWallet } from '../privy/PrivyConnectWallet'
import CitizenProfileLink from '../subscription/CitizenProfileLink'
import CookieBanner from './CookieBanner'
import GlobalSearch from './GlobalSearch'
import ColorsAndSocials from './Sidebar/ColorsAndSocials'
import LanguageChange from './Sidebar/LanguageChange'
import MobileMenuTop from './Sidebar/MobileMenuTop'
import MobileSidebar from './Sidebar/MobileSidebar'
import NavigationLink from './Sidebar/NavigationLink'
import TopNavBar from './TopNavBar'

interface Layout {
  children: JSX.Element
  lightMode: boolean
  setLightMode: (mode: boolean) => void
}

export default function Layout({ children, lightMode, setLightMode }: Layout) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const router = useRouter()

  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)

  const { citizen } = useContext(CitizenContext)
  const citizenContract = useContract({
    address: CITIZEN_ADDRESSES[chainSlug],
    chain: selectedChain,
    abi: CitizenABI as any,
  })

  const navigation = useNavigation(citizen)

  const [currentLang, setCurrentLang] = useState(router.locale)
  const { t } = useTranslation('common')
  //Background is defined in this root div.

  const isFullscreen =
    router.pathname === '/launch' ||
    router.pathname === '/home' ||
    router.pathname === '/about' ||
    router.pathname === '/faq' ||
    router.pathname === '/constitution' ||
    router.pathname === '/news' ||
    router.pathname === '/mission/[tokenId]' || 
    router.pathname === '/dude-perfect' ||
    router.pathname === '/network' ||
    router.pathname === '/network-overview' ||
    router.pathname === '/mooney' ||
    router.pathname === '/governance' ||
    router.pathname === '/projects-overview' ||
    router.pathname === '/get-mooney' ||
    router.pathname === '/lock' ||
    router.pathname === '/bridge'

  const isHomepage = router.pathname === '/'

  // Use top nav for all pages now
  const layout = (
    <div
      id="app-layout"
      className={`${
        !lightMode ? 'dark background-dark' : 'background-light'
      } min-h-screen`}
    >
      <>
        {/* Mobile menu top bar - for screens smaller than xl */}
        <div className="xl:hidden">
          <MobileMenuTop
            setSidebarOpen={setSidebarOpen}
            lightMode={lightMode}
            setLightMode={setLightMode}
            citizenContract={citizenContract}
            isFullscreen={isFullscreen}
          />
        </div>

        <MobileSidebar
          navigation={navigation}
          lightMode={lightMode}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          isFullscreen={isFullscreen}
        />

        {/* Top Navigation Bar - Show on extra large screens (xl) and up */}
        <div className="hidden xl:block">
          <TopNavBar
            navigation={navigation}
            lightMode={lightMode}
            setLightMode={setLightMode}
            citizenContract={citizenContract}
          />
        </div>

        {/* Main Content - Full width with top nav */}
        <main className={`pt-16 w-full min-h-screen ${isFullscreen || isHomepage ? '' : 'flex justify-center'}`}>
          <div className={`w-full min-h-screen ${isFullscreen || isHomepage ? '' : 'max-w-7xl px-4 sm:px-6 lg:px-8'}`}>
            {children}
          </div>
        </main>

        {/* Global Search - Sticky on all pages */}
        <GlobalSearch />
      </>

      <CookieBanner />
      <Toaster />
      <Analytics />
    </div>
  )

  return layout
}
