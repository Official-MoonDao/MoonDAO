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
import { useImportToken } from '../../lib/utils/import-token'
import { LogoSidebarLight, LogoWhite, LogoSidebar } from '../assets'
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

  const importToken = useImportToken()

  const chain = useChain()
  const { selectedChain } = useContext(ChainContext)

  const [currentLang, setCurrentLang] = useState(router.locale)
  const [isTokenImported, setIsTokenImported] = useState(false)

  useEffect(() => {
    if (localStorage.getItem('MOONEY_isImported')) setIsTokenImported(true)
  }, [address])
  const { t } = useTranslation('common');
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
        <div className="flex flex-grow flex-col overflow-y-auto pt-5 sidebar-bg-light dark:sidebar-bg-dark">
          <a href="https://moondao.com">
            <div className="flex flex-shrink-0 items-center px-4 pl-6">
              {lightMode ? <LogoSidebarLight /> : <LogoSidebar />}
            </div>
          </a>
          <div className="flex flex-grow flex-col pt-9 lg:pl-2">
            <nav className="flex-1 open space-y-1 px-4">
              {navigation.map((item, i) => (
                <NavigationLink item={item} key={i} />
              ))}
              {/*Language change, import button*/}
              <ul className="pt-4 px-3">
                {/*Language change button*/}
                <LanguageChange />
                {/*Import MOONEY, will add to LOCK MOONEY page*/}
                {address && !isTokenImported && (
                  <li className="mt-1 hidden bg-red-500">
                    <button
                      className="p-2 "
                      onClick={async () => {
                        const wasAdded = await importToken()
                        setIsTokenImported(wasAdded)
                      }}
                    >
                      {currentLang === 'en'
                        ? 'Import $MOONEY Token'
                        : '导入 $MOONEY 代币'}
                    </button>
                  </li>
                )}
              </ul>
            </nav>
          </div>

          {/*Color mode and Social links*/}
          <div className="flex flex-col pb-6 pl-7 lg:pl-9">
            <ColorsAndSocials
              lightMode={lightMode}
              setLightMode={setLightMode}
            />
          </div>
        </div>
      </div>

      {/*The content, child rendered here*/}
      <main className="flex justify-center pb-24 md:ml-48 relative">
        <section
          className={`mt-4 flex flex-col lg:w-[80%] lg:px-14 xl:px-16 2xl:px-20`}
        >
          {/*Connect Wallet and Preferred network warning*/}
          <div
            className={`max-w-[1400px] mb-4 lg:mb-2 flex flex-col items-end`}
          >
            {/* <div
              className={`${
                address && chain?.name === selectedChain?.name
                  ? 'hidden'
                  : ' mb-3'
              }`}
            >
              {address && chain?.name !== selectedChain?.name && (
                <SwitchNetworkBanner newNetwork={selectedChain} />
              )}
            </div> */}

            {/* <ConnectWallet className="!bg-gradient-to-b !text-slate-800 dark:!text-zinc-50 from-moon-gold to-yellow-300 dark:to-amber-400 !border-yellow-200 !border-opacity-50 !shadow !shadow-gray-200 hover:!scale-105 !transition-all !duration-150" /> */}

            <PrivyConnectWallet />
          </div>
          {children}
        </section>
      </main>

      <Toaster />
    </div>
  )

  return layout
}
