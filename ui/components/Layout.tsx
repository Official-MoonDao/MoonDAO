import {
  UserAddIcon,
  SparklesIcon,
  CurrencyDollarIcon,
  HomeIcon,
  NewspaperIcon,
  KeyIcon,
  UserIcon,
  LogoutIcon,
  GiftIcon,
  XCircleIcon,
  MenuIcon,
  LockClosedIcon,
  PlusIcon,
  ViewGridIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
} from '@heroicons/react/outline'
import useTranslation from 'next-translate/useTranslation'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Script from 'next/script'
import React from 'react'
import { useState, useEffect } from 'react'
// @ts-expect-error ts-migrate(7016) FIXME: Could not find a declaration file for module 'reac... Remove this comment to see the full error message
import Blockies from 'react-blockies'
import { isToken } from 'typescript'
import { useConnect, useEnsName, useDisconnect } from 'wagmi'
import { MOONEYToken } from '../lib/config'
import { connectorIcons } from '../lib/connectors'
import { importToken } from '../lib/import-token'
import { useAccount } from '../lib/use-wagmi'
import Logo from '../public/Original_White.png'
import ErrorCard from './ErrorCard'
import { useErrorContext } from './ErrorProvider'
import PreferredNetworkWrapper from './PreferredNetworkWrapper'

type Indexable = {
  [key: string]: any
}

const navigation = [
  {
    name: 'home',
    href: '/',
    icon: <ViewGridIcon className="h-5 w-5" />,
  },
  {
    name: 'lockTokens',
    href: '/lock',
    icon: <LockClosedIcon className="h-5 w-5" />,
  },
  {
    name: 'buyMOONEY',
    href: `https://app.uniswap.org/#/swap?inputCurrency=ETH&outputCurrency=0x20d4DB1946859E2Adb0e5ACC2eac58047aD41395&chain=mainnet`,
    icon: <PlusIcon className="h-5 w-5" />,
  },
  {
    name: 'governance',
    href: `https://snapshot.org/#/tomoondao.eth`,
    icon: <UserAddIcon className="h-5 w-5" />,
  },
  {
    name: 'homepage',
    href: 'https://moondao.com',
    icon: <HomeIcon className="h-5 w-5" />,
  },
  {
    name: 'docs',
    href: 'https://moondao.com/docs/introduction',
    icon: <NewspaperIcon className="h-5 w-5" />,
  },
]

export default function Layout({ children }: any) {
  const router = useRouter()
  const { connectors, connect, error: connectError } = useConnect()
  const { data: account } = useAccount()

  const { data: ensName } = useEnsName({ address: account?.address ?? '' })
  const { disconnect } = useDisconnect()
  const [nav, setNav] = useState(navigation)
  const errorContext = useErrorContext()

  const [currentLang, setCurrentLang] = useState(router.locale)
  const [isTokenImported, setIsTokenImported] = useState(false)
  const changeLang = (e: any, lang: any) => {
    e.preventDefault()
    setCurrentLang(lang)
    router.push(router.pathname, router.pathname, { locale: lang })
  }
  useEffect(() => {
    if (localStorage.getItem('MOONEY_isImported')) setIsTokenImported(true)
  }, [account])
  const { t } = useTranslation('common')

  const layout = (
    <div className="mx-auto font-display">
      <Script src="https://cdn.splitbee.io/sb.js" />
      <div className="h-screen">
        <div className="navbar yellow-text bg-black border-slate-100 border-b-2 py-0 pl-0 lg:hidden sticky z-10">
          <div className="navbar-start border-slate-100 pl-0">
            <div className="w-80 border-slate-100 py-4 box-content">
              <div className="pl-6 pt-2 cursor-pointer">
                <div className="flex-none hidden lg:block">
                  <Link href="/" passHref>
                    <a>
                      <Image alt="MoonDAO Logo" src={Logo} />
                    </a>
                  </Link>
                </div>
                <div className="flex-none lg:hidden">
                  <label
                    htmlFor="side-drawer"
                    className="btn btn-square btn-ghost"
                  >
                    <MenuIcon className="h-8 w-8" />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="drawer drawer-mobile stars-bg">
          <input id="side-drawer" type="checkbox" className="drawer-toggle" />
          <div className="drawer-content fixed top-0 left-0 right-0 bottom-0 lg:static pt-24 lg:pt-0 z-0 max-h-screen">
            <div className="flex flex-col w-full h-full">
              <PreferredNetworkWrapper>
                <div className="hero h-full bg-repeat">
                  <div className="hero-content">{children}</div>
                </div>
              </PreferredNetworkWrapper>
            </div>
          </div>
          <div className="drawer-side bg-black lg:bg-transparent">
            <label
              htmlFor="side-drawer"
              className="drawer-overlay z-10"
            ></label>
            <div className="sidebar w-80 flex flex-col justify-between pb-24 lg:pb-0 overflow-y-auto drop-shadow-md min-h-screen bg-black lg:bg-transparent">
              <div className="mt-6 py-4 hidden lg:block">
                <div className="px-8 pt-2 cursor-pointer">
                  <Link href="/" passHref>
                    <a>
                      <Image src={Logo} />
                    </a>
                  </Link>
                </div>
              </div>
              <ul className="menu scrollbar-hide p-4 overflow-y-auto text-base-400 grow font-GoodTimes">
                {nav.map((item: any) => (
                  <li
                    className="mt-1 relative py-2"
                    onClick={() =>
                      // @ts-expect-error ts-migrate(2531) FIXME: Object is possibly 'null'.
                      (document.getElementById('side-drawer').checked = false)
                    }
                    key={item.href}
                  >
                    {item.href.charAt(0) === '/' ? (
                      <Link href={item.href}>
                        <a
                          className={`py-4 ${
                            router.pathname == item.href ? 'active' : ''
                          }`}
                        >
                          {item.icon}
                          {t(item.name)}
                          <ChevronRightIcon className="h-5 w-5 absolute right-4 opacity-50" />
                        </a>
                      </Link>
                    ) : (
                      <a
                        className={`py-4 ${
                          router.pathname == item.href ? 'active' : ''
                        }`}
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {item.icon}
                        {t(item.name)}
                        <ExternalLinkIcon className="h-5 w-5 absolute right-4 opacity-50" />
                      </a>
                    )}
                  </li>
                ))}

                {/* <li className="relative py-2 px-2">
                  <select className="">
                    <option>{currentLang}</option>
                  </select>
                </li> */}
              </ul>
              <ul className="menu p-4 text-base-400">
                {account?.address ? (
                  <li>
                    <label htmlFor="web3-modal">
                      <div className="mask mask-circle cursor-pointer">
                        <Blockies seed={account?.address} size={12} />
                      </div>
                      {ensName
                        ? ensName
                        : `${((account.address as string) ?? '').substring(
                            0,
                            6
                          )}...${account.address.slice(-4)}`}
                      <ChevronDownIcon className="h-5 w-5 absolute right-4 opacity-50" />
                    </label>
                  </li>
                ) : (
                  <li>
                    <label
                      htmlFor="web3-modal"
                      className="btn btn-primary normal-case font-medium text-black modal-button"
                    >
                      {t('connectWallet')}
                    </label>
                  </li>
                )}
                <li className="mt-1 relative py-2">
                  {currentLang === 'en' ? (
                    <Link href="/" locale="zh">
                      <a
                        className="py-2 active text-black text-center"
                        onClick={(e) => changeLang(e, 'zh')}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="w-6 h-6"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802"
                          />
                        </svg>
                        <h1 className="mx-auto">切换到中文</h1>
                      </a>
                    </Link>
                  ) : (
                    <Link href="/" locale="en">
                      <a
                        className="py-2 active text-black text-center"
                        onClick={(e) => changeLang(e, 'en')}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="w-6 h-6"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802"
                          />
                        </svg>
                        <h1 className="mx-auto">Switch to English</h1>
                      </a>
                    </Link>
                  )}
                </li>

                {account && !isTokenImported && (
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
            </div>
          </div>
        </div>
      </div>

      <input type="checkbox" id="web3-modal" className="modal-toggle" />

      <label htmlFor="web3-modal" className="modal cursor-pointer">
        <label className="black-text modal-box relative" htmlFor="">
          <label
            htmlFor="web3-modal"
            className="btn btn-sm btn-circle btn-ghost absolute right-6 top-5"
          >
            ✕
          </label>

          {account ? (
            <>
              <h3 className="text-lg font-bold px-4">Account</h3>

              <p className="p-4">Connected to {account.connector?.name}</p>

              <ul className="menu bg-base-100 p-2 -m-2 rounded-box">
                <li key="address">
                  <a
                    href={`https://etherscan.io/address/${account.address}`}
                    rel="noreferrer noopener"
                    target="_blank"
                  >
                    <UserIcon className="h-5 w-5" />
                    {ensName
                      ? ensName
                      : `${((account.address as string) ?? '').substring(
                          0,
                          6
                        )}...${((account.address as string) ?? '').slice(-4)}`}
                  </a>
                </li>

                <li key="logout">
                  <a onClick={() => disconnect()}>
                    <LogoutIcon className="h-5 w-5" />
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
      </label>
      {errorContext?.errors ? (
        <div className="fixed md:right-8 md:bottom-8 md:left-auto bottom-0 left-0 right-0">
          <div className="stack max-w-sm">
            {errorContext.errors.map((error: any) => (
              <ErrorCard error={error} key={error.key} />
            ))}
          </div>
        </div>
      ) : (
        ''
      )}
    </div>
  )

  return layout
}
