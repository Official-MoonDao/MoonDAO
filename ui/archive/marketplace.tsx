import {
  GlobeAmericasIcon,
  RocketLaunchIcon,
  TicketIcon,
} from '@heroicons/react/24/outline'
import useTranslation from 'next-translate/useTranslation'
import Head from '@/components/layout/Head'
import { PageCards } from '@/components/layout/PageCards'

export default function Marketplace() {
  const sections: any = [
    {
      sectionName: 'Missions',
      pages: [
        {
          name: 'Ticket To Space',
          description:
            'We randomly selected one member of the MoonDAO community to win an opportunity to go to space!',
          href: '/sweepstakes',
          icon: RocketLaunchIcon,
        },
        {
          name: 'Zero Gravity',
          description:
            "Experience lunar and zero gravity alongside NASA astronauts as part of MoonDAO's astronaut training program.",
          href: '/zero-gravity',
          icon: TicketIcon,
        },
        {
          name: 'LifeShip',
          description:
            'Be a part of an off-world backup of life on Earth by sending your DNA to the surface on the Moon. Moondao has partnered with LifeShip.',
          href: '/lifeship',
          icon: GlobeAmericasIcon,
        },
      ],
    },
  ]

  const { t } = useTranslation('common')

  return (
    <div className="animate-fadeIn">
      <Head title={t('marketplaceTitle')} description={t('marketplaceDesc')} />

      {/*Section containing cards with links*/}
      <PageCards
        id="marketplace-cards"
        sections={sections}
        title="Marketplace"
        description={
          'Your gateway to digital collectibles, space training experiences, products, and once-in-a-lifetime opportunities like our Ticket to Space sweepstakes.'
        }
      />
    </div>
  )
}
