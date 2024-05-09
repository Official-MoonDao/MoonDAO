import {
  ChartBarIcon,
  DocumentIcon,
  InformationCircleIcon,
  NewspaperIcon,
} from '@heroicons/react/24/outline'
import useTranslation from 'next-translate/useTranslation'
import Head from '../components/layout/Head'
import { PageCards } from '../components/layout/PageCards'

export default function Info() {
  const sections: any = [
    {
      pages: [
        {
          name: 'News',
          description:
            'Weekly updates from MoonDAO about projects, proposals, open votes, and other initiatives. Be sure to subscribe to get updates in your inbox.',
          href: '/news',
          icon: NewspaperIcon,
        },
        {
          name: 'About',
          description:
            'Learn about how MoonDAO operates, how you can contribute or propose a project, read about our mission and vision, and more.',
          href: '/about',
          icon: DocumentIcon,
        },
        {
          name: 'Events',
          description:
            'Get started by attending one of our upcoming online events to find out how you can contribute to our plans by helping out on a project.',
          href: '/events',
          icon: InformationCircleIcon,
        },
        {
          name: 'Analytics',
          description:
            'Transparent data and analytics related to our treasury, token, transactions, and more.',
          href: '/analytics',
          icon: ChartBarIcon,
        },
      ],
    },
  ]

  const { t } = useTranslation('common')

  return (
    <div className="animate-fadeIn">
      <Head title={t('infoTitle')} description={t('infoDesc')} />

      {/*Section containing cards with links*/}
      <PageCards
        id="info-cards"
        sections={sections}
        title="Info"
        description={
          "Learn more about the Internet's Space Program with the latest news and project updates, dive into the documentation, join an upcoming online event, or explore transparent analytics about our treasury and transactions."
        }
      />
    </div>
  )
}
