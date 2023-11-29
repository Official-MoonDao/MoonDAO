import {
  BuildingStorefrontIcon,
  ChartBarIcon,
  CalendarIcon,
  WalletIcon,
  ArrowsRightLeftIcon,
  LockClosedIcon
} from '@heroicons/react/24/outline'
import useTranslation from 'next-translate/useTranslation'
import Link from 'next/link'
import Head from '../components/layout/Head'
import { PageCards } from '../components/layout/PageCards'

export default function Home() {
  const { t } = useTranslation('common')

  const pages: any = [
    {
      name: 'Get $MOONEY',
      description: 'Join the MoonDAO community by acquiring our governance token $MOONEY on UniSwap.',
      href: 'https://app.uniswap.org/swap?inputCurrency=ETH&outputCurrency=0x20d4DB1946859E2Adb0e5ACC2eac58047aD41395&chain=mainnet',
      icon: WalletIcon,
      externalLink: true,
    },
    {
      name: 'Bridge $MOONEY',
      description: 'Reduce onchain gas fees by bridging $MOONEY from L1 to L2.',
      href: 'https://wallet.polygon.technology/polygon/bridge/deposit',
      icon: ArrowsRightLeftIcon,
      externalLink: true,
    },
    {
      name: 'Get Voting Power',
      description: 'Voting power is granted to stakeholders, stake $MOONEY to fully participate in co-governance and co-creation.',
      href: '/lock',
      icon: LockClosedIcon,
      externalLink: false,
    },
    {
      name: 'Marketplace',
      description: 'Buy and sell digital and space assets on the MoonDAO marketplace.',
      href: 'https://market.moondao.com/',
      icon: BuildingStorefrontIcon,
      externalLink: true,
    },
    {
      name: 'Analytics',
      description: 'Explore stats and analytics related to our Treasury, the Community, and $MOONEY governance token.',
      href: '/analytics',
      icon: ChartBarIcon,
      externalLink: false,
    },
    {
      name: 'Events',
      description: 'Get more involved by joining an upcoming scheduled event.',
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
