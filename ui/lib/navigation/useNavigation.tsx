import {
  CircleStackIcon,
  FolderIcon,
  HomeIcon,
  MoonIcon,
  PlusIcon,
  RocketLaunchIcon,
  UserGroupIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline'
import { useMemo } from 'react'
import { useHiddenOnProduction } from 'const/flags'
import IconOrg from '@/components/assets/IconOrg'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'

export default function useNavigation(citizen: any) {
  // Moon Base Zero is merged to main but not public yet, so its entry drops out
  // on the live production site while staying present everywhere we develop.
  const hideUnreleased = useHiddenOnProduction()
  return useMemo(() => {
    const isCitizen = !!citizen?.metadata?.name
    const citizenshipChildren = [
      ...(isCitizen
        ? [
            {
              name: 'Your Profile',
              href: `/citizen/${generatePrettyLinkWithId(citizen.metadata.name, citizen.metadata.id)}`,
            },
          ]
        : [{ name: 'Become a Citizen', href: '/citizen' }]),
      ...(isCitizen
        ? [{ name: 'Create a Team', href: '/team' }]
        : [{ name: 'Join the Network', href: '/join' }]),
      { name: 'Submit a Contribution', href: '/contributions' },
      { name: 'View Citizens', href: '/network?tab=citizens' },
      { name: 'Explore the Map', href: '/map' },
    ]

    return [
      {
        name: citizen ? 'Dashboard' : 'Join',
        href: citizen ? '/' : '/citizen?create=true',
        icon: citizen ? HomeIcon : PlusIcon,
      },
      {
        name: 'Citizens',
        href: '/network',
        icon: IconOrg,
        children: citizenshipChildren,
      },
      {
        name: 'Teams',
        href: '/network?tab=teams',
        icon: UserGroupIcon,
        dynamicChildren: 'Teams' as const,
      },
      {
        name: 'Projects',
        icon: WrenchScrewdriverIcon,
        href: '/projects',
        dynamicChildren: 'Projects' as const,
      },
      ...(!hideUnreleased
        ? [
            {
              name: 'Moon Base Zero',
              icon: MoonIcon,
              href: '/moonbase',
            },
          ]
        : []),
      {
        name: '$MOONEY',
        icon: CircleStackIcon,
        href: '/mooney',
        children: [
          {
            name: 'Get $MOONEY',
            href: '/get-mooney',
          },
          { name: 'Lock $MOONEY', href: '/lock' },
          { name: 'Bridge $MOONEY', href: '/bridge' },
          { name: 'Token Overview', href: '/mooney' },
          { name: 'Governance Overview', href: '/governance' },
          { name: 'Governance Proposals', href: '/governance-proposals' },
        ],
      },
      {
        name: 'Send Frank to Space',
        icon: RocketLaunchIcon,
        href: '/launch',
        children: [
          { name: 'Fundraiser', href: '/mission/4' },
          { name: 'Fly with Frank Leaderboard', href: '/frank?tab=leaderboard' },
          { name: 'Path Forward Vote', href: '/overview-path-vote' },
          { name: 'Launchpad Explainer', href: '/launch' },
        ],
      },
      {
        name: 'Learn',
        icon: FolderIcon,
        href: '/info',
        children: [
          { name: 'News', href: '/news' },
          { name: 'Press', href: '/press' },
          { name: 'Town Hall', href: '/townhall' },
          { name: 'Roadmap', href: '/roadmap' },
          { name: 'Documentation', href: '/docs' },
          { name: 'Resources', href: '/resources' },
          { name: 'Constitution', href: '/constitution' },
        ],
      },
    ]
  }, [citizen, hideUnreleased])
}
