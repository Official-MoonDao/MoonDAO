import {
  GlobeAmericasIcon,
  RocketLaunchIcon,
  ShieldCheckIcon,
  TicketIcon,
} from '@heroicons/react/24/outline'
import useTranslation from 'next-translate/useTranslation'
import { useRouter } from 'next/router'
import Head from '../../components/layout/Head'
import { PageCards } from '../../components/layout/PageCards'

export default function Marketplace() {
  const router = useRouter()

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
    // {
    //   sectionName: 'Digital Assets',
    //   pages: [
    //     {
    //       name: 'MoonDAO Shields',
    //       description:
    //         'Grab these one of a kind digital collectibles and be a part of the FIRST MoonDAO collection.',
    //       icon: ShieldCheckIcon,
    //       href: '/marketplace/collection/0xE71f58663f80b61f5D127D9DE9d554ca66dED5f1',
    //     },
    //   ],
    // },
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
