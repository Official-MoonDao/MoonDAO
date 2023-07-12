import {
  KeyIcon,
  UserIcon,
  ArrowLeftOnRectangleIcon,
  XCircleIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline'
import { ConnectWallet, useAddress } from '@thirdweb-dev/react'
import useTranslation from 'next-translate/useTranslation'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Script from 'next/script'
import React from 'react'
import { useState, useEffect } from 'react'
import { useImportToken } from '../../lib/utils/import-token'
import { LogoBlack, LogoWhite, CNAsset } from '../assets'
import PreferredNetworkWrapper from '../thirdweb/PreferredNetworkWrapper'
import ColorsAndSocials from './Sidebar/ColorsAndSocials'
import MobileMenuTop from './Sidebar/MobileMenuTop'
import { navigation } from './Sidebar/Navigation'
import NavigationLink from './Sidebar/NavigationLink'
import ExternalLinks from './Sidebar/ExternalLinks'

type Indexable = {
  [key: string]: any
}

export default function Layout({ children, lightMode, setLightMode }: any) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const router = useRouter()

  const address = useAddress()

  const importToken = useImportToken()

  const [nav, setNav] = useState(navigation)

  const [currentLang, setCurrentLang] = useState(router.locale)
  const [isTokenImported, setIsTokenImported] = useState(false)
  const changeLang = (e: any, lang: any) => {
    e.preventDefault()
    setCurrentLang(lang)
    router.push(router.pathname, router.pathname, { locale: lang })
  }

  useEffect(() => {
    if (localStorage.getItem('MOONEY_isImported')) setIsTokenImported(true)
  }, [address])
  const { t } = useTranslation('common')
  // The relative and z-10 should only apply to the sidebar itself
  const layout = (
    <div
      className={`${
        !lightMode ? 'dark stars-dark' : 'stars-light'
      } min-h-screen relative z-10`}
    >
      <Script src="https://cdn.splitbee.io/sb.js" />

      {/*Mobile menu top bar*/}
      <MobileMenuTop
        setSidebarOpen={setSidebarOpen}
        lightMode={lightMode}
        setLightMode={setLightMode}
      />

      {/* Static sidebar for desktop */}
      <div className="hidden md:fixed md:inset-y-0 md:flex md:w-60 md:flex-col lg:w-64">
        {/* Sidebar component*/}
        <div className="flex flex-grow flex-col overflow-y-auto bg-gradient-to-b from-zinc-50 via-blue-50 to-blue-100 pt-5 dark:from-slate-950 dark:via-gray-950 dark:to-slate-900">
          <a href="https://moondao.com">
            <div className="flex flex-shrink-0 items-center px-4">
              {lightMode ? <LogoBlack /> : <LogoWhite />}
            </div>
          </a>
          <div className="flex flex-grow flex-col pt-9 lg:pl-2">
            <nav className="flex-1 space-y-1 px-4">
              {navigation.map((item, i) => (
                <NavigationLink item={item} key={i} />
              ))}
            </nav>
          </div>

          {/*User BLOCKY, Connect buttons. Extract as separate component, replace Menu class (that menu class comes from DAISYUI, watch out for those baked-in classes*/}
          <ul className="menu p-4 hidden">
            {/*User Blocky with wallet*/}

            <>
              <ConnectWallet />
            </>

            {/*Language change button*/}
            <li className="mt-1 relative py-2">
              {currentLang === 'en' ? (
                <Link href="/" locale="zh">
                  <a
                    className="py-2 active text-black text-center"
                    onClick={(e) => changeLang(e, 'zh')}
                  >
                    <CNAsset />
                    <h1 className="mx-auto">切换到中文</h1>
                  </a>
                </Link>
              ) : (
                <Link href="/" locale="en">
                  <a
                    className="py-2 active text-black text-center"
                    onClick={(e) => changeLang(e, 'en')}
                  >
                    <CNAsset />
                    <h1 className="mx-auto">Switch to English</h1>
                  </a>
                </Link>
              )}
            </li>

            {address && !isTokenImported && (
              <li className="mt-1 relative">
                <a
                  className="active p-2 "
                  onClick={async () => {
                    const wasAdded = await importToken()
                    setIsTokenImported(wasAdded)
                  }}
                >
                  <h1 className="mx-auto">
                    {currentLang === 'en'
                      ? 'Import $MOONEY Token'
                      : '导入 $MOONEY 代币'}
                  </h1>
                </a>
              </li>
            )}
          </ul>

          {/*Color mode and Social links*/}
          <div className="flex flex-col pb-6 pl-7 lg:pl-9">
            <div className="pt-10 pb-10 pl-3"><ExternalLinks /></div>
            <ColorsAndSocials
              lightMode={lightMode}
              setLightMode={setLightMode}
            />
          </div>
        </div>



      </div>

      {/*The content, child rendered here*/}
      <main className="flex justify-center pb-24 md:ml-48">
        <PreferredNetworkWrapper address={address}>
          <section className="mt-20 flex flex-col lg:w-[80%] lg:px-14 xl:px-16 2xl:px-20">
            <span>{children}</span>
          </section>
        </PreferredNetworkWrapper>
      </main>

      {/* Pop up for connect
      <input type="checkbox" id="web3-modal" className="modal-toggle" />
      <label htmlFor="web3-modal" className="modal cursor-pointer">
        <label className="black-text modal-box relative" htmlFor="">
          <label
            htmlFor="web3-modal"
            className="btn btn-sm btn-circle btn-ghost absolute right-6 top-5"
          >
            ✕
          </label>
          {address ? (
            <>
              <h3 className="text-lg font-bold px-4">Account</h3>

              <p className="p-4">Connected to {account.connector?.name}</p>

              <ul className="menu bg-base-100 p-2 rounded-box">
                <li key="address">
                  <a
                    href={`https://etherscan.io/address/${address}`}
                    rel="noreferrer noopener"
                    target="_blank"
                  >
                    <UserIcon className="h-5 w-5" />
                    {ensName
                      ? ensName
                      : `${((address as string) ?? '').substring(
                          0,
                          6
                        )}...${((address as string) ?? '').slice(-4)}`}
                  </a>
                </li>

                <li key="logout">
                  <a onClick={() => disconnect()}>
                    <ArrowLeftOnRectangleIcon className="h-5 w-5" />
                    Log out
                  </a>
                </li>
              </ul>
            </>
          ) : (
            <>
              <h3 className="text-lg font-bold px-4">
                Sign in by connecting your account
              </h3>

              <p className="p-4">You can choose from these providers:</p>
              {connectError ? (
                <div className="alert alert-error mb-4">
                  <div>
                    <XCircleIcon className="h-5 w-5" />
                    <span>{connectError?.message || 'Failed to connect'}</span>
                  </div>
                </div>
              ) : (
                ''
              )}

              <ul className="menu bg-base-100 p-2 -m-2 rounded-box">
                {connectors.map((connector: any) => (
                  <li key={connector.id}>
                    <button
                      disabled={!connector.ready}
                      onClick={() => connect(connector)}
                    >
                      {(connectorIcons as Indexable)[connector.name] ? (
                        <div className="h-5 w-5">
                          <Image
                            src={(connectorIcons as Indexable)[connector.name]}
                          />
                        </div>
                      ) : (
                        <KeyIcon className="h-5 w-5" />
                      )}
                      {connector.name}
                      {!connector.ready && ' (unsupported)'}
                    </button>
                  </li>
                ))}
              </ul>

              <p className="px-4 mt-4">
                New to Ethereum?{' '}
                <a
                  href="https://ethereum.org/wallets/"
                  rel="noreferrer noopener"
                  target="_blank"
                  className="underline text-n3blue"
                >
                  Learn more about wallets
                </a>
                .<br />
                <br />
                By using this software, you agree to{' '}
                <a
                  href="https://github.com/Official-MoonDao/MoonDAO-app/blob/main/LICENSE.md"
                  rel="noreferrer noopener"
                  target="_blank"
                  className="underline text-n3blue"
                >
                  its terms of use
                </a>
                .
              </p>
            </>
          )}
        </label>
      </label> */}

      {/*Error Handling*/}
    </div>
  )

  return layout
}
