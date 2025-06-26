import CitizenABI from 'const/abis/Citizen.json'
import { CITIZEN_ADDRESSES } from 'const/config'
import useTranslation from 'next-translate/useTranslation'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React from 'react'
import { useState } from 'react'
import { useContext } from 'react'
import { Toaster } from 'react-hot-toast'
import CitizenContext from '@/lib/citizen/citizen-context'
import useNavigation from '@/lib/navigation/useNavigation'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { LogoSidebarLight, LogoSidebar } from '../assets'
import { PrivyConnectWallet } from '../privy/PrivyConnectWallet'
import CitizenProfileLink from '../subscription/CitizenProfileLink'
import CookieBanner from './CookieBanner'
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
    router.pathname === '/about' ||
    router.pathname === '/faq' ||
    router.pathname === '/constitution' ||
    router.pathname === '/news' ||
    router.pathname === '/mission/[tokenId]' || 
    router.pathname === '/dude-perfect'

  // Use top nav only for homepage
  const isHomepage = router.pathname === '/'

  const layout = (
    <div
      id="app-layout"
      className={`${
        !lightMode ? 'dark background-dark' : 'background-light'
      } min-h-screen`}
    >
      {isHomepage ? (
        <>
          {/* Mobile menu top bar - for screens that can't fit the nav bar */}
          <MobileMenuTop
            setSidebarOpen={setSidebarOpen}
            lightMode={lightMode}
            setLightMode={setLightMode}
            citizenContract={citizenContract}
            isFullscreen={false}
          />

          <MobileSidebar
            navigation={navigation}
            lightMode={lightMode}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            isFullscreen={false}
          />

          {/* Top Navigation Bar - Show on medium screens (md) and up */}
          <div className="hidden md:block">
            <TopNavBar
              navigation={navigation}
              lightMode={lightMode}
              setLightMode={setLightMode}
              citizenContract={citizenContract}
            />
          </div>

          {/* Main Content - Full width for homepage */}
          <main className="lg:pt-16 lg:-mt-12 w-full min-h-screen">
            <div className="w-full min-h-screen">
              {children}
            </div>
          </main>
        </>
      ) : (
        <>
          {/*Mobile menu top bar*/}
          <MobileMenuTop
            setSidebarOpen={setSidebarOpen}
            lightMode={lightMode}
            setLightMode={setLightMode}
            citizenContract={citizenContract}
            isFullscreen={isFullscreen}
          />

          <MobileSidebar
            navigation={navigation}
            lightMode={lightMode}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            isFullscreen={isFullscreen}
          />

          {/* Static sidebar for desktop */}
          <div
            className={`relative z-10 hidden ${
              isFullscreen
                ? ''
                : 'md:inset-y-0 md:flex md:w-60 md:flex-col lg:w-[275px]'
            }`}
          >
            {/* Sidebar component*/}
            <div className="w-[250px] lg:w-[275px] flex flex-grow flex-col pt-5">
              <Link href="/" passHref>
                <div className="mt-2 ml-7 lg:ml-9 flex flex-shrink-0 items-center px-4 pl-6">
                  <LogoSidebar />
                </div>
              </Link>
              <div className="flex flex-grow flex-col pt-9 lg:pl-2">
                <div className="h-[50px] pl-6 mb-4 flex justify-center items-center">
                  <PrivyConnectWallet
                    type="desktop"
                    citizenContract={citizenContract}
                  />

                  <div className="relative mt-1 lg:right-4">
                    <CitizenProfileLink />
                  </div>
                </div>
                <nav className="flex flex-col px-4 overflow-y-auto h-[calc(75vh-2rem)] pb-[4rem]">
                  {navigation.map((item, i) => (
                    <NavigationLink key={`nav-link-${i}`} item={item} />
                  ))}
                  {/*Language change, import button*/}
                  <ul className="pt-4 px-3">
                    {/*Language change button*/}
                    <LanguageChange />
                  </ul>
                </nav>
              </div>

              {/*Color mode and Social links*/}
              <div
                className={`fixed bottom-0 flex flex-col justify-center w-[230px] lg:w-[258px] p-4 pl-7 lg:pl-9 backdrop-blur-md`}
              >
                <ColorsAndSocials
                  lightMode={lightMode}
                  setLightMode={setLightMode}
                />
              </div>
            </div>
          </div>

          {/*The content, child rendered here*/}
          <main
            className={`flex justify-center ${
              isFullscreen ? 'md:ml-0' : 'md:ml-60'
            } relative`}
          >
            <section
              className={`${
                isFullscreen
                  ? 'w-full '
                  : 'mt-4 md:w-[90%] lg:px-14 xl:px-16 2xl:px-20'
              } flex flex-col`}
            >
              {/*Connect Wallet and Preferred network warning*/}
              {children}
            </section>
          </main>
        </>
      )}

      <CookieBanner />
      <Toaster />
    </div>
  )

  return layout
}
