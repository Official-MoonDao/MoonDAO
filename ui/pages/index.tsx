import {
  BellIcon,
  LockClosedIcon,
  ChartBarSquareIcon,
  CalendarDaysIcon,
  FolderIcon,
  WalletIcon,
  ArrowsRightLeftIcon,
  BuildingStorefrontIcon,
  UserGroupIcon,
  PlusCircleIcon,
} from '@heroicons/react/24/outline'
import useTranslation from 'next-translate/useTranslation'
import Link from 'next/link'
import Head from '../components/layout/Head'

export default function Home() {
  const { t } = useTranslation('common')

  const pages: any = [
    {
      name: 'Buy $MOONEY',
      description: 'Acquire our governance token and join the community.',
      href: 'https://app.uniswap.org/#/swap?inputCurrency=ETH&outputCurrency=0x20d4DB1946859E2Adb0e5ACC2eac58047aD41395&chain=mainnet',
      icon: WalletIcon,
      externalLink: true,
    },
    {
      name: 'Bridge $MOONEY',
      description: 'Bridge $MOONEY from L1 to L2 for reduced gas fees.',
      href: 'https://wallet.polygon.technology/polygon/bridge/deposit',
      icon: ArrowsRightLeftIcon,
      externalLink: true,
    },
    {
      name: 'Get Voting Power',
      description: 'Stake $MOONEY to get voting power within MoonDAO.',
      href: '/lock',
      icon: LockClosedIcon,
      externalLink: false,
    },
    {
      name: 'Marketplace',
      description: 'Buy and sell NFTs on the MoonDAO marketplace.',
      href: 'https://market.moondao.com',
      icon: BuildingStorefrontIcon,
      externalLink: true,
    },
  ]

  return (
    <div className="animate-fadeIn">
      <Head title="Home" />
      {/*Features */}
      <div className="mt-3 px-5 lg:px-8 xl:px-9 py-12 lg:py-14 page-border-and-color w-[336px] sm:w-[400px] lg:mt-10 lg:w-full lg:max-w-[1080px] font-RobotoMono">
        <p className="text-white font-RobotoMono font-semibold text-sm lg:text-base text-center lg:text-left">
          Our base of operations
        </p>
        <h1 className="mt-2 lg:mt-3 leading-relaxed text-white font-GoodTimes text-center text-3xl lg:text-5xl xl:text-[54px] lg:text-left">
          The <br className="md:hidden" /> MoonDAO app
        </h1>

        <p className="mt-4 lg:mt-5 text-center lg:text-left font-RobotoMono text-base lg:text-lg text-white opacity-60">
          Here you can perform onchain operations related to the MoonDAO
          community.
        </p>

        <div
          id="home-card"
          className="mx-auto mt-8 max-w-2xl lg:mt-12 xl:mt-14 lg:max-w-none"
        >
          <dl
            id={'home-card-pages'}
            className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-2 xl:grid-cols-2"
          >
            {pages.map((page: any, i: number) => (
              <Link
                id={'#home-card-link' + i}
                href={page.href}
                key={page.name}
                target={page.externalLink ? '_blank' : ''}
                className="flex flex-col items-center text-center bg-[#071732] rounded-[6px] py-4 lg:py-5 hover:scale-105 transition-all duration-150"
                passHref
              >
                <dt className="flex items-center justify-center py-[10px] px-[16px] gap-x-3 bg-[#CBE4F7] text-[#1F212B] text-base font-bold w-3/4">
                  <page.icon
                    className="h-5 w-5 stroke-2 flex-none text-[#1F212B]"
                    aria-hidden="true"
                  />
                  {page.name}
                </dt>
                <dd className="mt-4 lg:mt-5 xl:mt-6 text-base leading-7 w-3/4 text-white font-medium lg:text-left">
                  <p className="">{page.description}</p>
                </dd>
              </Link>
            ))}
          </dl>
        </div>
      </div>
    </div>
  )
}
