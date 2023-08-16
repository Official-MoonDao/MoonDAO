import {
  BellIcon,
  WalletIcon,
  LockClosedIcon,
  ChartBarSquareIcon,
  CalendarDaysIcon,
  FolderIcon,
} from '@heroicons/react/24/outline'
import { useAddress } from '@thirdweb-dev/react'
import useTranslation from 'next-translate/useTranslation'
import Link from 'next/link'
import Head from '../components/layout/Head'

export default function Home() {
  const { t } = useTranslation('common')

  const pages = [
    {
      name: 'Get voting power',
      description: 'Lock MOONEY to get voting power within MoonDAO.',
      href: '/lock',
      icon: LockClosedIcon,
    },
    {
      name: 'Announcements',
      description: 'Check the latest announcements.',
      href: '/dashboard/announcements',
      icon: BellIcon,
    },
    {
      name: 'Proposals',
      description: 'Read all the proposals and vote on them.',
      href: '/dashboard/proposals',
      icon: FolderIcon,
    },
    {
      name: 'Analytics',
      description: 'See information related to Voting Power and the Treasury.',
      href: '/dashboard/analytics',
      icon: ChartBarSquareIcon,
    },
    {
      name: 'Calendar',
      description: 'See all the scheduled events and meetings.',
      href: '/dashboard/calendar',
      icon: CalendarDaysIcon,
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
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-2 xl:grid-cols-3">
              {pages.map((page) => (
                <div
                  key={page.name}
                  className="flex flex-col items-center text-center lg:text-left lg:justify-start lg:items-start lg:border lg:border-detail-light dark:lg:border-detail-dark lg:pl-4 lg:pr-3 lg:rounded-2xl lg:py-3 lg:bg-gradient-to-b lg:hover:from-blue-500 lg:hover:to-blue-800 dark:lg:hover:from-slate-950 dark:lg:hover:to-black group transition-all duration-150 lg:shadow lg:shadow-detail-light dark:lg:shadow-detail-dark lg:hover:scale-105"
                >
                  <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-title-light dark:text-title-dark lg:tracking-wider lg:group-hover:text-blue-50 dark:lg:group-hover:text-detail-dark">
                    <page.icon
                      className="h-5 w-5 flex-none text-moon-blue dark:text-moon-gold lg:group-hover:text-white dark:lg:group-hover:text-moon-gold"
                      aria-hidden="true"
                    />
                    {page.name}
                  </dt>
                  <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-light-text dark:text-dark-text lg:group-hover:text-white lg:group-hover:text-opacity-80">
                    <p className="flex-auto">{page.description}</p>
                    <p className="mt-6">
                      <Link
                        href={page.href}
                        className="text-sm font-semibold leading-6 text-detail-light dark:text-detail-dark hover:text-moon-blue hover:dark:text-moon-gold inline-block transition-all duration-105 lg:group-hover:text-white dark:lg:group-hover:text-moon-gold lg:group-hover:scale-110"
                      >
                        Go there <span aria-hidden="true">→</span>
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
