import {
  LockClosedIcon,
  WalletIcon,
  ArrowsRightLeftIcon,
  BuildingStorefrontIcon,
  ChartBarIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline'
import useTranslation from 'next-translate/useTranslation'
import Link from 'next/link'
import Head from '../components/layout/Head'
import { PageCards } from '../components/layout/PageCards'

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
    {
      name: 'Analytics',
      description: 'View MoonDAO analytics.',
      href: '/analytics',
      icon: ChartBarIcon,
      externalLink: false,
    },
    {
      name: 'Events',
      description: 'View scheduled MoonDAO events.',
      href: '/events',
      icon: CalendarIcon,
      externalLink: false,
    },
  ]

  return (
    <div className="animate-fadeIn">
      <Head title="Home" />
      {/*Features */}

      <PageCards
        id={'home-cards'}
        pages={pages}
        header={'Our base of operations'}
        title={'The MoonDAO app'}
        description={
          'Here you can perform onchain operations related to the MoonDAO community.'
        }
      />
    </div>
  )
}
