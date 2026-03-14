import {
  CircleStackIcon,
  FolderIcon,
  HomeIcon,
  PlusIcon,
  RocketLaunchIcon,
  UserGroupIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline'
import { useMemo } from 'react'
import IconOrg from '@/components/assets/IconOrg'

export default function useNavigation(citizen: any) {
  return useMemo(() => {
    return [
      {
        name: citizen ? 'Dashboard' : 'Join',
        href: citizen ? '/' : '/citizen?create=true',
        icon: citizen ? HomeIcon : PlusIcon,
      },
      {
        name: 'Citizenship',
        href: '/network',
        icon: IconOrg,
        children: [
          { name: 'Become a Citizen', href: '/citizen' },
          { name: 'Submit a Contribution', href: '/contributions' },
          { name: 'Explore Citizens', href: '/network' },
        ],
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
        ],
      },
      {
        name: 'Launchpad',
        icon: RocketLaunchIcon,
        href: '/launch',
        children: [
          { name: 'Launchpad Explainer', href: '/launch' },
          { name: 'Support Overview Flight', href: '/mission/4' },
          { name: 'Fly with Frank', href: '/overview-vote' },
        ],
      },
      {
        name: 'Learn',
        icon: FolderIcon,
        href: '/info',
        children: [
          { name: 'News', href: '/news' },
          { name: 'Town Hall', href: '/townhall' },
          { name: 'Roadmap', href: '/roadmap' },
          { name: 'About', href: '/about' },
          { name: 'Events', href: '/events' },
          { name: 'Resources', href: '/resources' },
          { name: 'Constitution', href: '/constitution' },
        ],
      },
    ]
  }, [citizen])
}
