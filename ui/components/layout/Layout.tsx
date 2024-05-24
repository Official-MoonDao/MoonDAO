import { useAddress } from '@thirdweb-dev/react'
//Network warning
import { useChain } from '@thirdweb-dev/react'
import useTranslation from 'next-translate/useTranslation'
import { useRouter } from 'next/router'
import Script from 'next/script'
import React from 'react'
import { useState, useEffect } from 'react'
import { useContext } from 'react'
import { Toaster } from 'react-hot-toast'
import ChainContext from '../../lib/thirdweb/chain-context'
import { LogoSidebarLight, LogoSidebar } from '../assets'
import { PrivyConnectWallet } from '../privy/PrivyConnectWallet'
import ColorsAndSocials from './Sidebar/ColorsAndSocials'
import LanguageChange from './Sidebar/LanguageChange'
import MobileMenuTop from './Sidebar/MobileMenuTop'
import MobileSidebar from './Sidebar/MobileSidebar'
import { navigation } from './Sidebar/Navigation'
import NavigationLink from './Sidebar/NavigationLink'

interface Layout {
  children: JSX.Element
  lightMode: boolean
  setLightMode: Function
}

export default function Layout({ children, lightMode, setLightMode }: Layout) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const router = useRouter()
  const address = useAddress()

  const chain = useChain()
  const { selectedChain } = useContext(ChainContext)

  const [currentLang, setCurrentLang] = useState(router.locale)
  const { t } = useTranslation('common')
  //Background is defined in this root div.
  const layout = (
    <div
      id="app-layout"
      className={`${
        !lightMode ? 'dark background-dark' : 'background-light'
      } min-h-screen`}
    >
      <Script src="https://cdn.splitbee.io/sb.js" />

      {/*Mobile menu top bar*/}
      <MobileMenuTop
        setSidebarOpen={setSidebarOpen}
        lightMode={lightMode}
        setLightMode={setLightMode}
      />

      <MobileSidebar
        lightMode={lightMode}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      {/* Static sidebar for desktop */}
      <div className="relative z-10 hidden md:fixed md:inset-y-0 md:flex md:w-60 md:flex-col lg:w-[275px]">
        {/* Sidebar component*/}
        <div className="w-[250px] lg:w-[275px] flex flex-grow flex-col pt-5 sidebar-bg-light dark:sidebar-bg-dark pb-24">
          <a href="https://moondao.com">
            <div className="flex flex-shrink-0 items-center px-4 pl-6">
              {lightMode ? <LogoSidebarLight /> : <LogoSidebar />}
            </div>
          </a>
          <div className="flex flex-grow flex-col pt-9 lg:pl-2">
            <div className="pl-6 mb-4 flex justify-center">
              <PrivyConnectWallet />
            </div>
            <nav className="flex flex-col px-4 overflow-y-auto h-[calc(80vh-4rem)]">
              {navigation.map((item, i) => (
                <NavigationLink item={item} key={i} />
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
            className={`flex flex-col justify-center w-[250px] lg:w-[275px] p-4 pl-7 lg:pl-9`}
          >
            <ColorsAndSocials
              lightMode={lightMode}
              setLightMode={setLightMode}
            />
          </div>
        </div>
      </div>

      {/*The content, child rendered here*/}
      <main className="flex justify-center pb-24 md:ml-60 relative">
        <section
          className={`mt-4 flex flex-col md:w-[90%] lg:px-14 xl:px-16 2xl:px-20`}
        >
          {/*Connect Wallet and Preferred network warning*/}
          {children}
        </section>
      </main>

      <Toaster />
    </div>
  )

  return layout
}
