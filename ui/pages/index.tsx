import {
  HomeIcon,
  HomeModernIcon,
  BellIcon,
  WalletIcon,
  LockClosedIcon,
  TableCellsIcon,
  ChartPieIcon,
  RocketLaunchIcon,
  CalendarDaysIcon,
  FolderIcon,
} from '@heroicons/react/24/outline'
import { useAddress } from '@thirdweb-dev/react'
import useTranslation from 'next-translate/useTranslation'
import Link from 'next/link'
import Head from '../components/layout/Head'

export default function Home() {
  const address = useAddress()
  const { t } = useTranslation('common')

  const pages = [
    {
      name: 'Get voting power',
      description: 'Lock MOONEY to get voting power within MoonDAO.',
      href: '#',
      icon: LockClosedIcon,
    },
    {
      name: 'Announcements',
      description: 'Check the latest announcements.',
      href: '#',
      icon: BellIcon,
    },
    {
      name: 'Proposals',
      description: 'Read all the proposals and vote on them.',
      href: '#',
      icon: FolderIcon,
    },
    {
      name: 'Treasury',
      description:
        'Check the assets owned by MoonDAO and the latest transactions from the treasury.',
      href: '#',
      icon: WalletIcon,
    },
    {
      name: 'Analytics',
      description:
        'See information related to the MOONEY holder distribution and staking.',
      href: '#',
      icon: TableCellsIcon,
    },
    {
      name: 'Calendar',
      description: 'See all the scheduled events and meetings.',
      href: '#',
      icon: CalendarDaysIcon,
    },
  ]

  return (
    <div className="animate-fadeIn">
      <Head title="Home" />
      {/*Features */}
      <div className="component-background py-12 lg:py-20 xl:py-24 mt-3 w-[336px] rounded-2xl sm:w-[400px] lg:mt-10 lg:w-full lg:max-w-[1080px] border-detail-light dark:border-detail-dark border lg:border-2 shadow-md shadow-detail-light dark:shadow-detail-dark ">
        <div id="home-card" className="mx-auto max-w-7xl px-6 lg:px-8">
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
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
              {pages.map((page) => (
                <div
                  key={page.name}
                  className="flex flex-col  items-center text-center"
                >
                  <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-title-light dark:text-title-dark">
                    <page.icon
                      className="h-5 w-5 flex-none text-moon-blue dark:text-moon-gold"
                      aria-hidden="true"
                    />
                    {page.name}
                  </dt>
                  <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-light-text dark:text-dark-text">
                    <p className="flex-auto">{page.description}</p>
                    <p className="mt-6">
                      <Link
                        href={page.href}
                        className="text-sm font-semibold leading-6 text-detail-light dark:text-detail-dark hover:text-moon-blue hover:dark:text-moon-gold hover:scale-105 inline-block transition-all duration-105"
                      >
                        Learn more <span aria-hidden="true">→</span>
                      </Link>
                    </p>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
