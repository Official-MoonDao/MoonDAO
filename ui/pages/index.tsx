import {
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
