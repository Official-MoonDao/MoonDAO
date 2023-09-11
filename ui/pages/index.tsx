import {
  BellIcon,
  LockClosedIcon,
  ChartBarSquareIcon,
  CalendarDaysIcon,
  FolderIcon,
  WalletIcon,
  ArrowsRightLeftIcon,
  BuildingStorefrontIcon,
} from '@heroicons/react/24/outline'
import useTranslation from 'next-translate/useTranslation'
import Link from 'next/link'
import Head from '../components/layout/Head'

export default function Home() {
  const { t } = useTranslation('common')

  const pages = [
    {
      name: 'Buy Mooney',
      description: 'Lock MOONEY to get voting power within MoonDAO.',
      href: 'https://app.uniswap.org/#/swap?inputCurrency=ETH&outputCurrency=0x20d4DB1946859E2Adb0e5ACC2eac58047aD41395&chain=mainnet',
      icon: WalletIcon,
      externalLink: true,
    },
    {
      name: 'Get voting power',
      description: 'Lock MOONEY to get voting power within MoonDAO.',
      href: '/lock',
      icon: LockClosedIcon,
      externalLink: false,
    },
    {
      name: 'Bridge Mooney to L2',
      description:
        'Bridge your MOONEY to polygon using the native bridge for reduced gas fees.',
      href: 'https://wallet.polygon.technology/',
      icon: ArrowsRightLeftIcon,
      externalLink: true,
    },
    {
      name: 'Announcements',
      description: 'Check the latest announcements.',
      href: '/announcements',
      icon: BellIcon,
      externalLink: false,
    },
    {
      name: 'Analytics',
      description: 'See information related to Voting Power and the Treasury.',
      href: '/analytics',
      icon: ChartBarSquareIcon,
      externalLink: false,
    },
    {
      name: 'Calendar',
      description: 'See all the scheduled events and meetings.',
      href: '/calendar',
      icon: CalendarDaysIcon,
      externalLink: false,
    },
    {
      name: 'Marketplace',
      description: 'Buy and sell NFTs on the MoonDAO marketplace.',
      href: 'https://marketplace.moondao.com',
      icon: BuildingStorefrontIcon,
      externalLink: true,
    },
  ]

  return (
    <div className="animate-fadeIn">
      <Head title="Home" />
      {/*Features */}
      <div className="component-background py-12 lg:py-20 mt-3 w-[336px] rounded-2xl sm:w-[400px] lg:mt-10 lg:w-full lg:max-w-[1080px] border-detail-light dark:border-detail-dark border lg:border-2 shadow-md shadow-detail-light dark:shadow-detail-dark ">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-base font-semibold leading-7 text-moon-blue dark:text-moon-gold">
              Our base of operations
            </h2>
            <h1 className="mt-2 text-3xl font-GoodTimes font-bold tracking-wide leading-relaxed text-title-light dark:text-title-dark sm:text-4xl xl:text-5xl">
              The <br className="md:hidden" /> MoonDAO app
            </h1>
            <p className="mt-6 text-lg leading-8 text-light-text dark:text-dark-text dark:text-opacity-80">
              Here you can perform on-chain operations related to the MoonDAO
              community and get updated about the latest announcements and
              events.
            </p>
          </div>
          <div
            id="home-card"
            className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none"
          >
            <dl
              id={'home-card-pages'}
              className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-2 xl:grid-cols-3"
            >
              {pages.map((page, i) => (
                <Link
                  id={'#home-card-link' + i}
                  href={page.href}
                  key={page.name}
                  target={page.externalLink ? '_blank' : ''}
                  className="flex flex-col items-center text-center lg:text-left lg:justify-start lg:items-start border border-detail-light dark:border-detail-dark pl-3 pr-2 lg:pl-4 lg:pr-3 rounded-2xl py-3 bg-gradient-to-b hover:from-blue-500 hover:to-blue-800 dark:hover:border-orange-500 dark:hover:from-stronger-dark dark:hover:to-orange-600 group transition-all duration-150 shadow shadow-detail-light dark:shadow-detail-dark dark:hover:shadow-orange-300 hover:scale-105"
                >
                  <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-title-light dark:text-title-dark lg:tracking-wider group-hover:text-blue-50 dark:group-hover:text-white">
                    <page.icon
                      className="h-6 w-6 lg:h-8 lg:w-8 flex-none text-moon-blue dark:text-moon-gold group-hover:text-white dark:group-hover:text-yellow-200"
                      aria-hidden="true"
                    />
                    {page.name}
                  </dt>
                  <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-light-text dark:text-dark-text group-hover:text-white group-hover:text-opacity-90">
                    <p className="flex-auto">{page.description}</p>
                    <div className="mt-6">
                      <p className="text-sm font-semibold leading-6 text-detail-light dark:text-detail-dark inline-block transition-all duration-105 group-hover:text-white group-hover:scale-110">
                        Go there <span aria-hidden="true">→</span>
                      </p>
                    </div>
                  </dd>
                </Link>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
